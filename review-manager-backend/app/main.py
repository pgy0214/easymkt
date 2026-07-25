from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()  # must run before routers/sms/auth modules read env vars at import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import scheduler
from app.database import Base, engine
from app.migrations import run_migrations
from app.routers import accounts, portal, reviewers, settings, settlement, stores, targets, tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    Base.metadata.create_all(bind=engine)  # recreate tables migrations may have dropped
    scheduler.start_scheduler()
    yield
    scheduler.shutdown_scheduler()


app = FastAPI(title="Review Manager API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reviewers.router)
app.include_router(accounts.router)
app.include_router(stores.router)
app.include_router(targets.router)
app.include_router(tasks.router)
app.include_router(settlement.router)
app.include_router(settings.router)
app.include_router(portal.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
