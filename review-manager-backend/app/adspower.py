import os
import time

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService

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


def detect_naver_profile_url(profile_id: str) -> str:
    """AdsPower 프로필의 브라우저(사람이 이미 로그인해둔 지속 세션)를 열어 네이버
    마이플레이스로 이동시킨 뒤, 실제로 도착한 URL(계정 고유 프로필 주소)을 읽어온다.
    로그인 화면으로 튕기면 아직 로그인이 안 된 것으로 보고 에러를 낸다.
    이 브라우저는 사람이 직접 로그인해둔 세션이라 절대 quit()/close()하지 않는다 —
    AdsPower가 붙여준 프로필에 연결(attach)만 하고 그대로 둔다."""
    data = start_browser(profile_id)
    selenium_address = data.get("ws", {}).get("selenium")
    if not selenium_address:
        raise RuntimeError("AdsPower가 브라우저 연결 정보를 반환하지 않았습니다")

    options = ChromeOptions()
    options.add_experimental_option("debuggerAddress", selenium_address)
    service = ChromeService(executable_path=data["webdriver"]) if data.get("webdriver") else ChromeService()
    driver = webdriver.Chrome(service=service, options=options)
    driver.get("https://m.place.naver.com/my")
    time.sleep(3)
    current_url = driver.current_url.rstrip("/")

    if "nid.naver.com" in current_url or "/login" in current_url:
        raise RuntimeError("이 계정이 아직 로그인되어 있지 않습니다 — AdsPower 창에서 먼저 네이버 로그인을 해주세요")
    if current_url == "https://m.place.naver.com/my":
        # 로그인이 안 되어 있으면 이 주소에서 리다이렉트가 안 일어나고 그대로 남는다 —
        # 계정 고유 프로필 주소(예: /my/profile/xxxx)로 이동했을 때만 진짜 성공으로 본다.
        raise RuntimeError(
            "마이플레이스 프로필 주소를 찾지 못했습니다 — 이 계정이 로그인되어 있지 않은 것 같습니다. "
            "AdsPower 창에서 직접 로그인 상태를 확인해주세요"
        )
    return current_url
