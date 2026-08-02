import os

import requests

# AdsPower desktop app's Local API — only reachable from the same machine the
# app runs on, and only works on a paid AdsPower plan (confirmed via the
# "API & MCP" settings screen: "This feature is only available for paid plans").


def _base_url() -> str:
    return os.environ.get("ADSPOWER_BASE_URL", "http://local.adspower.net:50325").rstrip("/")


def is_configured() -> bool:
    return bool(os.environ.get("ADSPOWER_API_KEY"))


def _headers() -> dict:
    api_key = os.environ.get("ADSPOWER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "AdsPower API 키가 설정되지 않았습니다 — .env에 ADSPOWER_API_KEY를 채워주세요"
        )
    return {"Authorization": f"Bearer {api_key}"}


def _call(path: str, params: dict | None = None, timeout: int = 15) -> dict:
    res = requests.get(f"{_base_url()}{path}", headers=_headers(), params=params, timeout=timeout)
    res.raise_for_status()
    body = res.json()
    if body.get("code") != 0:
        raise RuntimeError(f"AdsPower API 오류: {body.get('msg', '알 수 없는 오류')}")
    return body["data"]


def list_profiles(page: int = 1, page_size: int = 100) -> list[dict]:
    data = _call("/api/v1/user/list", {"page": page, "page_size": page_size})
    return data.get("list", [])


def start_browser(profile_id: str) -> dict:
    """지정한 AdsPower 프로필로 브라우저를 실행한다. 이미 실행 중이면 그 창의 접속 정보를 그대로 반환한다."""
    return _call("/api/v1/browser/start", {"user_id": profile_id}, timeout=30)
