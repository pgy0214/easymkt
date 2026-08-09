import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

Platform = Literal["naver", "kakao"]
ReviewerCategory = Literal["admin", "reviewer", "experience", "press", "advertiser"]
Gender = Literal["male", "female"]
TimeSlot = Literal["morning", "afternoon", "night"]
ApplicationStatus = Literal["pending", "approved", "rejected"]


# --- Admin dashboard login ---

class AdminLoginIn(BaseModel):
    username: str
    password: str


class AdminLoginOut(BaseModel):
    token: str


# --- ReviewAccount ---

class ReviewAccountCreate(BaseModel):
    platform: Platform
    label: str
    profile_url: Optional[str] = None
    ip_address: Optional[str] = None
    adspower_profile_id: Optional[str] = None
    time_slot: Optional[TimeSlot] = None
    has_login_issue: bool = False
    password: Optional[str] = None  # crud가 암호화해서 저장, 평문은 DB에 안 남음


class ReviewAccountUpdate(BaseModel):
    platform: Optional[Platform] = None
    label: Optional[str] = None
    profile_url: Optional[str] = None
    ip_address: Optional[str] = None
    adspower_profile_id: Optional[str] = None
    time_slot: Optional[TimeSlot] = None
    has_login_issue: Optional[bool] = None
    password: Optional[str] = None  # 빈 문자열이면 비밀번호 삭제, None이면 안 건드림


class ReviewAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reviewer_id: int
    platform: Platform
    label: str
    profile_url: Optional[str] = None
    ip_address: Optional[str] = None
    adspower_profile_id: Optional[str] = None
    time_slot: Optional[TimeSlot] = None
    has_login_issue: bool = False
    created_at: datetime.datetime

    # ORM 컬럼명(password_encrypted)과 달라서 자동 매핑 안 됨 — crud.account_to_out이
    # 복호화해서 채워줌 (work_days_raw→work_days와 동일한 패턴)
    password: Optional[str] = None


class AccountLaunchOut(BaseModel):
    debug_port: Optional[str] = None


class AccountAvailabilityOut(BaseModel):
    account_id: int
    label: str
    available_date: Optional[datetime.date] = None
    error: Optional[str] = None


class BulkAssignTimeSlotIn(BaseModel):
    account_ids: list[int]


class BulkAssignTimeSlotOut(BaseModel):
    assigned_count: int


# --- Reviewer ---

class ReviewerCreate(BaseModel):
    name: str
    category: ReviewerCategory = "reviewer"
    memo: Optional[str] = None
    contact_info: Optional[str] = None
    is_active: bool = True
    region: Optional[str] = None  # 체험단 전용
    blog_url: Optional[str] = None  # 체험단 전용
    blog_index: Optional[str] = None  # 체험단 전용, 블로그 지수(등급/점수 등 자유 표기)
    email: Optional[str] = None  # 체험단 전용, 블로그 주소 중복의심 시 관리자 확인용
    age_group: Optional[str] = None  # 체험단 전용
    gender: Optional[Gender] = None
    birth_date: Optional[datetime.date] = None
    applied_at: Optional[datetime.datetime] = None  # 체험단 전용, 지원 시각
    application_status: Optional[ApplicationStatus] = None  # 체험단 전용
    topics: Optional[list[str]] = None  # 체험단 전용, 관심 주제


class ReviewerUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[ReviewerCategory] = None
    memo: Optional[str] = None
    contact_info: Optional[str] = None
    is_active: Optional[bool] = None
    region: Optional[str] = None
    blog_url: Optional[str] = None
    blog_index: Optional[str] = None
    email: Optional[str] = None
    age_group: Optional[str] = None
    gender: Optional[Gender] = None
    birth_date: Optional[datetime.date] = None
    applied_at: Optional[datetime.datetime] = None
    application_status: Optional[ApplicationStatus] = None
    topics: Optional[list[str]] = None


class ReviewerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: ReviewerCategory
    memo: Optional[str] = None
    contact_info: Optional[str] = None
    is_active: bool
    region: Optional[str] = None
    blog_url: Optional[str] = None
    blog_index: Optional[str] = None
    email: Optional[str] = None
    age_group: Optional[str] = None
    gender: Optional[Gender] = None
    birth_date: Optional[datetime.date] = None
    applied_at: Optional[datetime.datetime] = None
    application_status: Optional[ApplicationStatus] = None
    username: Optional[str] = None
    topics: Optional[str] = None
    created_at: datetime.datetime
    accounts: list[ReviewAccountOut] = []

    # crud.reviewer_to_out이 각각 privacy_consent_at/marketing_consent_at 존재
    # 여부로 채워줌
    privacy_consent: bool = False
    marketing_consent: bool = False

    # 다른 리뷰어와 블로그 주소가 겹치는지 — crud.reviewer_to_out이 계산해서 채워줌
    blog_duplicate: bool = False


class RecentPostOut(BaseModel):
    title: str
    posted_date: Optional[datetime.date] = None


# --- Store ---

class StoreCreate(BaseModel):
    platform: Platform
    name: str
    url: str
    address: Optional[str] = None
    region: Optional[str] = None  # 체험단 캠페인 카드용 짧은 지역 라벨
    representative_hours: Optional[str] = None  # 대표시간
    representative_product: Optional[str] = None  # 대표상품
    cooldown_days: int = 90
    # 크롤링 불가 — 영수증 생성용, 등록 화면에서 바로 입력 가능(수정 화면에서도 계속 고칠 수 있음)
    business_registration_number: Optional[str] = None
    representative_name: Optional[str] = None
    phone: Optional[str] = None


class StoreUpdate(BaseModel):
    # name/address/representative_hours are crawled facts about the real
    # place and are intentionally not editable after creation — fix a wrong
    # value by deleting the store and re-registering it with the right URL.
    url: Optional[str] = None
    region: Optional[str] = None
    representative_product: Optional[str] = None
    cooldown_days: Optional[int] = None
    # not crawlable — admin enters these once, reused by every campaign at
    # this store for receipt-image generation
    business_registration_number: Optional[str] = None
    representative_name: Optional[str] = None
    phone: Optional[str] = None


class StoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    platform: Platform
    name: str
    url: str
    address: Optional[str] = None
    region: Optional[str] = None
    representative_hours: Optional[str] = None
    representative_product: Optional[str] = None
    business_registration_number: Optional[str] = None
    representative_name: Optional[str] = None
    phone: Optional[str] = None
    cooldown_days: int
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None


class StoreInfoFetchIn(BaseModel):
    url: str


class StoreInfoFetchOut(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    representative_hours: Optional[str] = None
    representative_product: Optional[str] = None


class StoreReceiptIn(BaseModel):
    date: Optional[datetime.date] = None
    count: int = 1


class CardRuleIn(BaseModel):
    card_prefix_1: str
    card_prefix_2: str
    approval_prefix: str
    acquirer: str
    card_type: str


class CardRuleOut(CardRuleIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class StoreReceiptOut(BaseModel):
    url: str


# --- ReviewTarget ---

class MenuItemIn(BaseModel):
    name: str
    price: int


class ReviewTargetCreate(BaseModel):
    store_id: int
    required_count: int
    unit_price: int  # 리뷰어 정산 단가
    sale_price: Optional[int] = None  # 매장 판매 단가 ("매출"), 없으면 정산요약 매출 집계에서 제외
    # weekday ints (0=Mon..6=Sun) the campaign's tasks may appear in the open
    # pool; None/omitted = visible every day. claim_time_limit_minutes is no
    # longer set per campaign — it's always snapshotted from Settings at
    # creation time (see crud.create_review_target).
    work_days: Optional[list[int]] = None
    daily_limit: Optional[int] = None  # 하루 최대 클레임 허용 건수; None = 제한 없음
    start_date: Optional[datetime.date] = None  # 작업 기간 시작일; None = 등록 즉시부터
    end_date: Optional[datetime.date] = None  # 작업 기간 종료일; None = 무기한
    # 리뷰 원고 자료
    guideline: Optional[str] = None
    regional_features: Optional[str] = None
    menu_items: Optional[list[MenuItemIn]] = None  # 최대 3개, 영수증 생성에도 사용
    photos_per_review: int = 1  # 리뷰 1건당 배정할 사진 갯수
    review_length: int = 80  # 리뷰 원고 목표 글자수 (50/80/100)


class ReviewTargetUpdate(BaseModel):
    # platform/store_id/required_count는 Task 생성 시점에 확정되는 구조적
    # 값이라 수정 대상에서 제외 — 잘못 등록했으면 삭제 후 재등록
    unit_price: Optional[int] = None
    sale_price: Optional[int] = None
    daily_limit: Optional[int] = None
    work_days: Optional[list[int]] = None
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    guideline: Optional[str] = None
    regional_features: Optional[str] = None
    menu_items: Optional[list[MenuItemIn]] = None
    photos_per_review: Optional[int] = None
    review_length: Optional[int] = None


class TargetPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_path: str


class TargetReviewTextOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str


class ReviewTextGenerateIn(BaseModel):
    guideline: Optional[str] = None
    regional_features: Optional[str] = None
    review_length: int = 80
    menu_items: Optional[list[MenuItemIn]] = None


class ReviewTextGenerateOut(BaseModel):
    text: str


class ReviewTargetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    platform: Platform
    required_count: int
    unit_price: int
    sale_price: Optional[int] = None
    claim_time_limit_minutes: int
    daily_limit: Optional[int] = None
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    created_at: datetime.datetime

    # denormalized, filled in by the router
    store_name: Optional[str] = None
    store_url: Optional[str] = None

    # parsed from the ORM's work_days_raw CSV column by crud.target_to_out
    # (kept off the ORM-matching attribute name to avoid a from_attributes
    # type mismatch — see crud.decode_work_days)
    work_days: Optional[list[int]] = None

    guideline: Optional[str] = None
    regional_features: Optional[str] = None
    # parsed from menu_items_json by crud.target_to_out (same reasoning as work_days)
    menu_items: Optional[list[MenuItemIn]] = None
    reference_photo_path: Optional[str] = None
    photos_per_review: int = 1
    photos: list[TargetPhotoOut] = []
    review_length: int = 80
    review_texts: list[TargetReviewTextOut] = []

    # denormalized, filled in by the router — 캠페인 목록의 진행중/완료 필터에 사용
    completed_count: int = 0


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
    sale_amount: Optional[int] = None
    receipt_image_path: Optional[str] = None
    # denormalized, filled in by the router — 캠페인 사진 풀에서 라운드로빈으로
    # 배정된 이 작업의 사진들 (crud.assign_photos_for_task)
    assigned_photo_paths: list[str] = []
    # denormalized, filled in by the router — 업로드분에서 1:1 배정되거나 부족분은
    # AI(app.review_writer)로 생성된 리뷰 원고 (crud.assign_review_text_for_task)
    assigned_review_text: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    # denormalized display fields, filled in by the router (not on the ORM model)
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewer_contact_info: Optional[str] = None
    reviewer_category: Optional[str] = None
    account_label: Optional[str] = None
    account_profile_url: Optional[str] = None
    store_id: Optional[int] = None
    store_name: Optional[str] = None
    store_url: Optional[str] = None

    # portal-pool only: which of the requesting reviewer's own accounts (for
    # this task's platform) currently pass the store's cooldown and may claim it
    eligible_account_ids: Optional[list[int]] = None


class PoolGroupOut(BaseModel):
    """포털 오픈풀 — 매장(캠페인)당 한 줄로 묶은 요약. 개별 Task 목록이 아님."""

    review_target_id: int
    store_id: Optional[int] = None
    store_name: Optional[str] = None
    platform: Platform
    unit_price: int
    remaining_today: int
    total_today: int
    sample_task_id: int  # "할게요" 클레임 시 실제로 클레임할 작업 id (그룹 내 아무 것이나 동일)
    eligible_account_ids: list[int] = []


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


class RevenueSummaryOut(BaseModel):
    total: int
    count: int


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


# --- 알림 발송 (SMS / 카카오 알림톡) ---

class NotifyStatusOut(BaseModel):
    sms_configured: bool
    kakao_configured: bool


class BulkMessageIn(BaseModel):
    reviewer_ids: list[int]
    channel: Literal["sms", "kakao"]
    message: str  # {name}은 수신자 이름으로 치환됨
    template_code: Optional[str] = None  # channel="kakao"일 때 필수
    fallback_message: Optional[str] = None  # channel="kakao"일 때, 실패 시 대체 문자


class NotifyResultItem(BaseModel):
    reviewer_id: int
    name: str
    success: bool
    reason: Optional[str] = None


# --- Self-service portal ---

class OtpRequestIn(BaseModel):
    phone: str


class OtpVerifyIn(BaseModel):
    phone: str
    code: str


class OtpVerifyOut(BaseModel):
    token: str
    reviewer: ReviewerOut
    # true면 아직 아이디/비밀번호를 만든 적이 없는 계정 — 프론트가 회원가입 완료
    # 화면으로 보내야 한다. false면 이미 가입된 계정이 인증번호로 들어온 것 —
    # 비밀번호를 잊어서 임시 비밀번호를 받으러 온 상황이다.
    needs_signup: bool


class PortalCompleteSignupIn(BaseModel):
    username: str
    password: str
    name: str
    privacy_consent: bool
    marketing_consent: bool = False
    # 체험단 활동을 한다면(선택) 채워지는 정보
    gender: Optional[Gender] = None
    region: Optional[str] = None
    age_group: Optional[str] = None
    topics: Optional[list[str]] = None
    # 광고주 포털에서 회원가입한 경우 "advertiser"로 전달됨
    category: Optional[Literal["advertiser"]] = None


class PortalProfileUpdateIn(BaseModel):
    """로그인 후 정보 수정 — 아이디/비밀번호는 별도 플로우(분실 시 재발급)로만
    바뀌므로 여기서는 다루지 않는다."""

    name: Optional[str] = None
    contact_info: Optional[str] = None
    gender: Optional[Gender] = None
    region: Optional[str] = None
    age_group: Optional[str] = None
    topics: Optional[list[str]] = None
    privacy_consent: Optional[bool] = None
    marketing_consent: Optional[bool] = None


class PortalResetPasswordOut(BaseModel):
    username: str
    temp_password: str


class PortalDevAutoLoginOut(BaseModel):
    enabled: bool
    token: Optional[str] = None


class KakaoConfigOut(BaseModel):
    configured: bool
    client_id: Optional[str] = None
    redirect_uri: Optional[str] = None


class KakaoExchangeIn(BaseModel):
    code: str


class KakaoExchangeOut(BaseModel):
    linked: bool
    token: Optional[str] = None
    reviewer: Optional[ReviewerOut] = None
    kakao_access_token: Optional[str] = None  # linked=False일 때만: confirm 단계에 그대로 전달
    suggested_name: Optional[str] = None


class KakaoConfirmIn(BaseModel):
    phone: str
    code: str  # SMS OTP 코드
    kakao_access_token: str  # exchange가 돌려준 값 — 서버가 다시 카카오에 검증
    name: Optional[str] = None


class PortalLoginIn(BaseModel):
    username: str
    password: str


class PortalClaimIn(BaseModel):
    account_id: int


class PortalBlogUrlIn(BaseModel):
    blog_url: str
    blog_index: Optional[str] = None
    email: Optional[str] = None


class TaskBriefOut(BaseModel):
    guideline: Optional[str] = None
    regional_features: Optional[str] = None
    menu_items: Optional[list[MenuItemIn]] = None
    reference_photo_path: Optional[str] = None
    assigned_photo_paths: list[str] = []
    assigned_review_text: Optional[str] = None
    receipt_image_path: Optional[str] = None


# --- Admin-side direct assignment (개별연락 후 배정) ---

class TaskAssignIn(BaseModel):
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


# --- Experience campaigns (체험단 캠페인) ---

CampaignType = Literal["방문형", "배송형"]
ContentType = Literal["블로그", "인스타그램", "유튜브", "틱톡"]
BenefitType = Literal["선착순 제공"]
ContactMethod = Literal["문자", "전화"]


class ExperienceCampaignCreate(BaseModel):
    store_id: int
    campaign_type: CampaignType
    content_type: ContentType
    benefit_type: BenefitType = "선착순 제공"
    product_name: str
    product_price: Optional[int] = None
    capacity: int
    content_guide: Optional[str] = None
    main_keyword: Optional[str] = None
    sub_keyword: Optional[str] = None
    reservation_required: bool = False
    contact_name: Optional[str] = None
    contact_method: Optional[ContactMethod] = None
    contact_info: Optional[str] = None
    extra_info: Optional[str] = None
    recruit_start: datetime.datetime
    recruit_end: datetime.datetime
    review_deadline: Optional[datetime.date] = None
    is_recurring: bool = False
    # 모집 희망사항 — 광고주가 원하는 블로거 조건, 관리자 전용(리뷰어에게는 노출 안 함)
    target_age_group: Optional[str] = None
    target_region: Optional[str] = None
    target_blog_index: Optional[str] = None


class ExperienceCampaignUpdate(BaseModel):
    campaign_type: Optional[CampaignType] = None
    content_type: Optional[ContentType] = None
    benefit_type: Optional[BenefitType] = None
    product_name: Optional[str] = None
    product_price: Optional[int] = None
    capacity: Optional[int] = None
    content_guide: Optional[str] = None
    main_keyword: Optional[str] = None
    sub_keyword: Optional[str] = None
    reservation_required: Optional[bool] = None
    contact_name: Optional[str] = None
    contact_method: Optional[ContactMethod] = None
    contact_info: Optional[str] = None
    extra_info: Optional[str] = None
    recruit_start: Optional[datetime.datetime] = None
    recruit_end: Optional[datetime.datetime] = None
    review_deadline: Optional[datetime.date] = None
    is_recurring: Optional[bool] = None
    target_age_group: Optional[str] = None
    target_region: Optional[str] = None
    target_blog_index: Optional[str] = None


class ExperienceCampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    campaign_type: CampaignType
    content_type: ContentType
    benefit_type: BenefitType
    product_name: str
    product_price: Optional[int] = None
    capacity: int
    content_guide: Optional[str] = None
    main_keyword: Optional[str] = None
    sub_keyword: Optional[str] = None
    reservation_required: bool
    contact_name: Optional[str] = None
    contact_method: Optional[str] = None
    contact_info: Optional[str] = None
    extra_info: Optional[str] = None
    recruit_start: datetime.datetime
    recruit_end: datetime.datetime
    review_deadline: Optional[datetime.date] = None
    is_recurring: bool
    image_path: Optional[str] = None
    target_age_group: Optional[str] = None
    target_region: Optional[str] = None
    target_blog_index: Optional[str] = None
    approval_status: str = "approved"  # approved|pending|rejected — 광고주 등록분만 관리자 승인 필요
    created_at: datetime.datetime

    # denormalized, filled in by crud
    store_name: Optional[str] = None
    store_region: Optional[str] = None
    applicant_count: int = 0


class ExperienceCampaignApprovalIn(BaseModel):
    status: Literal["approved", "rejected"]


class ExperienceApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    reviewer_id: int
    status: str
    applied_at: datetime.datetime
    result_link: Optional[str] = None

    # denormalized, filled in by crud — 이름/연락처/성별/연령대/지역은 승인 전에는
    # 프론트에서 숨기고 블로그주소/지수만 보여준다(개인정보 보호, 승인 후 공개)
    reviewer_name: Optional[str] = None
    reviewer_contact_info: Optional[str] = None
    reviewer_blog_url: Optional[str] = None
    reviewer_blog_index: Optional[str] = None
    reviewer_gender: Optional[str] = None
    reviewer_age_group: Optional[str] = None
    reviewer_region: Optional[str] = None


class ExperienceApplicationStatusIn(BaseModel):
    status: Literal["approved", "rejected"]


class ExperienceScoutCandidateOut(BaseModel):
    reviewer_id: int
    blog_url: str
    blog_index: Optional[str] = None
    age_group: Optional[str] = None
    region: Optional[str] = None


class ExperienceScoutIn(BaseModel):
    reviewer_ids: list[int]


class PortalExperienceCampaignOut(BaseModel):
    id: int
    store_name: str
    store_region: Optional[str] = None
    store_url: Optional[str] = None  # "구경하기" 버튼용 — 매장/상품 페이지 바로가기
    campaign_type: CampaignType
    content_type: ContentType
    product_name: str
    product_price: Optional[int] = None
    capacity: int
    applicant_count: int
    recruit_start: datetime.datetime
    recruit_end: datetime.datetime
    review_deadline: Optional[datetime.date] = None
    already_applied: bool
    image_path: Optional[str] = None

    # 캠페인 상세 — 가이드라인/키워드/방문정보. 모집 희망사항(target_*)은 광고주
    # 전용 정보라 여기 포함하지 않는다(리뷰어에게 노출 금지).
    content_guide: Optional[str] = None
    main_keyword: Optional[str] = None
    sub_keyword: Optional[str] = None
    reservation_required: bool = False
    contact_name: Optional[str] = None
    contact_method: Optional[str] = None
    contact_info: Optional[str] = None
    extra_info: Optional[str] = None
