import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Railway/Render inject DATABASE_URL for the attached Postgres addon (often as
# postgres://, which SQLAlchemy's psycopg2 dialect rejects — needs postgresql://).
# No DATABASE_URL set (local dev) falls back to the SQLite file as before.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./review_manager.db")
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
        "postgres://", "postgresql://", 1
    )

connect_args = (
    {"check_same_thread": False}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {}
)
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
