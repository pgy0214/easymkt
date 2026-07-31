import os

import requests

ALIGO_API_URL = "https://apis.aligo.in/send/"
ALIGO_KAKAO_API_URL = "https://kakaoapi.aligo.in/akv10/alimtalk/send/"


def _aligo_creds() -> tuple[str, str, str]:
    user_id = os.environ.get("ALIGO_USER_ID")
    api_key = os.environ.get("ALIGO_API_KEY")
    sender = os.environ.get("ALIGO_SENDER")
    if not (user_id and api_key and sender):
        raise RuntimeError(
            "Aligo API 자격증명이 설정되지 않았습니다 — .env에 ALIGO_USER_ID/ALIGO_API_KEY/ALIGO_SENDER를 채워주세요"
        )
    return user_id, api_key, sender


def is_sms_configured() -> bool:
    return bool(
        os.environ.get("ALIGO_USER_ID")
        and os.environ.get("ALIGO_API_KEY")
        and os.environ.get("ALIGO_SENDER")
    )


def is_kakao_configured() -> bool:
    return is_sms_configured() and bool(os.environ.get("ALIGO_KAKAO_SENDER_KEY"))


def send_sms(phone: str, message: str) -> None:
    """알리고(Aligo) 문자 발송 — 자유 텍스트를 그대로 보낼 수 있다(카카오 알림톡과 달리
    사전 승인된 템플릿이 필요 없음)."""
    user_id, api_key, sender = _aligo_creds()
    response = requests.post(
        ALIGO_API_URL,
        data={
            "key": api_key,
            "user_id": user_id,
            "sender": sender,
            "receiver": phone,
            "msg": message,
        },
        timeout=10,
    )
    response.raise_for_status()
    result = response.json()
    if str(result.get("result_code")) != "1":
        raise RuntimeError(f"SMS 발송 실패: {result}")


def send_otp_sms(phone: str, code: str) -> None:
    """Send an OTP code via Aligo (알리고). Requires ALIGO_USER_ID, ALIGO_API_KEY,
    ALIGO_SENDER in the environment (.env) — the actual registered sender number
    must be pre-approved in the Aligo dashboard."""
    send_sms(phone, f"[리뷰관리] 인증번호는 {code} 입니다. 5분 내에 입력해주세요.")


def send_kakao_alimtalk(
    phone: str,
    template_code: str,
    message: str,
    fallback_message: str | None = None,
) -> None:
    """알리고 카카오 알림톡 발송.

    ⚠️ 실제 발신프로필키/템플릿코드로 검증된 적 없는 코드다 — Aligo 공개 문서 기준으로
    작성했지만, 알림톡은 카카오 심사를 통과한 템플릿 문구와 정확히 일치해야 발송되므로
    (자유 텍스트 불가), 실사용 전에 실제 계정으로 한 번 테스트 발송해서 성공 판정
    조건(`result.get("code")`)이 맞는지 확인이 필요하다. ALIGO_KAKAO_SENDER_KEY(발신프로필키)를
    .env에 추가로 설정해야 한다.

    fallback_message를 주면 알림톡이 실패했을 때 문자로 대체 발송된다(failover)."""
    user_id, api_key, sender = _aligo_creds()
    sender_key = os.environ.get("ALIGO_KAKAO_SENDER_KEY")
    if not sender_key:
        raise RuntimeError(
            "카카오 알림톡 발신프로필키가 설정되지 않았습니다 — .env에 ALIGO_KAKAO_SENDER_KEY를 채워주세요"
        )

    data = {
        "apikey": api_key,
        "userid": user_id,
        "senderkey": sender_key,
        "tpl_code": template_code,
        "sender": sender,
        "receiver_1": phone,
        "message_1": message,
    }
    if fallback_message:
        data["failover"] = "Y"
        data["fsubject_1"] = "알림"
        data["fmessage_1"] = fallback_message

    response = requests.post(ALIGO_KAKAO_API_URL, data=data, timeout=10)
    response.raise_for_status()
    result = response.json()
    if str(result.get("code")) != "0":
        raise RuntimeError(f"알림톡 발송 실패: {result}")
