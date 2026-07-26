from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
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
