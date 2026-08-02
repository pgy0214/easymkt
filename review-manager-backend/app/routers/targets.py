from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, importers, schemas
from app.database import get_db

router = APIRouter(prefix="/api/targets", tags=["targets"])


@router.get("", response_model=list[schemas.ReviewTargetOut])
def list_targets(db: Session = Depends(get_db)):
    completed_counts = crud.get_completed_task_counts(db)
    results = []
    for t in crud.get_targets(db):
        out = crud.target_to_out(t)
        out.completed_count = completed_counts.get(t.id, 0)
        results.append(out)
    return results


@router.post("", response_model=schemas.ReviewTargetOut)
def create_target(data: schemas.ReviewTargetCreate, db: Session = Depends(get_db)):
    try:
        return crud.target_to_out(crud.create_review_target(db, data))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/parse-guideline", response_model=schemas.TargetGuidelineParseOut)
async def parse_guideline(file: UploadFile = File(...)):
    """캠페인 등록 폼의 원고 자료를 엑셀/CSV 업로드로 미리 채우기 위한 파서
    (DB에 아무것도 쓰지 않음 — 폼 프리필 용도)."""
    content = await file.read()
    parsed = importers.parse_target_guideline_row(content, file.filename or "")
    return schemas.TargetGuidelineParseOut(**parsed)


@router.patch("/{target_id}", response_model=schemas.ReviewTargetOut)
def update_target(
    target_id: int, data: schemas.ReviewTargetUpdate, db: Session = Depends(get_db)
):
    target = crud.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return crud.target_to_out(crud.update_target(db, target, data))


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


@router.post("/{target_id}/photos", response_model=list[schemas.TargetPhotoOut])
async def upload_target_photos(
    target_id: int, files: list[UploadFile] = File(...), db: Session = Depends(get_db)
):
    """캠페인 사진 풀에 여러 장을 한 번에 업로드 — 저장 전 자동으로 EXIF를 세탁한다
    (app.photo_washer)."""
    target = crud.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    contents = [(await f.read(), f.filename or "photo.jpg") for f in files]
    try:
        photos = crud.save_target_photos(db, target, contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return photos


@router.delete("/{target_id}/photos/{photo_id}")
def delete_target_photo(target_id: int, photo_id: int, db: Session = Depends(get_db)):
    photo = crud.get_target_photo(db, photo_id)
    if not photo or photo.review_target_id != target_id:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다")
    crud.delete_target_photo(db, photo)
    return {"ok": True}


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
