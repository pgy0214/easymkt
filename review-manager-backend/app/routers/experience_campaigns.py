from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/experience-campaigns", tags=["experience-campaigns"])


@router.get("", response_model=list[schemas.ExperienceCampaignOut])
def list_experience_campaigns(db: Session = Depends(get_db)):
    return crud.get_experience_campaigns(db)


@router.post("", response_model=schemas.ExperienceCampaignOut)
def create_experience_campaign(data: schemas.ExperienceCampaignCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_experience_campaign(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{campaign_id}", response_model=schemas.ExperienceCampaignOut)
def update_experience_campaign(
    campaign_id: int, data: schemas.ExperienceCampaignUpdate, db: Session = Depends(get_db)
):
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return crud.update_experience_campaign(db, campaign, data)


@router.post("/{campaign_id}/image", response_model=schemas.ExperienceCampaignOut)
async def upload_experience_campaign_image(
    campaign_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    content = await file.read()
    try:
        return crud.save_experience_campaign_image(db, campaign, content, file.filename or "image.jpg")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{campaign_id}/approval", response_model=schemas.ExperienceCampaignOut)
def update_experience_campaign_approval(
    campaign_id: int, data: schemas.ExperienceCampaignApprovalIn, db: Session = Depends(get_db)
):
    """광고주가 등록한 캠페인을 관리자가 승인/거절 — 승인돼야 리뷰어 포털에 노출된다."""
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return crud.update_experience_campaign_approval(db, campaign, data.status)


@router.delete("/{campaign_id}")
def delete_experience_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    crud.delete_experience_campaign(db, campaign)
    return {"ok": True}


@router.get("/{campaign_id}/applications", response_model=list[schemas.ExperienceApplicationOut])
def list_experience_applications(campaign_id: int, db: Session = Depends(get_db)):
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return crud.get_experience_applications(db, campaign_id)


@router.patch("/applications/{application_id}", response_model=schemas.ExperienceApplicationOut)
def update_experience_application_status(
    application_id: int, data: schemas.ExperienceApplicationStatusIn, db: Session = Depends(get_db)
):
    application = crud.get_experience_application(db, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="신청 내역을 찾을 수 없습니다")
    updated = crud.update_experience_application_status(db, application, data.status)
    return crud.experience_application_to_out(updated)


@router.get("/{campaign_id}/candidates", response_model=list[schemas.ExperienceScoutCandidateOut])
def list_experience_candidates(campaign_id: int, db: Session = Depends(get_db)):
    """이 캠페인에 아직 신청하지 않은, 블로그 정보를 등록한 체험단 후보 목록 —
    "모집희망 찾아보기"에서 관리자가 직접 섭외 대상을 고를 때 쓴다."""
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return crud.get_experience_candidates(db, campaign_id)


@router.post("/{campaign_id}/scout", response_model=list[schemas.ExperienceApplicationOut])
def scout_experience_candidates(
    campaign_id: int, data: schemas.ExperienceScoutIn, db: Session = Depends(get_db)
):
    """선택한 후보들을 이 캠페인의 지원자로 등록한다(관리자가 대신 신청 — 이후
    지원자 목록에서 동일하게 승인/거절 처리)."""
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    results = []
    for reviewer_id in data.reviewer_ids:
        try:
            application = crud.create_experience_application(db, campaign_id, reviewer_id)
        except ValueError:
            continue
        results.append(crud.experience_application_to_out(application))
    return results
