import datetime
import time as time_module

from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from app import models
from app.crawlers.base import chrome_driver, logger
from app.crawlers.blind_check_common import apply_scrape_result

REVIEW_WINDOW_DAYS = 30
MAX_LOAD_MORE_ATTEMPTS = 20


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
