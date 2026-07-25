import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app import crud
from app.crawlers import kakao_blind_check, naver_blind_check, naver_date_check
from app.database import SessionLocal

logger = logging.getLogger("scheduler")

scheduler = BackgroundScheduler()

NAVER_DATE_CHECK_INTERVAL_MINUTES = 2  # one-shot per task, not admin-configurable
CLAIM_EXPIRY_CHECK_INTERVAL_MINUTES = 10  # fixed, not admin-configurable


def _run_claim_expiry():
    db = SessionLocal()
    try:
        expired_count = crud.run_claim_expiry_job(db)
        if expired_count:
            logger.info("%d건 클레임 기한 초과 — 오픈풀로 복귀", expired_count)
    except Exception:
        logger.exception("클레임 만료 처리 실패")
    finally:
        db.close()


def _run_naver_date_check():
    db = SessionLocal()
    try:
        naver_date_check.run_job(db)
    except Exception:
        logger.exception("네이버 날짜확인 작업 실패")
    finally:
        db.close()


def _run_naver_blind_check():
    db = SessionLocal()
    try:
        naver_blind_check.run_job(db)
    except Exception:
        logger.exception("네이버 블라인드확인 작업 실패")
    finally:
        db.close()


def _run_kakao_blind_check():
    db = SessionLocal()
    try:
        kakao_blind_check.run_job(db)
    except Exception:
        logger.exception("카카오 블라인드확인 작업 실패")
    finally:
        db.close()


def start_scheduler() -> None:
    db = SessionLocal()
    try:
        settings = crud.get_settings(db)
        naver_interval = settings.naver_blind_check_interval_minutes
        kakao_interval = settings.kakao_blind_check_interval_minutes
    finally:
        db.close()

    scheduler.add_job(
        _run_claim_expiry,
        "interval",
        minutes=CLAIM_EXPIRY_CHECK_INTERVAL_MINUTES,
        id="claim_expiry",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_naver_date_check,
        "interval",
        minutes=NAVER_DATE_CHECK_INTERVAL_MINUTES,
        id="naver_date_check",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_naver_blind_check,
        "interval",
        minutes=naver_interval,
        id="naver_blind_check",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_kakao_blind_check,
        "interval",
        minutes=kakao_interval,
        id="kakao_blind_check",
        replace_existing=True,
    )
    scheduler.start()


def reschedule_blind_check_job(platform: str, minutes: int) -> None:
    scheduler.reschedule_job(f"{platform}_blind_check", trigger="interval", minutes=minutes)


def shutdown_scheduler() -> None:
    scheduler.shutdown(wait=False)
