import datetime
import random
import time as time_module

from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from app import crud, models, receipt_generator
from app.crawlers.base import chrome_driver, human_delay, logger, raise_if_captcha

CHECK_WINDOW_DAYS = 7


def find_next_available_date(profile_url: str) -> datetime.date | None:
    """Adapted from legacy `04. 영수증 가능날짜 체크.py`: open the reviewer's own
    Naver Place profile, read the dates they've already posted a review on, and
    pick the nearest of the last CHECK_WINDOW_DAYS days that isn't already used."""
    with chrome_driver(profile="date_check") as driver:
        driver.get(profile_url)
        human_delay(2.0, 3.5)
        raise_if_captcha(driver, debug_label="date_check_initial")

        try:
            tab_button = driver.find_element(
                By.CSS_SELECTOR, "ul.YUXlEx > li:first-child button"
            )
            tab_button.click()
            human_delay(0.8, 1.6)
        except Exception:
            logger.warning("리뷰 탭 버튼을 찾지 못했습니다: %s", profile_url)

        # 한 번에 바닥까지 순간이동하는 대신, 사람이 스크롤 휠을 굴리는 것처럼
        # 여러 단계로 나눠 무작위 간격을 두고 내려간다.
        for _ in range(2):
            current_height = driver.execute_script("return document.body.scrollHeight")
            steps = random.randint(3, 6)
            for i in range(1, steps + 1):
                driver.execute_script(
                    "window.scrollTo(0, arguments[0])", current_height * i / steps
                )
                time_module.sleep(random.uniform(0.15, 0.45))
            human_delay(0.6, 1.4)

        raise_if_captcha(driver, debug_label="date_check_scrolled")

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


def check_task_date(db, task: models.Task) -> bool:
    """작업 하나의 네이버 리뷰 가능 날짜를 지금 바로 확인하고(브라우저를 띄우므로
    몇 초 걸릴 수 있음), 찾으면 ready로 전환 + 영수증 생성까지 처리한다. 신청
    직후(포털 claim) 동기 호출과 2분 주기 run_job 양쪽에서 재사용한다.
    반환값은 "ready 전환 + 영수증 생성까지 성공"했는지 여부 — 날짜를 못 찾아
    다음 주기에 재시도해야 하는 경우와, 날짜는 찾았지만 영수증을 못 만든 경우
    모두 False다(호출부에서 구분하려면 task.naver_available_date를 같이 본다)."""
    account = task.review_account
    if not account or not account.profile_url:
        logger.warning("Task %s: 프로필 URL이 없어 날짜 확인을 건너뜁니다", task.id)
        task.status = "claimed"
        db.commit()
        return False

    try:
        date = find_next_available_date(account.profile_url)
    except Exception:
        logger.exception("Task %s 날짜 확인 실패", task.id)
        date = None

    task.naver_available_date = date
    task.status = "ready" if date else "claimed"
    db.commit()

    if not date:
        return False
    return _generate_receipt_if_possible(db, task)


def run_job(db) -> None:
    # 'claimed' = a reviewer just picked this up via the open pool; this job
    # runs the one-time date pre-check before it becomes 'ready' to work on
    # (포털에서 직접 신청한 건은 claim 시점에 이미 동기로 처리되므로 보통
    # 여기 안 걸림 — 그 처리가 실패했거나 관리자 수동배정 등으로 남은 것만 재시도)
    tasks = (
        db.query(models.Task)
        .filter(models.Task.status == "claimed", models.Task.platform == "naver")
        .all()
    )

    for task in tasks:
        task.status = "checking_date"
    db.commit()

    for task in tasks:
        check_task_date(db, task)


def _generate_receipt_if_possible(db, task: models.Task) -> bool:
    """네이버 영수증 날짜가 정해지면(=ready) 영수증 이미지를 만들어둔다. 오픈풀
    단계에서 이미 메뉴/영업시간 조건은 걸러졌으므로(crud.is_naver_receipt_possible_for_pool)
    여기서 더 실패할 수 있는 건 사실상 계정별 4시간 간격 조건뿐이다 — 그래도 방어적으로
    모든 실패 케이스에서 False를 반환해, 호출부(포털 claim)가 신청 자체를 되돌릴 수 있게 한다."""
    target = task.review_target
    store = target.store if target else None
    if not store:
        return False
    menu_items = crud.decode_menu_items(target.menu_items_json)
    card_rules = crud.card_rules_as_dicts(db)

    account = task.review_account
    if not account:
        return False
    is_admin_account = bool(account.reviewer and account.reviewer.category == "own")

    if is_admin_account:
        # 관리자(자체보유) 계정 — 우리가 영수증을 직접 만들기 때문에 오전/오후/밤을
        # 정확하게 나눠서 분배할 수 있다. 계정에 고정 시간대가 지정돼 있으면 그걸
        # 쓰고(관리자가 특정 계정을 특정 시간대에 고정하고 싶을 때 수동 지정),
        # 없으면 이 매장에서 실제로 가능한 밴드 중 하나를 무작위로 고른다 — 굳이
        # 미리 계정마다 배정해둘 필요 없이 매번 랜덤으로 오전/오후/밤에 고르게 분배된다.
        available_bands = receipt_generator.bands_available_for_store(store.representative_hours)
        if not available_bands:
            logger.warning(
                "Task %s: 매장 영업시간(%s)과 겹치는 시간대가 없어 영수증 생성을 건너뜁니다",
                task.id,
                store.representative_hours,
            )
            return False
        if account.time_slot in available_bands:
            hours_range = available_bands[account.time_slot]
        else:
            hours_range = random.choice(list(available_bands.values()))
    else:
        # 일반 리뷰어 계정 — 시간대 구분 없이 항상 매장 영업시간 중 "밤" 구간으로만
        # 영수증을 만든다.
        hours_range = receipt_generator.clip_band_to_store_hours("night", store.representative_hours)
        if hours_range is None:
            logger.warning(
                "Task %s: 매장이 밤 시간대(18~21시)에 영업하지 않아 영수증 생성을 건너뜁니다",
                task.id,
            )
            return False

    # 같은 계정이 같은 날짜에 이미 확정한 영수증 시간들과 최소 4시간 이상 떨어진
    # 시간을 골라야 물리적으로 이동 불가능한(예: 부산 10시·서울 11시) 배정이 안 된다.
    existing_times = crud.get_receipt_times_for_account_on_date(
        db, task.review_account_id, task.naver_available_date, exclude_task_id=task.id
    )
    receipt_time = receipt_generator.pick_time_with_gap(hours_range, existing_times)
    if receipt_time is None:
        logger.warning(
            "Task %s: 같은 계정·같은 날짜(%s)에 4시간 간격을 낼 시간 자리가 없어 영수증 생성을 건너뜁니다",
            task.id,
            task.naver_available_date,
        )
        return False

    try:
        path = receipt_generator.generate_receipt_for_task(
            task, store, menu_items, card_rules, receipt_time
        )
    except Exception:
        logger.exception("Task %s 영수증 생성 실패", task.id)
        return False
    if not path:
        return False
    task.receipt_image_path = path
    task.receipt_time = receipt_time
    db.commit()
    return True
