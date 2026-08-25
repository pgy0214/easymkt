from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/products", tags=["products"])

# easystore(상품판매 사이트)의 카탈로그 조회용 — 관리자 인증 없이 공개 노출된다.
# main.py에서 admin 인증 의존성 없이 별도로 등록됨 (router는 admin 전용으로 등록됨).
public_router = APIRouter(prefix="/api/products", tags=["products-public"])


@public_router.get("", response_model=list[schemas.ProductOut])
def list_products(active_only: bool = False, db: Session = Depends(get_db)):
    return crud.get_products(db, active_only=active_only)


@public_router.get("/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    return crud._product_to_out(product)


@router.post("", response_model=schemas.ProductOut)
def create_product(data: schemas.ProductCreate, db: Session = Depends(get_db)):
    return crud.create_product(db, data)


@router.patch("/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, data: schemas.ProductUpdate, db: Session = Depends(get_db)):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    return crud.update_product(db, product, data)


@router.post("/{product_id}/thumbnail", response_model=schemas.ProductOut)
async def upload_product_thumbnail(
    product_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    content = await file.read()
    try:
        return crud.save_product_thumbnail(db, product, content, file.filename or "thumb.jpg")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{product_id}/detail-images", response_model=schemas.ProductOut)
async def add_product_detail_image(
    product_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    content = await file.read()
    try:
        return crud.add_product_detail_image(db, product, content, file.filename or "detail.jpg")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{product_id}/detail-images", response_model=schemas.ProductOut)
def remove_product_detail_image(
    product_id: int, data: schemas.ProductDetailImageRemoveIn, db: Session = Depends(get_db)
):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    return crud.remove_product_detail_image(db, product, data.image_path)


@router.patch("/{product_id}/detail-images/order", response_model=schemas.ProductOut)
def reorder_product_detail_images(
    product_id: int, data: schemas.ProductDetailImagesReorderIn, db: Session = Depends(get_db)
):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    try:
        return crud.reorder_product_detail_images(db, product, data.image_paths)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    crud.delete_product(db, product)
    return {"ok": True}


@router.post("/{product_id}/options", response_model=schemas.ProductOut)
def create_product_option(
    product_id: int, data: schemas.ProductOptionCreate, db: Session = Depends(get_db)
):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    return crud.create_product_option(db, product, data)


@router.patch("/options/{option_id}", response_model=schemas.ProductOut)
def update_product_option(
    option_id: int, data: schemas.ProductOptionUpdate, db: Session = Depends(get_db)
):
    option = crud.get_product_option(db, option_id)
    if not option:
        raise HTTPException(status_code=404, detail="옵션을 찾을 수 없습니다")
    return crud.update_product_option(db, option, data)


@router.delete("/options/{option_id}", response_model=schemas.ProductOut)
def delete_product_option(option_id: int, db: Session = Depends(get_db)):
    option = crud.get_product_option(db, option_id)
    if not option:
        raise HTTPException(status_code=404, detail="옵션을 찾을 수 없습니다")
    return crud.delete_product_option(db, option)
