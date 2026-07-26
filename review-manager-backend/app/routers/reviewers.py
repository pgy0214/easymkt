from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.importers import parse_reviewer_rows

router = APIRouter(prefix="/api/reviewers", tags=["reviewers"])


@router.get("", response_model=list[schemas.ReviewerOut])
def list_reviewers(db: Session = Depends(get_db)):
    return crud.get_reviewers(db)


@router.post("", response_model=schemas.ReviewerOut)
def create_reviewer(data: schemas.ReviewerCreate, db: Session = Depends(get_db)):
    return crud.create_reviewer(db, data)


@router.get("/{reviewer_id}", response_model=schemas.ReviewerOut)
def get_reviewer(reviewer_id: int, db: Session = Depends(get_db)):
    reviewer = crud.get_reviewer(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="리뷰어를 찾을 수 없습니다")
    return reviewer


@router.patch("/{reviewer_id}", response_model=schemas.ReviewerOut)
def update_reviewer(
    reviewer_id: int, data: schemas.ReviewerUpdate, db: Session = Depends(get_db)
):
    reviewer = crud.get_reviewer(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="리뷰어를 찾을 수 없습니다")
    return crud.update_reviewer(db, reviewer, data)


@router.delete("/{reviewer_id}")
def delete_reviewer(reviewer_id: int, db: Session = Depends(get_db)):
    reviewer = crud.get_reviewer(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="리뷰어를 찾을 수 없습니다")
    try:
        crud.delete_reviewer(db, reviewer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.post("/import", response_model=schemas.ReviewerImportResult)
async def import_reviewers(
    file: UploadFile = File(...),
    category: str = Form(default="reviewer"),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        rows = parse_reviewer_rows(content, file.filename or "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일을 읽을 수 없습니다: {e}")
    return crud.import_reviewers(db, rows, category=category)


@router.post("/{reviewer_id}/accounts", response_model=schemas.ReviewAccountOut)
def create_account(
    reviewer_id: int, data: schemas.ReviewAccountCreate, db: Session = Depends(get_db)
):
    reviewer = crud.get_reviewer(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="리뷰어를 찾을 수 없습니다")
    return crud.create_account(db, reviewer_id, data)
