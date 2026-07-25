import csv
import io

import openpyxl

# Matches the user's "리뷰어" master-list sheet (이름/연락처/성별/플랫폼별 작업횟수/
# 기존작업자/중복병합건수). That sheet has no account/URL data at all, so import
# only creates bare Reviewer records (name/contact/note) — accounts get added
# individually once a reviewer is confirmed reachable and active.
NAME_HEADERS = {"이름"}
CONTACT_HEADERS = {"연락처"}
NOTE_HEADERS = {"기존작업자"}


def parse_reviewer_rows(content: bytes, filename: str) -> list[dict]:
    """Parse an uploaded .xlsx or .csv file into normalized reviewer rows:
    {name, contact_info, note}. Rows without a name are skipped."""
    if filename.lower().endswith(".csv"):
        rows = _parse_csv(content)
    else:
        rows = _parse_xlsx(content)

    results = []
    for row in rows:
        name = _first_matching(row, NAME_HEADERS)
        if not name:
            continue
        results.append(
            {
                "name": name,
                "contact_info": _first_matching(row, CONTACT_HEADERS),
                "note": _first_matching(row, NOTE_HEADERS),
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
