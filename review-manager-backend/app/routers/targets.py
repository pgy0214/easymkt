from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/targets", tags=["targets"])


@router.get("", response_model=list[schemas.ReviewTargetOut])
def list_targets(db: Session = Depends(get_db)):
    return [crud.target_to_out(t) for t in crud.get_targets(db)]


@router.post("", response_model=schemas.ReviewTargetOut)
def create_target(data: schemas.ReviewTargetCreate, db: Session = Depends(get_db)):
    try:
        return crud.target_to_out(crud.create_review_target(db, data))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{target_id}", response_model=schemas.ReviewTargetDetailOut)
def get_target(target_id: int, db: Session = Depends(get_db)):
    target = crud.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    out = schemas.ReviewTargetDetailOut.model_validate(target)
    if target.store is not None:
        out.store_name = target.store.name
        out.store_url = target.store.url
    out.work_days = crud.decode_work_days(target.work_days_raw)
    out.menu_items = crud.decode_menu_items(target.menu_items_json)
    out.tasks = [crud.task_to_out(t) for t in target.tasks]
    return out


@router.post("/{target_id}/photo", response_model=schemas.ReviewTargetOut)
async def upload_reference_photo(
    target_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    target = crud.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    content = await file.read()
    try:
        crud.save_reference_photo(db, target, content, file.filename or "photo.jpg")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return crud.target_to_out(target)


@router.delete("/{target_id}")
def delete_target(target_id: int, db: Session = Depends(get_db)):
    target = crud.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    try:
        crud.delete_target(db, target)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}
