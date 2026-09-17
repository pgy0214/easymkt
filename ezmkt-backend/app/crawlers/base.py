import json
import logging
import os
import random
import time as time_module
from contextlib import contextmanager

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.edge.options import Options as EdgeOptions

logger = logging.getLogger("crawlers")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
# 엣지는 크로미움 기반이라 옵션/CDP 메커니즘은 크롬과 동일하지만, User-Agent까지
# 크롬인 척하면 "브라우저 내부 동작은 엣지인데 UA는 크롬"인 불일치가 생겨 오히려
# 더 수상해 보인다 — 엣지로 켤 땐 진짜 엣지 UA를 쓴다.
EDGE_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
)

# 캡차가 뜬 순간의 증거(스크린샷/HTML/자동화 지문 진단값)를 남겨두는 곳 — 캡차가
# "더보기를 몇 번 누른 뒤"가 아니라 "페이지 최초 로드 시점부터" 뜨는 경우가 실제로
# 관측됐는데, 이건 클릭 빈도 문제가 아니라 브라우저 자체가 자동화로 식별된다는
# 뜻이라 진단이 필요했다. headless 여부와 무관하게 항상 저장되므로, 화면을 직접
# 못 보는 스케줄러 작업(영수증 날짜 확인 등)에서 캡차가 떠도 사후에 확인 가능하다.
DEBUG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "crawler_debug"
)

# 크롤링마다 완전히 새 브라우저(쿠키 0개, 방문기록 없음)로 접속하면 네이버 입장에서는
# 매번 "초면인 익명 방문자"로 보인다 — 실제 사람의 브라우저는 오래 쓸수록 쿠키/로그인
# 상태/방문기록이 쌓여서 신뢰를 얻는 것과 대조적이다. 크롤러 종류별로 고정된 디스크
# 경로에 크롬 프로필(--user-data-dir)을 두면, 크롤링이 끝나도 다음 실행 때 쿠키와
# 로컬스토리지가 그대로 이어져 "매번 초면"인 상태를 없앨 수 있다. 단, 같은 프로필로
# 두 크롤러 프로세스가 동시에 접속하면 크롬이 프로필 잠금 충돌로 실패하므로, 크롤러
# 종류별(블라인드 확인/영수증 날짜 확인)로 프로필을 분리해서 그 위험을 줄인다.
PROFILE_ROOT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "crawler_profile"
)

# 네이버 크롤러 전부(블라인드 확인, 영수증 날짜 확인 등)가 공유하는 캡차 방어 로직.
# 어느 크롤러든 "더보기"/탭 클릭을 반복하면 네이버가 자동화를 의심해 실제 콘텐츠
# 대신 보안확인(캡차) 화면을 띄운다 — 이걸 감지 못하면 캡차 화면을 정상 결과로
# 착각해서 조용히 틀린 데이터를 만들어낸다(블라인드 오판정, 영수증 날짜 오산정 등
# 실제로 두 곳에서 발견됨). 캡차를 자동으로 읽어서 대신 풀어주는 건 네이버의
# 자동화 방지 장치를 우회하는 행위라 만들지 않는다 — 감지 즉시 실패시키거나
# (wait_for_human=True일 때만) 사람이 화면 보고 직접 풀 시간을 잠깐 준다.
CAPTCHA_MARKER = "보안 확인을 완료해 주세요"
CAPTCHA_HUMAN_WAIT_SECONDS = 180
CAPTCHA_HUMAN_POLL_SECONDS = 3


def human_delay(min_s: float, max_s: float) -> None:
    """매번 똑같은 간격으로 기계적으로 클릭하는 패턴이 자동화 탐지를 유발하기
    쉬워서, 사람이 읽고 누르는 것처럼 무작위로 간격을 둔다. 가끔은(15% 확률)
    "읽어보느라 오래 멈칫하는" 느낌을 내려고 범위 자체를 2~4배로 늘린다 —
    매번 똑같은 min~max 구간 안에서만 무작위인 것도 그 자체로 규칙적인 패턴이다."""
    if random.random() < 0.15:
        time_module.sleep(random.uniform(min_s * 2, max_s * 4))
    else:
        time_module.sleep(random.uniform(min_s, max_s))


def human_scroll_and_click(driver, element) -> None:
    """자동화 탐지를 피하려고: (1) execute_script로 순간이동하듯 스크롤하는 대신
    여러 번에 걸쳐 무작위 간격만큼 나눠 스크롤하고, (2) execute_script로 요소를
    강제 클릭하는 대신(좌표/마우스 이벤트가 아예 없는 방식이라 자동화 신호가 뚜렷함)
    화면에 보이게 스크롤한 뒤 셀레니움 기본 .click()(실제 마우스 이벤트 발생)을 쓴다."""
    current = driver.execute_script("return window.pageYOffset")
    target = driver.execute_script(
        "return arguments[0].getBoundingClientRect().top + window.pageYOffset - 200", element
    )
    distance = target - current
    steps = random.randint(4, 8)
    for i in range(1, steps + 1):
        # 등속이 아니라 처음/끝은 느리고 중간은 빠른 완만한 곡선(ease-in-out)으로 스크롤
        progress = i / steps
        eased = progress - (progress - 0.5) ** 3 * 0.5 if progress != 0.5 else 0.5
        driver.execute_script("window.scrollTo(0, arguments[0])", current + distance * eased)
        time_module.sleep(random.uniform(0.08, 0.25))
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click()", element)


def save_debug_snapshot(driver, label: str) -> None:
    """캡차(또는 그 외 예기치 못한 화면)를 만난 시점의 증거를 남긴다 — 실패해도
    (디스크 문제 등) 본 크롤링 흐름을 절대 깨면 안 되므로 전부 조용히 무시한다."""
    try:
        os.makedirs(DEBUG_DIR, exist_ok=True)
        stamp = time_module.strftime("%Y%m%d_%H%M%S")
        base = os.path.join(DEBUG_DIR, f"{stamp}_{label}")
        driver.save_screenshot(f"{base}.png")
        with open(f"{base}.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        diagnostics = {
            "url": driver.current_url,
            "navigator_webdriver": driver.execute_script("return navigator.webdriver"),
            "user_agent": driver.execute_script("return navigator.userAgent"),
            "window_size": driver.get_window_size(),
            "cookie_count": len(driver.get_cookies()),
        }
        with open(f"{base}.json", "w", encoding="utf-8") as f:
            json.dump(diagnostics, f, ensure_ascii=False, indent=2)
        logger.warning("캡차 디버그 스냅샷 저장: %s.png / .html / .json", base)
    except Exception:
        logger.exception("캡차 디버그 스냅샷 저장 실패 (무시하고 계속)")


def raise_if_captcha(driver, wait_for_human: bool = False, debug_label: str | None = None) -> None:
    if CAPTCHA_MARKER not in driver.page_source:
        return

    save_debug_snapshot(driver, debug_label or "captcha")

    if wait_for_human:
        logger.warning("네이버 캡차 감지 — 실시간 화면에서 직접 풀어주세요 (최대 %d초 대기)", CAPTCHA_HUMAN_WAIT_SECONDS)
        deadline = time_module.time() + CAPTCHA_HUMAN_WAIT_SECONDS
        while time_module.time() < deadline:
            time_module.sleep(CAPTCHA_HUMAN_POLL_SECONDS)
            if CAPTCHA_MARKER not in driver.page_source:
                return  # 사람이 풀었다 — 그대로 이어서 진행

    raise RuntimeError(
        "네이버 보안 확인(캡차)에 걸려 페이지를 불러오지 못했습니다 — "
        "같은 대상을 짧은 시간에 반복 조회하면 발생하기 쉬우니 잠시 후 다시 시도해주세요"
    )


@contextmanager
def chrome_driver(headless: bool | None = None, profile: str | None = None, browser: str = "chrome"):
    """headless=None이면 .env의 CRAWLER_HEADLESS를 따르고, True/False를 명시하면
    그 값으로 강제한다 — 블라인드 일괄확인의 "실시간 화면 보기" 체크박스처럼 이번
    한 번만 눈으로 보고 싶을 때 전역 설정을 안 건드리고 그 요청에서만 창을 띄울 수 있다.
    profile을 주면 크롤링이 끝나도 쿠키/방문기록이 디스크에 남아 다음 실행에 이어진다
    (PROFILE_ROOT 주석 참고) — 같은 profile 이름을 쓰는 크롤러끼리는 동시 실행하면 안 된다.
    browser="edge"면 크롬 대신 엣지로 접속한다 — 둘 다 크로미움 기반이라 옵션/CDP는
    동일하게 통하지만, 완전히 다른 브라우저 실행파일·지문이라 지금까지 계속 자동화로
    찍혀온 크롬 세션과는 별개의 평판에서 새로 시작하게 된다."""
    if browser == "edge":
        options = EdgeOptions()
    else:
        options = ChromeOptions()
    # CRAWLER_HEADLESS=false in .env pops up a real browser window so you can
    # watch the crawler click through a page live — handy when checking Naver's
    # DOM or working out Kakao Map's real selectors
    if headless is None:
        headless = os.environ.get("CRAWLER_HEADLESS", "true").lower() != "false"
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument(f"user-agent={EDGE_USER_AGENT if browser == 'edge' else USER_AGENT}")
    if profile:
        profile_dir = os.path.join(PROFILE_ROOT, browser, profile)
        os.makedirs(profile_dir, exist_ok=True)
        options.add_argument(f"--user-data-dir={profile_dir}")
    # 셀레니움 기본 브라우저는 navigator.webdriver=true, "자동화 소프트웨어에 의해
    # 제어되고 있습니다" 배너, 작은 기본 창 크기 등 자동화 탐지에 그대로 걸리는
    # 지문을 남긴다 — 네이버 보안확인이 "더보기를 몇 번 누르기도 전에, 페이지 최초
    # 로드 시점부터" 뜨는 걸 실제로 관측했는데, 클릭 빈도 문제라면 이럴 수 없다.
    # 즉 클릭 속도보다 이 지문 자체가 더 근본적인 원인일 가능성이 크다 — 아래는
    # 그 지문을 지우는 표준적인 조치.
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--window-size=1920,1080")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    # 로컬(Windows)은 셀레니움이 크롬/드라이버를 알아서 찾아 쓰지만, 컨테이너(Railway
    # Dockerfile)에는 apt로 설치한 크로미움/드라이버 경로를 명시해줘야 한다 — 두 env var가
    # 없으면 지금까지와 동일하게 자동 탐지에 맡긴다.
    if browser == "edge":
        driver = webdriver.Edge(options=options)
    else:
        chrome_binary = os.environ.get("CHROME_BINARY_PATH")
        if chrome_binary:
            options.binary_location = chrome_binary
        chromedriver_path = os.environ.get("CHROMEDRIVER_PATH")
        service = ChromeService(executable_path=chromedriver_path) if chromedriver_path else None
        driver = webdriver.Chrome(options=options, service=service)
    try:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"},
        )
    except Exception:
        logger.exception("navigator.webdriver 은폐 스크립트 주입 실패 (무시하고 계속)")
    try:
        yield driver
    finally:
        driver.quit()
