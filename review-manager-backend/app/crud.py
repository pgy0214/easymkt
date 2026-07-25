import datetime
import secrets

from sqlalchemy.orm import Session

from app import models, schemas


# --- Reviewer ---

def get_reviewers(db: Session) -> list[models.Reviewer]:
    return db.query(models.Reviewer).order_by(models.Reviewer.id).all()


def get_reviewer(db: Session, reviewer_id: int) -> models.Reviewer | None:
    return db.query(models.Reviewer).filter(models.Reviewer.id == reviewer_id).first()


def get_reviewer_by_contact(db: Session, phone: str) -> models.Reviewer | None:
    return db.query(models.Reviewer).filter(models.Reviewer.contact_info == phone).first()


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


def create_reviewer(db: Session, data: schemas.ReviewerCreate) -> models.Reviewer:
    reviewer = models.Reviewer(
        name=data.name,
        memo=data.memo,
        contact_info=data.contact_info,
        is_active=data.is_active,
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
    if data.memo is not None:
        reviewer.memo = data.memo
    if data.contact_info is not None:
        reviewer.contact_info = data.contact_info
    if data.is_active is not None:
        reviewer.is_active = data.is_active
    db.commit()
    db.refresh(reviewer)
    return reviewer


def import_reviewers(db: Session, rows: list[dict]) -> schemas.ReviewerImportResult:
    """Bulk-import from the '리뷰어' master-list sheet: name + contact only, no
    accounts (that sheet has no account/URL data). Imported reviewers start
    inactive (연락불가) — the admin reviews and activates who's actually
    reachable before they become eligible for task assignment."""
    created = 0
    skipped_duplicate = 0
    skipped_invalid = 0

    for row in rows:
        name = row.get("name")
        if not name:
            skipped_invalid += 1
            continue

        contact_info = row.get("contact_info")
        if contact_info:
            existing = (
                db.query(models.Reviewer)
                .filter(models.Reviewer.contact_info == contact_info)
                .first()
            )
            if existing:
                skipped_duplicate += 1
                continue

        reviewer = models.Reviewer(
            name=name,
            memo=row.get("note"),
            contact_info=contact_info,
            is_active=False,
        )
        db.add(reviewer)
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

def create_account(
    db: Session, reviewer_id: int, data: schemas.ReviewAccountCreate
) -> models.ReviewAccount:
    account = models.ReviewAccount(
        reviewer_id=reviewer_id,
        platform=data.platform,
        label=data.label,
        profile_url=data.profile_url,
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
    db.commit()
    db.refresh(account)
    return account


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
        cooldown_days=data.cooldown_days,
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


def update_store(db: Session, store: models.Store, data: schemas.StoreUpdate) -> models.Store:
    if data.name is not None:
        store.name = data.name
    if data.url is not None:
        store.url = data.url
    if data.cooldown_days is not None:
        store.cooldown_days = data.cooldown_days
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


def target_to_out(target: models.ReviewTarget) -> schemas.ReviewTargetOut:
    out = schemas.ReviewTargetOut.model_validate(target)
    if target.store is not None:
        out.store_name = target.store.name
        out.store_url = target.store.url
    return out


def get_target(db: Session, target_id: int) -> models.ReviewTarget | None:
    return (
        db.query(models.ReviewTarget).filter(models.ReviewTarget.id == target_id).first()
    )


def delete_target(db: Session, target: models.ReviewTarget) -> None:
    in_progress = [t for t in target.tasks if t.status != "open"]
    if in_progress:
        raise ValueError(
            "이미 클레임되었거나 완료된 작업이 있어 캠페인을 삭제할 수 없습니다"
        )
    db.delete(target)
    db.commit()


def create_review_target(
    db: Session, data: schemas.ReviewTargetCreate
) -> models.ReviewTarget:
    """Create the target and its tasks as an unassigned open pool — reviewers
    claim them themselves via the self-service portal (no auto round-robin)."""
    store = get_store(db, data.store_id)
    if not store:
        raise ValueError("매장을 찾을 수 없습니다")

    target = models.ReviewTarget(
        store_id=store.id,
        platform=store.platform,
        required_count=data.required_count,
        unit_price=data.unit_price,
        claim_time_limit_minutes=data.claim_time_limit_minutes,
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
        )
        db.add(task)

    db.commit()
    db.refresh(target)
    return target


# --- Task ---

def task_to_out(task: models.Task) -> schemas.TaskOut:
    account = task.review_account
    reviewer = account.reviewer if account else None
    target = task.review_target

    out = schemas.TaskOut.model_validate(task)
    if reviewer is not None:
        out.reviewer_id = reviewer.id
        out.reviewer_name = reviewer.name
        out.reviewer_contact_info = reviewer.contact_info
    if account is not None:
        out.account_label = account.label
    if target is not None and target.store is not None:
        out.store_id = target.store.id
        out.store_name = target.store.name
        out.store_url = target.store.url
    return out


def get_tasks(
    db: Session,
    reviewer_id: int | None = None,
    account_id: int | None = None,
    platform: str | None = None,
    status: str | None = None,
    blind_status: str | None = None,
    settlement_status: str | None = None,
    sort: str | None = None,
) -> list[models.Task]:
    # outerjoin (not join) — 'open' pool tasks have no review_account_id yet and
    # must still show up in the admin dashboard
    query = db.query(models.Task).outerjoin(
        models.ReviewAccount, models.Task.review_account_id == models.ReviewAccount.id
    )

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


def get_open_pool_tasks(db: Session, platforms: list[str]) -> list[models.Task]:
    return (
        db.query(models.Task)
        .filter(models.Task.status == "open", models.Task.platform.in_(platforms))
        .order_by(models.Task.created_at)
        .all()
    )


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
    reviewers = get_reviewers(db)
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
