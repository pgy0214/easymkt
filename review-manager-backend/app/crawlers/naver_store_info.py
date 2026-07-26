import re
import time as time_module

from bs4 import BeautifulSoup

from app.crawlers.base import chrome_driver, logger

# NOTE: unlike the review crawlers (adapted from a working legacy script),
# there was no existing reference code for scraping store name/address/menu,
# so these selectors are best-effort guesses at Naver Place's current DOM.
# If a field consistently comes back empty, open the store page with
# CRAWLER_HEADLESS=false, inspect the real class names, and update the lists
# below — the rest of the flow (partial results, admin fills in the gaps)
# doesn't need to change.
NAME_SELECTORS = ["h1#_header", "div.V4UO6 span.IY7ZX", "span.GHAhO"]
ADDRESS_SELECTORS = ["span.LDgIH", ".PkgBl .LDgIH", "div.O8qbU span.place_bluelink"]
# only a live "영업 중 · 21:00에 영업 종료" style status line, not the full
# weekly schedule (that's behind a click-to-expand toggle on the page) — good
# enough to tell the admin whether hours are registered at all
BUSINESS_HOURS_SELECTORS = ["div.A_cdD"]
MENU_ITEM_SELECTORS = ["li.E2jtL", "li.gHmZ_"]
MENU_NAME_SELECTORS = ["span.lPzHi", "span.MI3iK"]
MENU_PRICE_SELECTORS = ["div.GXS1X em", "div.GXS1X"]
MAX_MENU_ITEMS = 30


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


def _extract_address(soup) -> str | None:
    share_el = soup.select_one("[data-line-description]")
    if share_el:
        value = (share_el.get("data-line-description") or "").strip()
        if value:
            return value
    return _first_text(soup, ADDRESS_SELECTORS)


def _extract_business_hours(soup) -> str | None:
    for sel in BUSINESS_HOURS_SELECTORS:
        el = soup.select_one(sel)
        if el:
            text = el.get_text(" ", strip=True)
            if text:
                return text
    return None


# matches the numeric place id out of any of Naver's URL shapes for a store
# page (short links and desktop map links redirect to one of these)
PLACE_ID_PATTERN = re.compile(r"/(?:place|restaurant|accommodation|entry/place)/(\d+)")


def fetch_store_info(store_url: str) -> dict:
    result: dict = {"name": None, "address": None, "business_hours": None, "menu": None}

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
        result["business_hours"] = _extract_business_hours(soup)

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

            menu_lines = []
            for item in items[:MAX_MENU_ITEMS]:
                name = _first_text(item, MENU_NAME_SELECTORS)
                if not name:
                    continue
                price = _first_text(item, MENU_PRICE_SELECTORS) or ""
                menu_lines.append(f"{name} {price}".strip())

            if menu_lines:
                result["menu"] = ", ".join(menu_lines)
        except Exception:
            logger.exception("네이버 매장 메뉴 크롤링 실패: %s", store_url)

    return result
