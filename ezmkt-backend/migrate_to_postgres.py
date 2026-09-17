"""로컬 SQLite(review_manager.db)의 데이터를 Railway Postgres로 옮기는 1회성 스크립트.

사용법:
  1. Railway -> Postgres 서비스 -> Connect 탭에서 "Public Network" 연결 문자열을 복사
     (내부용 말고 외부에서 접속 가능한 쪽 -- 보통 viaduct.proxy.rlwy.net 같은 호스트)
  2. 이 파일이 있는 easyreview-backend 폴더에서:
       TARGET_DATABASE_URL=postgresql://... python migrate_to_postgres.py
     (PowerShell이면: $env:TARGET_DATABASE_URL="postgresql://..."; python migrate_to_postgres.py)

안전장치: 이미 Postgres 쪽 테이블에 데이터가 있으면 그 테이블은 건너뛴다(덮어쓰거나
중복 삽입하지 않음) -- 실수로 두 번 돌려도 안전하다. 마이그레이션 후에는 Postgres의
auto-increment 시퀀스를 옮겨온 데이터의 실제 최대 id 이후로 맞춰서, 이후 온라인에서
새로 만드는 레코드가 id 충돌을 내지 않게 한다.
"""
import os
import sys

from sqlalchemy import create_engine, select, text

sys.path.insert(0, os.path.dirname(__file__))
from app.database import Base
from app import models  # noqa: F401 -- Base.metadata에 전체 테이블을 등록시키기 위한 import

SOURCE_URL = "sqlite:///./review_manager.db"
TARGET_URL = os.environ.get("TARGET_DATABASE_URL")

if not TARGET_URL:
    print("TARGET_DATABASE_URL 환경변수가 필요합니다 (Railway Postgres의 Public 연결 문자열).")
    sys.exit(1)
if TARGET_URL.startswith("postgres://"):
    TARGET_URL = TARGET_URL.replace("postgres://", "postgresql://", 1)

source_engine = create_engine(SOURCE_URL)
target_engine = create_engine(TARGET_URL)

# 혹시 대상 Postgres가 완전히 빈 상태(새 인스턴스)일 수도 있으니 스키마부터 보장
Base.metadata.create_all(bind=target_engine)

with source_engine.connect() as src, target_engine.connect() as dst:
    for table in Base.metadata.sorted_tables:
        first_col = list(table.c.keys())[0]
        already_has_data = dst.execute(select(table.c[first_col]).limit(1)).first() is not None
        if already_has_data:
            print(f"[skip] {table.name}: 대상에 이미 데이터가 있어 건너뜀")
            continue

        rows = [dict(r._mapping) for r in src.execute(select(table))]
        if not rows:
            print(f"[skip] {table.name}: 원본에 데이터 없음")
            continue

        dst.execute(table.insert(), rows)
        dst.commit()
        print(f"[ok]   {table.name}: {len(rows)}건 이전 완료")

    # id 컬럼이 있는 테이블은 Postgres 시퀀스를 실제 최대값 이후로 맞춰준다
    for table in Base.metadata.sorted_tables:
        if "id" not in table.c:
            continue
        seq_name = f"{table.name}_id_seq"
        dst.execute(
            text(
                f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM {table.name}), 1))"
            )
        )
    dst.commit()

print("\n마이그레이션 완료.")
