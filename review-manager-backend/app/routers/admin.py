import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app import auth, schemas

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
def login(data: schemas.AdminLoginIn):
    username = os.environ.get("ADMIN_USERNAME", "admin")
    password_hash = os.environ.get("ADMIN_PASSWORD_HASH")
    if not password_hash:
        raise HTTPException(status_code=500, detail="ADMIN_PASSWORD_HASH가 설정되지 않았습니다")
    if data.username != username or not auth.verify_password(data.password, password_hash):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")
    return schemas.AdminLoginOut(token=auth.issue_admin_token())
