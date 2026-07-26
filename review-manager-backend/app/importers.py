import csv
import io

import openpyxl

# Matches the user's "리뷰어" master-list sheet (이름/연락처/성별/플랫폼별 작업횟수/
# 기존작업자/중복병합건수). That sheet has no account/URL data at all, so import
# only creates bare Reviewer records (name/contact/note) — accounts get added
# individually once a reviewer is confirmed reachable and active.
NAME_HEADERS = {"이름"}
CONTACT_HEADERS = {"연락처"}
NOTE_HEADERS = {"기존작업자", "메모"}
REGION_HEADERS = {"지역"}
AGE_GROUP_HEADERS = {"연령대"}
GENDER_HEADERS = {"성별"}
GENDER_VALUE_MAP = {"남": "male", "남성": "male", "male": "male", "여": "female", "여성": "female", "female": "female"}


def parse_reviewer_rows(content: bytes, filename: str) -> list[dict]:
    """Parse an uploaded .xlsx or .csv file into normalized reviewer rows:
    {name, contact_info, note, region, age_group, gender}. Rows without a
    name are skipped. region/age_group/gender only matter for the 체험단
    import path — they're just None if the sheet doesn't have those columns."""
    if filename.lower().endswith(".csv"):
        rows = _parse_csv(content)
    else:
        rows = _parse_xlsx(content)

    results = []
    for row in rows:
        name = _first_matching(row, NAME_HEADERS)
        if not name:
            continue
        gender_raw = _first_matching(row, GENDER_HEADERS)
        results.append(
            {
                "name": name,
                "contact_info": _first_matching(row, CONTACT_HEADERS),
                "note": _first_matching(row, NOTE_HEADERS),
                "region": _first_matching(row, REGION_HEADERS),
                "age_group": _first_matching(row, AGE_GROUP_HEADERS),
                "gender": GENDER_VALUE_MAP.get(gender_raw.strip().lower()) if gender_raw else None,
            }
        )
    return results


def _first_matching(row: dict, header_candidates: set) -> str | None:
    for key, value in row.items():
        if key and key.strip() in header_candidates:
            text = str(value).strip() if value is not None else ""
            return text or None
    return None


GUIDELINE_HEADERS = {"가이드라인", "원고 가이드라인"}
REGIONAL_FEATURES_HEADERS = {"지역특징", "지역적 특징"}
MENU_NAME_HEADERS = [{"메뉴1명", "메뉴명1"}, {"메뉴2명", "메뉴명2"}, {"메뉴3명", "메뉴명3"}]
MENU_PRICE_HEADERS = [{"메뉴1가격", "메뉴가격1"}, {"메뉴2가격", "메뉴가격2"}, {"메뉴3가격", "메뉴가격3"}]


def parse_target_guideline_row(content: bytes, filename: str) -> dict:
    """캠페인 등록 폼의 리뷰 원고 자료(가이드라인/지역특징/메뉴 3개)를 엑셀/CSV
    한 줄로 미리 채워 넣기 위한 파서 — 캠페인 1건은 원고도 1건뿐이라 첫 데이터
    행만 사용한다."""
    if filename.lower().endswith(".csv"):
        rows = _parse_csv(content)
    else:
        rows = _parse_xlsx(content)

    if not rows:
        return {"guideline": None, "regional_features": None, "menu_items": None}

    row = rows[0]
    menu_items = []
    for name_headers, price_headers in zip(MENU_NAME_HEADERS, MENU_PRICE_HEADERS):
        name = _first_matching(row, name_headers)
        price_raw = _first_matching(row, price_headers)
        if name and price_raw:
            try:
                menu_items.append({"name": name, "price": int(float(price_raw))})
            except ValueError:
                continue

    return {
        "guideline": _first_matching(row, GUIDELINE_HEADERS),
        "regional_features": _first_matching(row, REGIONAL_FEATURES_HEADERS),
        "menu_items": menu_items or None,
    }


def _parse_csv(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def _parse_xlsx(content: bytes) -> list[dict]:
    workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet = workbook.active
    rows_iter = sheet.iter_rows(values_only=True)
    headers = [str(h).strip() if h is not None else "" for h in next(rows_iter, [])]

    rows = []
    for values in rows_iter:
        row = {headers[i]: values[i] for i in range(min(len(headers), len(values)))}
        rows.append(row)
    return rows
