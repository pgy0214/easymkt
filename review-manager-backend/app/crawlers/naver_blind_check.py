import datetime
import re
import time as time_module

from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from app import models
from app.crawlers.base import chrome_driver, logger
from app.crawlers.blind_check_common import apply_scrape_result

REVIEW_WINDOW_DAYS = 30
MAX_LOAD_MORE_ATTEMPTS = 20

PROFILE_ID_RE = re.compile(r"/my/([a-f0-9]+)")
PLACE_ID_RE = re.compile(r"/(?:place|restaurant|accommodation|hairshop|hospital)/(\d+)")


def extract_profile_id(url: str) -> str | None:
    """네이버 마이플레이스 링크(예: https://m.place.naver.com/my/{id}/review)에서
    고유 사용자 id를 뽑아낸다 — 닉네임은 언제든 바뀔 수 있지만 이 id는 안 바뀌므로,
    리뷰 목록에 걸린 작성자 프로필 링크와 이 id를 직접 비교해 매칭한다."""
    if not url:
        return None
    match = PROFILE_ID_RE.search(url)
    return match.group(1) if match else None


def _normalize_review_list_url(store_url: str) -> str:
    """관리자가 붙여넣는 매장 URL은 map.naver.com(PC 지도)이나 m.place.naver.com의
    업종별 경로(restaurant/accommodation/...)까지 제각각이다. 어떤 형태든 리뷰
    id 하나만 뽑아내면 업종에 상관없이 통하는 m.place.naver.com/place/{id}/review/
    visitor 경로로 통일한다 — map.naver.com URL은 그대로 열면 리뷰 목록이 아니라
    지도 화면이라 이 변환이 꼭 필요하다."""
    if "/review/" in store_url:
        return store_url
    match = PLACE_ID_RE.search(store_url)
    if match:
        return f"https://m.place.naver.com/place/{match.group(1)}/review/visitor?reviewSort=recent"
    return store_url.rstrip("/") + "/review/visitor?reviewSort=recent"


def scrape_store_review_profile_ids(store_url: str, window_days: int = REVIEW_WINDOW_DAYS) -> set[str]:
    """매장 리뷰 목록을 스크롤하며 현재 노출 중인 리뷰 작성자들의 프로필 id 집합을 모은다.
    개별 리뷰엔 직접 링크가 없어 이 방식으로만 "이 사람 리뷰가 지금 보이는가"를 판정할 수 있다."""
    url = _normalize_review_list_url(store_url)

    profile_ids: set[str] = set()
    with chrome_driver() as driver:
        driver.get(url)
        time_module.sleep(2)

        cutoff = datetime.date.today() - datetime.timedelta(days=window_days)
        stop = False
        attempts = 0
        while not stop and attempts < MAX_LOAD_MORE_ATTEMPTS:
            attempts += 1
            soup = BeautifulSoup(driver.page_source, "html.parser")
            items = soup.select("li.place_apply_pui")
            profile_ids = set()
            oldest_on_page = None
            for item in items:
                a_prof = item.select_one('a[data-pui-click-code="profile"]')
                pid = extract_profile_id(a_prof.get("href")) if a_prof else None
                if pid:
                    profile_ids.add(pid)
                date_el = item.select_one("time")
                posted_date = _parse_date_text(date_el.get_text(strip=True)) if date_el else None
                if posted_date and (oldest_on_page is None or posted_date < oldest_on_page):
                    oldest_on_page = posted_date

            if oldest_on_page and oldest_on_page < cutoff:
                stop = True
                continue

            try:
                more_button = driver.find_element(By.CSS_SELECTOR, "a.fvwqf")
                driver.execute_script("arguments[0].click()", more_button)
                time_module.sleep(1.5)
            except Exception:
                stop = True

    return profile_ids


def scrape_store_reviews(store_url: str) -> list[dict]:
    """Adapted from legacy `02. cst_campaign 리뷰단 크롤링.py`: open the store's
    Naver Place visitor-review list and click "더보기" until reviews are older
    than REVIEW_WINDOW_DAYS, collecting nickname/date/content per review."""
    reviews: list[dict] = []
    url = store_url
    if "/review/" not in url:
        url = url.rstrip("/") + "/review/visitor?reviewSort=recent"

    with chrome_driver() as driver:
        driver.get(url)
        time_module.sleep(2)

        cutoff = datetime.date.today() - datetime.timedelta(days=REVIEW_WINDOW_DAYS)
        stop = False
        attempts = 0
        while not stop and attempts < MAX_LOAD_MORE_ATTEMPTS:
            attempts += 1
            soup = BeautifulSoup(driver.page_source, "html.parser")
            items = soup.select("li.place_apply_pui")
            reviews = []
            oldest_on_page = None
            for item in items:
                nickname_el = item.select_one("span.pui__NMi-Dp")
                content_el = item.select_one('a[data-pui-click-code*="rvshowmore"]')
                date_el = item.select_one("time")
                if not nickname_el:
                    continue
                date_text = date_el.get_text(strip=True) if date_el else ""
                posted_date = _parse_date_text(date_text)
                if posted_date and (oldest_on_page is None or posted_date < oldest_on_page):
                    oldest_on_page = posted_date
                reviews.append(
                    {
                        "nickname": nickname_el.get_text(strip=True),
                        "date_text": date_text,
                        "content": content_el.get_text(strip=True) if content_el else "",
                        "posted_date": posted_date,
                    }
                )

            if oldest_on_page and oldest_on_page < cutoff:
                stop = True
                continue

            try:
                more_button = driver.find_element(By.CSS_SELECTOR, "a.fvwqf")
                driver.execute_script("arguments[0].click()", more_button)
                time_module.sleep(1.5)
            except Exception:
                stop = True

    return reviews


def _parse_date_text(text: str) -> datetime.date | None:
    text = text.strip()
    today = datetime.date.today()
    if text.endswith("일 전"):
        try:
            return today - datetime.timedelta(days=int(text.replace("일 전", "").strip()))
        except ValueError:
            return None
    if text == "오늘":
        return today
    if text == "어제":
        return today - datetime.timedelta(days=1)
    for fmt in ("%Y.%m.%d.", "%Y.%m.%d", "%m.%d.", "%m.%d"):
        try:
            parsed = datetime.datetime.strptime(text, fmt)
            if parsed.year == 1900:
                parsed = parsed.replace(year=today.year)
            return parsed.date()
        except ValueError:
            continue
    return None


def _eligible_tasks_query(db):
    return db.query(models.Task).filter(
        models.Task.status == "completed",
        models.Task.platform == "naver",
        models.Task.blind_status != "blinded",
        models.Task.check_expired.is_(False),
    )


def run_job(db) -> None:
    tasks = _eligible_tasks_query(db).all()
    if not tasks:
        return

    now = datetime.datetime.utcnow()
    by_store: dict[str, list[models.Task]] = {}
    for task in tasks:
        store_url = task.review_target.store_url if task.review_target else None
        if not store_url:
            continue
        by_store.setdefault(store_url, []).append(task)

    for store_url, store_tasks in by_store.items():
        try:
            scraped = scrape_store_reviews(store_url)
        except Exception:
            logger.exception("네이버 블라인드 확인 크롤링 실패: %s", store_url)
            continue

        for task in store_tasks:
            account_label = task.review_account.label if task.review_account else ""
            apply_scrape_result(task, scraped, account_label, now)
        db.commit()


def recheck_task(db, task: models.Task) -> models.Task:
    store_url = task.review_target.store_url if task.review_target else None
    if not store_url:
        return task

    now = datetime.datetime.utcnow()
    scraped = scrape_store_reviews(store_url)
    account_label = task.review_account.label if task.review_account else ""
    apply_scrape_result(task, scraped, account_label, now, force=True)
    db.commit()
    db.refresh(task)
    return task
