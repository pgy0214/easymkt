import datetime
import time as time_module

from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from app import models
from app.crawlers.base import chrome_driver, logger
from app.crawlers.blind_check_common import apply_scrape_result

# NOTE: unlike Naver, there was no existing reference implementation for Kakao
# Map crawling to adapt. These selectors are best-effort placeholders based on
# Kakao Map's typical place-review layout and have NOT been verified against a
# live page. Before relying on this in production, open a real store's Kakao
# Map review page, inspect it with browser devtools, and update the constants
# below to match — the rest of the module (pagination loop, snapshot/diff
# logic in blind_check_common) should not need to change.
REVIEW_TAB_SELECTOR = 'a[href="#kakaoReview"], a.link_tab[data-tab="review"]'
REVIEW_LIST_ITEM_SELECTOR = "ul.list_review > li"
REVIEWER_NAME_SELECTOR = ".name_user, .txt_name"
REVIEW_CONTENT_SELECTOR = ".desc_review, .txt_comment"
REVIEW_DATE_SELECTOR = ".time_write, .txt_date"
MORE_BUTTON_SELECTOR = "a.link_more, button.btn_more"

REVIEW_WINDOW_DAYS = 30
MAX_LOAD_MORE_ATTEMPTS = 20


def scrape_store_reviews(store_url: str) -> list[dict]:
    """Same approach as naver_blind_check.scrape_store_reviews (open the
    store's review section, click "more" until past the window, collect
    nickname/date/content) but against Kakao Map's page structure."""
    reviews: list[dict] = []

    with chrome_driver() as driver:
        driver.get(store_url)
        time_module.sleep(2)

        try:
            tab = driver.find_element(By.CSS_SELECTOR, REVIEW_TAB_SELECTOR)
            driver.execute_script("arguments[0].click()", tab)
            time_module.sleep(1)
        except Exception:
            logger.warning("카카오맵 리뷰 탭을 찾지 못했습니다: %s", store_url)

        cutoff = datetime.date.today() - datetime.timedelta(days=REVIEW_WINDOW_DAYS)
        stop = False
        attempts = 0
        while not stop and attempts < MAX_LOAD_MORE_ATTEMPTS:
            attempts += 1
            soup = BeautifulSoup(driver.page_source, "html.parser")
            items = soup.select(REVIEW_LIST_ITEM_SELECTOR)
            reviews = []
            oldest_on_page = None
            for item in items:
                nickname_el = item.select_one(REVIEWER_NAME_SELECTOR)
                content_el = item.select_one(REVIEW_CONTENT_SELECTOR)
                date_el = item.select_one(REVIEW_DATE_SELECTOR)
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
                more = driver.find_element(By.CSS_SELECTOR, MORE_BUTTON_SELECTOR)
                driver.execute_script("arguments[0].click()", more)
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
    for fmt in ("%Y.%m.%d.", "%Y.%m.%d", "%y.%m.%d"):
        try:
            return datetime.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _eligible_tasks_query(db):
    return db.query(models.Task).filter(
        models.Task.status == "completed",
        models.Task.platform == "kakao",
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
            logger.exception("카카오맵 블라인드 확인 크롤링 실패: %s", store_url)
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
