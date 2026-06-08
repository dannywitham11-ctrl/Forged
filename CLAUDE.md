# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Self-hosted, single-user trading journal ("Forge") for futures traders running multiple prop-firm accounts. Imports raw fills from Sierra Chart's Trade Activity Log (TSV) and NinjaTrader (CSV), matches them into round-trip trades, and computes per-account economics, drawdown lifecycle, payout planning, and analytics.

## Running it

Everything runs through `docker-compose.yml` at the repo root. There is no host-side build chain; the api and web images are built inside Docker.

```bash
docker compose up -d --build          # build + start db, api, web
docker compose logs -f api            # tail backend logs
docker compose restart api            # pick up Python edits (no --reload in CMD)
docker compose up -d --build web      # rebuild frontend bundle (Vite build at image-build time)
docker compose exec db psql -U tz -d forge        # DB shell (DB name = POSTGRES_DB in .env)
```

**Ports** (configured in `.env`): web `5180`, api `8088`, postgres `5433`. API docs at http://localhost:8088/docs.

**No test suite exists.** Validate changes by: hitting the API with curl, watching `docker compose logs api`, and exercising the affected page in the browser.

### Important: the api container does NOT auto-reload

The `api` service bind-mounts `./backend/app → /app/app`, so source edits are visible inside the container, but `CMD ["uvicorn", "app.main:app", ...]` runs without `--reload`. After backend edits, `docker compose restart api`. The `web` service has no bind-mount — frontend edits require `docker compose up -d --build web`.

### Sierra Chart .scid / .data bind-mount

`docker-compose.yml` optionally bind-mounts a host path (env var `SIERRA_DATA`) to `/sierra-data:ro` so the api can read `.scid` (tick history) and `.data` (TradeAccount snapshots) files directly. When `SIERRA_DATA` is unset the mount points to a placeholder dir and the related endpoints return "not mounted".

## Architecture

### Data flow (the central pipeline)

```
Sierra TSV / NinjaTrader CSV
        │
        ▼   parser.parse_sierra_fills  /  nt_parser.parse_ninjatrader_executions
   ParsedFill records (one per fill row)
        │
        ▼   services.insert_executions  (dedupe by (account_id, fill_id))
   Execution rows in DB, account auto-created via services.get_or_create_account
        │
        ▼   services.rebuild_trades_for_account
   matching.match_executions_to_trades  →  Trade rows (1 per opening order)
        │
        ▼   services.evaluate_account_lifecycle
   Account.status auto-flips: active → blown / funded
```

`rebuild_trades_for_account` is the single source of truth for trade construction. It deletes existing trades for an account and rebuilds from the raw `Execution` rows. Call it after editing commissions, fees, or anything that changes how P&L is computed. The upload route calls it for every account touched by the upload.

### Trade matching algorithm (`matching.py`)

Sierra's fills carry `open_close` ('Open'/'Close'), `internal_order_id`, and `parent_internal_order_id`. **One trade = one opening order + all of its closes** (where close.parent_internal_order_id == opener.internal_order_id). Orphan closes are FIFO'd against the oldest unclosed opener of the opposite side on the same symbol. If a symbol has no open_close markers at all, a position-to-zero crossing fallback (`_position_walk_fallback`) is used.

`trade_date` follows `UserSettings.timezone` + `UserSettings.date_by` ("exit" or "entry"). Default is exit time in the user's tz — a trade closed Fri 00:10 local is a Friday trade.

### Account classification & naming (`services.py`)

`external_id` patterns drive both `account_type` and the friendly `display_name`:

- `_EXTID_RE` matches `[PA-|EVAL-|FUNDED-|TCP-]<FIRM>-<digits>-<digits>` (Apex/TopStep/TPT style).
- `_LUCID_FLEX_RE` matches `[PA-|EVAL-]LFE<size>-<alphanumeric>-<TEST|PA|EVAL|FUNDED><digits>` (Lucid Flex).
- `_TRADEIFY_RE` matches `tradeify-TDFY<prog><size><userid>` (Tradeify).

`detect_account_type()` tries Lucid-Flex, then Tradeify, then the general pattern. `friendly_account_name()` produces e.g. "Apex 50K PA-10" or "Lucid 50K EVAL-3". Both return `"personal"` / `None` if nothing matches. When adding a new external_id format, add the regex here — the upload flow, the `/regenerate-name` route, and `apply_preset_to_account` all funnel through these functions.

### Account lifecycle (drawdown / blow detection)

`services.detect_blown` walks the account's `Execution + Payout` timeline in order, simulating equity under the account's `drawdown_mode` (`static`, `trailing_eod`, `trailing_realtime`), and returns the first ts at which equity crossed the floor. `evaluate_account_lifecycle` runs that walk after every trade rebuild and flips `Account.status` between `active` ↔ `blown` ↔ `funded`. **The broker can override:** if `Account.broker_balance` is set and above starting, an auto-`blown` status is retracted.

### Prop firm presets (`prop_firms.py`)

Firms (`PropFirmDef`) and plans (`PropFirmPlanDef`) are seeded on every startup via `seed_prop_firms()` — idempotent so user edits in the DB survive restarts. When the user "applies a preset", `services.apply_preset_to_account` copies the (firm + plan) field set onto the account and regenerates the display_name.

### Costs ledger

`AccountCost` rows have `is_recurring` (default false). For one-time costs, `amount` is the spend. For recurring, `cost_date` is the start date and `amount` is per-month; the effective total is `amount × monthly_cycles_elapsed(cost_date, end_cap=recurring_end_date)`. Use `services.expand_cost_amount(cost)` whenever you sum money out — `prop.compute_economics` does. `AccountCostOut` exposes the precomputed `effective_total` and `cycles_elapsed`.

### Schema migrations

There is no Alembic. Schema changes use the idempotent list at the top of `migrations.py` — append `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` statements; they run on every startup after `Base.metadata.create_all`. When you add a column, update three places: the ORM model in `models.py`, the migration list in `migrations.py`, and the matching Pydantic schema in `schemas.py`.

### Backend layout

- `app/main.py` — FastAPI wiring, startup runs create_all + migrations + seed.
- `app/db.py` — engine, `SessionLocal`, `get_db` dependency.
- `app/models.py` — all SQLAlchemy ORM tables.
- `app/schemas.py` — Pydantic request/response models (`*In`, `*Out`, `*Update`).
- `app/routers/*.py` — FastAPI routers, mounted in `main.py`. The `account_costs` router lives at `/api/account-costs`.
- `app/services.py` — shared business logic (account creation, preset application, trade rebuilding, cost expansion, lifecycle eval).
- `app/parser.py` (Sierra TSV) / `app/nt_parser.py` (NinjaTrader CSV) — fills → `ParsedFill` iterator.
- `app/matching.py` — `Execution` → `Trade` rows.
- `app/scid_reader.py` — binary `.scid` reader for Sierra tick data.
- `app/tradeaccount_reader.py` — TLV parser for Sierra's `.data` files (broker balance snapshots).
- `app/bars.py` — generic OHLCV CSV/TSV parser for market data uploads.
- `app/analytics.py` — pure trade-stat math (win rate, profit factor, breakdowns, histograms).
- `app/insight.py` — composite "insight score".
- `app/plan.py` — payout forecast, ETA calculator, playbook suggestions.
- `app/prop.py` — `compute_prop_status` + `compute_economics`.
- `app/instruments.py` — futures contract specs (price_divisor, point_value, tick_size).
- `app/migrations.py` — idempotent ALTER list run at startup.

### Frontend layout

Vite + React 18 + TypeScript + Tailwind + recharts + lightweight-charts.

- `frontend/src/App.tsx` — router, global account-selection state (persisted in localStorage under `tz_account_selection` and `tz_account_filters`). `filters.hideBlown` defaults to true; the visible-accounts set drives the API params passed to every page.
- `frontend/src/lib/api.ts` — single thin fetch wrapper + typed entrypoints under `api.*`. Add new endpoints here; keep TS types alongside.
- `frontend/src/pages/*.tsx` — one file per route.
- `frontend/src/components/*.tsx` — reusable UI (charts, tiles, modal, account multi-select).
- `frontend/nginx.conf` — proxies `/api/*` to the api container; the app talks to the API via relative URLs.

The frontend bundle is **built into the image** (`RUN npm run build`), not served by Vite. Rebuild the `web` service after frontend edits.

## Conventions worth knowing

- **No async ORM.** Everything uses sync SQLAlchemy 2.0 with `Session`. FastAPI routes are `def`, not `async def`, except `uploads.py`/`attachments.py`/`market_data.py` where file IO is async.
- **`/api` prefix** on every router. The nginx config matches that prefix.
- **Account-scoped queries** go through `account_ids: number[] | undefined`. `undefined` = all visible, `[-1]` = explicit "none selected" (returns nothing).
- **No auth** — single user, local-only. CORS is wide open (`*`).
- **Backend times are naive UTC.** The frontend parses them via `parseBackendTime()` (appends `Z`) so the browser doesn't shift them by the local offset.
