from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, scheduler, schemas
from app.database import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])

# easystore 결제 안내용 계좌정보 — 인증 없이 공개(체크아웃 화면에서 조회)
public_router = APIRouter(prefix="/api/settings", tags=["settings-public"])


@public_router.get("/bank-info", response_model=schemas.BankInfoOut)
def get_bank_info(db: Session = Depends(get_db)):
    return crud.get_settings(db)


@router.get("", response_model=schemas.SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return crud.get_settings(db)


@router.patch("", response_model=schemas.SettingsOut)
def update_settings(data: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    settings = crud.update_settings(db, data)
    if data.naver_blind_check_interval_minutes is not None:
        scheduler.reschedule_blind_check_job(
            "naver", settings.naver_blind_check_interval_minutes
        )
    if data.kakao_blind_check_interval_minutes is not None:
        scheduler.reschedule_blind_check_job(
            "kakao", settings.kakao_blind_check_interval_minutes
        )
    return settings
