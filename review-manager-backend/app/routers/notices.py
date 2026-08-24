from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/notices", tags=["notices"])


@router.get("", response_model=list[schemas.NoticeOut])
def list_notices(db: Session = Depends(get_db)):
    return crud.get_notices(db)


@router.post("", response_model=schemas.NoticeOut)
def create_notice(data: schemas.NoticeCreate, db: Session = Depends(get_db)):
    return crud.create_notice(db, data)


@router.patch("/{notice_id}", response_model=schemas.NoticeOut)
def update_notice(notice_id: int, data: schemas.NoticeUpdate, db: Session = Depends(get_db)):
    notice = crud.get_notice(db, notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")
    return crud.update_notice(db, notice, data)


@router.post("/{notice_id}/image", response_model=schemas.NoticeOut)
async def upload_notice_image(notice_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    notice = crud.get_notice(db, notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")
    content = await file.read()
    try:
        return crud.save_notice_image(db, notice, content, file.filename or "image.jpg")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{notice_id}")
def delete_notice(notice_id: int, db: Session = Depends(get_db)):
    notice = crud.get_notice(db, notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")
    crud.delete_notice(db, notice)
    return {"ok": True}
