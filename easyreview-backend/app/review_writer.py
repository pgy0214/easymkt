import os

import anthropic

# 리뷰 원고 자동 생성 — 캠페인 원고 업로드분이 작업 갯수보다 적을 때 나머지를 채운다.
# 대량(캠페인당 수백 건)의 짧은 텍스트 생성이라 비용/속도가 중요해 Haiku를 쓴다.
MODEL = "claude-haiku-4-5"


def is_configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY가 설정되지 않았습니다 — .env에 채워주세요 (리뷰 원고 자동생성 기능에 필요)"
        )
    return anthropic.Anthropic(api_key=api_key)


def _build_prompt(
    guideline: str | None,
    regional_features: str | None,
    tone: str | None,
    length: int,
    menu_items: list[dict] | None,
) -> str:
    parts = []
    if guideline:
        parts.append(f"원고 가이드라인:\n{guideline}")
    if regional_features:
        parts.append(f"지역적 특징:\n{regional_features}")
    if tone:
        parts.append(f"말투 지시:\n{tone}")
    if menu_items:
        menu_text = ", ".join(f"{m['name']}({m['price']}원)" for m in menu_items)
        parts.append(f"메뉴: {menu_text}")
    context = "\n\n".join(parts) if parts else "(참고 자료 없음 — 자연스러운 방문 후기를 작성해줘)"

    return f"""다음 참고 자료를 바탕으로 실제 방문객이 쓴 것처럼 자연스러운 네이버 영수증 리뷰를 한 편 작성해줘.

{context}

조건:
- 글자수는 {length}자 내외 (너무 짧거나 길지 않게)
- 반말/존댓말 섞지 말고 후기 특유의 편한 구어체로
- 문장 종결어미는 한 가지로 통일하지 말고 여러 종류를 섞어서 써줘
  (예: ~함요, ~했네요, ~더라고요, ~했어요, ~대만족ㅋㅋ, ~했습니다 등 중에서
  자연스럽게 골고루) — 같은 캠페인의 다른 리뷰들과 패턴이 겹치지 않게 매번
  다르게 조합해줘
- 과장된 광고 문구, 이모지, 해시태그 없이
- 결과는 리뷰 본문 텍스트만 출력 (제목, 설명, 따옴표 없이)"""


def generate_review_text(
    guideline: str | None,
    regional_features: str | None,
    length: int,
    tone: str | None = None,
    menu_items: list[dict] | None = None,
) -> str:
    client = _client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": _build_prompt(guideline, regional_features, tone, length, menu_items),
            }
        ],
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    return text.strip()
