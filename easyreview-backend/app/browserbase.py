import os
import time

import requests

# Browserbase 클라우드 브라우저 — AdsPower와 달리 로컬 PC 없이도 서버(Railway)에서
# 바로 호출 가능한 진짜 인터넷 API. 계정별 고정 IP는 Bright Data ISP 프록시(호스트/
# 포트/아이디/비번 고정, IP만 요청마다 아이디 뒤에 "-ip-<주소>"를 붙여서 지정)를
# 그대로 붙여쓴다 — app/adspower.py는 그대로 두고(로컬 PC 필요 없는 대체 경로).

BASE_URL = "https://api.browserbase.com/v1"
NAVER_MY_URL = "https://m.place.naver.com/my"


def is_configured() -> bool:
    return bool(os.environ.get("BROWSERBASE_API_KEY"))


def _headers() -> dict:
    api_key = os.environ.get("BROWSERBASE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "BROWSERBASE_API_KEY가 설정되지 않았습니다 — .env에 채워주세요"
        )
    return {"X-BB-API-Key": api_key, "Content-Type": "application/json"}


def _project_id() -> str | None:
    return os.environ.get("BROWSERBASE_PROJECT_ID") or None


def brightdata_proxy_configured() -> bool:
    return bool(
        os.environ.get("BRIGHTDATA_PROXY_HOST")
        and os.environ.get("BRIGHTDATA_PROXY_PORT")
        and os.environ.get("BRIGHTDATA_PROXY_USERNAME")
        and os.environ.get("BRIGHTDATA_PROXY_PASSWORD")
    )


def _brightdata_proxy(ip_address: str) -> dict:
    """Bright Data ISP 프록시 — 호스트/포트/아이디/비번은 전부 고정이고, 아이디 뒤에
    "-ip-<주소>"를 붙이는 것으로만 어떤 고정 IP를 쓸지 고른다(계정별 IP 배정은 이
    ip_address 하나만 바뀌면 됨 — app.models.ReviewAccount.ip_address 그대로 사용)."""
    host = os.environ.get("BRIGHTDATA_PROXY_HOST")
    port = os.environ.get("BRIGHTDATA_PROXY_PORT")
    username = os.environ.get("BRIGHTDATA_PROXY_USERNAME")
    password = os.environ.get("BRIGHTDATA_PROXY_PASSWORD")
    if not (host and port and username and password):
        raise RuntimeError(
            "BRIGHTDATA_PROXY_HOST/PORT/USERNAME/PASSWORD가 서버에 설정되어 있지 않습니다"
        )
    return {
        "type": "external",
        "server": f"http://{host}:{port}",
        "username": f"{username}-ip-{ip_address}",
        "password": password,
    }


def create_context(name: str | None = None) -> dict:
    """이 계정 전용 지속 아이덴티티(쿠키/로그인상태/지문)를 하나 만든다 — AdsPower의
    "프로필"과 같은 개념. 계정마다 한 번만 만들어서 context_id를 저장해두고, 이후
    세션마다 재사용한다(세션을 새로 열어도 이 안에 로그인 상태가 그대로 남아있음)."""
    body = {"name": name} if name else {}
    project_id = _project_id()
    if project_id:
        body["projectId"] = project_id
    res = requests.post(f"{BASE_URL}/contexts", headers=_headers(), json=body, timeout=15)
    res.raise_for_status()
    return res.json()


def create_session(context_id: str, ip_address: str | None = None) -> dict:
    """이 계정(context)으로 실제 브라우저를 하나 띄운다. ip_address를 주면 Bright Data
    프록시로 그 고정 IP를 통해 접속한다 — 매번 같은 IP로 접속해야 계정별 로그인이
    안 섞인다. 켜져있는 시간만큼 과금되므로 작업이 끝나면 반드시 end_session으로
    닫아야 한다."""
    body = {
        "browserSettings": {
            "context": {"id": context_id, "persist": True},
        },
    }
    project_id = _project_id()
    if project_id:
        body["projectId"] = project_id
    if ip_address:
        body["proxies"] = [_brightdata_proxy(ip_address)]
    res = requests.post(f"{BASE_URL}/sessions", headers=_headers(), json=body, timeout=30)
    res.raise_for_status()
    return res.json()


def get_live_view_url(session_id: str) -> str:
    """사람이 직접 로그인하거나 화면을 봐야 할 때 여는 링크 — 로컬 프로그램 설치 없이
    일반 브라우저 새 탭에서 바로 열린다."""
    res = requests.get(f"{BASE_URL}/sessions/{session_id}/debug", headers=_headers(), timeout=15)
    res.raise_for_status()
    return res.json()["debuggerFullscreenUrl"]


def end_session(session_id: str) -> None:
    """세션(=요금이 발생 중인 켜진 브라우저)을 닫는다. Context(데이터)는 그대로 남는다."""
    res = requests.post(
        f"{BASE_URL}/sessions/{session_id}",
        headers=_headers(),
        json={"status": "REQUEST_RELEASE"},
        timeout=15,
    )
    res.raise_for_status()


def check_naver_login(context_id: str, ip_address: str | None = None) -> bool:
    """이 계정(context)이 지금 네이버에 로그인돼 있는지 확인한다 — adspower.
    detect_naver_profile_url과 같은 판정 방식(마이플레이스로 이동시켜 로그인
    화면으로 튕기는지 확인). 확인용 세션을 새로 열었다가 끝나면 바로 닫으므로
    과금은 확인에 걸리는 몇 초뿐이다. 실제 사용과 같은 IP로 확인해야 의미가
    있으므로 ip_address를 그대로 넘겨서 세션을 연다."""
    session = create_session(context_id, ip_address)
    session_id = session["id"]
    selenium_url = session.get("seleniumRemoteUrl")
    if not selenium_url:
        end_session(session_id)
        raise RuntimeError("Browserbase 세션에서 seleniumRemoteUrl을 받지 못했습니다")

    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options as ChromeOptions
        from selenium.webdriver.remote.remote_connection import RemoteConnection

        api_key = os.environ["BROWSERBASE_API_KEY"]

        class _BrowserbaseConnection(RemoteConnection):
            """Selenium은 커스텀 헤더를 못 넣어서, Browserbase가 요구하는
            x-bb-api-key/session-id를 여기서 주입해야 세션에 붙을 수 있다."""

            def get_remote_connection_headers(self, parsed_url, keep_alive=False):
                headers = super().get_remote_connection_headers(parsed_url, keep_alive)
                headers["x-bb-api-key"] = api_key
                headers["session-id"] = session_id
                return headers

        connection = _BrowserbaseConnection(selenium_url)
        options = ChromeOptions()
        driver = webdriver.Remote(command_executor=connection, options=options)
        driver.get(NAVER_MY_URL)
        time.sleep(3)
        current_url = driver.current_url.rstrip("/")
        return not (
            "nid.naver.com" in current_url
            or "/login" in current_url
            or current_url == NAVER_MY_URL
        )
    finally:
        end_session(session_id)
