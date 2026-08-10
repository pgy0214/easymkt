import csv
import datetime
import io
import re

import openpyxl

# Matches the user's "리뷰어" master-list sheet (이름/연락처/성별/플랫폼별 작업횟수/
# 기존작업자/중복병합건수). That sheet has no account/URL data at all, so import
# only creates bare Reviewer records (name/contact/note) — accounts get added
# individually once a reviewer is confirmed reachable and active.
NAME_HEADERS = {"이름"}
CONTACT_HEADERS = {"연락처"}
NOTE_HEADERS = {"기존작업자", "메모"}
REGION_HEADERS = {"지역"}
BLOG_URL_HEADERS = {"블로그주소", "블로그 주소", "블로그URL", "블로그 URL"}
BLOG_INDEX_HEADERS = {"지수", "블로그지수", "블로그 지수"}
AGE_GROUP_HEADERS = {"연령대"}
GENDER_HEADERS = {"성별"}
GENDER_VALUE_MAP = {"남": "male", "남성": "male", "male": "male", "여": "female", "여성": "female", "female": "female"}
TIMESTAMP_HEADERS = {"타임스탬프", "신청시간"}


def _parse_timestamp(raw: str | None) -> datetime.datetime | None:
    """구글폼 제출 시각 파서. 구글시트 기본 타임스탬프 형식(예: "2024. 1. 18 오후 1:23:45")과
    ISO 계열 형식을 모두 지원한다."""
    if not raw:
        return None
    text = raw.strip()

    match = re.match(
        r"(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s+(오전|오후)\s*(\d{1,2}):(\d{2}):(\d{2})", text
    )
    if match:
        year, month, day, ampm, hour, minute, second = match.groups()
        hour = int(hour) % 12
        if ampm == "오후":
            hour += 12
        try:
            return datetime.datetime(int(year), int(month), int(day), hour, int(minute), int(second))
        except ValueError:
            return None

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y.%m.%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def parse_reviewer_rows(content: bytes, filename: str) -> list[dict]:
    """Parse an uploaded .xlsx or .csv file into normalized reviewer rows:
    {name, contact_info, note, region, blog_url, blog_index, age_group,
    gender, applied_at}. Rows without a name are skipped. region/blog_url/
    blog_index/age_group/gender/applied_at only matter for the 체험단 import
    path — they're just None if the sheet doesn't have those columns."""
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
                "blog_url": _first_matching(row, BLOG_URL_HEADERS),
                "blog_index": _first_matching(row, BLOG_INDEX_HEADERS),
                "age_group": _first_matching(row, AGE_GROUP_HEADERS),
                "gender": GENDER_VALUE_MAP.get(gender_raw.strip().lower()) if gender_raw else None,
                "applied_at": _parse_timestamp(_first_matching(row, TIMESTAMP_HEADERS)),
            }
        )
    return results


def _first_matching(row: dict, header_candidates: set) -> str | None:
    for key, value in row.items():
        if key and key.strip() in header_candidates:
            text = str(value).strip() if value is not None else ""
            return text or None
    return None


BIRTH_DATE_HEADERS = {"생년월일", "생일", "생년월일(예:570710)"}
_BIRTH_DATE_FORMATS = ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d", "%Y%m%d", "%Y-%m-%d %H:%M:%S")


def _parse_birth_date(raw: str | None) -> datetime.date | None:
    if not raw:
        return None
    text = raw.strip()

    # 6자리 YYMMDD(예: "570710" = 1957-07-10) — 화면 표시 형식과 맞춘 압축 표기.
    # strptime의 %y는 57을 2057로 해석해버려서(포직스 관행: 00~68→2000년대) 생년월일
    # 용도로는 안 맞아, 현재 연도의 뒤 두 자리보다 크면 1900년대로 직접 판정한다.
    if re.fullmatch(r"\d{6}", text):
        yy, mm, dd = int(text[:2]), int(text[2:4]), int(text[4:6])
        current_yy = datetime.date.today().year % 100
        century = 1900 if yy > current_yy else 2000
        try:
            return datetime.date(century + yy, mm, dd)
        except ValueError:
            return None

    for fmt in _BIRTH_DATE_FORMATS:
        try:
            return datetime.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


PLATFORM_HEADERS = {"플랫폼"}
LABEL_HEADERS = {"계정아이디", "계정 아이디"}
PROFILE_URL_HEADERS = {"네이버마이플레이스URL", "네이버 마이플레이스 URL", "URL", "마이플레이스URL"}
IP_HEADERS = {"IP", "ip"}
PASSWORD_HEADERS = {"비밀번호", "계정비밀번호", "계정 비밀번호", "패스워드"}
PLATFORM_VALUE_MAP = {"네이버": "naver", "naver": "naver", "카카오": "kakao", "kakao": "kakao"}


def parse_admin_account_rows(content: bytes, filename: str) -> list[dict]:
    """관리자 계정 일괄등록 시트 파서 — 리뷰어 마스터 시트와 달리 이 시트는 계정
    한 건(플랫폼/계정아이디/URL/IP)까지 한 행에 다 담겨 있다(관리자 계정 화면이
    리뷰어+계정을 평탄화해서 한 줄로 보여주는 것과 동일한 모양). 이름과 계정아이디가
    둘 다 있어야 유효한 행으로 본다 — 계정아이디가 없으면 "계정"으로서 의미가 없다."""
    if filename.lower().endswith(".csv"):
        rows = _parse_csv(content)
    else:
        rows = _parse_xlsx(content)

    results = []
    for row in rows:
        # 완전히 빈 줄까지 "행"으로 세면 skipped_invalid가 부풀려지니, 아무 컬럼도
        # 없는 줄만 걸러낸다 — name/label 누락 여부는 crud.import_admin_accounts가
        # 세도록 여기서는 걸러내지 않는다(여기서 continue로 건너뛰면 그 카운트가
        # 통계에 아예 안 잡히는 문제가 있었음).
        if not any(v is not None and str(v).strip() for v in row.values()):
            continue
        platform_raw = _first_matching(row, PLATFORM_HEADERS)
        platform = PLATFORM_VALUE_MAP.get(platform_raw.strip().lower()) if platform_raw else "naver"
        gender_raw = _first_matching(row, GENDER_HEADERS)
        results.append(
            {
                "name": _first_matching(row, NAME_HEADERS),
                "contact_info": _first_matching(row, CONTACT_HEADERS),
                "platform": platform or "naver",
                "label": _first_matching(row, LABEL_HEADERS),
                "profile_url": _first_matching(row, PROFILE_URL_HEADERS),
                "ip_address": _first_matching(row, IP_HEADERS),
                "password": _first_matching(row, PASSWORD_HEADERS),
                "gender": GENDER_VALUE_MAP.get(gender_raw.strip().lower()) if gender_raw else None,
                "birth_date": _parse_birth_date(_first_matching(row, BIRTH_DATE_HEADERS)),
            }
        )
    return results


CARD_PREFIX_1_HEADERS = {"카드번호 앞 4자리", "카드번호앞4자리"}
CARD_PREFIX_2_HEADERS = {"카드번호 다음 4자리", "카드번호다음4자리"}
APPROVAL_PREFIX_HEADERS = {"승인번호 앞자리", "승인번호앞자리"}
ACQUIRER_HEADERS = {"매입사명", "매입사"}
CARD_TYPE_HEADERS = {"카드종류"}


def parse_card_rule_rows(content: bytes, filename: str) -> list[dict]:
    """영수증 카드정보 일괄등록 시트 파서 — CardRuleModal 수동등록 폼과 동일한 5개
    필드(카드번호 앞/뒤 4자리, 승인번호 앞자리, 매입사명, 카드종류)를 그대로 받는다.
    자릿수/숫자 형식 검증은 crud.import_card_rules에서 한다."""
    if filename.lower().endswith(".csv"):
        rows = _parse_csv(content)
    else:
        rows = _parse_xlsx(content)

    results = []
    for row in rows:
        if not any(v is not None and str(v).strip() for v in row.values()):
            continue
        results.append(
            {
                "card_prefix_1": _first_matching(row, CARD_PREFIX_1_HEADERS),
                "card_prefix_2": _first_matching(row, CARD_PREFIX_2_HEADERS),
                "approval_prefix": _first_matching(row, APPROVAL_PREFIX_HEADERS),
                "acquirer": _first_matching(row, ACQUIRER_HEADERS),
                "card_type": _first_matching(row, CARD_TYPE_HEADERS),
            }
        )
    return results


REVIEW_TEXT_HEADERS = {"리뷰내용", "리뷰 내용", "원고", "내용"}

STORE_URL_HEADERS = {"매장URL", "매장 URL", "매장링크", "매장 링크"}
PROFILE_URL_HEADERS = {"마이플레이스링크", "마이플레이스 링크", "마이플레이스URL", "마이플레이스 URL", "프로필링크", "프로필 링크"}
BLIND_CHECK_NOTE_HEADERS = {"비고", "메모"}


def parse_blind_check_rows(content: bytes, filename: str) -> list[dict]:
    """블라인드 일괄확인 엑셀 파서 — {매장URL, 마이플레이스링크} 값이 모두 있는 행만
    대상으로 삼는다(둘 중 하나라도 없으면 그 리뷰를 특정할 수 없어 건너뜀)."""
    if filename.lower().endswith(".csv"):
        rows = _parse_csv(content)
    else:
        rows = _parse_xlsx(content)

    results = []
    for row in rows:
        store_url = _first_matching(row, STORE_URL_HEADERS)
        profile_url = _first_matching(row, PROFILE_URL_HEADERS)
        if store_url and profile_url:
            results.append(
                {
                    "store_url": store_url,
                    "profile_url": profile_url,
                    "note": _first_matching(row, BLIND_CHECK_NOTE_HEADERS),
                }
            )
    return results


def parse_review_text_rows(content: bytes, filename: str) -> list[str]:
    """캠페인 리뷰 원고 풀 엑셀 파서 — "번호"는 라벨일 뿐 순서에 쓰지 않고, 파일에 나온
    행 순서 그대로 작업(Task) 생성 순서에 1:1로 배정한다(crud.assign_review_text_for_task).
    "리뷰내용"이 빈 행은 건너뛴다."""
    if filename.lower().endswith(".csv"):
        rows = _parse_csv(content)
    else:
        rows = _parse_xlsx(content)

    texts = []
    for row in rows:
        content_text = _first_matching(row, REVIEW_TEXT_HEADERS)
        if content_text:
            texts.append(content_text)
    return texts


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
