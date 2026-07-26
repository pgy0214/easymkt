import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.datetime.utcnow()


class Reviewer(Base):
    __tablename__ = "reviewers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False, default="reviewer")  # admin|reviewer|experience|press
    memo = Column(String, nullable=True)
    contact_info = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)  # 연락가능(작업배정 대상) 여부
    region = Column(String, nullable=True)  # 체험단 전용
    age_group = Column(String, nullable=True)  # 체험단 전용
    gender = Column(String, nullable=True)  # 체험단 전용, male|female
    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    accounts = relationship(
        "ReviewAccount", back_populates="reviewer", cascade="all, delete-orphan"
    )


class ReviewAccount(Base):
    __tablename__ = "review_accounts"

    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    platform = Column(String, nullable=False)  # 'naver' | 'kakao'
    label = Column(String, nullable=False)
    profile_url = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)  # 관리자(자체보유) 계정에 배정된 IP
    created_at = Column(DateTime, default=utcnow)

    reviewer = relationship("Reviewer", back_populates="accounts")
    tasks = relationship("Task", back_populates="review_account")


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String, nullable=False)  # 'naver' | 'kakao'
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    address = Column(String, nullable=True)
    representative_hours = Column(String, nullable=True)  # "대표시간" — common hours across business days
    representative_product = Column(String, nullable=True)  # "대표상품" — menu/rooms/services depending on category
    business_registration_number = Column(String, nullable=True)  # 사업자번호, 영수증 생성용
    representative_name = Column(String, nullable=True)  # 대표자명, 영수증 생성용
    phone = Column(String, nullable=True)  # 연락처, 영수증 생성용
    cooldown_days = Column(Integer, nullable=False, default=90)  # 계정당 재작업 가능 주기
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    targets = relationship("ReviewTarget", back_populates="store")


class ReviewTarget(Base):
    __tablename__ = "review_targets"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    platform = Column(String, nullable=False)  # 'naver' | 'kakao', copied from store at creation
    required_count = Column(Integer, nullable=False)
    unit_price = Column(Integer, nullable=False)  # 리뷰어에게 지급하는 건당 정산 금액
    sale_price = Column(Integer, nullable=True)  # 매장에 청구하는 건당 판매 금액 ("매출")
    claim_time_limit_minutes = Column(Integer, nullable=False, default=1440)
    work_days_raw = Column(String, nullable=True)  # CSV weekday ints (0=Mon..6=Sun); null = every day
    daily_limit = Column(Integer, nullable=True)  # 하루 최대 노출/클레임 허용 건수; null = 제한 없음

    # 리뷰 원고 자료 — 리뷰어가 포털에서 조회 (v2 "리뷰 자료 보기")
    guideline = Column(String, nullable=True)  # 원고 작성 가이드라인
    regional_features = Column(String, nullable=True)  # 지역적 특징
    menu_items_json = Column(String, nullable=True)  # JSON: [{"name":..,"price":..}, ...] 최대 3개
    reference_photo_path = Column(String, nullable=True)  # 참고 이미지 (선택)

    created_at = Column(DateTime, default=utcnow)

    store = relationship("Store", back_populates="targets")
    tasks = relationship(
        "Task", back_populates="review_target", cascade="all, delete-orphan"
    )


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    review_target_id = Column(Integer, ForeignKey("review_targets.id"), nullable=False)
    review_account_id = Column(Integer, ForeignKey("review_accounts.id"), nullable=True)
    platform = Column(String, nullable=False)

    status = Column(String, nullable=False, default="open")
    # open (unclaimed, pool) -> claimed (reviewer picked it up)
    #   -> checking_date (naver only) -> ready -> completed
    #   -> claimed/checking_date/ready can expire back to 'open' (claim_deadline passed)

    claimed_at = Column(DateTime, nullable=True)
    claim_deadline = Column(DateTime, nullable=True)
    last_expired_at = Column(DateTime, nullable=True)  # for admin dashboard notice

    naver_available_date = Column(Date, nullable=True)  # "영수증 날짜"
    result_link = Column(String, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    receipt_image_path = Column(String, nullable=True)  # naver_available_date가 정해지면 자동 생성

    review_posted_date = Column(Date, nullable=True)  # 실제 리뷰 "작성일"

    blind_status = Column(String, nullable=False, default="unknown")  # unknown|visible|blinded
    blind_checked_at = Column(DateTime, nullable=True)
    check_expired = Column(Boolean, nullable=False, default=False)

    snapshot_date_text = Column(String, nullable=True)
    snapshot_content = Column(String, nullable=True)

    settlement_amount = Column(Integer, nullable=False, default=0)  # 리뷰어에게 지급할 금액
    settlement_status = Column(String, nullable=False, default="unpaid")  # unpaid|paid
    settlement_paid_at = Column(DateTime, nullable=True)
    sale_amount = Column(Integer, nullable=True)  # 매장에 청구한 금액 ("매출"), target.sale_price 스냅샷

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    review_target = relationship("ReviewTarget", back_populates="tasks")
    review_account = relationship("ReviewAccount", back_populates="tasks")


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    naver_blind_check_interval_minutes = Column(Integer, nullable=False, default=20)
    kakao_blind_check_interval_minutes = Column(Integer, nullable=False, default=20)
    naver_default_claim_minutes = Column(Integer, nullable=False, default=1440)
    kakao_default_claim_minutes = Column(Integer, nullable=False, default=1440)
