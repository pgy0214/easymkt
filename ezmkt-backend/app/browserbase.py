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
    닫아야 한다.

    timeout을 명시하지 않으면 프로젝트 기본값(300초=5분)이 적용돼서, 관리자가 직접
    로그인(2단계 인증 등 포함)하는 도중에 "Debugging connection was closed" 로 끊겨버린다
    — 1시간으로 넉넉히 늘려서 사람이 로그인할 시간을 확보한다.

    region을 명시하지 않으면 기본값 us-west-2(미국 오레곤)라서, 한국 사이트 접속 + 실시간
    화면보기 스트리밍 왕복 지연이 커서 체감상 많이 느리다 — 한국에서 제일 가까운
    ap-southeast-1(싱가포르)로 지정한다. (Browserbase API는 locale/언어 설정 필드 자체가
    없어서, 원격 브라우저가 영어로 뜨는 문제는 이 방법으로는 못 고침 — 라이브뷰 안에서
    직접 크롬 언어 설정을 한국어로 바꿔야 함)"""
    body = {
        "browserSettings": {
            "context": {"id": context_id, "persist": True},
        },
        "timeout": 3600,
        "region": "ap-southeast-1",
    }
    project_id = _project_id()
    if project_id:
        body["projectId"] = project_id
    if ip_address:
        body["proxies"] = [_brightdata_proxy(ip_address)]
    res = requests.post(f"{BASE_URL}/sessions", headers=_headers(), json=body, timeout=30)
    res.raise_for_status()
    return res.json()


def _remote_driver(session_id: str, selenium_url: str):
    """이 세션에 Selenium Remote WebDriver를 붙인다. Selenium은 커스텀 헤더를 못
    넣어서, Browserbase가 요구하는 x-bb-api-key/session-id를 주입해야 붙을 수 있다."""
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.remote.remote_connection import RemoteConnection

    api_key = os.environ["BROWSERBASE_API_KEY"]

    class _BrowserbaseConnection(RemoteConnection):
        def get_remote_connection_headers(self, parsed_url, keep_alive=False):
            headers = super().get_remote_connection_headers(parsed_url, keep_alive)
            headers["x-bb-api-key"] = api_key
            headers["session-id"] = session_id
            return headers

    connection = _BrowserbaseConnection(selenium_url)
    driver = webdriver.Remote(command_executor=connection, options=ChromeOptions())
    _apply_mobile_emulation(driver)
    return driver


# 네이버 리뷰/마이플레이스 쪽 기능(방문인증 등) 상당수가 모바일 환경에서만 동작해서
# ("방문 인증은 모바일 환경에서만 가능합니다" 안내가 데스크톱 UA/화면에서 뜸), 이
# 모듈로 여는 세션은 항상 실제 휴대폰처럼 보이도록 미리 맞춰둔다 — 관리자가 매번
# 라이브뷰에서 크롬 개발자도구로 수동으로 모바일 모드를 켤 필요가 없게.
_MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36"
)


def _apply_mobile_emulation(driver) -> None:
    driver.command_executor._commands["executeCdpCommand"] = (
        "POST",
        "/session/$sessionId/goog/cdp/execute",
    )
    driver.execute_cdp_cmd(
        "Emulation.setDeviceMetricsOverride",
        {"width": 390, "height": 844, "deviceScaleFactor": 3, "mobile": True},
    )
    driver.execute_cdp_cmd("Emulation.setTouchEmulationEnabled", {"enabled": True})
    driver.execute_cdp_cmd(
        "Network.setUserAgentOverride",
        {
            "userAgent": _MOBILE_UA,
            # Browserbase의 브라우저 자체 언어가 영어라 여태 영어 UI로 떴었다 —
            # chrome://settings는 막혀서 못 바꿨지만, 페이지가 보고 판단하는 값(요청
            # 헤더의 Accept-Language, JS의 navigator.language)은 CDP로 직접 덮어써서
            # 고칠 수 있다는 걸 실측으로 확인했다.
            "acceptLanguage": "ko-KR,ko;q=0.9",
            "userAgentMetadata": {
                "platform": "Android",
                "mobile": True,
                "architecture": "",
                "model": "SM-S911N",
                "platformVersion": "14",
            },
        },
    )
    driver.execute_cdp_cmd("Emulation.setLocaleOverride", {"locale": "ko-KR"})


def _get_with_retry(driver, url: str) -> None:
    """세션이 막 만들어진 직후엔 Bright Data 프록시 연결이 아직 준비되기 전이라
    첫 driver.get()이 "failed to connect to browser"로 실패하는 경우가 있다 —
    실측으로 확인한 동작이다. 실패한 시도 자체가 에러로 끝나기까지 15초 안팎
    걸려서(재시도 2번이면 30초 이상 그냥 날아감), 먼저 짧게 기다렸다가 시도하면
    대부분 첫 시도에 바로 성공한다 — 그래도 실패하면 기존대로 재시도한다."""
    from selenium.common.exceptions import WebDriverException

    time.sleep(3)
    for attempt in range(3):
        try:
            driver.get(url)
            return
        except WebDriverException:
            if attempt == 2:
                raise
            time.sleep(2)


def create_session_and_open(context_id: str, ip_address: str | None, url: str = NAVER_MY_URL) -> dict:
    """세션을 만들고 곧바로 지정한 주소로 이동시켜둔다. 그냥 세션만 만들면 브라우저가
    about:blank 상태로 떠서, "플레이스바로가기"로 라이브뷰를 열어도 빈 화면만 보인다
    — 관리자가 탭을 열자마자 마이플레이스 화면(로그인 여부까지 한눈에 보임)이 떠
    있도록 미리 이동시킨다. 이동이 실패해도(네트워크 문제 등) 세션 자체는 살아있으니
    그대로 반환한다 — 라이브뷰에서 직접 주소를 입력해 넘어갈 수 있다."""
    session = create_session(context_id, ip_address)
    selenium_url = session.get("seleniumRemoteUrl")
    if selenium_url:
        try:
            driver = _remote_driver(session["id"], selenium_url)
            _get_with_retry(driver, url)
        except Exception:
            pass
    return session


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


def end_running_sessions_for_context(context_id: str) -> int:
    """이 계정(context)으로 지금 켜져 있는 세션을 전부 찾아서 닫는다 — "지금 실행"이
    타임아웃(1시간)까지 켜둔 세션을 관리자가 로그인을 마친 뒤 직접 끌 수 있게 하기 위함.
    반환값은 닫은 세션 개수."""
    params = {"status": "RUNNING"}
    project_id = _project_id()
    if project_id:
        params["projectId"] = project_id
    res = requests.get(f"{BASE_URL}/sessions", headers=_headers(), params=params, timeout=15)
    res.raise_for_status()
    matching = [s for s in res.json() if s.get("contextId") == context_id]
    for session in matching:
        end_session(session["id"])
    return len(matching)


def check_naver_login(context_id: str, ip_address: str | None = None) -> bool:
    """이 계정(context)이 지금 네이버에 로그인돼 있는지 확인한다 — 마이플레이스로
    이동시켜서 로그인 화면(nid.naver.com)으로 튕기는지, 또는 URL은 그대로 /my에
    남아있지만 본문에 "로그인해주세요."가 뜨는지로 판단한다(URL이 안 바뀌었다고
    무조건 로그인 안 된 게 아니다 — 로그인된 경우에도 이 페이지는 리다이렉트 없이
    같은 주소에서 닉네임/리뷰 개수 등 실제 내용만 채워서 보여준다). 확인용 세션을
    새로 열었다가 끝나면 바로 닫으므로 과금은 확인에 걸리는 몇 초뿐이다. 실제
    사용과 같은 IP로 확인해야 의미가 있으므로 ip_address를 그대로 넘겨서 세션을
    연다."""
    session = create_session(context_id, ip_address)
    session_id = session["id"]
    selenium_url = session.get("seleniumRemoteUrl")
    if not selenium_url:
        end_session(session_id)
        raise RuntimeError("Browserbase 세션에서 seleniumRemoteUrl을 받지 못했습니다")

    try:
        driver = _remote_driver(session_id, selenium_url)
        _get_with_retry(driver, NAVER_MY_URL)
        time.sleep(3)
        current_url = driver.current_url.rstrip("/")
        if "nid.naver.com" in current_url or "/login" in current_url:
            return False

        # 로그인 안 된 상태에서도 이 페이지 자체는 리다이렉트 없이 그대로 /my에
        # 남아있고, 대신 본문에 "로그인해주세요."가 뜬다(반대로 로그인된 경우엔
        # 닉네임/리뷰 개수 등 실제 내용이 채워짐) — 실제로 로그인된 계정과 아닌
        # 계정을 각각 붙여서 비교해 확인한 판정 기준이다.
        body_text = driver.find_element("tag name", "body").text
        return "로그인해주세요" not in body_text
    finally:
        end_session(session_id)
