import datetime
import json
import logging
import os
import random
import re
import secrets

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import auth, crypto, models, photo_washer, receipt_generator, review_writer, schemas

logger = logging.getLogger(__name__)

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
ALLOWED_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


# --- Reviewer ---

def get_reviewers(db: Session) -> list[models.Reviewer]:
    return db.query(models.Reviewer).order_by(models.Reviewer.id).all()


def get_reviewer(db: Session, reviewer_id: int) -> models.Reviewer | None:
    return db.query(models.Reviewer).filter(models.Reviewer.id == reviewer_id).first()


def _digits_only(raw: str | None) -> str:
    return re.sub(r"\D", "", raw or "")


def get_reviewer_by_contact(db: Session, phone: str) -> models.Reviewer | None:
    """전화번호로 리뷰어를 찾는다. 관리자가 엑셀로 미리 올려둔 레코드는 시트에 적힌
    형식 그대로(하이픈 유무 등 제각각) 저장돼 있을 수 있어서, 정확히 일치하는 값이
    없으면 숫자만 비교하는 방식으로 한 번 더 찾는다 — 그래야 스프레드시트의
    "01012345678"과 포털에 입력한 "010-1234-5678"이 같은 사람으로 인식된다."""
    exact = db.query(models.Reviewer).filter(models.Reviewer.contact_info == phone).first()
    if exact:
        return exact
    digits = _digits_only(phone)
    if not digits:
        return None
    for reviewer in db.query(models.Reviewer).filter(models.Reviewer.contact_info.isnot(None)):
        if _digits_only(reviewer.contact_info) == digits:
            return reviewer
    return None


def get_reviewer_by_kakao_id(db: Session, kakao_id: str) -> models.Reviewer | None:
    return db.query(models.Reviewer).filter(models.Reviewer.kakao_id == kakao_id).first()


def get_reviewer_by_username(db: Session, username: str) -> models.Reviewer | None:
    return (
        db.query(models.Reviewer)
        .filter(models.Reviewer.username == username.strip().lower())
        .first()
    )


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


_TEMP_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"  # 헷갈리는 0/O/1/l/I 제외


def generate_temp_password(length: int = 8) -> str:
    return "".join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(length))


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
    if data.category == "own":
        contact_info = _normalize_phone(contact_info)
    applied_at = data.applied_at
    application_status = data.application_status
    if data.category == "experience":
        applied_at = applied_at or datetime.datetime.utcnow()
        application_status = application_status or "pending"
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
        applied_at=applied_at,
        application_status=application_status,
        topics=",".join(data.topics) if data.topics else None,
    )
    db.add(reviewer)
    db.commit()
    db.refresh(reviewer)
    return reviewer


def create_member(db: Session, data: schemas.MemberCreateIn) -> models.Reviewer:
    """회원관리 "임의 추가" — 포털 셀프가입(전화번호 인증→아이디/비밀번호 입력)을
    관리자가 대신 완료시켜주는 것과 같다. privacy_consent_at을 지금 시각으로
    바로 채워서 목록에서 "가입 완료된 회원"으로 곧장 보이게 한다. 광고주는 셀프
    가입과 동일하게 사업자등록증 승인 전까지 is_active=False로 시작한다 — 관리자가
    직접 추가했다고 승인 절차를 건너뛰면 안 된다."""
    contact_info = data.contact_info
    if data.category == "own":
        contact_info = _normalize_phone(contact_info)
    reviewer = models.Reviewer(
        name=data.name,
        category=data.category,
        username=data.username,
        password_hash=auth.hash_password(data.password),
        contact_info=contact_info,
        is_active=data.category != "advertiser",
        privacy_consent_at=datetime.datetime.utcnow(),
    )
    db.add(reviewer)
    db.commit()
    db.refresh(reviewer)
    return reviewer


def migrate_self_owned_admin_category(db: Session) -> None:
    """category='admin'의 의미가 "회사 자체보유(리뷰포스팅용) 계정"에서 "대시보드
    관리자"로 바뀌면서, 예전 뜻으로 쓰이던 기존 행들을 새 이름 'own'으로 옮겨준다.
    반드시 seed_test_accounts()보다 먼저 호출해야 한다 — 그래야 이 함수가 새로
    만든 category='admin' 행(관리자/개발자)까지 'own'으로 잘못 바꿔버리는 걸
    막을 수 있다. username='admin'이 아직 없다는 건 이 마이그레이션이 아직
    한 번도 안 돌았다는 뜻이라, 그때만 실행한다(그 이후엔 매번 조용히 건너뜀)."""
    if get_reviewer_by_username(db, "admin"):
        return
    db.query(models.Reviewer).filter(models.Reviewer.category == "admin").update(
        {"category": "own"}
    )
    db.commit()


TEST_ACCOUNTS = [
    {"username": "kingsas", "password": "chlrkd12!@", "name": "개발자", "category": "admin"},
    {"username": "admin", "password": "1234", "name": "관리자", "category": "admin"},
    {"username": "ads1", "password": "1234", "name": "테스트 광고주", "category": "advertiser"},
    {"username": "review", "password": "1234", "name": "테스트 리뷰어", "category": "reviewer"},
]


def fix_test_admin_categories(db: Session) -> None:
    """예전(카테고리 재정의 이전) 버전의 코드나 수동 테스트로 인해 admin/kingsas
    계정이 'admin'이 아닌 다른 category로 남아있을 수 있어 바로잡는다 —
    seed_test_accounts는 계정이 이미 있으면 손대지 않기 때문에 이 값은 저절로
    고쳐지지 않는다."""
    changed = False
    for username in ("admin", "kingsas"):
        reviewer = get_reviewer_by_username(db, username)
        if reviewer and reviewer.category != "admin":
            reviewer.category = "admin"
            changed = True
    if changed:
        db.commit()


def seed_test_accounts(db: Session) -> None:
    """매 배포마다 동일한 아이디/비밀번호로 로그인해볼 수 있는 기본 계정들을
    보장한다(없으면 생성, 있으면 손대지 않음) — 실제 오픈 전 테스트 편의용이라
    관리자/개발자 계정도 일부러 단순한 비밀번호로 시작한다. 실제 정보(비밀번호
    등)는 나중에 회원관리 화면에서 직접 바꾸면 된다. 반드시
    migrate_self_owned_admin_category() 다음에 호출해야 한다."""
    for account in TEST_ACCOUNTS:
        existing = get_reviewer_by_username(db, account["username"])
        if existing:
            continue
        db.add(
            models.Reviewer(
                name=account["name"],
                category=account["category"],
                username=account["username"],
                password_hash=auth.hash_password(account["password"]),
                is_active=True,
                privacy_consent_at=datetime.datetime.utcnow(),
            )
        )
    db.commit()


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
            _normalize_phone(data.contact_info) if category == "own" else data.contact_info
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
    if data.applied_at is not None:
        reviewer.applied_at = data.applied_at
    if data.application_status is not None:
        reviewer.application_status = data.application_status
    if data.topics is not None:
        reviewer.topics = ",".join(data.topics)
    db.commit()
    db.refresh(reviewer)
    return reviewer


def reviewer_to_out(
    reviewer: models.Reviewer, duplicate_blog_ids: set[int] | None = None
) -> schemas.ReviewerOut:
    """ReviewerOut.accounts는 그냥 model_validate만 하면 계정의 password가 항상
    None이 된다 — ORM 컬럼명이 password_encrypted라 자동 매핑이 안 되기 때문
    (account_to_out과 동일한 이유). 리뷰어를 반환하는 라우터는 전부 이 함수를
    거쳐야 계정 비밀번호가 복호화된 채로 나간다.

    duplicate_blog_ids를 넘기면 blog_duplicate 플래그도 채운다 — 호출하는 쪽이
    get_duplicate_blog_reviewer_ids(db)로 한 번만 계산해서 넘기는 방식(목록 조회 시
    리뷰어마다 매번 쿼리하지 않도록)."""
    out = schemas.ReviewerOut.model_validate(reviewer)
    out.accounts = [account_to_out(a) for a in reviewer.accounts]
    out.blog_duplicate = bool(duplicate_blog_ids) and reviewer.id in duplicate_blog_ids
    out.privacy_consent = bool(reviewer.privacy_consent_at)
    out.marketing_consent = bool(reviewer.marketing_consent_at)
    return out


def get_duplicate_blog_reviewer_ids(db: Session) -> set[int]:
    """블로그 주소(공백 제거 + 소문자)가 같은 다른 리뷰어가 있는 리뷰어 id 집합.
    관리자가 엑셀로 미리 올려둔 정보와 실제 가입자의 정보가 전화번호는 다르지만
    블로그 주소가 겹치는 경우를 관리자가 눈으로 확인할 수 있게 하기 위한 것 —
    자동으로 합치지는 않고 표시만 한다."""
    rows = (
        db.query(models.Reviewer.id, models.Reviewer.blog_url)
        .filter(models.Reviewer.blog_url.isnot(None), models.Reviewer.blog_url != "")
        .all()
    )
    by_key: dict[str, list[int]] = {}
    for reviewer_id, blog_url in rows:
        key = blog_url.strip().lower()
        by_key.setdefault(key, []).append(reviewer_id)
    return {rid for ids in by_key.values() if len(ids) > 1 for rid in ids}


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
            applied_at=(row.get("applied_at") or datetime.datetime.utcnow()) if category == "experience" else None,
            application_status="pending" if category == "experience" else None,
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
    """관리자 계정(자체보유) 일괄등록 — 이름/계정아이디가 둘 다 있는 행마다 Reviewer(category='own')
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
            category="own",
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
    # 계정을 하나라도 등록하면 그 자체로 "작업 받을 준비가 됐다"는 뜻이라 관리자
    # 승인 없이 바로 활성화한다 — 광고주는 계정 개념이 없어 별도로 사업자등록증
    # 승인 절차를 거친다(advertiser.py의 get_approved_advertiser 참고).
    reviewer = db.query(models.Reviewer).filter(models.Reviewer.id == reviewer_id).first()
    if reviewer and not reviewer.is_active:
        reviewer.is_active = True
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


def create_store(
    db: Session, data: schemas.StoreCreate, owner_reviewer_id: int | None = None
) -> models.Store:
    store = models.Store(
        platform=data.platform,
        name=data.name,
        url=data.url,
        address=data.address,
        region=data.region,
        representative_hours=data.representative_hours,
        representative_product=data.representative_product,
        cooldown_days=data.cooldown_days,
        business_registration_number=data.business_registration_number,
        representative_name=data.representative_name,
        phone=data.phone,
        owner_reviewer_id=owner_reviewer_id,
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


def get_stores_by_owner(db: Session, owner_reviewer_id: int) -> list[models.Store]:
    return (
        db.query(models.Store)
        .filter(models.Store.owner_reviewer_id == owner_reviewer_id)
        .order_by(models.Store.name)
        .all()
    )


def update_store(db: Session, store: models.Store, data: schemas.StoreUpdate) -> models.Store:
    # name/address/representative_hours are intentionally not in StoreUpdate
    # — see the comment there
    if data.url is not None:
        store.url = data.url
    if data.region is not None:
        store.region = data.region
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


def save_task_receipt_image(db: Session, task: models.Task, content: bytes, filename: str) -> None:
    """관리자가 로컬(크롬/폰트가 있는 환경)에서 만든 영수증 이미지를 수동으로 업로드할 때
    쓴다 — 크롤러가 자동 생성하는 경로(app/crawlers/naver_date_check.py)와 별개로, 크롬·
    폰트가 없는 클라우드 배포판에서도 이미 만들어진 이미지를 작업에 붙일 수 있게 해준다."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        raise ValueError(f"지원하지 않는 이미지 형식입니다: {ext or '(확장자 없음)'}")
    dest = os.path.join(UPLOADS_DIR, "receipts", f"task_{task.id}{ext}")
    with open(dest, "wb") as f:
        f.write(content)
    task.receipt_image_path = f"/uploads/receipts/task_{task.id}{ext}"
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
            tone=target.tone,
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
    if data.tone is not None:
        target.tone = data.tone
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
        tone=data.tone,
        menu_items_json=encode_menu_items(data.menu_items),
        photos_per_review=data.photos_per_review,
        review_length=data.review_length,
    )
    db.add(target)
    db.flush()

    scheduled_dates = _compute_scheduled_dates(
        data.start_date, data.work_days, data.daily_limit, data.required_count
    )
    for i in range(data.required_count):
        task = models.Task(
            review_target_id=target.id,
            review_account_id=None,
            platform=store.platform,
            status="open",
            settlement_amount=data.unit_price,
            sale_amount=data.sale_price,
            sequence_no=i + 1,
            scheduled_date=scheduled_dates[i],
        )
        db.add(task)

    db.commit()
    db.refresh(target)
    return target


def _compute_scheduled_dates(
    start_date: "datetime.date | None",
    work_days: list[int] | None,
    daily_limit: int | None,
    count: int,
) -> list[datetime.date]:
    """캠페인 생성 시점에 각 Task가 '몇 일자 몫'인지 미리 정해둔다 — 시작일부터
    작업요일을 따라가며 하루 daily_limit개씩 채운다(daily_limit이 없으면 제한이
    없다는 뜻이라 전부 시작일 하루치로 본다). 관리자 작업현황의 기간 필터가
    등록일이 아니라 이 값을 기준으로 조회하기 위한 것."""
    day = start_date or _kst_today_date()
    per_day = daily_limit or count
    dates: list[datetime.date] = []
    while len(dates) < count:
        if not work_days or day.weekday() in work_days:
            dates.extend([day] * min(per_day, count - len(dates)))
        day = day + datetime.timedelta(days=1)
    return dates


# --- Task ---

def task_to_out(db: Session, task: models.Task) -> schemas.TaskOut:
    account = task.review_account
    reviewer = account.reviewer if account else None
    target = task.review_target

    out = schemas.TaskOut.model_validate(task)
    out.task_no = f"{task.review_target_id}{(task.sequence_no or 0):03d}"
    if reviewer is not None:
        out.reviewer_id = reviewer.id
        out.reviewer_name = reviewer.name
        out.reviewer_contact_info = reviewer.contact_info
        out.reviewer_category = reviewer.category
        out.reviewer_bank_account = reviewer.bank_account
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
    scheduled_from: str | None = None,
    scheduled_to: str | None = None,
    completed_from: str | None = None,
    completed_to: str | None = None,
    store_id: int | None = None,
    search: str | None = None,
    sort: str | None = None,
) -> list[models.Task]:
    # outerjoin (not join) — 'open' pool tasks have no review_account_id yet and
    # must still show up in the admin dashboard
    query = db.query(models.Task).outerjoin(
        models.ReviewAccount, models.Task.review_account_id == models.ReviewAccount.id
    )

    reviewer_joined = False
    if reviewer_category is not None:
        query = query.outerjoin(
            models.Reviewer, models.ReviewAccount.reviewer_id == models.Reviewer.id
        ).filter(models.Reviewer.category == reviewer_category)
        reviewer_joined = True
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
    if store_id is not None:
        query = query.join(
            models.ReviewTarget, models.Task.review_target_id == models.ReviewTarget.id
        ).filter(models.ReviewTarget.store_id == store_id)
    if created_from is not None:
        query = query.filter(
            models.Task.created_at >= datetime.datetime.fromisoformat(created_from)
        )
    if created_to is not None:
        # inclusive of the whole "to" day
        end = datetime.datetime.fromisoformat(created_to) + datetime.timedelta(days=1)
        query = query.filter(models.Task.created_at < end)
    if scheduled_from is not None:
        query = query.filter(
            models.Task.scheduled_date >= datetime.date.fromisoformat(scheduled_from)
        )
    if scheduled_to is not None:
        query = query.filter(
            models.Task.scheduled_date <= datetime.date.fromisoformat(scheduled_to)
        )
    if completed_from is not None:
        query = query.filter(
            models.Task.completed_at >= datetime.datetime.fromisoformat(completed_from)
        )
    if completed_to is not None:
        end = datetime.datetime.fromisoformat(completed_to) + datetime.timedelta(days=1)
        query = query.filter(models.Task.completed_at < end)
    if search and not reviewer_joined:
        query = query.outerjoin(
            models.Reviewer, models.ReviewAccount.reviewer_id == models.Reviewer.id
        )

    sort_map = {
        "created_at": models.Task.created_at.asc(),
        "-created_at": models.Task.created_at.desc(),
        "status": models.Task.status.asc(),
        "settlement_status": models.Task.settlement_status.asc(),
    }
    if sort in sort_map:
        query = query.order_by(sort_map[sort])
    else:
        # 작업번호(캠페인 내 순번) 순 — 클레임 여부와 무관하게 항상 같은 순서로 보이도록
        query = query.order_by(models.Task.sequence_no.asc(), models.Task.created_at.asc())

    tasks = query.all()

    if search:
        needle = search.strip().lower()
        tasks = [t for t in tasks if needle in _task_search_haystack(t)]

    return tasks


def _task_search_haystack(task: models.Task) -> str:
    account = task.review_account
    reviewer = account.reviewer if account else None
    task_no = f"{task.review_target_id}{(task.sequence_no or 0):03d}"
    parts = [
        reviewer.name if reviewer else None,
        reviewer.contact_info if reviewer else None,
        account.label if account else None,
        task.result_link,
        task_no,
    ]
    return " ".join(p for p in parts if p).lower()


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


_ACTIVE_TASK_STATUSES = ("claimed", "checking_date", "ready")


def is_account_eligible_for_store(
    db: Session, account_id: int, store_id: int, now: datetime.datetime | None = None
) -> bool:
    now = now or datetime.datetime.utcnow()
    store = get_store(db, store_id)
    if not store:
        return True
    has_active_task = (
        db.query(models.Task)
        .join(models.ReviewTarget, models.Task.review_target_id == models.ReviewTarget.id)
        .filter(
            models.Task.review_account_id == account_id,
            models.ReviewTarget.store_id == store_id,
            models.Task.status.in_(_ACTIVE_TASK_STATUSES),
        )
        .first()
        is not None
    )
    if has_active_task:
        return False
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


# 한 리뷰어가 하루에 한 매장에 쓸 수 있는 서로 다른 계정 수 상한 — 매장 재작업
# 쿨다운과는 별개로, 같은 사람이 여러 계정으로 몰아서 하루에 한 매장을 도배하는
# 것을 막기 위한 제한(계정별 쿨다운 통과 여부와 무관하게 적용).
MAX_ACCOUNTS_PER_STORE_PER_DAY = 3


def get_accounts_used_today_for_store(db: Session, reviewer_id: int, store_id: int) -> set[int]:
    start_utc, end_utc = _kst_today_utc_range()
    rows = (
        db.query(models.Task.review_account_id)
        .join(models.ReviewAccount, models.Task.review_account_id == models.ReviewAccount.id)
        .join(models.ReviewTarget, models.Task.review_target_id == models.ReviewTarget.id)
        .filter(
            models.ReviewAccount.reviewer_id == reviewer_id,
            models.ReviewTarget.store_id == store_id,
            models.Task.claimed_at >= start_utc,
            models.Task.claimed_at < end_utc,
        )
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def mark_account_no_date_today(db: Session, account: models.ReviewAccount) -> None:
    """이 계정은 오늘(KST) 리뷰 가능한 날짜가 없다고 확인됨 — 같은 날 다시 크롤링
    해봐야 결과가 똑같으니, 오늘 하루는 오픈풀 신청 대상에서 뺀다."""
    account.naver_no_date_until = _kst_today_date()
    db.commit()


def clear_account_no_date(db: Session, account: models.ReviewAccount) -> None:
    if account.naver_no_date_until is not None:
        account.naver_no_date_until = None
        db.commit()


def get_eligible_account_ids(
    db: Session, accounts: list[models.ReviewAccount], store_id: int, reviewer_id: int
) -> list[int]:
    used_today = get_accounts_used_today_for_store(db, reviewer_id, store_id)
    if len(used_today) >= MAX_ACCOUNTS_PER_STORE_PER_DAY:
        return []
    today = _kst_today_date()
    now = datetime.datetime.utcnow()
    return [
        a.id
        for a in accounts
        if a.naver_no_date_until != today and is_account_eligible_for_store(db, a.id, store_id, now)
    ]


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


def is_naver_receipt_possible_for_pool(
    target: models.ReviewTarget, store: models.Store | None
) -> bool:
    if not target.menu_items_json:
        return False
    if not store:
        return False
    return receipt_generator.clip_band_to_store_hours("night", store.representative_hours) is not None


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

    # 네이버 영수증 생성이 애초에 불가능한 캠페인(메뉴 미등록/매장 영업시간이 밤
    # 시간대와 안 겹침)은 신청해도 영수증을 못 받으니 오픈풀에 노출하지 않는다.
    # 계정마다 달라지는 "4시간 간격" 조건은 여기서 알 수 없어 신청(claim) 시점에
    # 확인한다 — is_naver_receipt_possible_for_pool 참고.
    tasks = [
        t
        for t in tasks
        if t.platform != "naver"
        or is_naver_receipt_possible_for_pool(t.review_target, t.review_target.store)
    ]

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
                eligible_account_ids=get_eligible_account_ids(
                    db, my_accounts, target.store_id, reviewer.id
                ),
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
    used_today = get_accounts_used_today_for_store(
        db, account.reviewer_id, task.review_target.store_id
    )
    if account.id not in used_today and len(used_today) >= MAX_ACCOUNTS_PER_STORE_PER_DAY:
        raise ValueError(
            f"이 매장은 하루에 최대 {MAX_ACCOUNTS_PER_STORE_PER_DAY}개 계정까지만 신청할 수 있습니다"
        )

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
    """관리자가 자체보유(own/admin) 계정의 결과 링크를 직접 입력 — 본인이 곧
    확인자이므로 submitted를 거치지 않고 바로 완료 처리한다."""
    task.result_link = result_link
    task.completed_at = datetime.datetime.utcnow()
    task.status = "completed"
    db.commit()
    db.refresh(task)
    return task


def submit_task_result(db: Session, task: models.Task, result_link: str) -> models.Task:
    """리뷰어가 포털에서 결과 링크를 제출 — 관리자가 결과보기로 확인하고 완료
    버튼을 눌러야 completed로 넘어간다(complete_task). 반려 이력이 있었다면
    다시 제출하는 것이므로 지운다."""
    task.result_link = result_link
    task.status = "submitted"
    task.reject_reason = None
    db.commit()
    db.refresh(task)
    return task


def complete_task(db: Session, task: models.Task) -> models.Task:
    """관리자가 리뷰어 제출 결과를 확인한 뒤 최종 완료 처리."""
    if task.status != "submitted":
        raise ValueError("제출된 결과가 없는 작업은 완료 처리할 수 없습니다")
    task.status = "completed"
    task.completed_at = datetime.datetime.utcnow()
    task.reject_reason = None
    db.commit()
    db.refresh(task)
    return task


def reject_task(db: Session, task: models.Task, reason: str) -> models.Task:
    """결재 반려처럼, 관리자가 제출된 결과를 확인했지만 수정이 필요할 때 사유를
    남기고 리뷰어가 다시 제출할 수 있는 상태로 되돌린다."""
    if task.status != "submitted":
        raise ValueError("제출된 결과가 없는 작업은 반려할 수 없습니다")
    task.status = "claimed" if task.platform == "kakao" else "ready"
    task.reject_reason = reason
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
    # 자체보유계정(own)은 우리 소유라 정산할 필요가 없어 미정산 목록에서 제외
    reviewers = [r for r in get_reviewers(db) if r.category != "own"]
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


def import_card_rules(db: Session, rows: list[dict]) -> schemas.ReviewerImportResult:
    """영수증 카드정보 일괄등록 — CardRuleModal 수동등록 폼(POST /card-rules)과
    동일한 5개 필드를 받아 반복 생성한다. 같은 카드번호+승인번호 앞자리 조합이
    이미 있으면 건너뛴다(카드정보를 무작위로 골라 쓰는 용도라 완전 중복은 의미 없음)."""
    created = 0
    skipped_duplicate = 0
    skipped_invalid = 0
    seen_keys: set[tuple[str, str, str]] = set()

    for row in rows:
        card_prefix_1 = re.sub(r"\D", "", row.get("card_prefix_1") or "")
        card_prefix_2 = re.sub(r"\D", "", row.get("card_prefix_2") or "")
        approval_prefix = re.sub(r"\D", "", row.get("approval_prefix") or "")
        acquirer = (row.get("acquirer") or "").strip()
        card_type = (row.get("card_type") or "").strip()

        if (
            len(card_prefix_1) != 4
            or len(card_prefix_2) != 4
            or not approval_prefix
            or len(approval_prefix) > 7
            or not acquirer
            or not card_type
        ):
            skipped_invalid += 1
            continue

        key = (card_prefix_1, card_prefix_2, approval_prefix)
        if key in seen_keys:
            skipped_duplicate += 1
            continue
        existing = (
            db.query(models.CardRule)
            .filter(
                models.CardRule.card_prefix_1 == card_prefix_1,
                models.CardRule.card_prefix_2 == card_prefix_2,
                models.CardRule.approval_prefix == approval_prefix,
            )
            .first()
        )
        if existing:
            skipped_duplicate += 1
            continue
        seen_keys.add(key)

        db.add(
            models.CardRule(
                card_prefix_1=card_prefix_1,
                card_prefix_2=card_prefix_2,
                approval_prefix=approval_prefix,
                acquirer=acquirer,
                card_type=card_type,
            )
        )
        created += 1

    db.commit()
    return schemas.ReviewerImportResult(
        created=created, skipped_duplicate=skipped_duplicate, skipped_invalid=skipped_invalid
    )


# --- Experience campaigns (체험단 캠페인) ---


def _experience_campaign_to_out(db: Session, campaign: models.ExperienceCampaign) -> schemas.ExperienceCampaignOut:
    out = schemas.ExperienceCampaignOut.model_validate(campaign)
    out.store_name = campaign.store.name if campaign.store else None
    out.store_region = campaign.store.region if campaign.store else None
    out.applicant_count = (
        db.query(models.ExperienceApplication)
        .filter(models.ExperienceApplication.campaign_id == campaign.id)
        .count()
    )
    return out


def get_experience_campaigns(db: Session) -> list[schemas.ExperienceCampaignOut]:
    campaigns = db.query(models.ExperienceCampaign).order_by(models.ExperienceCampaign.id.desc()).all()
    return [_experience_campaign_to_out(db, c) for c in campaigns]


def get_experience_campaign(db: Session, campaign_id: int) -> models.ExperienceCampaign | None:
    return db.query(models.ExperienceCampaign).filter(models.ExperienceCampaign.id == campaign_id).first()


def create_experience_campaign(
    db: Session,
    data: schemas.ExperienceCampaignCreate,
    created_by_reviewer_id: int | None = None,
    approval_status: str = "approved",
) -> schemas.ExperienceCampaignOut:
    store = db.query(models.Store).filter(models.Store.id == data.store_id).first()
    if not store:
        raise ValueError("매장을 찾을 수 없습니다")
    campaign = models.ExperienceCampaign(
        store_id=data.store_id,
        campaign_type=data.campaign_type,
        content_type=data.content_type,
        benefit_type=data.benefit_type,
        product_name=data.product_name,
        product_price=data.product_price,
        capacity=data.capacity,
        content_guide=data.content_guide,
        main_keyword=data.main_keyword,
        sub_keyword=data.sub_keyword,
        reservation_required=data.reservation_required,
        contact_name=data.contact_name,
        contact_method=data.contact_method,
        contact_info=data.contact_info,
        extra_info=data.extra_info,
        recruit_start=data.recruit_start,
        recruit_end=data.recruit_end,
        review_deadline=data.review_deadline,
        is_recurring=data.is_recurring,
        target_age_group=data.target_age_group,
        target_region=data.target_region,
        target_blog_index=data.target_blog_index,
        created_by_reviewer_id=created_by_reviewer_id,
        approval_status=approval_status,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return _experience_campaign_to_out(db, campaign)


def get_experience_campaigns_by_owner(db: Session, owner_reviewer_id: int) -> list[schemas.ExperienceCampaignOut]:
    campaigns = (
        db.query(models.ExperienceCampaign)
        .join(models.Store, models.ExperienceCampaign.store_id == models.Store.id)
        .filter(models.Store.owner_reviewer_id == owner_reviewer_id)
        .order_by(models.ExperienceCampaign.id.desc())
        .all()
    )
    return [_experience_campaign_to_out(db, c) for c in campaigns]


def update_experience_campaign_approval(
    db: Session, campaign: models.ExperienceCampaign, status: str
) -> schemas.ExperienceCampaignOut:
    campaign.approval_status = status
    db.commit()
    db.refresh(campaign)
    return _experience_campaign_to_out(db, campaign)


def update_experience_campaign(
    db: Session, campaign: models.ExperienceCampaign, data: schemas.ExperienceCampaignUpdate
) -> schemas.ExperienceCampaignOut:
    for field in (
        "campaign_type", "content_type", "benefit_type", "product_name", "product_price",
        "capacity", "content_guide", "main_keyword", "sub_keyword", "reservation_required",
        "contact_name", "contact_method", "contact_info",
        "extra_info", "recruit_start", "recruit_end", "review_deadline", "is_recurring",
        "target_age_group", "target_region", "target_blog_index",
    ):
        value = getattr(data, field)
        if value is not None:
            setattr(campaign, field, value)
    db.commit()
    db.refresh(campaign)
    return _experience_campaign_to_out(db, campaign)


def delete_experience_campaign(db: Session, campaign: models.ExperienceCampaign) -> None:
    db.delete(campaign)
    db.commit()


def save_experience_campaign_image(
    db: Session, campaign: models.ExperienceCampaign, content: bytes, filename: str
) -> schemas.ExperienceCampaignOut:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        raise ValueError(f"지원하지 않는 이미지 형식입니다: {ext or '(확장자 없음)'}")
    dest = os.path.join(UPLOADS_DIR, "campaigns", f"experience_campaign_{campaign.id}{ext}")
    with open(dest, "wb") as f:
        f.write(content)
    campaign.image_path = f"/uploads/campaigns/experience_campaign_{campaign.id}{ext}"
    db.commit()
    db.refresh(campaign)
    return _experience_campaign_to_out(db, campaign)


def save_business_registration_image(
    db: Session, reviewer: models.Reviewer, content: bytes, filename: str
) -> models.Reviewer:
    """광고주 회원가입 시 첨부하는 사업자등록증 — 업로드만으로는 승인(is_active)되지
    않는다, 관리자가 회원관리에서 이미지를 직접 확인하고 활성화해줘야 한다."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        raise ValueError(f"지원하지 않는 이미지 형식입니다: {ext or '(확장자 없음)'}")
    dest_dir = os.path.join(UPLOADS_DIR, "business_registrations")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"reviewer_{reviewer.id}{ext}")
    with open(dest, "wb") as f:
        f.write(content)
    reviewer.business_registration_image_path = f"/uploads/business_registrations/reviewer_{reviewer.id}{ext}"
    db.commit()
    db.refresh(reviewer)
    return reviewer


def experience_application_to_out(app_row: models.ExperienceApplication) -> schemas.ExperienceApplicationOut:
    out = schemas.ExperienceApplicationOut.model_validate(app_row)
    reviewer = app_row.reviewer
    if reviewer:
        out.reviewer_name = reviewer.name
        out.reviewer_contact_info = reviewer.contact_info
        out.reviewer_blog_url = reviewer.blog_url
        out.reviewer_blog_index = reviewer.blog_index
        out.reviewer_gender = reviewer.gender
        out.reviewer_age_group = reviewer.age_group
        out.reviewer_region = reviewer.region
    return out


def get_experience_applications(db: Session, campaign_id: int) -> list[schemas.ExperienceApplicationOut]:
    applications = (
        db.query(models.ExperienceApplication)
        .filter(models.ExperienceApplication.campaign_id == campaign_id)
        .order_by(models.ExperienceApplication.id.desc())
        .all()
    )
    return [experience_application_to_out(a) for a in applications]


def get_experience_candidates(db: Session, campaign_id: int) -> list[schemas.ExperienceScoutCandidateOut]:
    """블로그 정보를 등록했고 이 캠페인에 아직 신청하지 않은 체험단 후보 —
    "모집희망 찾아보기"에서 관리자가 직접 섭외할 대상을 고를 때 쓴다."""
    already_applied_ids = {
        row.reviewer_id
        for row in db.query(models.ExperienceApplication.reviewer_id)
        .filter(models.ExperienceApplication.campaign_id == campaign_id)
        .all()
    }
    candidates = (
        db.query(models.Reviewer)
        .filter(models.Reviewer.blog_url.isnot(None), models.Reviewer.blog_url != "")
        .all()
    )
    return [
        schemas.ExperienceScoutCandidateOut(
            reviewer_id=r.id,
            blog_url=r.blog_url,
            blog_index=r.blog_index,
            age_group=r.age_group,
            region=r.region,
        )
        for r in candidates
        if r.id not in already_applied_ids
    ]


def get_experience_application(db: Session, application_id: int) -> models.ExperienceApplication | None:
    return (
        db.query(models.ExperienceApplication)
        .filter(models.ExperienceApplication.id == application_id)
        .first()
    )


def create_experience_application(
    db: Session, campaign_id: int, reviewer_id: int
) -> models.ExperienceApplication:
    existing = (
        db.query(models.ExperienceApplication)
        .filter(
            models.ExperienceApplication.campaign_id == campaign_id,
            models.ExperienceApplication.reviewer_id == reviewer_id,
        )
        .first()
    )
    if existing:
        raise ValueError("이미 신청한 캠페인입니다")
    application = models.ExperienceApplication(campaign_id=campaign_id, reviewer_id=reviewer_id)
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


def update_experience_application_status(
    db: Session, application: models.ExperienceApplication, status: str
) -> models.ExperienceApplication:
    application.status = status
    db.commit()
    db.refresh(application)
    return application


def get_portal_experience_campaigns(
    db: Session, reviewer_id: int
) -> list[schemas.PortalExperienceCampaignOut]:
    now = datetime.datetime.utcnow()
    campaigns = (
        db.query(models.ExperienceCampaign)
        .filter(
            models.ExperienceCampaign.recruit_start <= now,
            models.ExperienceCampaign.recruit_end >= now,
            models.ExperienceCampaign.approval_status == "approved",
        )
        .order_by(models.ExperienceCampaign.recruit_end)
        .all()
    )
    applied_campaign_ids = {
        row.campaign_id
        for row in db.query(models.ExperienceApplication.campaign_id)
        .filter(models.ExperienceApplication.reviewer_id == reviewer_id)
        .all()
    }
    results = []
    for c in campaigns:
        applicant_count = (
            db.query(models.ExperienceApplication)
            .filter(models.ExperienceApplication.campaign_id == c.id)
            .count()
        )
        results.append(
            schemas.PortalExperienceCampaignOut(
                id=c.id,
                store_name=c.store.name if c.store else "",
                store_region=c.store.region if c.store else None,
                store_url=c.store.url if c.store else None,
                campaign_type=c.campaign_type,
                content_type=c.content_type,
                product_name=c.product_name,
                product_price=c.product_price,
                capacity=c.capacity,
                applicant_count=applicant_count,
                recruit_start=c.recruit_start,
                recruit_end=c.recruit_end,
                review_deadline=c.review_deadline,
                already_applied=c.id in applied_campaign_ids,
                image_path=c.image_path,
                content_guide=c.content_guide,
                main_keyword=c.main_keyword,
                sub_keyword=c.sub_keyword,
                reservation_required=c.reservation_required,
                contact_name=c.contact_name,
                contact_method=c.contact_method,
                contact_info=c.contact_info,
                extra_info=c.extra_info,
            )
        )
    return results
