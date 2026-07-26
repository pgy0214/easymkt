import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

Platform = Literal["naver", "kakao"]


# --- ReviewAccount ---

class ReviewAccountCreate(BaseModel):
    platform: Platform
    label: str
    profile_url: Optional[str] = None


class ReviewAccountUpdate(BaseModel):
    platform: Optional[Platform] = None
    label: Optional[str] = None
    profile_url: Optional[str] = None


class ReviewAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reviewer_id: int
    platform: Platform
    label: str
    profile_url: Optional[str] = None
    created_at: datetime.datetime


# --- Reviewer ---

class ReviewerCreate(BaseModel):
    name: str
    memo: Optional[str] = None
    contact_info: Optional[str] = None
    is_active: bool = True


class ReviewerUpdate(BaseModel):
    name: Optional[str] = None
    memo: Optional[str] = None
    contact_info: Optional[str] = None
    is_active: Optional[bool] = None


class ReviewerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    memo: Optional[str] = None
    contact_info: Optional[str] = None
    is_active: bool
    created_at: datetime.datetime
    accounts: list[ReviewAccountOut] = []


# --- Store ---

class StoreCreate(BaseModel):
    platform: Platform
    name: str
    url: str
    address: Optional[str] = None
    business_hours: Optional[str] = None
    menu: Optional[str] = None
    cooldown_days: int = 90


class StoreUpdate(BaseModel):
    # name/address/business_hours are crawled facts about the real place and
    # are intentionally not editable after creation — fix a wrong value by
    # deleting the store and re-registering it with the right URL.
    url: Optional[str] = None
    menu: Optional[str] = None
    cooldown_days: Optional[int] = None


class StoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    platform: Platform
    name: str
    url: str
    address: Optional[str] = None
    business_hours: Optional[str] = None
    menu: Optional[str] = None
    cooldown_days: int
    created_at: datetime.datetime


class StoreInfoFetchIn(BaseModel):
    url: str


class StoreInfoFetchOut(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    business_hours: Optional[str] = None
    menu: Optional[str] = None


# --- ReviewTarget ---

class ReviewTargetCreate(BaseModel):
    store_id: int
    required_count: int
    unit_price: int
    # weekday ints (0=Mon..6=Sun) the campaign's tasks may appear in the open
    # pool; None/omitted = visible every day. claim_time_limit_minutes is no
    # longer set per campaign — it's always snapshotted from Settings at
    # creation time (see crud.create_review_target).
    work_days: Optional[list[int]] = None


class ReviewTargetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    platform: Platform
    required_count: int
    unit_price: int
    claim_time_limit_minutes: int
    created_at: datetime.datetime

    # denormalized, filled in by the router
    store_name: Optional[str] = None
    store_url: Optional[str] = None

    # parsed from the ORM's work_days_raw CSV column by crud.target_to_out
    # (kept off the ORM-matching attribute name to avoid a from_attributes
    # type mismatch — see crud.decode_work_days)
    work_days: Optional[list[int]] = None


class ReviewTargetDetailOut(ReviewTargetOut):
    tasks: list["TaskOut"] = []


# --- Task ---

class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    review_target_id: int
    review_account_id: Optional[int] = None
    platform: Platform
    status: str
    claimed_at: Optional[datetime.datetime] = None
    claim_deadline: Optional[datetime.datetime] = None
    last_expired_at: Optional[datetime.datetime] = None
    naver_available_date: Optional[datetime.date] = None
    result_link: Optional[str] = None
    completed_at: Optional[datetime.datetime] = None
    review_posted_date: Optional[datetime.date] = None
    blind_status: str
    blind_checked_at: Optional[datetime.datetime] = None
    check_expired: bool
    settlement_amount: int
    settlement_status: str
    settlement_paid_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    # denormalized display fields, filled in by the router (not on the ORM model)
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewer_contact_info: Optional[str] = None
    account_label: Optional[str] = None
    store_id: Optional[int] = None
    store_name: Optional[str] = None
    store_url: Optional[str] = None

    # portal-pool only: which of the requesting reviewer's own accounts (for
    # this task's platform) currently pass the store's cooldown and may claim it
    eligible_account_ids: Optional[list[int]] = None


class TaskResultUpdate(BaseModel):
    result_link: str


class TaskSettlementUpdate(BaseModel):
    settlement_status: Literal["unpaid", "paid"]
    settlement_amount: Optional[int] = None


# --- Settlement summary ---

class SettlementSummaryItem(BaseModel):
    reviewer_id: int
    reviewer_name: str
    completed_count: int
    unpaid_amount: int
    paid_amount: int


# --- Settings ---

class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    naver_blind_check_interval_minutes: int
    kakao_blind_check_interval_minutes: int
    naver_default_claim_minutes: int
    kakao_default_claim_minutes: int


class SettingsUpdate(BaseModel):
    naver_blind_check_interval_minutes: Optional[int] = None
    kakao_blind_check_interval_minutes: Optional[int] = None
    naver_default_claim_minutes: Optional[int] = None
    kakao_default_claim_minutes: Optional[int] = None


class ReviewerImportResult(BaseModel):
    created: int
    skipped_duplicate: int
    skipped_invalid: int


# --- Self-service portal ---

class OtpRequestIn(BaseModel):
    phone: str
    name: Optional[str] = None  # used to create a new reviewer if phone isn't found yet


class OtpVerifyIn(BaseModel):
    phone: str
    code: str


class OtpVerifyOut(BaseModel):
    token: str
    reviewer: ReviewerOut


class PortalClaimIn(BaseModel):
    account_id: int


# --- Account work history (매장별 작업 이력) ---

class AccountStoreHistoryItem(BaseModel):
    store_id: int
    store_name: str
    platform: Platform
    last_completed_at: datetime.datetime
    cooldown_days: int
    eligible_at: datetime.datetime
    is_eligible_now: bool


ReviewTargetDetailOut.model_rebuild()
