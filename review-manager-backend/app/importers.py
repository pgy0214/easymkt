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
