import datetime
import time as time_module

from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from app import models
from app.crawlers.base import chrome_driver, logger

CHECK_WINDOW_DAYS = 7


def find_next_available_date(profile_url: str) -> datetime.date | None:
    """Adapted from legacy `04. 영수증 가능날짜 체크.py`: open the reviewer's own
    Naver Place profile, read the dates they've already posted a review on, and
    pick the nearest of the last CHECK_WINDOW_DAYS days that isn't already used."""
    with chrome_driver() as driver:
        driver.get(profile_url)
        time_module.sleep(2)

        try:
            tab_button = driver.find_element(
                By.CSS_SELECTOR, "ul.YUXlEx > li:first-child button"
            )
            tab_button.click()
            time_module.sleep(1)
        except Exception:
            logger.warning("리뷰 탭 버튼을 찾지 못했습니다: %s", profile_url)

        for _ in range(2):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
            time_module.sleep(1)

        soup = BeautifulSoup(driver.page_source, "html.parser")
        used_dates = set()
        for item in soup.select('div[role="listitem"] time'):
            parsed = _parse_date_text(item.get_text(strip=True))
            if parsed:
                used_dates.add(parsed)

    today = datetime.date.today()
    for offset in range(1, CHECK_WINDOW_DAYS + 1):
        candidate = today - datetime.timedelta(days=offset)
        if candidate not in used_dates:
            return candidate
    return None


def _parse_date_text(text: str) -> datetime.date | None:
    text = text.strip()
    for fmt in ("%Y.%m.%d.", "%Y.%m.%d", "%y.%m.%d."):
        try:
            return datetime.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def run_job(db) -> None:
    # 'claimed' = a reviewer just picked this up via the open pool; this job
    # runs the one-time date pre-check before it becomes 'ready' to work on
    tasks = (
        db.query(models.Task)
        .filter(models.Task.status == "claimed", models.Task.platform == "naver")
        .all()
    )

    for task in tasks:
        task.status = "checking_date"
    db.commit()

    for task in tasks:
        account = task.review_account
        if not account or not account.profile_url:
            logger.warning("Task %s: 프로필 URL이 없어 날짜 확인을 건너뜁니다", task.id)
            task.status = "claimed"
            db.commit()
            continue

        try:
            date = find_next_available_date(account.profile_url)
        except Exception:
            logger.exception("Task %s 날짜 확인 실패", task.id)
            date = None

        task.naver_available_date = date
        task.status = "ready" if date else "claimed"
        db.commit()
