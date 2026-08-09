from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db
from app.routers.portal import get_current_reviewer

router = APIRouter(prefix="/api/advertiser", tags=["advertiser"])


@router.get("/me", response_model=schemas.ReviewerOut)
def get_me(reviewer: models.Reviewer = Depends(get_current_reviewer)):
    return crud.reviewer_to_out(reviewer)


@router.get("/stores", response_model=list[schemas.StoreOut])
def list_my_stores(
    reviewer: models.Reviewer = Depends(get_current_reviewer), db: Session = Depends(get_db)
):
    return crud.get_stores_by_owner(db, reviewer.id)


@router.post("/stores", response_model=schemas.StoreOut)
def create_my_store(
    data: schemas.StoreCreate,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    return crud.create_store(db, data, owner_reviewer_id=reviewer.id)


@router.get("/campaigns", response_model=list[schemas.ExperienceCampaignOut])
def list_my_campaigns(
    reviewer: models.Reviewer = Depends(get_current_reviewer), db: Session = Depends(get_db)
):
    return crud.get_experience_campaigns_by_owner(db, reviewer.id)


@router.post("/campaigns", response_model=schemas.ExperienceCampaignOut)
def create_my_campaign(
    data: schemas.ExperienceCampaignCreate,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    store = crud.get_store(db, data.store_id)
    if not store or store.owner_reviewer_id != reviewer.id:
        raise HTTPException(status_code=404, detail="본인 소유 매장이 아닙니다")
    try:
        return crud.create_experience_campaign(
            db, data, created_by_reviewer_id=reviewer.id, approval_status="pending"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/campaigns/{campaign_id}")
def delete_my_campaign(
    campaign_id: int,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign or campaign.created_by_reviewer_id != reviewer.id:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    crud.delete_experience_campaign(db, campaign)
    return {"ok": True}
