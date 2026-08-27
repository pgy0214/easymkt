import re
import time as time_module

from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from app.crawlers.base import chrome_driver, logger

# NOTE: unlike the review crawlers (adapted from a working legacy script),
# there was no existing reference code for scraping store info, so these
# selectors are best-effort guesses at Naver Place's current DOM. If a field
# consistently comes back empty, open the store page with
# CRAWLER_HEADLESS=false, inspect the real class names, and update the lists
# below — the rest of the flow (partial results, admin fills in the gaps)
# doesn't need to change.
NAME_SELECTORS = ["h1#_header", "div.V4UO6 span.IY7ZX", "span.GHAhO"]
ADDRESS_SELECTORS = ["span.LDgIH", ".PkgBl .LDgIH", "div.O8qbU span.place_bluelink"]

DAY_NAME_TO_INDEX = {
    "월요일": 0,
    "화요일": 1,
    "수요일": 2,
    "목요일": 3,
    "금요일": 4,
    "토요일": 5,
    "일요일": 6,
}
TIME_RANGE_PATTERN = re.compile(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})")

# only verified against restaurant/cafe-style pages — accommodation, hair
# salons, etc. likely use a different sub-page entirely (Naver Place tabs
# differ by business category) and are not covered yet. When a store's
# category doesn't match one we recognize, representative_product just comes
# back empty rather than risk scraping the wrong section (a genuine mistake
# caught during testing: this store's generic "가격표" block on /home turned
# out to be promotional taglines, not real prices, for a non-restaurant
# category — so we only trust the dedicated /menu/list sub-page).
MENU_ITEM_SELECTORS = ["li.E2jtL", "li.gHmZ_"]
MENU_NAME_SELECTORS = ["span.lPzHi", "span.MI3iK"]
MENU_PRICE_SELECTORS = ["div.GXS1X em", "div.GXS1X"]
MAX_MENU_ITEMS = 30

RESTAURANT_LIKE_CATEGORIES = {"restaurant", "cafe", "bakery", "bar"}


def _first_text(soup, selectors: list[str]) -> str | None:
    for sel in selectors:
        el = soup.select_one(sel)
        if el:
            text = el.get_text(strip=True)
            if text:
                return text
    return None


def _extract_name(soup) -> str | None:
    # the kakao/line share widget carries the store name in a data attribute
    # regardless of the page's (frequently-changing) CSS class names — try
    # that first, then fall back to guessed selectors, then the <title> tag.
    share_el = soup.select_one("[data-line-title]")
    if share_el:
        value = (share_el.get("data-line-title") or "").strip()
        if value:
            return value
    text = _first_text(soup, NAME_SELECTORS)
    if text:
        return text
    if soup.title:
        title = soup.title.get_text(strip=True)
        cleaned = re.sub(r"\s*[:\-]\s*네이버.*$", "", title).strip()
        return cleaned or None
    return None


# 도로명주소는 항상 지번/건물번호(숫자, "60-1" 같은 하이픈 포함 가능)로 끝난다 — 네이버
# 페이지가 그 뒤에 상호명을 이어붙여 내려주는 경우가 있어(예: "...향일암로 60-1 갑순네
# 돌산갓김치") 마지막 숫자 토큰 뒤는 전부 잘라낸다. 상호명이 항상 정확히 store.name과
# 일치하는 것도 아니라서(공백 유무 등) 이름 매칭이 아니라 주소 형식 자체로 판단한다.
_ROAD_ADDRESS_TAIL_RE = re.compile(r"\d+(-\d+)?")


def _trim_to_road_address(address: str) -> str:
    last_match = None
    for m in _ROAD_ADDRESS_TAIL_RE.finditer(address):
        last_match = m
    if not last_match:
        return address.strip()
    return address[: last_match.end()].strip()


def _extract_address(soup) -> str | None:
    share_el = soup.select_one("[data-line-description]")
    value = None
    if share_el:
        value = (share_el.get("data-line-description") or "").strip() or None
    if not value:
        value = _first_text(soup, ADDRESS_SELECTORS)
    return _trim_to_road_address(value) if value else None


def _extract_business_category(current_url: str, soup) -> str | None:
    match = re.search(r"businessCategory=([a-zA-Z_]+)", current_url)
    if match:
        return match.group(1)
    match = re.search(r'"businessCategory"\s*:\s*"([a-zA-Z_]+)"', str(soup))
    return match.group(1) if match else None


def _to_minutes(text: str) -> int | None:
    try:
        h, m = text.split(":")
        return int(h) * 60 + int(m)
    except ValueError:
        return None


def _minutes_to_text(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _parse_hour_rows(soup) -> list[tuple[int, int]]:
    """Parse the expanded per-day schedule (span.i8cJw day label followed by
    a sibling div.H3ua4 time range) into (start_minutes, end_minutes) pairs
    for days the store is actually open. "매일" expands to all 7 days;
    unrecognized labels (브레이크타임/정기휴무/공휴일 등) are skipped — they
    aren't a business day's open hours."""
    ranges = []
    for label_el in soup.select("span.i8cJw"):
        label = label_el.get_text(strip=True)
        time_el = label_el.find_next("div", class_="H3ua4")
        if not time_el:
            continue
        match = TIME_RANGE_PATTERN.search(time_el.get_text(strip=True))
        if not match:
            continue
        start, end = _to_minutes(match.group(1)), _to_minutes(match.group(2))
        if start is None or end is None or end <= start:
            continue
        if label == "매일":
            ranges.extend([(start, end)] * 7)
        elif label in DAY_NAME_TO_INDEX:
            ranges.append((start, end))
    return ranges


def _compute_representative_hours(ranges: list[tuple[int, int]]) -> str | None:
    """대표시간 = the time window that's open across every business day —
    e.g. Mon 10-18 / Tue 11-18 / Wed 10-18 → 11:00~18:00 (latest common
    start, earliest common end). 분 단위까지 실제 크롤링한 값 그대로 유지한다
    (예전엔 "깔끔하게 보이라고" 정시로 반올림했었는데, 08:40~19:20인 매장이
    08:00~19:00으로 저장돼 실제보다 이르게/늦게 문을 연 것처럼 영수증이 생성되는
    문제가 있었음 — receipt_generator의 시간 파서는 분 단위를 그대로 지원하므로
    반올림할 이유가 없다). Returns None if there's no common window."""
    if not ranges:
        return None
    start = max(r[0] for r in ranges)
    end = min(r[1] for r in ranges)
    if start >= end:
        return None
    return f"{_minutes_to_text(start)}~{_minutes_to_text(end)}"


# fallback when Naver has no registered hours at all (common for accommodation
# etc.) — a fixed placeholder rather than leaving it blank, per admin request
DEFAULT_REPRESENTATIVE_HOURS = "16:00~21:00"


def _extract_representative_hours(driver) -> str:
    try:
        toggle = driver.find_element(
            By.XPATH, "//*[normalize-space(text())='펼쳐보기']/ancestor::a[1]"
        )
        driver.execute_script("arguments[0].click()", toggle)
        time_module.sleep(1.5)
    except Exception:
        return DEFAULT_REPRESENTATIVE_HOURS  # no expandable hours section at all

    soup = BeautifulSoup(driver.page_source, "html.parser")
    return _compute_representative_hours(_parse_hour_rows(soup)) or DEFAULT_REPRESENTATIVE_HOURS


# matches the numeric place id out of any of Naver's URL shapes for a store
# page (short links and desktop map links redirect to one of these)
PLACE_ID_PATTERN = re.compile(r"/(?:place|restaurant|accommodation|entry/place)/(\d+)")


def fetch_store_info(store_url: str) -> dict:
    result: dict = {
        "name": None,
        "address": None,
        "representative_hours": None,
        "representative_product": None,
    }

    with chrome_driver() as driver:
        driver.get(store_url)
        time_module.sleep(2)

        # naver.me short links and map.naver.com desktop links redirect to a
        # page that doesn't render the info we need — re-navigate to the
        # mobile place page (a consistent, known shape) using the place id
        # pulled out of wherever we landed.
        place_id_match = PLACE_ID_PATTERN.search(driver.current_url)
        place_id = place_id_match.group(1) if place_id_match else None
        if place_id:
            driver.get(f"https://m.place.naver.com/place/{place_id}/home")
            time_module.sleep(2)

        soup = BeautifulSoup(driver.page_source, "html.parser")
        result["name"] = _extract_name(soup)
        result["address"] = _extract_address(soup)
        category = _extract_business_category(driver.current_url, soup)
        result["representative_hours"] = _extract_representative_hours(driver)

        if category in RESTAURANT_LIKE_CATEGORIES or category is None:
            try:
                menu_url = (
                    f"https://m.place.naver.com/place/{place_id}/menu/list"
                    if place_id
                    else store_url.split("?")[0].rstrip("/") + "/menu/list"
                )
                driver.get(menu_url)
                time_module.sleep(2)
                menu_soup = BeautifulSoup(driver.page_source, "html.parser")

                items: list = []
                for sel in MENU_ITEM_SELECTORS:
                    found = menu_soup.select(sel)
                    if found:
                        items = found
                        break

                lines = []
                seen = set()
                for item in items[:MAX_MENU_ITEMS]:
                    name = _first_text(item, MENU_NAME_SELECTORS)
                    if not name:
                        continue
                    price = _first_text(item, MENU_PRICE_SELECTORS) or ""
                    # 페이지가 같은 메뉴 항목을 두 번(예: 요약 섹션 + 전체 목록) 내려주는
                    # 경우가 있어 같은 이름+가격 조합은 한 번만 기록한다.
                    key = (name, price)
                    if key in seen:
                        continue
                    seen.add(key)
                    lines.append(f"{name} {price}".strip())

                if lines:
                    result["representative_product"] = ", ".join(lines)
            except Exception:
                logger.exception("네이버 매장 대표상품 크롤링 실패: %s", store_url)
        # other categories (숙박/미용실 등) don't have a verified selector
        # yet — leave representative_product empty rather than guess wrong

    return result
