from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.importers import parse_card_rule_rows

router = APIRouter(prefix="/api/card-rules", tags=["card-rules"])


@router.get("", response_model=list[schemas.CardRuleOut])
def list_card_rules(db: Session = Depends(get_db)):
    return crud.get_card_rules(db)


@router.post("", response_model=schemas.CardRuleOut)
def create_card_rule(data: schemas.CardRuleIn, db: Session = Depends(get_db)):
    return crud.create_card_rule(db, data)


@router.post("/import", response_model=schemas.ReviewerImportResult)
async def import_card_rules(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        rows = parse_card_rule_rows(content, file.filename or "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일을 읽을 수 없습니다: {e}")
    return crud.import_card_rules(db, rows)


@router.delete("/{rule_id}")
def delete_card_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = crud.get_card_rule(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")
    crud.delete_card_rule(db, rule)
    return {"ok": True}
