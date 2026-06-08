"""FastAPI application wiring.

Startup creates tables, runs idempotent migrations, and seeds prop firm presets.
There is no auth — single user, local only — so CORS is wide open.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401 -- import registers ORM tables on Base
from .db import Base, SessionLocal, engine
from .migrations import run_migrations
from .prop_firms import seed_prop_firms
from .routers import (
    account_costs,
    accounts,
    admin,
    attachments,
    economics,
    executions,
    market_data,
    payouts,
    plan,
    playbooks,
    prop_firms,
    settings as settings_router,
    stats,
    strategies,
    trades,
    uploads,
)

app = FastAPI(title="Forge — self-hosted trading journal", version="0.2.0")

cors_origins = os.environ.get("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if cors_origins == "*" else [o.strip() for o in cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    # Seed prop firm presets (idempotent — does not overwrite user edits).
    db = SessionLocal()
    try:
        seed_prop_firms(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"ok": True}


for _router in (
    accounts,
    uploads,
    trades,
    stats,
    executions,
    strategies,
    payouts,
    prop_firms,
    account_costs,
    economics,
    playbooks,
    settings_router,
    plan,
    attachments,
    admin,
    market_data,
):
    app.include_router(_router.router)
