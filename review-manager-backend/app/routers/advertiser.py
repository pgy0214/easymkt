from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, importers, models, review_writer, schemas
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


def get_approved_advertiser(
    reviewer: models.Reviewer = Depends(get_current_advertiser),
) -> models.Reviewer:
    """매장등록/캠페인생성처럼 실제 영업 행위로 이어지는 API는 관리자가 사업자등록증을
    확인하고 활성화(is_active)해준 광고주만 쓸 수 있다 — 로그인/내정보 조회는
    승인 전에도 가능해야 하니 get_current_advertiser와 분리한다."""
    if not reviewer.is_active:
        raise HTTPException(
            status_code=403,
            detail="사업자등록증 승인 대기 중입니다. 관리자 확인 후 매장등록/캠페인생성이 가능해요.",
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
    reviewer: models.Reviewer = Depends(get_approved_advertiser),
    db: Session = Depends(get_db),
):
    return crud.create_store(db, data, owner_reviewer_id=reviewer.id)


@router.patch("/stores/{store_id}", response_model=schemas.StoreOut)
def update_my_store(
    store_id: int,
    data: schemas.StoreUpdate,
    reviewer: models.Reviewer = Depends(get_current_advertiser),
    db: Session = Depends(get_db),
):
    store = crud.get_store(db, store_id)
    if not store or store.owner_reviewer_id != reviewer.id:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다")
    return crud.update_store(db, store, data)


@router.get("/campaigns", response_model=list[schemas.ExperienceCampaignOut])
def list_my_campaigns(
    reviewer: models.Reviewer = Depends(get_current_advertiser), db: Session = Depends(get_db)
):
    return crud.get_experience_campaigns_by_owner(db, reviewer.id)


@router.post("/campaigns", response_model=schemas.ExperienceCampaignOut)
def create_my_campaign(
    data: schemas.ExperienceCampaignCreate,
    reviewer: models.Reviewer = Depends(get_approved_advertiser),
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


def _get_owned_review_target(
    db: Session, reviewer: models.Reviewer, target_id: int
) -> models.ReviewTarget:
    target = crud.get_target(db, target_id)
    if not target or not target.store or target.store.owner_reviewer_id != reviewer.id:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return target


@router.get("/review-targets", response_model=list[schemas.ReviewTargetOut])
def list_my_review_targets(
    reviewer: models.Reviewer = Depends(get_current_advertiser), db: Session = Depends(get_db)
):
    """관리자의 "캠페인관리"(영수증리뷰)와 같은 ReviewTarget을 광고주 본인 소유
    매장만 필터링해서 보여준다."""
    store_ids = {s.id for s in crud.get_stores_by_owner(db, reviewer.id)}
    completed_counts = crud.get_completed_task_counts(db)
    results = []
    for t in crud.get_targets(db):
        if t.store_id not in store_ids:
            continue
        out = crud.target_to_out(t)
        out.completed_count = completed_counts.get(t.id, 0)
        results.append(out)
    return results


@router.post("/review-targets", response_model=schemas.ReviewTargetOut)
def create_my_review_target(
    data: schemas.ReviewTargetCreate,
    reviewer: models.Reviewer = Depends(get_approved_advertiser),
    db: Session = Depends(get_db),
):
    store = crud.get_store(db, data.store_id)
    if not store or store.owner_reviewer_id != reviewer.id:
        raise HTTPException(status_code=404, detail="본인 소유 매장이 아닙니다")
    try:
        return crud.target_to_out(crud.create_review_target(db, data))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/review-targets/preview-review-text", response_model=schemas.ReviewTextGenerateOut)
def preview_my_review_text(
    data: schemas.ReviewTextGenerateIn,
    reviewer: models.Reviewer = Depends(get_current_advertiser),
):
    if not review_writer.is_configured():
        raise HTTPException(
            status_code=400, detail="ANTHROPIC_API_KEY가 서버에 설정되어 있지 않습니다"
        )
    text = review_writer.generate_review_text(
        guideline=data.guideline,
        regional_features=data.regional_features,
        length=data.review_length,
        menu_items=[m.model_dump() for m in data.menu_items] if data.menu_items else None,
    )
    return schemas.ReviewTextGenerateOut(text=text)


@router.post(
    "/review-targets/{target_id}/review-texts", response_model=list[schemas.TargetReviewTextOut]
)
async def upload_my_review_target_review_texts(
    target_id: int,
    file: UploadFile = File(...),
    reviewer: models.Reviewer = Depends(get_current_advertiser),
    db: Session = Depends(get_db),
):
    target = _get_owned_review_target(db, reviewer, target_id)
    content = await file.read()
    texts = importers.parse_review_text_rows(content, file.filename or "")
    if not texts:
        raise HTTPException(status_code=400, detail="파일에서 리뷰내용을 찾을 수 없습니다")
    return crud.save_target_review_texts(db, target, texts)


@router.post("/review-targets/{target_id}/photos", response_model=list[schemas.TargetPhotoOut])
async def upload_my_review_target_photos(
    target_id: int,
    files: list[UploadFile] = File(...),
    reviewer: models.Reviewer = Depends(get_current_advertiser),
    db: Session = Depends(get_db),
):
    target = _get_owned_review_target(db, reviewer, target_id)
    contents = [(await f.read(), f.filename or "photo.jpg") for f in files]
    try:
        return crud.save_target_photos(db, target, contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/review-targets/{target_id}")
def delete_my_review_target(
    target_id: int,
    reviewer: models.Reviewer = Depends(get_current_advertiser),
    db: Session = Depends(get_db),
):
    target = _get_owned_review_target(db, reviewer, target_id)
    try:
        crud.delete_target(db, target)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}
