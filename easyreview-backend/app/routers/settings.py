from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, scheduler, schemas
from app.database import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])


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
