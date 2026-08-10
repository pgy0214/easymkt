from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.crawlers import naver_store_info
from app.database import get_db
from app.routers.portal import get_current_reviewer

router = APIRouter(prefix="/api/advertiser", tags=["advertiser"])


def get_current_advertiser(reviewer: models.Reviewer = Depends(get_current_reviewer)) -> models.Reviewer:
    """일반 리뷰어 계정이 광고주 API를 쓰지 못하게 막는다 — 광고주 회원가입으로
    만든 계정이거나, 관리자가 회원관리에서 직접 권한을 부여한 계정만 통과."""
    if reviewer.category != "advertiser":
        raise HTTPException(
            status_code=403, detail="광고주 권한이 없는 계정입니다. 관리자에게 문의해주세요."
        )
    return reviewer


@router.get("/me", response_model=schemas.ReviewerOut)
def get_me(reviewer: models.Reviewer = Depends(get_current_reviewer)):
    return crud.reviewer_to_out(reviewer)


@router.post("/stores/fetch-info", response_model=schemas.StoreInfoFetchOut)
def fetch_store_info(
    data: schemas.StoreInfoFetchIn, reviewer: models.Reviewer = Depends(get_current_advertiser)
):
    try:
        return naver_store_info.fetch_store_info(data.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"매장 정보를 가져오지 못했습니다: {e}")


@router.get("/stores", response_model=list[schemas.StoreOut])
def list_my_stores(
    reviewer: models.Reviewer = Depends(get_current_advertiser), db: Session = Depends(get_db)
):
    return crud.get_stores_by_owner(db, reviewer.id)


@router.post("/stores", response_model=schemas.StoreOut)
def create_my_store(
    data: schemas.StoreCreate,
    reviewer: models.Reviewer = Depends(get_current_advertiser),
    db: Session = Depends(get_db),
):
    return crud.create_store(db, data, owner_reviewer_id=reviewer.id)


@router.get("/campaigns", response_model=list[schemas.ExperienceCampaignOut])
def list_my_campaigns(
    reviewer: models.Reviewer = Depends(get_current_advertiser), db: Session = Depends(get_db)
):
    return crud.get_experience_campaigns_by_owner(db, reviewer.id)


@router.post("/campaigns", response_model=schemas.ExperienceCampaignOut)
def create_my_campaign(
    data: schemas.ExperienceCampaignCreate,
    reviewer: models.Reviewer = Depends(get_current_advertiser),
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
    reviewer: models.Reviewer = Depends(get_current_advertiser),
    db: Session = Depends(get_db),
):
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign or campaign.created_by_reviewer_id != reviewer.id:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    crud.delete_experience_campaign(db, campaign)
    return {"ok": True}
