from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    return crud.get_products(db)


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


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    crud.delete_product(db, product)
    return {"ok": True}
