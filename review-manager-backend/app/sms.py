import os

import requests

ALIGO_API_URL = "https://apis.aligo.in/send/"


def send_otp_sms(phone: str, code: str) -> None:
    """Send an OTP code via Aligo (알리고). Requires ALIGO_USER_ID, ALIGO_API_KEY,
    ALIGO_SENDER in the environment (.env) — the actual registered sender number
    must be pre-approved in the Aligo dashboard."""
    user_id = os.environ.get("ALIGO_USER_ID")
    api_key = os.environ.get("ALIGO_API_KEY")
    sender = os.environ.get("ALIGO_SENDER")
    if not (user_id and api_key and sender):
        raise RuntimeError(
            "Aligo API 자격증명이 설정되지 않았습니다 — .env에 ALIGO_USER_ID/ALIGO_API_KEY/ALIGO_SENDER를 채워주세요"
        )

    response = requests.post(
        ALIGO_API_URL,
        data={
            "key": api_key,
            "user_id": user_id,
            "sender": sender,
            "receiver": phone,
            "msg": f"[리뷰관리] 인증번호는 {code} 입니다. 5분 내에 입력해주세요.",
        },
        timeout=10,
    )
    response.raise_for_status()
    result = response.json()
    if str(result.get("result_code")) != "1":
        raise RuntimeError(f"SMS 발송 실패: {result}")
