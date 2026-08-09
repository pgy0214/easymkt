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
    out = schemas.ExperienceApplicationOut.model_validate(updated)
    reviewer = updated.reviewer
    if reviewer:
        out.reviewer_name = reviewer.name
        out.reviewer_contact_info = reviewer.contact_info
        out.reviewer_blog_url = reviewer.blog_url
        out.reviewer_blog_index = reviewer.blog_index
    return out
