import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()  # must run before routers/sms/auth modules read env vars at import time

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import scheduler
from app.database import Base, engine
from app.migrations import run_migrations
from app.routers import (
    accounts,
    admin,
    advertiser,
    card_rules,
    experience_campaigns,
    notify,
    portal,
    reviewers,
    settings,
    settlement,
    stores,
    targets,
    tasks,
)

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(os.path.join(UPLOADS_DIR, "campaigns"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_DIR, "receipts"), exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    Base.metadata.create_all(bind=engine)  # recreate tables migrations may have dropped
    scheduler.start_scheduler()
    yield
    scheduler.shutdown_scheduler()


app = FastAPI(title="Review Manager API", lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Railway의 FRONTEND_ORIGINS 환경변수가 대시보드엔 정상 저장되는데도 실행
# 프로세스에는 반영되지 않는 현상이 반복 확인되어(Vercel의 커스텀 env var
# 미반영 문제와 동일 패턴), 환경변수 의존을 없애고 코드에 직접 명시한다.
# 둘 다 공개 프론트엔드 도메인이라 코드에 있어도 민감정보 아님.
_frontend_origins = [
    "http://localhost:5173",
    "https://review-managing.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(reviewers.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(accounts.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(stores.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(targets.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(tasks.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(settlement.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(settings.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(portal.router)
app.include_router(notify.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(card_rules.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(experience_campaigns.router, dependencies=[Depends(admin.get_current_admin)])
app.include_router(advertiser.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
