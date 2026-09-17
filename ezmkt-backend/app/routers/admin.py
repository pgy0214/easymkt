from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app import auth, crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"])


def get_current_admin(authorization: Optional[str] = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        auth.verify_admin_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/login", response_model=schemas.AdminLoginOut)
def login(data: schemas.AdminLoginIn, db: Session = Depends(get_db)):
    """관리자(대시보드 접근 권한자) 로그인 — reviewers 테이블에서 category='admin'
    이고 활성화된 계정만 허용한다. 예전엔 .env에 딱 한 명만 하드코딩돼 있었지만,
    이제 회원관리에서 여러 명을 등록/비활성화(=로그인 차단)할 수 있다."""
    reviewer = crud.get_reviewer_by_username(db, data.username)
    if (
        not reviewer
        or reviewer.category != "admin"
        or not reviewer.is_active
        or not reviewer.password_hash
        or not auth.verify_password(data.password, reviewer.password_hash)
    ):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")
    return schemas.AdminLoginOut(
        token=auth.issue_admin_token(admin_id=reviewer.id, username=reviewer.username)
    )
