import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.crawlers import naver_blog
from app.database import get_db
from app.importers import parse_admin_account_rows, parse_reviewer_rows

router = APIRouter(prefix="/api/reviewers", tags=["reviewers"])


@router.get("", response_model=list[schemas.ReviewerOut])
def list_reviewers(db: Session = Depends(get_db)):
    duplicate_ids = crud.get_duplicate_blog_reviewer_ids(db)
    return [crud.reviewer_to_out(r, duplicate_ids) for r in crud.get_reviewers(db)]


@router.post("/members", response_model=schemas.ReviewerOut)
def create_member(data: schemas.MemberCreateIn, db: Session = Depends(get_db)):
    """회원관리 화면의 "회원 임의 추가" — 포털 셀프가입(전화번호 인증 필요)을
    거치지 않고 관리자가 직접 아이디/비밀번호를 지정해 회원을 만든다. 아이디
    규칙은 포털 셀프가입(complete_signup)과 동일하게 맞춘다."""
    username = data.username.strip().lower()
    if not re.fullmatch(r"[a-z0-9_]{4,20}", username):
        raise HTTPException(status_code=400, detail="아이디는 영문 소문자/숫자/밑줄 4~20자로 입력해주세요")
    if len(data.password) < 4:
        raise HTTPException(status_code=400, detail="비밀번호는 4자 이상이어야 합니다")
    if crud.get_reviewer_by_username(db, username):
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다")
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="이름을 입력해주세요")

    member = schemas.MemberCreateIn(**{**data.model_dump(), "username": username})
    return crud.reviewer_to_out(crud.create_member(db, member))


@router.post("", response_model=schemas.ReviewerOut)
def create_reviewer(data: schemas.ReviewerCreate, db: Session = Depends(get_db)):
    return crud.reviewer_to_out(crud.create_reviewer(db, data))


@router.get("/{reviewer_id}", response_model=schemas.ReviewerOut)
def get_reviewer(reviewer_id: int, db: Session = Depends(get_db)):
    reviewer = crud.get_reviewer(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="리뷰어를 찾을 수 없습니다")
    return crud.reviewer_to_out(reviewer)


@router.patch("/{reviewer_id}", response_model=schemas.ReviewerOut)
def update_reviewer(
    reviewer_id: int, data: schemas.ReviewerUpdate, db: Session = Depends(get_db)
):
    reviewer = crud.get_reviewer(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="리뷰어를 찾을 수 없습니다")
    return crud.reviewer_to_out(crud.update_reviewer(db, reviewer, data))


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


@router.post("/import-admin", response_model=schemas.ReviewerImportResult)
async def import_admin_accounts(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        rows = parse_admin_account_rows(content, file.filename or "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일을 읽을 수 없습니다: {e}")
    return crud.import_admin_accounts(db, rows)


@router.post("/{reviewer_id}/recent-posts", response_model=list[schemas.RecentPostOut])
def get_recent_posts(reviewer_id: int, db: Session = Depends(get_db)):
    reviewer = crud.get_reviewer(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="리뷰어를 찾을 수 없습니다")
    if not reviewer.blog_url:
        raise HTTPException(status_code=400, detail="등록된 블로그 URL이 없습니다")
    try:
        return naver_blog.fetch_recent_posts(reviewer.blog_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"최근 게시글을 가져오지 못했습니다: {e}")


@router.post("/{reviewer_id}/accounts", response_model=schemas.ReviewAccountOut)
def create_account(
    reviewer_id: int, data: schemas.ReviewAccountCreate, db: Session = Depends(get_db)
):
    reviewer = crud.get_reviewer(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="리뷰어를 찾을 수 없습니다")
    return crud.account_to_out(crud.create_account(db, reviewer_id, data))
