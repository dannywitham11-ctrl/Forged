# Forged

A self-hosted, locally-run trading journal for futures traders managing multiple
prop-firm accounts. It imports raw fills from **Sierra Chart**, **NinjaTrader**,
and **MotiveWave**, reconstructs them into round-trip trades, and computes
per-account economics, drawdown lifecycle, payout planning, and analytics.

Runs entirely on your machine — no auth, no telemetry, all data stays local.

---

## Tech stack

| Layer    | Tech |
|----------|------|
| Backend  | Python 3.12 · FastAPI · SQLAlchemy 2.0 (sync) · PostgreSQL (SQLite for dev) |
| Frontend | TypeScript · React 18 · Vite · Tailwind CSS · Recharts · lightweight-charts |
| Serving  | Docker Compose — Postgres + API (uvicorn) + web (Nginx serving the built SPA) |

---

## Quick start (run it locally)

**Prerequisite:** Docker Desktop running.

```bash
git clone https://github.com/dannywitham11-ctrl/Forged.git
cd Forged
cp .env.example .env          # edit ports / password if you like
docker compose up -d --build
```

Open **http://localhost:5180**. API docs at **http://localhost:8088/docs**.

Stop with `docker compose down` (your data persists in `./data`).

> Ports are set in `.env` — web `5180`, api `8088`, postgres `5433`.

---

## Development (hot reload)

You can run the two halves separately for fast iteration. CORS is wide open, so
the frontend dev server can talk to the API cross-origin.

**Backend** (uses a local SQLite file — no Postgres needed for dev):

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate    # Windows
# source .venv/bin/activate                          # macOS/Linux
pip install -r requirements.txt
set DATABASE_URL=sqlite:///./dev.db                  # Windows (use export on *nix)
set UPLOAD_DIR=./_uploads
uvicorn app.main:app --reload --port 8088
```

**Frontend:**

```bash
cd frontend
npm install
# point the dev server at the API, then start Vite (http://localhost:5173):
# Windows:  set VITE_API_BASE=http://localhost:8088 && npm run dev
VITE_API_BASE=http://localhost:8088 npm run dev
```

After backend edits the `--reload` flag restarts uvicorn automatically; Vite
hot-reloads the frontend.

---

## Project structure

```
backend/
  app/
    main.py            FastAPI app wiring (startup: create tables + migrations + seed)
    db.py              engine / session (Postgres by default, SQLite when DATABASE_URL is sqlite)
    models.py          SQLAlchemy ORM tables
    schemas.py         Pydantic request/response models
    routers/           one module per resource (accounts, trades, uploads, stats, ...)
    parser.py          Sierra Chart TSV  -> ParsedFill
    nt_parser.py       NinjaTrader CSV   -> ParsedFill
    mw_parser.py       MotiveWave CSV    -> ParsedFill
    matching.py        ParsedFill rows   -> round-trip Trade rows
    services.py        account creation/classification, trade rebuild, lifecycle
    prop.py / plan.py  prop-firm status, economics, payout forecasting
    analytics.py       win rate / profit factor / equity & drawdown curves
  Dockerfile
  requirements.txt
frontend/
  src/
    App.tsx            router + global account-selection state
    lib/api.ts         typed fetch wrapper (all endpoints + TS types)
    pages/             one file per route
    components/        charts, tiles, modals, account multi-select
  Dockerfile / nginx.conf
docker-compose.yml     db + api + web
.env.example           copy to .env
CLAUDE.md              deep-dive architecture notes
```

---

## Importing trades

On the **Upload** page, drop an export — the format is auto-detected:

- **Sierra Chart** — `Trade > Trade Activity Log > Export` (`.txt`, tab-separated).
- **NinjaTrader** — `Control Center > Trade Performance > Executions` grid → Export CSV.
- **MotiveWave** — the Executions / Order History table → right-click → Export CSV.

Accounts are auto-created from the account ID and classified (Apex, Lucid, etc.).
Apply a prop-firm preset on the **Prop Firms** page to get drawdown/payout rules.

> Tip: set your **timezone** under Plan → Edit goals so trades bucket by your
> local day (exports with timezone offsets are normalized to UTC on import).

---

## Configuration

Copy `.env.example` → `.env`. Nothing secret is required for local use; pick a
real `POSTGRES_PASSWORD` if you expose Postgres. The backend also reads
`DATABASE_URL` directly (used by the dev SQLite flow above).

---

## Notes & conventions

- **Sync SQLAlchemy** throughout; FastAPI routes are `def` (async only where file IO needs it).
- Every API route is under `/api`; Nginx proxies that prefix to the API container.
- **No authentication** — single-user, localhost only. Don't expose it to the public internet without putting auth in front of it.
- Schema changes are idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements in `migrations.py`, run on every startup (no Alembic).
- Prop-firm seed values in `prop_firms.py` are best-effort estimates — verify against each firm before relying on forecasts.

## License

[MIT](./LICENSE)
