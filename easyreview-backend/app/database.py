import os
import shutil

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 2026-08-23: DATABASE_URL을 읽어 Postgres에 연결하는 버전을 배포했더니 프로덕션이
# 전체 502(크래시)로 다운됨 — 로그를 볼 방법이 없어 정확한 원인 파악 전이라 우선
# 이전 상태(SQLite 하드코딩)로 긴급 롤백. Postgres 연결은 원인 파악 후 별도로 재시도.
#
# 2026-08-24: DB 파일이 지금까지 컨테이너의 비영구 디스크(./review_manager.db)에
# 있어서, Railway가 재배포 때 컨테이너를 새로 만들면 데이터가 날아갈 위험이 있었다
# (uploads/ 폴더만 영구 Volume에 마운트돼 있고 DB 파일은 그 밖에 있었음). 이미 붙어있는
# 그 Volume(/app/uploads) 안으로 DB를 옮겨서 해결 — 최초 1회, 볼륨에 아직 DB가 없고
# 예전 위치에 파일이 남아있으면 그대로 복사만 하고(삭제 없음) 그 다음부터는 볼륨 파일을
# 계속 사용한다. 로컬 개발 환경(uploads 폴더 없음)에서는 예전처럼 프로젝트 루트를 그대로 쓴다.
_OLD_DB_PATH = "./review_manager.db"
_VOLUME_DIR = "/app/uploads"
if os.path.isdir(_VOLUME_DIR):
    _DB_PATH = os.path.join(_VOLUME_DIR, "review_manager.db")
    if not os.path.exists(_DB_PATH) and os.path.exists(_OLD_DB_PATH):
        shutil.copy(_OLD_DB_PATH, _DB_PATH)
else:
    _DB_PATH = _OLD_DB_PATH

SQLALCHEMY_DATABASE_URL = f"sqlite:///{_DB_PATH}"

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
