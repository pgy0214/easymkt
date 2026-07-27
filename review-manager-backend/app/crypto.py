import os

from cryptography.fernet import Fernet, InvalidToken


def _fernet() -> Fernet:
    key = os.environ.get("ACCOUNT_SECRET_KEY")
    if not key:
        raise RuntimeError(
            "ACCOUNT_SECRET_KEY가 설정되지 않았습니다 — .env에 Fernet 키를 넣어주세요 "
            '(생성: python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())")'
        )
    return Fernet(key.encode())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as e:
        raise ValueError("저장된 값을 복호화할 수 없습니다 (ACCOUNT_SECRET_KEY가 바뀌었을 수 있어요)") from e
