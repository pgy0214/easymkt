from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/settlement", tags=["settlement"])


@router.get("/summary", response_model=list[schemas.SettlementSummaryItem])
def summary(db: Session = Depends(get_db)):
    return crud.settlement_summary(db)


@router.get("/revenue", response_model=schemas.RevenueSummaryOut)
def revenue(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return crud.revenue_summary(db, date_from=date_from, date_to=date_to)
