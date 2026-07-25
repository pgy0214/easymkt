from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/settlement", tags=["settlement"])


@router.get("/summary", response_model=list[schemas.SettlementSummaryItem])
def summary(db: Session = Depends(get_db)):
    return crud.settlement_summary(db)
