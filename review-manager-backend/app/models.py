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
    memo = Column(String, nullable=True)
    contact_info = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)  # 연락가능(작업배정 대상) 여부
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
    created_at = Column(DateTime, default=utcnow)

    reviewer = relationship("Reviewer", back_populates="accounts")
    tasks = relationship("Task", back_populates="review_account")


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String, nullable=False)  # 'naver' | 'kakao'
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    cooldown_days = Column(Integer, nullable=False, default=90)  # 계정당 재작업 가능 주기
    created_at = Column(DateTime, default=utcnow)

    targets = relationship("ReviewTarget", back_populates="store")


class ReviewTarget(Base):
    __tablename__ = "review_targets"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    platform = Column(String, nullable=False)  # 'naver' | 'kakao', copied from store at creation
    required_count = Column(Integer, nullable=False)
    unit_price = Column(Integer, nullable=False)
    claim_time_limit_hours = Column(Integer, nullable=False, default=24)
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

    review_posted_date = Column(Date, nullable=True)  # 실제 리뷰 "작성일"

    blind_status = Column(String, nullable=False, default="unknown")  # unknown|visible|blinded
    blind_checked_at = Column(DateTime, nullable=True)
    check_expired = Column(Boolean, nullable=False, default=False)

    snapshot_date_text = Column(String, nullable=True)
    snapshot_content = Column(String, nullable=True)

    settlement_amount = Column(Integer, nullable=False, default=0)
    settlement_status = Column(String, nullable=False, default="unpaid")  # unpaid|paid
    settlement_paid_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    review_target = relationship("ReviewTarget", back_populates="tasks")
    review_account = relationship("ReviewAccount", back_populates="tasks")


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    naver_blind_check_interval_minutes = Column(Integer, nullable=False, default=20)
    kakao_blind_check_interval_minutes = Column(Integer, nullable=False, default=20)
    naver_default_claim_hours = Column(Integer, nullable=False, default=24)
    kakao_default_claim_hours = Column(Integer, nullable=False, default=24)
