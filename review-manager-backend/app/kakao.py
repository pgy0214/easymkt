import os

import requests

# Kakao Login (OAuth authorization code flow) — 리뷰어 포털 전용 추가 로그인 수단.
# developers.kakao.com에서 앱을 만들고 REST API 키/Client Secret을 .env에 채워야 동작한다.


def is_configured() -> bool:
    return bool(os.environ.get("KAKAO_REST_API_KEY")) and bool(os.environ.get("KAKAO_CLIENT_SECRET"))


def client_id() -> str:
    return os.environ.get("KAKAO_REST_API_KEY", "")


def redirect_uri() -> str:
    return os.environ.get("KAKAO_REDIRECT_URI", "http://localhost:5173/")


def exchange_code_for_token(code: str) -> str:
    res = requests.post(
        "https://kauth.kakao.com/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": client_id(),
            "client_secret": os.environ.get("KAKAO_CLIENT_SECRET", ""),
            "redirect_uri": redirect_uri(),
            "code": code,
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()["access_token"]


def get_kakao_profile(access_token: str) -> dict:
    res = requests.get(
        "https://kapi.kakao.com/v2/user/me",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    res.raise_for_status()
    body = res.json()
    return {
        "kakao_id": str(body["id"]),
        "nickname": body.get("kakao_account", {}).get("profile", {}).get("nickname"),
    }
