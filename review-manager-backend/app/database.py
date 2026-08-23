from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 2026-08-23: DATABASE_URL을 읽어 Postgres에 연결하는 버전을 배포했더니 프로덕션이
# 전체 502(크래시)로 다운됨 — 로그를 볼 방법이 없어 정확한 원인 파악 전이라 우선
# 이전 상태(SQLite 하드코딩)로 긴급 롤백. Postgres 연결은 원인 파악 후 별도로 재시도.
SQLALCHEMY_DATABASE_URL = "sqlite:///./review_manager.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
