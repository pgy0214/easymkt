from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/orders", tags=["orders"])

# easystore 결제(계좌이체) 흐름 — 게스트 주문 생성은 인증 없이 공개.
# main.py에서 admin 인증 의존성 없이 별도로 등록됨 (router는 admin 전용으로 등록됨).
public_router = APIRouter(prefix="/api/orders", tags=["orders-public"])


@public_router.post("", response_model=schemas.OrderOut)
def create_order(data: schemas.OrderCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_order(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[schemas.OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return crud.get_orders(db)


@router.patch("/{order_id}/status", response_model=schemas.OrderOut)
def update_order_status(order_id: int, data: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    order = crud.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    return crud.update_order_status(db, order, data.status)
