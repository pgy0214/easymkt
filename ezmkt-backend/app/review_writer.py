import os
import re
from collections import Counter

import anthropic

# 리뷰 원고 자동 생성 — 캠페인 원고 업로드분이 작업 갯수보다 적을 때 나머지를 채운다.
# 대량(캠페인당 수백 건)의 짧은 텍스트 생성이라 비용/속도가 중요해 Haiku를 쓴다.
# "원고 만들기" 페이지의 일괄 생성도 동일 모델 사용.
MODEL = "claude-haiku-4-5"
BATCH_MODEL = MODEL

# 말투 프리셋 — "학습"의 실질적인 구현: 자유 텍스트 한 줄로 말투를 매번 새로 설명하는
# 대신, 자주 쓰는 말투 유형별로 세부 규칙(종결어미/격식/구조)을 미리 정의해뒀다가
# 캠페인에서 고르기만 하면 된다. 새 매장이 들어와도 이 규칙 자체는 그대로 재사용되고,
# 매장별 내용(가이드라인/지역특징/메뉴/금지어)만 캠페인마다 다르게 채우면 된다.
TONE_PRESETS = {
    "friendly": {
        "label": "친근한 구어체 (기본)",
        "instruction": (
            "반말은 쓰지 말고 편한 구어체 존댓말로. 문장 종결어미(~했어요/~하더라고요/"
            "~했네요/~대만족ㅋㅋ/~했음요/~했습니다 등)를 한 가지로 통일하지 말고 여러 종류를 "
            "골고루 섞어서, 친구한테 편하게 말하듯 자연스럽게 써줘."
        ),
    },
    "formal": {
        "label": "정중한 존댓말체",
        "instruction": (
            "문장 종결은 ~습니다/~였습니다 체로 격식 있고 예의 바르게 통일해줘. "
            "이모티콘이나 지나치게 캐주얼한 표현(ㅋㅋ, ~함요, ~대박 등)은 쓰지 마."
        ),
    },
    "heartfelt": {
        "label": "진심 어린 감사체",
        "instruction": (
            "실제로 도움을 받고 고마운 마음이 느껴지는 어투로 써줘. 방문 전의 고민이나 "
            "불편함과, 방문 후 달라진 점을 자연스럽게 대비시켜줘. 과장하지 말고 담백하게 "
            "진심이 느껴지게."
        ),
    },
    "concise": {
        "label": "간결하고 임팩트있게",
        "instruction": (
            "군더더기 없이 짧고 임팩트 있게 써줘. 한두 문장으로 핵심만 전달하고, "
            "부연설명은 최소화해줘."
        ),
    },
    "detailed": {
        "label": "꼼꼼한 설명형",
        "instruction": (
            "방문 계기부터 실제 경험한 과정, 결과까지 구체적으로 풀어서 설명하듯 써줘. "
            "다른 사람이 참고할 만한 디테일을 담아서 정보 전달에 무게를 둬줘."
        ),
    },
}
DEFAULT_TONE_PRESET = "friendly"


def tone_preset_options() -> list[dict]:
    return [{"key": key, "label": v["label"]} for key, v in TONE_PRESETS.items()]


def is_configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY가 설정되지 않았습니다 — .env에 채워주세요 (리뷰 원고 자동생성 기능에 필요)"
        )
    return anthropic.Anthropic(api_key=api_key)


def _tone_instruction(tone_preset: str | None) -> str:
    preset = TONE_PRESETS.get(tone_preset or "", TONE_PRESETS[DEFAULT_TONE_PRESET])
    return preset["instruction"]


def _context_block(
    guideline: str | None,
    regional_features: str | None,
    tone: str | None,
    menu_items: list[dict] | None,
) -> str:
    parts = []
    if guideline:
        parts.append(f"원고 가이드라인:\n{guideline}")
    if regional_features:
        parts.append(f"지역적 특징:\n{regional_features}")
    if tone:
        parts.append(f"추가 지시(말투 세부):\n{tone}")
    if menu_items:
        menu_text = ", ".join(f"{m['name']}({m['price']}원)" for m in menu_items)
        parts.append(f"메뉴: {menu_text}")
    return "\n\n".join(parts) if parts else "(참고 자료 없음 — 자연스러운 방문 후기를 작성해줘)"


def _forbidden_words_line(forbidden_words: str | None) -> str:
    if not forbidden_words:
        return ""
    words = [w.strip() for w in re.split(r"[,\n]", forbidden_words) if w.strip()]
    if not words:
        return ""
    return (
        f"\n- 다음 단어는 절대 쓰지 마, 같은 뜻으로 연상되는 다른 표현으로도 대체하지 마: "
        f"{', '.join(words)}"
    )


def _build_prompt(
    guideline: str | None,
    regional_features: str | None,
    tone: str | None,
    length: int,
    menu_items: list[dict] | None,
    forbidden_words: str | None = None,
    tone_preset: str | None = None,
) -> str:
    context = _context_block(guideline, regional_features, tone, menu_items)

    return f"""다음 참고 자료를 바탕으로 실제 방문객이 쓴 것처럼 자연스러운 네이버 영수증 리뷰를 한 편 작성해줘.

{context}

조건:
- 글자수는 {length}자 내외 (너무 짧거나 길지 않게) — 아래 말투를 지키느라 이 글자수를 넘기지 마, 글자수가 우선이야
- {_tone_instruction(tone_preset)}
- 같은 캠페인의 다른 리뷰들과 패턴이 겹치지 않게 매번 다르게 조합해줘
- 과장된 광고 문구, 이모지, 해시태그 없이{_forbidden_words_line(forbidden_words)}
- 결과는 리뷰 본문 텍스트만 출력 (제목, 설명, 따옴표 없이)"""


def generate_review_text(
    guideline: str | None,
    regional_features: str | None,
    length: int,
    tone: str | None = None,
    menu_items: list[dict] | None = None,
    forbidden_words: str | None = None,
    tone_preset: str | None = None,
) -> str:
    client = _client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": _build_prompt(
                    guideline,
                    regional_features,
                    tone,
                    length,
                    menu_items,
                    forbidden_words,
                    tone_preset,
                ),
            }
        ],
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    return text.strip()


def _build_batch_prompt(
    guideline: str | None,
    regional_features: str | None,
    tone: str | None,
    length: int,
    menu_items: list[dict] | None,
    forbidden_words: str | None,
    tone_preset: str | None,
    count: int,
) -> str:
    context = _context_block(guideline, regional_features, tone, menu_items)

    return f"""다음 참고 자료를 바탕으로 실제 방문객이 쓴 것처럼 자연스러운 네이버 영수증 리뷰를 {count}편 작성해줘.

{context}

조건:
- 글자수는 {length}자 내외로, 리뷰마다 조금씩 다르게(예: {max(length - 10, 10)}~{length + 10}자 사이) 자연스럽게 분산시켜줘 — 전부 똑같은 길이로 맞추지 마. 아래 말투를 지키느라 이 범위를 넘기지 마, 글자수가 우선이야
- {_tone_instruction(tone_preset)}
- 방문 계기/상황을 리뷰마다 다르게 섞어줘 (예: 직장인, 지인 추천, 재방문, 가족 동반, 다른 곳과 비교, 우연히 발견 등 — 상황에 안 맞으면 자연스러운 다른 계기로 대체해도 됨)
- {count}편 전체를 놓고 봤을 때 특정 표현이나 도입부가 반복되지 않게, 서로 겹치는 문장이 없게 다양하게 써줘
- 과장된 광고 문구, 이모지, 해시태그 없이{_forbidden_words_line(forbidden_words)}

출력 형식(반드시 지켜줘):
- "1. ", "2. " 처럼 번호와 마침표로 시작하는 한 줄에 리뷰 하나씩, 총 {count}줄만 출력
- 번호 앞뒤로 다른 설명, 요약, 안내 문구는 절대 붙이지 마
- 리뷰 내용에 줄바꿈이나 따옴표를 넣지 마 (한 줄짜리 텍스트여야 함)"""


_NUMBERED_ITEM_RE = re.compile(
    r"(?:^|\n)\s*\d+[.)]\s*(.+?)(?=\n\s*\d+[.)]\s|\Z)", re.DOTALL
)


def _parse_numbered_list(text: str, expected_count: int) -> list[str]:
    """번호 매긴 항목을 뽑아낸다 — 모델이 매번 정확히 한 줄씩 나눠 쓴다는 보장이 없어서
    (가끔 항목 하나가 줄바꿈 없이 이어지거나, 반대로 항목 내용 자체에 줄바꿈이 섞이기도
    함) 다음 번호가 나올 때까지를 한 항목으로 통째로 잡는 방식으로 파싱한다."""
    items = []
    for match in _NUMBERED_ITEM_RE.finditer(text):
        content = " ".join(match.group(1).split()).strip('"').strip("'").strip()
        if content:
            items.append(content)
    return items[:expected_count]


def generate_review_texts_batch(
    guideline: str | None,
    regional_features: str | None,
    length: int,
    count: int,
    tone: str | None = None,
    menu_items: list[dict] | None = None,
    forbidden_words: str | None = None,
    tone_preset: str | None = None,
) -> list[str]:
    """원고 만들기 페이지 전용 — count편을 한 번의 호출로 함께 생성해, 모델이 전체 결과를
    보면서 서로 겹치지 않게 스스로 다양화하도록 한다(건별로 따로따로 호출하면 서로의
    존재를 몰라 표현이 우연히 겹칠 수 있음)."""
    client = _client()
    response = client.messages.create(
        model=BATCH_MODEL,
        max_tokens=min(count * 220 + 300, 8000),
        messages=[
            {
                "role": "user",
                "content": _build_batch_prompt(
                    guideline,
                    regional_features,
                    tone,
                    length,
                    menu_items,
                    forbidden_words,
                    tone_preset,
                    count,
                ),
            }
        ],
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    return _parse_numbered_list(text, count)


def validate_review_texts(
    texts: list[str], forbidden_words: str | None, target_length: int
) -> list[list[str]]:
    """관리자가 "정상적으로 나왔는지" 눈으로 다시 안 읽어봐도 되도록, 모델이 지시를
    놓쳤을 가능성에 대비한 코드 레벨 안전망 — 프롬프트로만 맡기지 않고 건별로 직접
    검사해서 경고를 붙인다. 리스트 순서는 texts와 1:1로 대응."""
    words = (
        [w.strip() for w in re.split(r"[,\n]", forbidden_words) if w.strip()]
        if forbidden_words
        else []
    )
    counts = Counter(texts)
    low, high = max(10, target_length - 25), target_length + 40

    warnings_per_text = []
    for text in texts:
        warnings = []
        hit = [w for w in words if w in text]
        if hit:
            warnings.append(f"금지어 포함: {', '.join(hit)}")
        if counts[text] > 1:
            warnings.append("배치 내 중복")
        if not (low <= len(text) <= high):
            warnings.append(f"글자수 확인 필요 ({len(text)}자)")
        warnings_per_text.append(warnings)
    return warnings_per_text
