import datetime
import json
import logging
import os
import random
import re
import secrets

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import crypto, models, photo_washer, review_writer, schemas

logger = logging.getLogger(__name__)

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
ALLOWED_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


# --- Reviewer ---

def get_reviewers(db: Session) -> list[models.Reviewer]:
    return db.query(models.Reviewer).order_by(models.Reviewer.id).all()


def get_reviewer(db: Session, reviewer_id: int) -> models.Reviewer | None:
    return db.query(models.Reviewer).filter(models.Reviewer.id == reviewer_id).first()


def get_reviewer_by_contact(db: Session, phone: str) -> models.Reviewer | None:
    return db.query(models.Reviewer).filter(models.Reviewer.contact_info == phone).first()


def get_reviewer_by_kakao_id(db: Session, kakao_id: str) -> models.Reviewer | None:
    return db.query(models.Reviewer).filter(models.Reviewer.kakao_id == kakao_id).first()


def get_receipt_times_for_account_on_date(
    db: Session, account_id: int, date, exclude_task_id: int | None = None
) -> list:
    """같은 계정이 같은 날짜에 이미 확정한 영수증 시간들 — 물리적으로 불가능한(4시간 이내)
    시간이 새로 배정되지 않도록 비교하는 기준."""
    query = db.query(models.Task.receipt_time).filter(
        models.Task.review_account_id == account_id,
        models.Task.naver_available_date == date,
        models.Task.receipt_time.isnot(None),
    )
    if exclude_task_id is not None:
        query = query.filter(models.Task.id != exclude_task_id)
    return [row[0] for row in query.all()]


def issue_otp(db: Session, reviewer: models.Reviewer) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    reviewer.otp_code = code
    reviewer.otp_expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
    db.commit()
    return code


def verify_otp(db: Session, reviewer: models.Reviewer, code: str) -> bool:
    if not reviewer.otp_code or not reviewer.otp_expires_at:
        return False
    if datetime.datetime.utcnow() > reviewer.otp_expires_at:
        return False
    if not secrets.compare_digest(reviewer.otp_code, code):
        return False
    reviewer.otp_code = None
    reviewer.otp_expires_at = None
    db.commit()
    return True


def _normalize_phone(raw: str | None) -> str | None:
    """관리자 계정의 연락처는 항상 실제 전화번호라, 어떤 형태로 입력해도
    010-0000-0000 식으로 통일한다. 리뷰어 관리 쪽 연락처는 카톡ID 등
    전화번호가 아닌 값도 들어올 수 있어서 이 함수를 쓰지 않는다 — 여기서도
    숫자만 뽑았을 때 "0"으로 시작하는 국내 전화번호 모양이 아니면 원본을
    그대로 둔다(억지로 깨뜨리지 않음)."""
    if not raw:
        return raw
    digits = re.sub(r"\D", "", raw)
    if not digits or not digits.startswith("0"):
        return raw.strip()
    if len(digits) == 11:
        return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
    if len(digits) == 10:
        if digits.startswith("02"):
            return f"{digits[:2]}-{digits[2:6]}-{digits[6:]}"
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    if len(digits) == 9 and digits.startswith("02"):
        return f"{digits[:2]}-{digits[2:5]}-{digits[5:]}"
    return raw.strip()


def create_reviewer(db: Session, data: schemas.ReviewerCreate) -> models.Reviewer:
    contact_info = data.contact_info
    if data.category == "admin":
        contact_info = _normalize_phone(contact_info)
    reviewer = models.Reviewer(
        name=data.name,
        category=data.category,
        memo=data.memo,
        contact_info=contact_info,
        is_active=data.is_active,
        region=data.region,
        blog_url=data.blog_url,
        blog_index=data.blog_index,
        age_group=data.age_group,
        gender=data.gender,
        birth_date=data.birth_date,
    )
    db.add(reviewer)
    db.commit()
    db.refresh(reviewer)
    return reviewer


def update_reviewer(
    db: Session, reviewer: models.Reviewer, data: schemas.ReviewerUpdate
) -> models.Reviewer:
    if data.name is not None:
        reviewer.name = data.name
    if data.category is not None:
        reviewer.category = data.category
    if data.memo is not None:
        reviewer.memo = data.memo
    if data.contact_info is not None:
        category = data.category if data.category is not None else reviewer.category
        reviewer.contact_info = (
            _normalize_phone(data.contact_info) if category == "admin" else data.contact_info
        )
    if data.is_active is not None:
        reviewer.is_active = data.is_active
    if data.region is not None:
        reviewer.region = data.region
    if data.blog_url is not None:
        reviewer.blog_url = data.blog_url
    if data.blog_index is not None:
        reviewer.blog_index = data.blog_index
    if data.age_group is not None:
        reviewer.age_group = data.age_group
    if data.gender is not None:
        reviewer.gender = data.gender
    if data.birth_date is not None:
        reviewer.birth_date = data.birth_date
    db.commit()
    db.refresh(reviewer)
    return reviewer


def reviewer_to_out(reviewer: models.Reviewer) -> schemas.ReviewerOut:
    """ReviewerOut.accounts는 그냥 model_validate만 하면 계정의 password가 항상
    None이 된다 — ORM 컬럼명이 password_encrypted라 자동 매핑이 안 되기 때문
    (account_to_out과 동일한 이유). 리뷰어를 반환하는 라우터는 전부 이 함수를
    거쳐야 계정 비밀번호가 복호화된 채로 나간다."""
    out = schemas.ReviewerOut.model_validate(reviewer)
    out.accounts = [account_to_out(a) for a in reviewer.accounts]
    return out


def import_reviewers(
    db: Session, rows: list[dict], category: str = "reviewer"
) -> schemas.ReviewerImportResult:
    """Bulk-import from a name/contact(+체험단: region/age/gender) sheet, no
    accounts (that sheet has no account/URL data). Imported reviewers start
    inactive (연락불가) — the admin reviews and activates who's actually
    reachable before they become eligible for task assignment."""
    created = 0
    skipped_duplicate = 0
    skipped_invalid = 0
    # DB 세션이 autoflush=False라서 db.query()는 이번 업로드에서 이미 db.add()했지만
    # 아직 flush 안 된 행을 못 본다 — 즉 같은 파일 안에 같은 연락처가 두 번 있으면
    # DB 조회만으로는 못 걸러진다. 그래서 이번 배치에서 본 연락처를 따로 기억해둔다.
    seen_contacts: set[str] = set()

    for row in rows:
        name = row.get("name")
        if not name:
            skipped_invalid += 1
            continue

        contact_info = row.get("contact_info")
        if contact_info:
            if contact_info in seen_contacts:
                skipped_duplicate += 1
                continue
            existing = (
                db.query(models.Reviewer)
                .filter(models.Reviewer.contact_info == contact_info)
                .first()
            )
            if existing:
                skipped_duplicate += 1
                continue
            seen_contacts.add(contact_info)

        reviewer = models.Reviewer(
            name=name,
            category=category,
            memo=row.get("note"),
            contact_info=contact_info,
            is_active=False,
            region=row.get("region") if category == "experience" else None,
            blog_url=row.get("blog_url") if category == "experience" else None,
            blog_index=row.get("blog_index") if category == "experience" else None,
            age_group=row.get("age_group") if category == "experience" else None,
            gender=row.get("gender") if category == "experience" else None,
        )
        db.add(reviewer)
        created += 1

    db.commit()
    return schemas.ReviewerImportResult(
        created=created,
        skipped_duplicate=skipped_duplicate,
        skipped_invalid=skipped_invalid,
    )


def import_admin_accounts(db: Session, rows: list[dict]) -> schemas.ReviewerImportResult:
    """관리자 계정 일괄등록 — 이름/계정아이디가 둘 다 있는 행마다 Reviewer(category='admin')
    와 그 계정을 한 번에 만든다(화면의 "관리자 계정 추가" 폼 1회 제출과 동일한 동작).
    기존 리뷰어 일괄등록(import_reviewers)과 달리 계정까지 같이 생기므로 여기서만 쓰는
    별도 함수로 분리했다."""
    created = 0
    skipped_duplicate = 0
    skipped_invalid = 0
    # import_reviewers와 동일한 이유(autoflush=False)로, 같은 파일 안에서 계정아이디가
    # 두 번 나오는 경우까지 걸러내려면 DB 조회만으로는 부족해서 이번 배치에서 본
    # 계정아이디를 따로 기억해둔다.
    seen_labels: set[str] = set()

    for row in rows:
        name = row.get("name")
        label = row.get("label")
        if not name or not label:
            skipped_invalid += 1
            continue

        if label in seen_labels:
            skipped_duplicate += 1
            continue
        contact_info = row.get("contact_info")
        existing_label = (
            db.query(models.ReviewAccount).filter(models.ReviewAccount.label == label).first()
        )
        if existing_label:
            skipped_duplicate += 1
            continue
        seen_labels.add(label)

        reviewer = models.Reviewer(
            name=name,
            category="admin",
            contact_info=_normalize_phone(contact_info),
            is_active=True,
            gender=row.get("gender"),
            birth_date=row.get("birth_date"),
        )
        db.add(reviewer)
        db.flush()

        password = row.get("password")
        account = models.ReviewAccount(
            reviewer_id=reviewer.id,
            platform=row.get("platform") or "naver",
            label=label,
            profile_url=row.get("profile_url"),
            ip_address=row.get("ip_address"),
            password_encrypted=crypto.encrypt(password) if password else None,
        )
        db.add(account)
        created += 1

    db.commit()
    return schemas.ReviewerImportResult(
        created=created,
        skipped_duplicate=skipped_duplicate,
        skipped_invalid=skipped_invalid,
    )


def delete_reviewer(db: Session, reviewer: models.Reviewer) -> None:
    account_ids = [a.id for a in reviewer.accounts]
    if account_ids:
        task_count = (
            db.query(models.Task)
            .filter(models.Task.review_account_id.in_(account_ids))
            .count()
        )
        if task_count > 0:
            raise ValueError("배정된 작업이 있는 리뷰어는 삭제할 수 없습니다")
    db.delete(reviewer)
    db.commit()


# --- ReviewAccount ---

def account_to_out(account: models.ReviewAccount) -> schemas.ReviewAccountOut:
    out = schemas.ReviewAccountOut.model_validate(account)
    out.password = crypto.decrypt(account.password_encrypted) if account.password_encrypted else None
    return out


def create_account(
    db: Session, reviewer_id: int, data: schemas.ReviewAccountCreate
) -> models.ReviewAccount:
    account = models.ReviewAccount(
        reviewer_id=reviewer_id,
        platform=data.platform,
        label=data.label,
        profile_url=data.profile_url,
        ip_address=data.ip_address,
        adspower_profile_id=data.adspower_profile_id,
        time_slot=data.time_slot,
        has_login_issue=data.has_login_issue,
        password_encrypted=crypto.encrypt(data.password) if data.password else None,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def get_account(db: Session, account_id: int) -> models.ReviewAccount | None:
    return (
        db.query(models.ReviewAccount)
        .filter(models.ReviewAccount.id == account_id)
        .first()
    )


def update_account(
    db: Session, account: models.ReviewAccount, data: schemas.ReviewAccountUpdate
) -> models.ReviewAccount:
    if data.platform is not None:
        account.platform = data.platform
    if data.label is not None:
        account.label = data.label
    if data.profile_url is not None:
        account.profile_url = data.profile_url
    if data.ip_address is not None:
        account.ip_address = data.ip_address
    if data.adspower_profile_id is not None:
        account.adspower_profile_id = data.adspower_profile_id
    if data.time_slot is not None:
        account.time_slot = data.time_slot
    if data.has_login_issue is not None:
        account.has_login_issue = data.has_login_issue
    if data.password is not None:
        account.password_encrypted = crypto.encrypt(data.password) if data.password else None
    db.commit()
    db.refresh(account)
    return account


def bulk_assign_time_slots(db: Session, account_ids: list[int]) -> int:
    """선택된 계정 중 시간대(오전/오후/밤)가 아직 없는 계정에만 랜덤으로 하나씩
    배정한다. 이미 배정된 계정은 건드리지 않아 여러 번 눌러도 안전하다."""
    accounts = (
        db.query(models.ReviewAccount)
        .filter(models.ReviewAccount.id.in_(account_ids), models.ReviewAccount.time_slot.is_(None))
        .all()
    )
    slots = list(schemas.TimeSlot.__args__)
    for account in accounts:
        account.time_slot = random.choice(slots)
    db.commit()
    return len(accounts)


def delete_account(db: Session, account: models.ReviewAccount) -> None:
    task_count = (
        db.query(models.Task).filter(models.Task.review_account_id == account.id).count()
    )
    if task_count > 0:
        raise ValueError("배정된 작업이 있는 계정은 삭제할 수 없습니다")
    db.delete(account)
    db.commit()


# --- Store ---

def get_stores(db: Session, platform: str | None = None) -> list[models.Store]:
    query = db.query(models.Store)
    if platform is not None:
        query = query.filter(models.Store.platform == platform)
    return query.order_by(models.Store.name).all()


def get_store(db: Session, store_id: int) -> models.Store | None:
    return db.query(models.Store).filter(models.Store.id == store_id).first()


def create_store(db: Session, data: schemas.StoreCreate) -> models.Store:
    store = models.Store(
        platform=data.platform,
        name=data.name,
        url=data.url,
        address=data.address,
        representative_hours=data.representative_hours,
        representative_product=data.representative_product,
        cooldown_days=data.cooldown_days,
        business_registration_number=data.business_registration_number,
        representative_name=data.representative_name,
        phone=data.phone,
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


def update_store(db: Session, store: models.Store, data: schemas.StoreUpdate) -> models.Store:
    # name/address/representative_hours are intentionally not in StoreUpdate
    # — see the comment there
    if data.url is not None:
        store.url = data.url
    if data.representative_product is not None:
        store.representative_product = data.representative_product
    if data.cooldown_days is not None:
        store.cooldown_days = data.cooldown_days
    if data.business_registration_number is not None:
        store.business_registration_number = data.business_registration_number
    if data.representative_name is not None:
        store.representative_name = data.representative_name
    if data.phone is not None:
        store.phone = data.phone
    db.commit()
    db.refresh(store)
    return store


def delete_store(db: Session, store: models.Store) -> None:
    target_count = (
        db.query(models.ReviewTarget).filter(models.ReviewTarget.store_id == store.id).count()
    )
    if target_count > 0:
        raise ValueError("캠페인으로 사용 중인 매장은 삭제할 수 없습니다")
    db.delete(store)
    db.commit()


# --- ReviewTarget ---

def get_targets(db: Session) -> list[models.ReviewTarget]:
    return db.query(models.ReviewTarget).order_by(models.ReviewTarget.id.desc()).all()


def get_completed_task_counts(db: Session) -> dict[int, int]:
    """캠페인 목록의 진행중/완료 상태 판정에 쓰는 매장별 완료 건수 — target당 개별
    쿼리 대신 한 번의 group-by로 계산한다."""
    rows = (
        db.query(models.Task.review_target_id, func.count(models.Task.id))
        .filter(models.Task.status == "completed")
        .group_by(models.Task.review_target_id)
        .all()
    )
    return {target_id: count for target_id, count in rows}


def encode_work_days(days: list[int] | None) -> str | None:
    if not days:
        return None
    return ",".join(str(d) for d in sorted(set(days)))


def decode_work_days(raw: str | None) -> list[int] | None:
    if not raw:
        return None
    return sorted(int(d) for d in raw.split(",") if d.strip() != "")


def encode_menu_items(items: list["schemas.MenuItemIn"] | None) -> str | None:
    if not items:
        return None
    return json.dumps([{"name": i.name, "price": i.price} for i in items[:3]], ensure_ascii=False)


def decode_menu_items(raw: str | None) -> list[dict] | None:
    if not raw:
        return None
    return json.loads(raw)


def target_to_out(target: models.ReviewTarget) -> schemas.ReviewTargetOut:
    out = schemas.ReviewTargetOut.model_validate(target)
    if target.store is not None:
        out.store_name = target.store.name
        out.store_url = target.store.url
    out.work_days = decode_work_days(target.work_days_raw)
    out.menu_items = decode_menu_items(target.menu_items_json)
    return out


def get_target(db: Session, target_id: int) -> models.ReviewTarget | None:
    return (
        db.query(models.ReviewTarget).filter(models.ReviewTarget.id == target_id).first()
    )


def save_reference_photo(
    db: Session, target: models.ReviewTarget, content: bytes, filename: str
) -> None:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        raise ValueError(f"지원하지 않는 이미지 형식입니다: {ext or '(확장자 없음)'}")
    dest = os.path.join(UPLOADS_DIR, "campaigns", f"target_{target.id}{ext}")
    with open(dest, "wb") as f:
        f.write(content)
    target.reference_photo_path = f"/uploads/campaigns/target_{target.id}{ext}"
    db.commit()


def save_target_photos(
    db: Session, target: models.ReviewTarget, files: list[tuple[bytes, str]]
) -> list[models.TargetPhoto]:
    """캠페인 사진 풀에 여러 장을 한 번에 추가한다 — 저장 전 photo_washer.wash_photo()로
    EXIF를 자동으로 세탁한다(사용자가 수동으로 쓰던 포토워셔 프로그램을 대체)."""
    saved = []
    for content, filename in files:
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_PHOTO_EXTENSIONS:
            raise ValueError(f"지원하지 않는 이미지 형식입니다: {ext or '(확장자 없음)'}")
        washed = photo_washer.wash_photo(content)
        photo = models.TargetPhoto(review_target_id=target.id, file_path="")
        db.add(photo)
        db.flush()
        filename = f"target_{target.id}_photo_{photo.id}.jpg"
        dest = os.path.join(UPLOADS_DIR, "campaigns", filename)
        with open(dest, "wb") as f:
            f.write(washed)
        photo.file_path = f"/uploads/campaigns/{filename}"
        saved.append(photo)
    db.commit()
    for photo in saved:
        db.refresh(photo)
    return saved


def get_target_photo(db: Session, photo_id: int) -> models.TargetPhoto | None:
    return db.query(models.TargetPhoto).filter(models.TargetPhoto.id == photo_id).first()


def delete_target_photo(db: Session, photo: models.TargetPhoto) -> None:
    path = os.path.join(UPLOADS_DIR, "campaigns", os.path.basename(photo.file_path))
    if os.path.exists(path):
        os.remove(path)
    db.delete(photo)
    db.commit()


def save_target_review_texts(
    db: Session, target: models.ReviewTarget, texts: list[str]
) -> list[models.TargetReviewText]:
    """엑셀로 업로드된 리뷰 원고를 풀에 추가한다 — 순서대로 저장되며, 작업(Task) 생성
    순서에 1:1로 배정된다(assign_review_text_for_task, 사진과 달리 라운드로빈으로
    반복 사용하지 않음)."""
    saved = []
    for content in texts:
        text = models.TargetReviewText(review_target_id=target.id, content=content)
        db.add(text)
        saved.append(text)
    db.commit()
    for text in saved:
        db.refresh(text)
    return saved


def get_target_review_text(db: Session, text_id: int) -> models.TargetReviewText | None:
    return db.query(models.TargetReviewText).filter(models.TargetReviewText.id == text_id).first()


def delete_target_review_text(db: Session, text: models.TargetReviewText) -> None:
    db.delete(text)
    db.commit()


def assign_review_text_for_task(db: Session, task: models.Task) -> str | None:
    """이 작업(Task)에 배정할 리뷰 원고를 고른다 — 업로드된 원고 풀에서 작업 생성
    순서대로 1건씩 소진하며, 풀이 부족하면 남은 작업은 처음 조회되는 시점에
    app.review_writer로 생성해 Task.assigned_review_text에 캐싱한다(한 번 생성되면
    재생성하지 않음 — 매번 다른 원고가 배정되면 관리자/리뷰어가 혼란스러움)."""
    if task.assigned_review_text:
        return task.assigned_review_text

    target = task.review_target
    if target is None:
        return None

    texts = target.review_texts  # TargetReviewText.id순 정렬됨
    tasks = sorted(target.tasks, key=lambda t: t.id)
    try:
        task_index = tasks.index(task)
    except ValueError:
        return None

    if task_index < len(texts):
        task.assigned_review_text = texts[task_index].content
        db.commit()
        return task.assigned_review_text

    if not review_writer.is_configured():
        return None

    # 아직 아무도 클레임하지 않은 오픈풀 작업까지 미리 AI로 원고를 생성해두면
    # (특히 크레딧 부족/레이트리밋으로 매번 실패할 때) 오픈풀 목록 조회 자체가
    # 매우 느려진다 — 실제로 작업 중인(클레임된) 건에 한해서만 생성한다.
    if task.status == "open":
        return None

    try:
        generated = review_writer.generate_review_text(
            guideline=target.guideline,
            regional_features=target.regional_features,
            length=target.review_length,
            menu_items=decode_menu_items(target.menu_items_json),
        )
    except Exception:
        logger.exception("Task %s 리뷰 원고 AI 생성 실패", task.id)
        return None
    task.assigned_review_text = generated
    db.commit()
    return generated


def assign_photos_for_task(task: models.Task) -> list[str]:
    """캠페인 사진 풀에서 이 작업(Task)에 배정할 사진 경로를 라운드로빈으로 고른다 —
    캠페인의 photos_per_review 설정값만큼, 작업마다 겹치지 않게(풀이 부족하면 순환)."""
    target = task.review_target
    if target is None or not target.photos or target.photos_per_review <= 0:
        return []
    photos = target.photos  # ReviewTarget.photos relationship은 id순 정렬됨
    tasks = sorted(target.tasks, key=lambda t: t.id)
    try:
        task_index = tasks.index(task)
    except ValueError:
        return []
    n = len(photos)
    start = (task_index * target.photos_per_review) % n
    return [photos[(start + i) % n].file_path for i in range(min(target.photos_per_review, n))]


def delete_target(db: Session, target: models.ReviewTarget) -> None:
    in_progress = [t for t in target.tasks if t.status != "open"]
    if in_progress:
        raise ValueError(
            "이미 클레임되었거나 완료된 작업이 있어 캠페인을 삭제할 수 없습니다"
        )
    db.delete(target)
    db.commit()


def update_target(
    db: Session, target: models.ReviewTarget, data: schemas.ReviewTargetUpdate
) -> models.ReviewTarget:
    """캠페인 수정 — platform/store_id/required_count는 Task 생성 시점에 이미
    확정된 구조적 값이라 여기서 바꾸지 않는다(잘못 등록했으면 삭제 후 재등록).
    unit_price/sale_price를 바꿔도 이미 생성된 Task의 settlement_amount/
    sale_amount 스냅샷은 소급 변경되지 않는다 — 새로 등록하는 캠페인과 동일하게
    생성 시점 값을 그대로 쓰는 기존 설계를 그대로 따른다."""
    if data.unit_price is not None:
        target.unit_price = data.unit_price
    if data.sale_price is not None:
        target.sale_price = data.sale_price
    if data.daily_limit is not None:
        target.daily_limit = data.daily_limit
    if data.work_days is not None:
        target.work_days_raw = encode_work_days(data.work_days)
    if data.start_date is not None:
        target.start_date = data.start_date
    if data.end_date is not None:
        target.end_date = data.end_date
    if data.guideline is not None:
        target.guideline = data.guideline
    if data.regional_features is not None:
        target.regional_features = data.regional_features
    if data.menu_items is not None:
        target.menu_items_json = encode_menu_items(data.menu_items)
    if data.photos_per_review is not None:
        target.photos_per_review = data.photos_per_review
    if data.review_length is not None:
        target.review_length = data.review_length
    db.commit()
    db.refresh(target)
    return target


def create_review_target(
    db: Session, data: schemas.ReviewTargetCreate
) -> models.ReviewTarget:
    """Create the target and its tasks as an unassigned open pool — reviewers
    claim them themselves via the self-service portal (no auto round-robin)."""
    store = get_store(db, data.store_id)
    if not store:
        raise ValueError("매장을 찾을 수 없습니다")

    # claim time limit is no longer set per campaign — always the current
    # Settings default for the platform, snapshotted at creation time
    settings = get_settings(db)
    claim_minutes = (
        settings.naver_default_claim_minutes
        if store.platform == "naver"
        else settings.kakao_default_claim_minutes
    )

    target = models.ReviewTarget(
        store_id=store.id,
        platform=store.platform,
        required_count=data.required_count,
        unit_price=data.unit_price,
        sale_price=data.sale_price,
        claim_time_limit_minutes=claim_minutes,
        work_days_raw=encode_work_days(data.work_days),
        daily_limit=data.daily_limit,
        start_date=data.start_date,
        end_date=data.end_date,
        guideline=data.guideline,
        regional_features=data.regional_features,
        menu_items_json=encode_menu_items(data.menu_items),
        photos_per_review=data.photos_per_review,
        review_length=data.review_length,
    )
    db.add(target)
    db.flush()

    for _ in range(data.required_count):
        task = models.Task(
            review_target_id=target.id,
            review_account_id=None,
            platform=store.platform,
            status="open",
            settlement_amount=data.unit_price,
            sale_amount=data.sale_price,
        )
        db.add(task)

    db.commit()
    db.refresh(target)
    return target


# --- Task ---

def task_to_out(db: Session, task: models.Task) -> schemas.TaskOut:
    account = task.review_account
    reviewer = account.reviewer if account else None
    target = task.review_target

    out = schemas.TaskOut.model_validate(task)
    if reviewer is not None:
        out.reviewer_id = reviewer.id
        out.reviewer_name = reviewer.name
        out.reviewer_contact_info = reviewer.contact_info
        out.reviewer_category = reviewer.category
    if account is not None:
        out.account_label = account.label
        out.account_profile_url = account.profile_url
    if target is not None and target.store is not None:
        out.store_id = target.store.id
        out.store_name = target.store.name
        out.store_url = target.store.url
    out.assigned_photo_paths = assign_photos_for_task(task)
    out.assigned_review_text = assign_review_text_for_task(db, task)
    return out


def get_tasks(
    db: Session,
    reviewer_id: int | None = None,
    account_id: int | None = None,
    platform: str | None = None,
    status: str | None = None,
    blind_status: str | None = None,
    settlement_status: str | None = None,
    reviewer_category: str | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    sort: str | None = None,
) -> list[models.Task]:
    # outerjoin (not join) — 'open' pool tasks have no review_account_id yet and
    # must still show up in the admin dashboard
    query = db.query(models.Task).outerjoin(
        models.ReviewAccount, models.Task.review_account_id == models.ReviewAccount.id
    )

    if reviewer_category is not None:
        query = query.outerjoin(
            models.Reviewer, models.ReviewAccount.reviewer_id == models.Reviewer.id
        ).filter(models.Reviewer.category == reviewer_category)
    if reviewer_id is not None:
        query = query.filter(models.ReviewAccount.reviewer_id == reviewer_id)
    if account_id is not None:
        query = query.filter(models.Task.review_account_id == account_id)
    if platform is not None:
        query = query.filter(models.Task.platform == platform)
    if status is not None:
        query = query.filter(models.Task.status == status)
    if blind_status is not None:
        query = query.filter(models.Task.blind_status == blind_status)
    if settlement_status is not None:
        query = query.filter(models.Task.settlement_status == settlement_status)
    if created_from is not None:
        query = query.filter(
            models.Task.created_at >= datetime.datetime.fromisoformat(created_from)
        )
    if created_to is not None:
        # inclusive of the whole "to" day
        end = datetime.datetime.fromisoformat(created_to) + datetime.timedelta(days=1)
        query = query.filter(models.Task.created_at < end)

    sort_map = {
        "created_at": models.Task.created_at.asc(),
        "-created_at": models.Task.created_at.desc(),
        "status": models.Task.status.asc(),
        "settlement_status": models.Task.settlement_status.asc(),
    }
    query = query.order_by(sort_map.get(sort, models.Task.created_at.desc()))

    return query.all()


# --- Store cooldown eligibility (재작업 가능 주기) ---

def get_last_completed_task_for_store(
    db: Session, account_id: int, store_id: int
) -> models.Task | None:
    return (
        db.query(models.Task)
        .join(models.ReviewTarget, models.Task.review_target_id == models.ReviewTarget.id)
        .filter(
            models.Task.review_account_id == account_id,
            models.ReviewTarget.store_id == store_id,
            models.Task.status == "completed",
        )
        .order_by(models.Task.completed_at.desc())
        .first()
    )


def _task_reference_date(task: models.Task) -> datetime.date | None:
    """The date to count the cooldown from: the actual review posting date if
    known (from blind-check matching), else the completion timestamp."""
    if task.review_posted_date:
        return task.review_posted_date
    if task.completed_at:
        return task.completed_at.date()
    return None


def is_account_eligible_for_store(
    db: Session, account_id: int, store_id: int, now: datetime.datetime | None = None
) -> bool:
    now = now or datetime.datetime.utcnow()
    store = get_store(db, store_id)
    if not store:
        return True
    last_task = get_last_completed_task_for_store(db, account_id, store_id)
    if not last_task:
        return True
    reference = _task_reference_date(last_task)
    if reference is None:
        return True
    eligible_at = datetime.datetime.combine(reference, datetime.time.min) + datetime.timedelta(
        days=store.cooldown_days
    )
    return now >= eligible_at


def get_eligible_account_ids(
    db: Session, accounts: list[models.ReviewAccount], store_id: int
) -> list[int]:
    now = datetime.datetime.utcnow()
    return [a.id for a in accounts if is_account_eligible_for_store(db, a.id, store_id, now)]


def get_account_store_history(db: Session, account_id: int) -> list[schemas.AccountStoreHistoryItem]:
    completed_tasks = (
        db.query(models.Task)
        .join(models.ReviewTarget, models.Task.review_target_id == models.ReviewTarget.id)
        .filter(models.Task.review_account_id == account_id, models.Task.status == "completed")
        .all()
    )

    latest_by_store: dict[int, tuple[datetime.date, models.Store]] = {}
    for task in completed_tasks:
        store = task.review_target.store if task.review_target else None
        reference = _task_reference_date(task)
        if not store or reference is None:
            continue
        existing = latest_by_store.get(store.id)
        if not existing or reference > existing[0]:
            latest_by_store[store.id] = (reference, store)

    now = datetime.datetime.utcnow()
    items = []
    for reference, store in latest_by_store.values():
        reference_dt = datetime.datetime.combine(reference, datetime.time.min)
        eligible_at = reference_dt + datetime.timedelta(days=store.cooldown_days)
        items.append(
            schemas.AccountStoreHistoryItem(
                store_id=store.id,
                store_name=store.name,
                platform=store.platform,
                last_completed_at=reference_dt,
                cooldown_days=store.cooldown_days,
                eligible_at=eligible_at,
                is_eligible_now=now >= eligible_at,
            )
        )
    return items


def get_task(db: Session, task_id: int) -> models.Task | None:
    return db.query(models.Task).filter(models.Task.id == task_id).first()


def _kst_weekday() -> int:
    # this app is Korea-only; use KST (not naive UTC) so the pool's
    # day-of-week restriction flips at Korean midnight, not UTC midnight
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).weekday()


def _kst_today_date() -> datetime.date:
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).date()


def _kst_today_utc_range() -> tuple[datetime.datetime, datetime.datetime]:
    """[start, end) of "today" in KST, expressed back in UTC (since claimed_at
    is stored as naive UTC) — used to count how many of a campaign's tasks
    were claimed today for the daily_limit throttle."""
    now_kst = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
    start_kst = datetime.datetime(now_kst.year, now_kst.month, now_kst.day)
    start_utc = start_kst - datetime.timedelta(hours=9)
    return start_utc, start_utc + datetime.timedelta(days=1)


def get_open_pool_tasks(db: Session, platforms: list[str]) -> list[models.Task]:
    tasks = (
        db.query(models.Task)
        .filter(models.Task.status == "open", models.Task.platform.in_(platforms))
        .order_by(models.Task.created_at)
        .all()
    )
    weekday = _kst_weekday()
    tasks = [
        t
        for t in tasks
        if not t.review_target.work_days_raw
        or weekday in decode_work_days(t.review_target.work_days_raw)
    ]

    # start_date/end_date: campaign's overall working period (both null =
    # unrestricted, matches the old always-open behavior)
    today = _kst_today_date()

    def within_campaign_period(t: models.Task) -> bool:
        target = t.review_target
        if target.start_date is not None and today < target.start_date:
            return False
        if target.end_date is not None and today > target.end_date:
            return False
        return True

    tasks = [t for t in tasks if within_campaign_period(t)]

    # daily_limit: once N tasks from a campaign have been claimed today
    # (KST), hide the rest of that campaign's open tasks from the pool until
    # tomorrow — a soft pacing cap, not a hard cutoff on the campaign itself
    start_utc, end_utc = _kst_today_utc_range()
    claimed_today_by_target: dict[int, int] = {}

    def under_daily_limit(t: models.Task) -> bool:
        target = t.review_target
        if target.daily_limit is None:
            return True
        if target.id not in claimed_today_by_target:
            claimed_today_by_target[target.id] = (
                db.query(models.Task)
                .filter(
                    models.Task.review_target_id == target.id,
                    models.Task.claimed_at >= start_utc,
                    models.Task.claimed_at < end_utc,
                )
                .count()
            )
        return claimed_today_by_target[target.id] < target.daily_limit

    return [t for t in tasks if under_daily_limit(t)]


def get_open_pool_summary(
    db: Session, platforms: list[str], reviewer: models.Reviewer
) -> list[schemas.PoolGroupOut]:
    """포털 오픈풀 — 개별 작업을 하나씩 나열하지 않고 매장(캠페인)당 한 줄로 묶어서,
    오늘 기준 잔여/총 건수를 계산해 돌려준다. task_to_out을 거치지 않으므로 원고
    AI생성·사진배정처럼 무거운 계산이 붙지 않아 빠르다."""
    tasks = get_open_pool_tasks(db, platforms)

    start_utc, end_utc = _kst_today_utc_range()
    by_target: dict[int, list[models.Task]] = {}
    for t in tasks:
        by_target.setdefault(t.review_target_id, []).append(t)

    groups = []
    for target_id, target_tasks in by_target.items():
        target = target_tasks[0].review_target
        store = target.store
        open_count = len(target_tasks)
        if target.daily_limit is not None:
            claimed_today = (
                db.query(models.Task)
                .filter(
                    models.Task.review_target_id == target_id,
                    models.Task.claimed_at >= start_utc,
                    models.Task.claimed_at < end_utc,
                )
                .count()
            )
            total_today = target.daily_limit
            remaining_today = max(0, min(open_count, target.daily_limit - claimed_today))
        else:
            total_today = open_count
            remaining_today = open_count

        my_accounts = [a for a in reviewer.accounts if a.platform == target.platform]
        groups.append(
            schemas.PoolGroupOut(
                review_target_id=target_id,
                store_id=store.id if store else None,
                store_name=store.name if store else None,
                platform=target.platform,
                unit_price=target.unit_price,
                remaining_today=remaining_today,
                total_today=total_today,
                sample_task_id=min(t.id for t in target_tasks),
                eligible_account_ids=get_eligible_account_ids(db, my_accounts, target.store_id),
            )
        )
    return groups


def get_reviewer_tasks(db: Session, reviewer_id: int) -> list[models.Task]:
    return (
        db.query(models.Task)
        .join(models.ReviewAccount, models.Task.review_account_id == models.ReviewAccount.id)
        .filter(models.ReviewAccount.reviewer_id == reviewer_id)
        .order_by(models.Task.created_at.desc())
        .all()
    )


def claim_task(db: Session, task: models.Task, account: models.ReviewAccount) -> models.Task:
    if task.status != "open":
        raise ValueError("이미 다른 사람이 가져간 작업입니다")
    if task.platform != account.platform:
        raise ValueError("플랫폼이 일치하지 않는 계정입니다")
    if not is_account_eligible_for_store(db, account.id, task.review_target.store_id):
        raise ValueError("이 계정은 해당 매장의 재작업 가능 기간이 아직 지나지 않았습니다")

    now = datetime.datetime.utcnow()
    task.review_account_id = account.id
    task.claimed_at = now
    task.claim_deadline = now + datetime.timedelta(
        minutes=task.review_target.claim_time_limit_minutes
    )
    task.status = "claimed"
    db.commit()
    db.refresh(task)
    return task


def update_task_result(db: Session, task: models.Task, result_link: str) -> models.Task:
    task.result_link = result_link
    task.completed_at = datetime.datetime.utcnow()
    task.status = "completed"
    db.commit()
    db.refresh(task)
    return task


def update_task_settlement(
    db: Session, task: models.Task, data: schemas.TaskSettlementUpdate
) -> models.Task:
    task.settlement_status = data.settlement_status
    if data.settlement_amount is not None:
        task.settlement_amount = data.settlement_amount
    task.settlement_paid_at = (
        datetime.datetime.utcnow() if data.settlement_status == "paid" else None
    )
    db.commit()
    db.refresh(task)
    return task


def run_claim_expiry_job(db: Session) -> int:
    """Revert claims past their deadline back to the open pool so another
    reviewer can pick them up; flags last_expired_at for the admin dashboard."""
    now = datetime.datetime.utcnow()
    expired = (
        db.query(models.Task)
        .filter(
            models.Task.status.in_(["claimed", "checking_date", "ready"]),
            models.Task.claim_deadline.isnot(None),
            models.Task.claim_deadline < now,
        )
        .all()
    )
    for task in expired:
        task.status = "open"
        task.review_account_id = None
        task.claimed_at = None
        task.claim_deadline = None
        task.naver_available_date = None
        task.last_expired_at = now
    db.commit()
    return len(expired)


def settlement_summary(db: Session) -> list[schemas.SettlementSummaryItem]:
    # 관리자(자체보유계정)는 우리 소유라 정산할 필요가 없어 미정산 목록에서 제외
    reviewers = [r for r in get_reviewers(db) if r.category != "admin"]
    results = []
    for reviewer in reviewers:
        account_ids = [a.id for a in reviewer.accounts]
        if not account_ids:
            continue
        tasks = (
            db.query(models.Task)
            .filter(models.Task.review_account_id.in_(account_ids))
            .filter(models.Task.status == "completed")
            .all()
        )
        if not tasks:
            continue
        unpaid_amount = sum(
            t.settlement_amount for t in tasks if t.settlement_status == "unpaid"
        )
        paid_amount = sum(
            t.settlement_amount for t in tasks if t.settlement_status == "paid"
        )
        results.append(
            schemas.SettlementSummaryItem(
                reviewer_id=reviewer.id,
                reviewer_name=reviewer.name,
                completed_count=len(tasks),
                unpaid_amount=unpaid_amount,
                paid_amount=paid_amount,
            )
        )
    return results


def revenue_summary(
    db: Session, date_from: str | None = None, date_to: str | None = None
) -> schemas.RevenueSummaryOut:
    """매출 = 매장에 청구한 금액(sale_amount), 완료된 작업 기준. 정산(리뷰어 지급)과는
    별개 지표라 정산 여부와 무관하게 집계한다. sale_amount가 없는(캠페인 등록 시 판매금액을
    안 넣은) 작업은 매출 계산에서 빠진다. 날짜는 완료일(completed_at) 기준 — 매출은
    작업이 끝난 시점에 실현된다고 보는 게 등록일보다 더 정확함."""
    query = db.query(models.Task).filter(
        models.Task.status == "completed", models.Task.sale_amount.isnot(None)
    )
    if date_from is not None:
        query = query.filter(models.Task.completed_at >= datetime.datetime.fromisoformat(date_from))
    if date_to is not None:
        end = datetime.datetime.fromisoformat(date_to) + datetime.timedelta(days=1)
        query = query.filter(models.Task.completed_at < end)

    tasks = query.all()
    return schemas.RevenueSummaryOut(
        total=sum(t.sale_amount for t in tasks), count=len(tasks)
    )


# --- Settings ---

def get_settings(db: Session) -> models.Settings:
    settings = db.query(models.Settings).first()
    if settings is None:
        settings = models.Settings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_settings(db: Session, data: schemas.SettingsUpdate) -> models.Settings:
    settings = get_settings(db)
    if data.naver_blind_check_interval_minutes is not None:
        settings.naver_blind_check_interval_minutes = data.naver_blind_check_interval_minutes
    if data.kakao_blind_check_interval_minutes is not None:
        settings.kakao_blind_check_interval_minutes = data.kakao_blind_check_interval_minutes
    if data.naver_default_claim_minutes is not None:
        settings.naver_default_claim_minutes = data.naver_default_claim_minutes
    if data.kakao_default_claim_minutes is not None:
        settings.kakao_default_claim_minutes = data.kakao_default_claim_minutes
    db.commit()
    db.refresh(settings)
    return settings


def get_card_rules(db: Session) -> list[models.CardRule]:
    return db.query(models.CardRule).order_by(models.CardRule.id).all()


def card_rules_as_dicts(db: Session) -> list[dict]:
    """receipt_generator.generate_receipt()가 바로 쓸 수 있는 형태로 변환."""
    return [
        {
            "card_prefix_1": r.card_prefix_1,
            "card_prefix_2": r.card_prefix_2,
            "approval_prefix": r.approval_prefix,
            "acquirer": r.acquirer,
            "card_type": r.card_type,
        }
        for r in get_card_rules(db)
    ]


def create_card_rule(db: Session, data: schemas.CardRuleIn) -> models.CardRule:
    rule = models.CardRule(
        card_prefix_1=data.card_prefix_1,
        card_prefix_2=data.card_prefix_2,
        approval_prefix=data.approval_prefix,
        acquirer=data.acquirer,
        card_type=data.card_type,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def get_card_rule(db: Session, rule_id: int) -> models.CardRule | None:
    return db.query(models.CardRule).filter(models.CardRule.id == rule_id).first()


def delete_card_rule(db: Session, rule: models.CardRule) -> None:
    db.delete(rule)
    db.commit()
