from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, receipt_generator, schemas
from app.crawlers import naver_store_info
from app.database import get_db

router = APIRouter(prefix="/api/stores", tags=["stores"])


@router.get("", response_model=list[schemas.StoreOut])
def list_stores(platform: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_stores(db, platform=platform)


@router.post("", response_model=schemas.StoreOut)
def create_store(data: schemas.StoreCreate, db: Session = Depends(get_db)):
    return crud.create_store(db, data)


@router.post("/fetch-info", response_model=schemas.StoreInfoFetchOut)
def fetch_store_info(data: schemas.StoreInfoFetchIn):
    try:
        info = naver_store_info.fetch_store_info(data.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"매장 정보를 가져오지 못했습니다: {e}")
    return info


@router.patch("/{store_id}", response_model=schemas.StoreOut)
def update_store(store_id: int, data: schemas.StoreUpdate, db: Session = Depends(get_db)):
    store = crud.get_store(db, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다")
    return crud.update_store(db, store, data)


MAX_RECEIPT_BATCH_COUNT = 50


@router.post("/{store_id}/receipt", response_model=list[schemas.StoreReceiptOut])
def generate_store_receipt(
    store_id: int, data: schemas.StoreReceiptIn = schemas.StoreReceiptIn(), db: Session = Depends(get_db)
):
    store = crud.get_store(db, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다")
    if data.count < 1 or data.count > MAX_RECEIPT_BATCH_COUNT:
        raise HTTPException(status_code=400, detail=f"개수는 1~{MAX_RECEIPT_BATCH_COUNT} 사이여야 합니다")
    card_rules = crud.card_rules_as_dicts(db)
    try:
        urls = [
            receipt_generator.generate_receipt_for_store(store, card_rules, target_date=data.date)
            for _ in range(data.count)
        ]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return [schemas.StoreReceiptOut(url=u) for u in urls]


@router.delete("/{store_id}")
def delete_store(store_id: int, db: Session = Depends(get_db)):
    store = crud.get_store(db, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다")
    try:
        crud.delete_store(db, store)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}
