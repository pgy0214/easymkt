import datetime
import os

import bcrypt
import jwt

TOKEN_TTL_DAYS = 30
ADMIN_TOKEN_TTL_DAYS = 30
ALGORITHM = "HS256"


def _secret() -> str:
    secret = os.environ.get("PORTAL_JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "PORTAL_JWT_SECRET이 설정되지 않았습니다 — .env에 임의의 긴 무작위 문자열을 넣어주세요"
        )
    return secret


def issue_token(reviewer_id: int) -> str:
    payload = {
        "reviewer_id": reviewer_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def verify_token(token: str) -> int:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
    except jwt.PyJWTError as e:
        raise ValueError("유효하지 않거나 만료된 토큰입니다") from e
    return payload["reviewer_id"]


def _admin_secret() -> str:
    secret = os.environ.get("ADMIN_JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "ADMIN_JWT_SECRET이 설정되지 않았습니다 — .env에 임의의 긴 무작위 문자열을 넣어주세요"
        )
    return secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def issue_admin_token(admin_id: int | None = None, username: str | None = None) -> str:
    payload = {
        "admin": True,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=ADMIN_TOKEN_TTL_DAYS),
    }
    if admin_id is not None:
        payload["admin_id"] = admin_id
    if username is not None:
        payload["username"] = username
    return jwt.encode(payload, _admin_secret(), algorithm=ALGORITHM)


def verify_admin_token(token: str) -> None:
    try:
        payload = jwt.decode(token, _admin_secret(), algorithms=[ALGORITHM])
    except jwt.PyJWTError as e:
        raise ValueError("유효하지 않거나 만료된 토큰입니다") from e
    if not payload.get("admin"):
        raise ValueError("관리자 토큰이 아닙니다")
