# -*- coding: utf-8 -*-
"""Receipt (카드결제승인) image generator.

Adapted from the legacy `영수증개발 코드\\1. 영수증 생성 후 업로드\\V1페이히어.py`
script (and the cleaner `runner_V1(체리베이스먼트).py` parametrization pattern
it's normally driven by). The rendering routine below — fonts, canvas size,
layout, dashed separators, card-approval randomization table — is copied
unchanged from that script on purpose: the receipt's visual appearance must
stay exactly as validated before. The only things that differ from the
legacy version are:
  - store name/address/business info and menu come from this app's Store /
    ReviewTarget records instead of a per-store runner_V1(...).py file that
    had to be hand-copied for every new store
  - the date/time is the task's actual assigned date (+ a random time within
    the store's representative business hours) instead of the legacy
    script's own random day-offset cycle
"""
import io
import os
import random
import re
from datetime import date as date_cls
from datetime import datetime, time

from PIL import Image, ImageDraw, ImageFont

from app import photo_washer

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

# 폰트 경로 — 레거시 코드와 동일 (건드리지 말 것)
PATH_SANDOLL = r"C:\Users\PARK GWANYONG\AppData\Local\Microsoft\Windows\Fonts\AppleSDGothicNeoL.ttf"
PATH_ARIAL = r"C:\Windows\Fonts\Arial.ttf"

# 상품명은 x=50에서 시작해 오른쪽으로 그려지고, 단가는 x=390에서 우측정렬로 그려진다
# (draw_mixed/draw_mixed_right, 건드리지 말 것 — canvas 레이아웃은 레거시 그대로 유지).
# text_mixed_width()로 실측한 결과: 단가는 "9,900원"~"999,000원" 범위에서 85~113px,
# 즉 최악의 경우 단가 칸 왼쪽 끝이 x=277까지 올 수 있다. 상품명은 12자(한글 기준,
# SANDOLL 26pt, 실제 크롤링된 긴 메뉴명 "순두부짬뽕밥(2인분 (공기밥..." 앞부분으로 측정)를
# 넘으면 폭이 213px를 넘어서기 시작해 겹칠 위험이 커진다 — 14자로 뒀다가 실제 생성된
# 영수증에서 겹침을 직접 확인하고 12자로 낮췄다.
MAX_PRODUCT_NAME_LENGTH = 12

# ============================ RULES (레거시 시드 데이터, DB card_rules 테이블 최초
# 시딩에만 쓰인다 — 실제 영수증 생성은 항상 DB에서 읽은 목록을 인자로 받는다. 관리자가
# 설정 탭에서 카드번호/승인번호/매입사명/카드종류를 추가·삭제할 수 있다) ============================
RULES_TEXT = r"""
카드번호1/4	카드번호2/4	승인번호(8자리)	매입사	카드종류
4678	5600	"8"+7자리랜덤	우리	우리카드
5289	3600	"8"+7자리랜덤	우리	우리카드
5317	6400	"8"+7자리랜덤	우리	우리카드
5376	9900	"8"+7자리랜덤	우리	우리카드
5387	3300	"8"+7자리랜덤	우리	우리카드
6573	3225	"7"+7자리랜덤	비씨	부산비씨체크
9440	3255	"7"+7자리랜덤	비씨	부산비씨체크
5388	3255	"7"+7자리랜덤	비씨	부산비씨체크
9420	3255	"7"+7자리랜덤	비씨	부산비씨체크
9417	2400	"7"+7자리랜덤	비씨	우리비씨체크
5370	4460	"7"+7자리랜덤	비씨	우리비씨체크
9421	2000	"7"+7자리랜덤	비씨	우리비씨체크
9425	2090	"7"+7자리랜덤	비씨	우리카드
9425	2090	"7"+7자리랜덤	비씨	우리카드
5389	0382	"7"+7자리랜덤	비씨	IBK체크카드
9446	0360	"7"+7자리랜덤	비씨	IBK체크카드
4048	0328	"7"+7자리랜덤	비씨	IBK비씨카드
9490	1928	"00"+6자리	현대	현대
5531	4200	"00"+6자리	현대	현대마스타
4025	9600	"00"+6자리	현대	현대비자
4033	0201	"00"+6자리	현대	현대비자
4033	0200	"00"+6자리	현대	현대비자
4033	0202	"00"+6자리	현대	현대비자
4574	9380	"00"+6자리	현대	현대비자
9490	1300	"00"+6자리	현대	현대체크
4045	7700	"00"+6자리	현대	현대카드
4045	7700	"00"+6자리	현대	현대카드
4045	7700	"00"+6자리	현대	현대카드
4232	1000	"00"+6자리	현대	현대카드
4640	2200	"00"+6자리	현대	현대카드
4890	1681	"00"+6자리	현대	현대카드
4890	1602	"00"+6자리	현대	현대카드
4890	1600	"00"+6자리	현대	현대카드
5288	1500	"00"+6자리	현대	현대카드
5288	1500	"00"+6자리	현대	현대카드
4265	8692	"300"+4자리	KB국민	KB국민카드
4579	7356	"300"+4자리	KB국민	KB국민카드
4579	7389	"300"+4자리	KB국민	KB국민카드
4602	0500	"300"+4자리	KB국민	KB국민카드
5409	2600	"300"+4자리	KB국민	KB국민카드
5570	4206	"300"+4자리	KB국민	KB국민카드
5570	4293	"300"+4자리	KB국민	KB국민카드
5570	4289	"300"+4자리	KB국민	KB국민카드
5570	4202	"300"+4자리	KB국민	KB국민카드
5570	4272	"300"+4자리	KB국민	KB국민카드
5365	1050	"2"+7자리	KB국민	카카오체크
5365	1076	"2"+7자리	KB국민	카카오체크
5365	1039	"2"+7자리	KB국민	카카오체크
5365	1051	"2"+7자리	KB국민	카카오체크
5365	1036	"2"+7자리	KB국민	카카오체크
5365	1070	"2"+7자리	KB국민	카카오체크
5365	1063	"2"+7자리	KB국민	카카오체크
5365	1015	"2"+7자리	KB국민	카카오체크
5365	1037	"2"+7자리	KB국민	카카오체크
5365	1081	"2"+7자리	KB국민	카카오체크
5365	1091	"2"+7자리	KB국민	카카오체크
5365	1050	"2"+7자리	KB국민	카카오체크
5365	1055	"2"+7자리	KB국민	카카오체크
5173	3258	"300"+4자리	KB국민	KB국민체크
5173	3254	"300"+4자리	KB국민	KB국민체크
5173	3258	"300"+4자리	KB국민	KB국민체크
5173	3254	"300"+4자리	KB국민	KB국민체크
5173	3277	"300"+4자리	KB국민	KB국민체크
5173	3283	"300"+4자리	KB국민	KB국민체크
5272	8945	"300"+4자리	KB국민	KB국민체크
5272	8925	"300"+4자리	KB국민	KB국민체크
5272	8927	"300"+4자리	KB국민	KB국민체크
5272	8920	"300"+4자리	KB국민	KB국민체크
5272	8946	"300"+4자리	KB국민	KB국민체크
5272	8991	"300"+4자리	KB국민	KB국민체크
9490	9402	"300"+4자리	KB국민	KB국민체크
9490	9400	"300"+4자리	KB국민	KB국민체크
9490	9493	"300"+4자리	KB국민	KB국민체크
9490	9400	"300"+4자리	KB국민	KB국민체크
9490	9433	"300"+4자리	KB국민	KB국민체크
""".strip()

_digit_token_re = re.compile(r"[0-9,.:/\-]+")


def is_num_token(p: str) -> bool:
    return _digit_token_re.fullmatch(p) is not None


def rand_digits(n: int) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(n))


def parse_rules(text: str):
    rules = []
    rows = [r for r in text.splitlines() if r.strip()]
    for idx, raw in enumerate(rows):
        if idx == 0:
            continue
        parts = [p.strip() for p in raw.split("\t")]
        while len(parts) < 5:
            parts.append("")
        rules.append(
            {"g1": parts[0], "g2": parts[1], "approval_rule": parts[2], "acquirer": parts[3], "cardtype": parts[4]}
        )
    return rules


def _extract_approval_prefix(approval_rule: str) -> str:
    """레거시 규칙의 approval_rule은 '"8"+7자리랜덤' 같은 DSL 문자열이다 — DB 시딩 시
    앞자리 숫자만 뽑아 card_rules.approval_prefix에 저장한다."""
    text = (approval_rule or "").strip()
    m = re.search(r'"(\d+)"', text)
    if m:
        return m.group(1)
    return text if text.isdigit() else ""


def legacy_rules_as_card_rule_dicts() -> list[dict]:
    """DB card_rules 테이블이 비어있을 때 최초 1회 시딩할 데이터."""
    return [
        {
            "card_prefix_1": r["g1"],
            "card_prefix_2": r["g2"],
            "approval_prefix": _extract_approval_prefix(r["approval_rule"]),
            "acquirer": r["acquirer"],
            "card_type": r["cardtype"],
        }
        for r in parse_rules(RULES_TEXT)
    ]


def gen_card_number(rule: dict) -> str:
    g1 = (re.sub(r"\D", "", rule.get("card_prefix_1") or "") or rand_digits(4))[:4].ljust(4, "0")
    g2 = (re.sub(r"\D", "", rule.get("card_prefix_2") or "") or rand_digits(4))[:4].ljust(4, "0")
    return f"{g1}-{g2}-****-****"


def gen_approval_number(rule: dict) -> str:
    prefix = re.sub(r"\D", "", rule.get("approval_prefix") or "")
    return (prefix + rand_digits(8 - len(prefix)))[:8] if prefix else rand_digits(8)


# ============================ RENDER UTILS (레거시 그대로) ============================
def text_mixed_width(draw, text, base_font, digit_font):
    parts = re.findall(r"[0-9,.:/\-]+|[^0-9,.:/\-]+", text)
    total = 0
    for p in parts:
        total += draw.textlength(p, font=digit_font if is_num_token(p) else base_font)
    return total


def draw_mixed(draw, x, y, text, base_font, digit_font, fill="black"):
    parts = re.findall(r"[0-9,.:/\-]+|[^0-9,.:/\-]+", text)
    cx = x
    ba, _ = base_font.getmetrics()
    for p in parts:
        font = digit_font if is_num_token(p) else base_font
        oa, _ = font.getmetrics()
        draw.text((cx, y + (ba - oa)), p, font=font, fill=fill)
        cx += draw.textlength(p, font=font)


def draw_mixed_right(draw, x_right, y, text, base_font, digit_font, fill="black"):
    w = text_mixed_width(draw, text, base_font, digit_font)
    draw_mixed(draw, x_right - w, y, text, base_font, digit_font, fill=fill)


def dashed(draw, x0, y, count=42, dash_len=7.8, gap=5):
    cx = x0
    for _ in range(count):
        draw.line((cx, y, cx + dash_len, y), fill="black", width=2)
        cx += dash_len + gap
    return y + 6


# ============================ ORDER SELECTION ============================
def _pick_random_order(menu_items: list[dict]) -> tuple[list[str], list[int], list[int]]:
    """레거시 runner의 '방/메뉴 조합을 랜덤으로 골라 자연스러운 합계를 만드는' 방식과
    동일한 취지 — 입력된 메뉴(최대 3개) 중 1개~전체를 랜덤으로 골라 수량(1~2)도
    랜덤으로 매긴다."""
    num = random.randint(1, len(menu_items))
    chosen = random.sample(menu_items, num)
    names = [m["name"][:MAX_PRODUCT_NAME_LENGTH] for m in chosen]
    prices = [m["price"] for m in chosen]
    quantities = [random.randint(1, 2) for _ in chosen]
    return names, prices, quantities


def _random_time_in_range(hours_range: str | None) -> tuple[int, int, int]:
    """"16:00~21:00" 같은 대표시간 문자열 안에서 랜덤 시:분:초를 고른다.
    파싱 실패 시 레거시 기본값(17~21시)으로 대체."""
    if hours_range:
        m = re.match(r"(\d{1,2}):(\d{2})~(\d{1,2}):(\d{2})", hours_range)
        if m:
            start_h, start_m, end_h, end_m = map(int, m.groups())
            start_total, end_total = start_h * 60 + start_m, end_h * 60 + end_m
            if end_total > start_total:
                total = random.randint(start_total, end_total - 1)
                return total // 60, total % 60, random.randint(0, 59)
    return random.randint(17, 21), random.randint(0, 59), random.randint(0, 59)


# 계정별 고정 시간대 밴드 — "부산에서 12시에 쓰고 서울에서 13시에 쓰는" 것처럼 물리적으로
# 불가능해 보이지 않도록, 계정마다 항상 같은 시간대(오전/오후/밤)에만 영수증을 만든다.
TIME_SLOT_BANDS = {
    "morning": (11 * 60, 15 * 60),
    "afternoon": (15 * 60, 18 * 60),
    "night": (18 * 60, 21 * 60),
}


def _parse_hours_range(hours_range: str | None) -> tuple[int, int] | None:
    if not hours_range:
        return None
    m = re.match(r"(\d{1,2}):(\d{2})~(\d{1,2}):(\d{2})", hours_range)
    if not m:
        return None
    start_h, start_m, end_h, end_m = map(int, m.groups())
    start_total, end_total = start_h * 60 + start_m, end_h * 60 + end_m
    return (start_total, end_total) if end_total > start_total else None


def clip_band_to_store_hours(time_slot: str, hours_range: str | None) -> str | None:
    """계정의 고정 시간대 밴드를 매장의 실제 대표시간과 교집합으로 잘라 "HH:MM~HH:MM"
    문자열로 돌려준다. 매장이 그 시간대에 아예 영업을 안 하면(교집합이 없으면) None —
    이 계정은 이 매장에 대해서는 이 밴드로 영수증을 만들 수 없다는 뜻이다."""
    band = TIME_SLOT_BANDS.get(time_slot)
    if not band:
        return None
    store_range = _parse_hours_range(hours_range)
    if not store_range:
        return None
    start = max(band[0], store_range[0])
    end = min(band[1], store_range[1])
    if end <= start:
        return None
    return f"{start // 60:02d}:{start % 60:02d}~{end // 60:02d}:{end % 60:02d}"


def _time_diff_hours(a: time, b: time) -> float:
    seconds_a = a.hour * 3600 + a.minute * 60 + a.second
    seconds_b = b.hour * 3600 + b.minute * 60 + b.second
    return abs(seconds_a - seconds_b) / 3600


def pick_time_with_gap(
    hours_range: str | None, existing_times: list[time], min_gap_hours: int = 4, attempts: int = 30
) -> time | None:
    """매장 대표시간 범위 안에서, 같은 계정·같은 날짜에 이미 쓴 시간들과 전부
    min_gap_hours 이상 차이나는 시간을 찾는다(같은 사람이 물리적으로 이동 불가능한
    거리를 같은 시간대에 방문한 것처럼 보이지 않도록). 못 찾으면 None."""
    for _ in range(attempts):
        hour, minute, second = _random_time_in_range(hours_range)
        candidate = time(hour=hour, minute=minute, second=second)
        if all(_time_diff_hours(candidate, existing) >= min_gap_hours for existing in existing_times):
            return candidate
    return None


# ============================ MAIN ROUTINE (레거시 make_one_receipt 이식) ============================
def generate_receipt(
    *,
    store_name: str,
    business_registration_number: str | None,
    representative_name: str | None,
    phone: str | None,
    address: str | None,
    menu_items: list[dict],
    dt: datetime,
    output_path: str,
    card_rules: list[dict],
) -> str:
    if not menu_items:
        raise ValueError("메뉴 정보가 없어 영수증을 만들 수 없습니다.")
    if not card_rules:
        raise ValueError("영수증 카드정보가 없어 영수증을 만들 수 없습니다. 설정 탭에서 추가해주세요.")

    가게이름 = store_name
    사업자번호 = business_registration_number or ""
    대표명 = representative_name or ""
    연락처 = phone or ""
    주소 = address or ""

    승인일 = dt.strftime("%y%m%d")
    표시일시 = dt.strftime("%Y-%m-%d %H:%M:%S")

    l_메뉴, l_단가, l_수량 = _pick_random_order(menu_items)
    총액 = sum(p * q for p, q in zip(l_단가, l_수량))
    공급가액, 부가세 = (총액 * 10) // 11, 총액 - (총액 * 10) // 11

    rule = random.choice(card_rules)
    카드번호_표시 = gen_card_number(rule)
    승인번호 = gen_approval_number(rule)

    # 캔버스 세팅 — 레거시와 동일 (건드리지 말 것)
    W, H, P, FS = 630, 2000, 50, 26
    R = W - P
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    f_text, f_digit = ImageFont.truetype(PATH_SANDOLL, FS), ImageFont.truetype(PATH_ARIAL, FS)
    f_big, f_big_d = ImageFont.truetype(PATH_SANDOLL, 35), ImageFont.truetype(PATH_ARIAL, 35)

    y = 28
    draw_mixed(d, (W - text_mixed_width(d, "카드결제승인", f_big, f_big_d)) // 2, y, "카드결제승인", f_big, f_big_d)
    y += 53
    y = dashed(d, P, y)
    y += 16

    draw_mixed(d, P, y, f"[{가게이름}]", f_text, f_digit)
    y += 34
    draw_mixed(d, P, y, f"{사업자번호}  TEL: {연락처}", f_text, f_digit)
    draw_mixed_right(d, R, y, 대표명, f_text, f_digit)
    y += 34
    for addr in 주소.split("\n"):
        draw_mixed(d, P, y, addr, f_text, f_digit)
        y += 34
    y = dashed(d, P, y)
    y += 6
    draw_mixed(d, P, y, "거래 일시", f_text, f_digit)
    draw_mixed_right(d, R, y, 표시일시, f_text, f_digit)
    y += 36
    y = dashed(d, P, y)
    y += 6

    draw_mixed(d, P, y, "상품명", f_text, f_digit)
    draw_mixed_right(d, R, y, "금액", f_text, f_digit)
    draw_mixed_right(d, R - 120, y, "수량", f_text, f_digit)
    draw_mixed_right(d, R - 190, y, "단가", f_text, f_digit)
    y += 40
    y = dashed(d, P, y)
    y += 6
    for n, p, q in zip(l_메뉴, l_단가, l_수량):
        draw_mixed(d, P, y, n, f_text, f_digit)
        draw_mixed_right(d, R - 190, y, f"{p:,}원", f_text, f_digit)
        draw_mixed_right(d, R - 120, y, str(q), f_text, f_digit)
        draw_mixed_right(d, R, y, f"{p * q:,}원", f_text, f_digit)
        y += 40
    y = dashed(d, P, y)
    y += 12

    draw_mixed(d, P, y, "공급가액", f_text, f_digit)
    draw_mixed_right(d, R, y, f"{공급가액:,}원", f_text, f_digit)
    y += 34
    draw_mixed(d, P, y, "부가세", f_text, f_digit)
    draw_mixed_right(d, R, y, f"{부가세:,}원", f_text, f_digit)
    y += 40
    y = dashed(d, P, y)
    y += 10
    draw_mixed(d, P, y, "결 제 금 액", f_big, f_big_d)
    draw_mixed_right(d, 570, y, f"{총액:,}원", f_big, f_big_d)
    y += 60
    y = dashed(d, P, y)
    y += 10

    infos = [
        ("승인일시", 표시일시),
        ("할부", "일시불"),
        ("카드번호", 카드번호_표시),
        ("가맹점번호", "00080365021"),
        ("승인번호", 승인번호),
        ("매입사명", rule.get("acquirer", "")),
        ("카드종류", rule.get("card_type", "")),
    ]
    for label, val in infos:
        draw_mixed(d, P, y, label, f_text, f_digit)
        draw_mixed_right(d, R, y, val, f_text, f_digit)
        y += 34

    buf = io.BytesIO()
    img.crop((0, 0, W, y + 30)).save(buf, format="JPEG")
    # 카메라 사진과 마찬가지로 EXIF를 세탁한다 — 영수증에 찍힌 거래일시와 어긋나지
    # 않도록 target_date를 그 시각으로 맞춘다(레코더/카메라 종류만 무작위).
    washed = photo_washer.wash_photo(buf.getvalue(), target_date=dt)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(washed)
    return output_path


# "이름 가격[,가격]원" 조합을 문자열 전체에서 직접 찾는다 — 단순히 ","로 나누면
# "22,000원"처럼 가격 자체에 천단위 콤마가 들어간 경우 "22"와 "000원"으로 쪼개져버리는
# 문제가 있었다(실제로 이렇게 깨진 화면을 확인함). `.+?`(비탐욕)가 "공백 + 숫자(,숫자)*
# + 선택적 원 + (,로 이어지거나 끝)"이 성립하는 가장 가까운 지점까지만 이름으로 잡으므로,
# 이름 안에 있는 숫자(예: "2인분", "2개")는 그 뒤에 콤마/끝이 바로 오지 않는 한 가격으로
# 오인하지 않는다.
_product_item_re = re.compile(r"(.+?)\s+(\d+(?:,\d{3})*)\s*원?\s*(?:,\s*|$)")


def parse_representative_product(text: str | None) -> list[dict]:
    """Store.representative_product("아메리카노 4,500원, 카페라떼 5000원" 같은 콤마구분
    문자열)를 generate_receipt()가 받는 [{"name":.., "price":..}] 형태로 변환한다."""
    if not text:
        return []
    items = []
    for m in _product_item_re.finditer(text.strip()):
        name = m.group(1).strip()
        if name:
            items.append({"name": name, "price": int(m.group(2).replace(",", ""))})
    return items


def generate_receipt_for_store(store, card_rules: list[dict], target_date: date_cls | None = None) -> str:
    """매장관리에 등록된 정보만으로(캠페인/작업 없이) 영수증 이미지 1건을 즉석 생성한다.
    target_date를 안 주면 오늘 날짜를 쓴다."""
    menu_items = parse_representative_product(store.representative_product)
    if not menu_items:
        raise ValueError("대표상품(메뉴/금액)이 등록되어 있지 않아 영수증을 만들 수 없습니다.")

    hour, minute, second = _random_time_in_range(store.representative_hours)
    base_date = target_date or datetime.now().date()
    dt = datetime.combine(base_date, time(hour=hour, minute=minute, second=second))

    # 같은 날짜로 여러 장을 한 번에 만들 때 파일명이 겹치지 않도록 랜덤 접미사를 붙인다
    # (시:분:초가 우연히 같은 값으로 뽑힐 수 있어 타임스탬프만으로는 충분하지 않음).
    filename = f"store_{store.id}_{dt.strftime('%Y%m%d%H%M%S')}_{random.randint(1000, 9999)}.jpg"
    output_path = os.path.join(UPLOADS_DIR, "receipts", filename)
    generate_receipt(
        store_name=store.name,
        business_registration_number=store.business_registration_number,
        representative_name=store.representative_name,
        phone=store.phone,
        address=store.address,
        menu_items=menu_items,
        dt=dt,
        output_path=output_path,
        card_rules=card_rules,
    )
    return f"/uploads/receipts/{filename}"


def generate_receipt_for_task(
    task, store, menu_items: list[dict] | None, card_rules: list[dict], receipt_time: time
) -> str | None:
    """작업(Task)의 확정된 영수증 날짜(naver_available_date)+시간(receipt_time)으로 영수증
    이미지를 생성. 시간은 호출자가 미리 골라서 넘겨준다(같은 계정·같은 날짜의 다른 작업들과
    최소 간격을 확인하는 책임은 pick_time_with_gap()/호출자 쪽에 있음). 메뉴가 등록 안 된
    캠페인은 건너뛰고 None을 반환 — 이 경우 관리자가 캠페인에 메뉴를 채운 뒤 나중에 다시
    시도해야 함."""
    if not menu_items:
        return None
    if not task.naver_available_date:
        return None

    dt = datetime.combine(task.naver_available_date, receipt_time)

    output_path = os.path.join(UPLOADS_DIR, "receipts", f"task_{task.id}.jpg")
    generate_receipt(
        store_name=store.name,
        business_registration_number=store.business_registration_number,
        representative_name=store.representative_name,
        phone=store.phone,
        address=store.address,
        menu_items=menu_items,
        dt=dt,
        output_path=output_path,
        card_rules=card_rules,
    )
    return f"/uploads/receipts/task_{task.id}.jpg"
