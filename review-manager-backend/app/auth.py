import datetime
import os

import jwt

TOKEN_TTL_DAYS = 30
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
