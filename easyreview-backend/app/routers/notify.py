from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas, sms
from app.database import get_db

router = APIRouter(prefix="/api/notify", tags=["notify"])


@router.get("/status", response_model=schemas.NotifyStatusOut)
def get_status():
    return schemas.NotifyStatusOut(
        sms_configured=sms.is_sms_configured(),
        kakao_configured=sms.is_kakao_configured(),
    )


@router.post("/bulk", response_model=list[schemas.NotifyResultItem])
def send_bulk(data: schemas.BulkMessageIn, db: Session = Depends(get_db)):
    if data.channel == "kakao" and not data.template_code:
        raise HTTPException(status_code=400, detail="카카오 알림톡은 template_code가 필요합니다")

    results = []
    for reviewer_id in data.reviewer_ids:
        reviewer = crud.get_reviewer(db, reviewer_id)
        if not reviewer:
            results.append(
                schemas.NotifyResultItem(reviewer_id=reviewer_id, name="?", success=False, reason="리뷰어를 찾을 수 없음")
            )
            continue
        if not reviewer.contact_info:
            results.append(
                schemas.NotifyResultItem(
                    reviewer_id=reviewer_id, name=reviewer.name, success=False, reason="연락처 없음"
                )
            )
            continue

        personalized = data.message.replace("{name}", reviewer.name)
        try:
            if data.channel == "sms":
                sms.send_sms(reviewer.contact_info, personalized)
            else:
                sms.send_kakao_alimtalk(
                    reviewer.contact_info, data.template_code, personalized, data.fallback_message
                )
            results.append(schemas.NotifyResultItem(reviewer_id=reviewer_id, name=reviewer.name, success=True))
        except Exception as e:
            results.append(
                schemas.NotifyResultItem(
                    reviewer_id=reviewer_id, name=reviewer.name, success=False, reason=str(e)
                )
            )
    return results
