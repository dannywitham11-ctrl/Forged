import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Postgres by default; override via DATABASE_URL. The docker-compose db service
# publishes 5433 on the host, so a local (non-docker) run hits the same port.
default_db = "sqlite:////tmp/dev.db" if os.environ.get("VERCEL") else "postgresql+psycopg://tz:tz_local_dev@localhost:5433/forge"
DATABASE_URL = os.environ.get("DATABASE_URL", default_db)

# SQLite (used by the no-Docker / packaged-.exe modes) serves requests from
# FastAPI's threadpool, so connections cross threads — disable the same-thread
# check. Postgres is unaffected (connect_args stays empty).
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
