from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, importers, review_writer, schemas
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


@router.post("/preview-review-text", response_model=schemas.ReviewTextGenerateOut)
def preview_review_text(data: schemas.ReviewTextGenerateIn):
    """등록 폼의 "예시 보기" 버튼 — 현재 입력된 가이드라인/지역특징/글자수로 예시 원고를
    생성만 해서 보여준다(저장 안 함)."""
    if not review_writer.is_configured():
        raise HTTPException(
            status_code=400, detail="ANTHROPIC_API_KEY가 서버에 설정되어 있지 않습니다"
        )
    text = review_writer.generate_review_text(
        guideline=data.guideline,
        regional_features=data.regional_features,
        tone=data.tone,
        length=data.review_length,
        menu_items=[m.model_dump() for m in data.menu_items] if data.menu_items else None,
        forbidden_words=data.forbidden_words,
        tone_preset=data.tone_preset,
    )
    return schemas.ReviewTextGenerateOut(text=text)


@router.patch("/{target_id}", response_model=schemas.ReviewTargetOut)
def update_target(
    target_id: int, data: schemas.ReviewTargetUpdate, db: Session = Depends(get_db)
):
    target = crud.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return crud.target_to_out(crud.update_target(db, target, data))


@router.patch("/{target_id}/approval", response_model=schemas.ReviewTargetOut)
def update_target_approval(
    target_id: int, data: schemas.ReviewTargetApprovalIn, db: Session = Depends(get_db)
):
    """광고주가 등록한 캠페인을 관리자가 승인/거절 — 승인돼야 오픈풀에 노출된다."""
    target = crud.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return crud.target_to_out(crud.update_review_target_approval(db, target, data.status))


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
    out.tasks = [crud.task_to_out(db, t) for t in target.tasks]
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


@router.post("/{target_id}/review-texts", response_model=list[schemas.TargetReviewTextOut])
async def upload_target_review_texts(
    target_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """캠페인 리뷰 원고 풀에 엑셀(번호+리뷰내용)을 업로드 — 작업 생성 순서대로 1:1로
    배정된다(crud.assign_review_text_for_task)."""
    target = crud.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    content = await file.read()
    texts = importers.parse_review_text_rows(content, file.filename or "")
    if not texts:
        raise HTTPException(status_code=400, detail="파일에서 리뷰내용을 찾을 수 없습니다")
    return crud.save_target_review_texts(db, target, texts)


MAX_GENERATE_COUNT = 30


@router.post(
    "/{target_id}/review-texts/generate",
    response_model=list[schemas.TargetReviewTextGeneratedOut],
)
def generate_target_review_texts(
    target_id: int, data: schemas.ReviewTextBulkGenerateIn, db: Session = Depends(get_db)
):
    """원고 만들기 페이지 — 캠페인에 등록된 가이드라인/지역특징/말투/금지어/메뉴 정보를
    그대로 사용해 원고 count건을 생성해 원고 풀에 저장한다(save_target_review_texts와
    동일하게 작업 생성 순서로 1:1 배정됨). 관리자가 "정상적으로 나왔는지" 바로 확인할 수
    있도록 건별 QA 경고(금지어 포함/중복/글자수 이탈)를 같이 내려준다."""
    target = crud.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    if not review_writer.is_configured():
        raise HTTPException(
            status_code=400, detail="ANTHROPIC_API_KEY가 서버에 설정되어 있지 않습니다"
        )
    count = max(1, min(data.count, MAX_GENERATE_COUNT))
    menu_items = crud.decode_menu_items(target.menu_items_json)
    texts = review_writer.generate_review_texts_batch(
        guideline=target.guideline,
        regional_features=target.regional_features,
        tone=target.tone,
        length=target.review_length,
        menu_items=menu_items,
        forbidden_words=target.forbidden_words,
        tone_preset=target.tone_preset,
        count=count,
    )
    if not texts:
        raise HTTPException(status_code=502, detail="원고 생성에 실패했습니다 — 다시 시도해주세요")
    warnings = review_writer.validate_review_texts(texts, target.forbidden_words, target.review_length)
    saved = crud.save_target_review_texts(db, target, texts)
    return [
        schemas.TargetReviewTextGeneratedOut(id=t.id, content=t.content, warnings=w)
        for t, w in zip(saved, warnings)
    ]


@router.delete("/{target_id}/review-texts/{text_id}")
def delete_target_review_text(target_id: int, text_id: int, db: Session = Depends(get_db)):
    text = crud.get_target_review_text(db, text_id)
    if not text or text.review_target_id != target_id:
        raise HTTPException(status_code=404, detail="원고를 찾을 수 없습니다")
    crud.delete_target_review_text(db, text)
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
