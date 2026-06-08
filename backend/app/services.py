"""Higher-level operations shared across routers: account creation/classification,
preset application, cost expansion, trade rebuilding, and lifecycle evaluation.
"""
from __future__ import annotations

import json as _json
import os
import re
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .matching import match_executions_to_trades
from .parser import ParsedFill


# ---------- Cost expansion ----------
def monthly_cycles_elapsed(
    start: datetime, now: Optional[datetime] = None, end_cap: Optional[datetime] = None
) -> int:
    """Monthly billing cycles fired since `start` up to min(now, end_cap). The
    start date itself counts as cycle #1.

    e.g. start=2026-01-15, now=2026-05-21 → Jan/Feb/Mar/Apr/May 15 → 5.
    """
    if now is None:
        now = datetime.utcnow()
    cutoff = now if end_cap is None else min(now, end_cap)
    if cutoff < start:
        return 0
    months = (cutoff.year - start.year) * 12 + (cutoff.month - start.month)
    if cutoff.day < start.day:
        months -= 1
    return max(0, months + 1)


def expand_cost_amount(cost) -> float:
    """Real money spent on this cost row so far: ``amount × cycles`` for recurring
    costs, otherwise just ``amount``."""
    if not getattr(cost, "is_recurring", False):
        return cost.amount
    cycles = monthly_cycles_elapsed(cost.cost_date, end_cap=cost.recurring_end_date)
    return cost.amount * cycles


# ---------- Account classification & naming ----------
_SIZE_RE = re.compile(r"(\d+\s*K)", re.IGNORECASE)
# 1) Explicit type prefix:  PA-APEX-123456-10 / EVAL-APEX-... / FUNDED-...
# 2) Firm-as-prefix (Apex marks evals just as APEX-...):  APEX-123456-10
_EXTID_RE = re.compile(
    r"^(?:(?P<type>PA|EVAL|FUNDED|TCP)[-_])?(?P<firm>[A-Z]+)[-_](?P<user>\d+)[-_](?P<suffix>\d+)$",
    re.IGNORECASE,
)
# Lucid Flex: LFE050-XXXXXXXX-TEST001 — size in prefix, alphanumeric user code,
# suffix word carries the type (TEST=eval, PA=funded, etc.).
_LUCID_FLEX_RE = re.compile(
    r"^(?:(?P<type>PA|EVAL|FUNDED|TCP)[-_])?LFE(?P<size>\d+)[-_](?P<user>[A-Z0-9]+)[-_]"
    r"(?P<suffix_word>TEST|PA|EVAL|FUNDED)(?P<suffix>\d+)$",
    re.IGNORECASE,
)
# Tradeify: tradeify-TDFYG25xxxxxxxxxx. Letter after TDFY is program code
# (G=Growth, S=Select, L=Lightning), then size (25/50/100/150), then account id.
_TRADEIFY_RE = re.compile(
    # Longest size alternative first so "TDFYG150..." picks 150, not 15.
    r"^(?:(?P<type>PA|EVAL|FUNDED)[-_])?tradeify[-_]TDFY(?P<prog>[A-Z])(?P<size>150|100|50|25)(?P<userid>\d+)$",
    re.IGNORECASE,
)
_TRADEIFY_PROGRAMS = {"G": "Growth", "S": "Select", "L": "Lightning"}
_KNOWN_FIRMS = {"APEX", "TOPSTEP", "TPT", "LUCID", "MFFU", "BULENOX", "EARN2TRADE"}


def _lucid_flex_type(m: re.Match) -> str:
    """account_type from a Lucid Flex match: explicit prefix wins, else the suffix word."""
    t = (m.group("type") or "").upper()
    if t in ("PA", "TCP"):
        return "pa"
    if t == "EVAL":
        return "eval"
    if t == "FUNDED":
        return "funded"
    word = m.group("suffix_word").upper()
    if word in ("TEST", "EVAL"):
        return "eval"
    if word == "PA":
        return "pa"
    if word == "FUNDED":
        return "funded"
    return "eval"


def detect_account_type(external_id: str) -> str:
    """Infer account_type from the external_id prefix.

    PA-* → 'pa', EVAL-* → 'eval', FUNDED-* → 'funded'. Known firms with no
    explicit type prefix (APEX-, TOPSTEP-, ...) default to 'eval'. Anything
    unrecognized is 'personal'.
    """
    if not external_id:
        return "personal"
    ext = external_id.strip()
    m = _LUCID_FLEX_RE.match(ext)
    if m:
        return _lucid_flex_type(m)
    m = _TRADEIFY_RE.match(ext)
    if m:
        t = (m.group("type") or "").upper()
        if t == "PA":
            return "pa"
        if t == "FUNDED":
            return "funded"
        if t == "EVAL":
            return "eval"
        return "eval"  # Tradeify accounts arrive during evaluation by default
    m = _EXTID_RE.match(ext)
    if not m:
        return "personal"
    t = (m.group("type") or "").upper()
    firm = m.group("firm").upper()
    if t == "PA":
        return "pa"
    if t == "EVAL":
        return "eval"
    if t == "FUNDED":
        return "funded"
    if t == "TCP":
        return "pa"
    if not t and firm in _KNOWN_FIRMS:
        return "eval"
    return "personal"


def friendly_account_name(
    external_id: str, plan_label: Optional[str] = None, firm_label: Optional[str] = None
) -> Optional[str]:
    """PA-APEX-123456-10 → 'Apex 50K PA-10' (or 'Apex 50K EVAL-10' for evals)
    when plan info is available. Returns None if the external_id can't be parsed."""
    if not external_id:
        return None
    ext = external_id.strip()

    lfe = _LUCID_FLEX_RE.match(ext)
    if lfe:
        size_digits = lfe.group("size").lstrip("0") or "0"
        suffix_num = str(int(lfe.group("suffix")))
        t = (lfe.group("type") or "").upper()
        if not t:
            word = lfe.group("suffix_word").upper()
            t = "EVAL" if word == "TEST" else word
        firm_name = firm_label or "Lucid"
        firm_name = re.sub(r"\s*\([^)]+\)\s*", "", firm_name)
        firm_name = re.sub(r"\s+(Trader Funding|Trading|Trader|Funding)$", "", firm_name, flags=re.I).strip()
        return f"{firm_name} {size_digits}K {t}-{suffix_num}"

    tdf = _TRADEIFY_RE.match(ext)
    if tdf:
        prog = _TRADEIFY_PROGRAMS.get(tdf.group("prog").upper(), tdf.group("prog").upper())
        size = tdf.group("size")
        tail = tdf.group("userid")[-5:]  # last 5 digits disambiguate same-size accounts
        firm_name = firm_label or "Tradeify"
        return f"{firm_name} {size}K {prog}-{tail}"

    m = _EXTID_RE.match(ext)
    if not m:
        return None
    type_part = (m.group("type") or "").upper()
    firm_part = m.group("firm").upper()
    suffix = m.group("suffix")
    if not type_part and firm_part in _KNOWN_FIRMS:
        type_part = "EVAL"

    firm_name = firm_label or firm_part.title()
    firm_name = re.sub(r"\s*\([^)]+\)\s*", "", firm_name)
    firm_name = re.sub(r"\s+(Trader Funding|Trading|Trader|Funding)$", "", firm_name, flags=re.I).strip()

    size = ""
    if plan_label:
        sm = _SIZE_RE.search(plan_label)
        if sm:
            size = sm.group(1).upper().replace(" ", "")

    return f"{firm_name} {size} {type_part}-{suffix}".replace("  ", " ").strip()


def get_or_create_account(db: Session, external_id: str) -> models.Account:
    acct = db.query(models.Account).filter_by(external_id=external_id).first()
    if acct:
        return acct
    acct = models.Account(
        external_id=external_id,
        display_name=external_id,
        broker="Sierra Chart",
        account_type=detect_account_type(external_id),
    )
    db.add(acct)
    db.flush()
    # Apply the user's default-for-new-imports preset if configured.
    settings = db.query(models.UserSettings).first()
    if settings and settings.preferred_firm_key and settings.preferred_plan_key:
        firm = db.query(models.PropFirmDef).filter_by(key=settings.preferred_firm_key).first()
        if firm:
            plan = (
                db.query(models.PropFirmPlanDef)
                .filter_by(firm_id=firm.id, key=settings.preferred_plan_key)
                .first()
            )
            if plan:
                apply_preset_to_account(acct, firm, plan)
                db.flush()
    return acct


def apply_preset_to_account(acct: models.Account, firm, plan) -> None:
    """Copy a (firm, plan) preset onto `acct` in place. Caller commits."""
    dd_mode = plan.drawdown_mode_override or firm.default_drawdown_mode
    detected_type = detect_account_type(acct.external_id)
    acct.prop_firm_key = firm.key
    acct.prop_firm_plan_key = plan.key
    acct.prop_firm = firm.label
    acct.account_type = detected_type if detected_type != "personal" else (acct.account_type or "pa")
    # Only overwrite starting_balance when the plan carries a real size. Personal
    # presets (e.g. Tradovate) use account_size=0 so the user keeps their balance.
    if plan.account_size and plan.account_size > 0:
        acct.starting_balance = plan.account_size
    acct.profit_target = plan.profit_target
    acct.max_drawdown = plan.max_drawdown
    acct.drawdown_mode = dd_mode
    acct.trailing_drawdown_cap = plan.max_drawdown if dd_mode in ("trailing_realtime", "trailing_eod") else 0.0
    acct.safety_net_amount = plan.safety_net_amount
    acct.payout_min = firm.default_payout_min
    acct.payout_caps = plan.payout_caps
    acct.max_payouts = plan.max_payouts or 0
    acct.min_trading_days_before_payout = firm.default_min_trading_days_before_payout
    acct.consistency_rule_pct = firm.default_consistency_rule_pct
    acct.contracts_micro_max = plan.contracts_micro or 0
    acct.contracts_mini_max = plan.contracts_mini or 0
    # Regenerate display name only if it's still the raw id / firm stem / prior auto-name.
    auto = friendly_account_name(acct.external_id, plan.label, firm.label)
    if auto and (
        acct.display_name == acct.external_id
        or acct.display_name.startswith(firm.label)
        or acct.display_name == auto
    ):
        acct.display_name = auto


# ---------- Lifecycle / drawdown ----------
def _current_equity_from_broker_or_trades(
    acct: models.Account, realized_pnl: float, total_payouts: float
) -> float:
    if acct.broker_balance is not None:
        return acct.broker_balance
    return (
        (acct.starting_balance or 0)
        + (acct.starting_balance_offset or 0)
        + realized_pnl
        - total_payouts
    )


def detect_blown(
    db: Session, acct: models.Account
) -> tuple[bool, Optional[datetime], Optional[str]]:
    """Walk the account's equity history; return (blown, when, reason) if it ever
    breached the DD floor under its drawdown_mode. (False, None, None) otherwise."""
    if (acct.max_drawdown or 0) <= 0:
        return False, None, None
    trades = (
        db.query(models.Trade).filter_by(account_id=acct.id).order_by(models.Trade.exit_time).all()
    )
    payouts = (
        db.query(models.Payout).filter_by(account_id=acct.id).order_by(models.Payout.payout_date).all()
    )
    events: list[tuple[datetime, float]] = []
    for t in trades:
        events.append((t.exit_time, t.net_pnl))
    for p in payouts:
        events.append((p.payout_date, -p.amount))
    events.sort(key=lambda x: x[0])
    if not events:
        return False, None, None

    starting = acct.starting_balance or 0
    mode = acct.drawdown_mode or "none"
    dd = acct.max_drawdown
    cap_offset = acct.trailing_drawdown_cap if (acct.trailing_drawdown_cap or 0) > 0 else dd

    equity = starting
    trailing_peak = starting
    eod_peak = starting
    last_day = None

    for ts, delta in events:
        equity += delta

        if mode == "static":
            floor = starting - dd
        elif mode == "trailing_realtime":
            if equity > trailing_peak:
                trailing_peak = min(equity, starting + cap_offset)
            floor = trailing_peak - dd
        elif mode == "trailing_eod":
            if last_day is not None and ts.date() != last_day:
                eod_peak = max(eod_peak, equity)
                if cap_offset and eod_peak > starting + cap_offset:
                    eod_peak = starting + cap_offset
            floor = eod_peak - dd
            last_day = ts.date()
        else:
            return False, None, None

        if equity < floor - 0.01:
            return True, ts, "trailing_dd" if "trailing" in mode else "static_dd"
    return False, None, None


def evaluate_account_lifecycle(
    db: Session, acct: models.Account, realized_pnl: float, total_payouts: float
) -> bool:
    """Auto-flip acct.status across active ↔ blown ↔ funded. Broker balance is
    authoritative when set (an auto-blown is retracted if the broker is above
    starting). Skips 'closed'. Returns True if the status changed."""
    if acct.status == "closed":
        return False
    starting = acct.starting_balance or 0
    current_equity = _current_equity_from_broker_or_trades(acct, realized_pnl, total_payouts)

    # 1) Blow detection walks the event history.
    blown, blown_at, reason = detect_blown(db, acct)

    # Broker above starting retracts an auto-blow.
    if acct.broker_balance is not None and (acct.max_drawdown or 0) > 0:
        if blown and acct.broker_balance > starting:
            if acct.broker_balance >= (acct.starting_balance + (acct.starting_balance_offset or 0)):
                blown = False
                blown_at = None
                reason = None

    if blown and acct.status not in ("blown", "closed"):
        acct.status = "blown"
        if not acct.blown_date:
            acct.blown_date = blown_at
            acct.blow_reason = reason
        return True
    elif (not blown) and acct.status == "blown" and acct.blow_reason in ("trailing_dd", "static_dd"):
        # Retract a previously auto-set blow when the broker disagrees.
        acct.status = "active"
        acct.blown_date = None
        acct.blow_reason = None
        return True

    # 2) Target hit → funded.
    target = acct.profit_target or 0
    if target <= 0:
        return False
    if current_equity >= starting + target and acct.status == "active":
        acct.status = "funded"
        if not acct.passed_eval_date:
            acct.passed_eval_date = datetime.utcnow()
        return True
    return False


# ---------- Execution insert + trade rebuild ----------
def insert_executions(
    db: Session, fills: list[ParsedFill], batch: models.UploadBatch
) -> tuple[int, int, set[int]]:
    """Insert fills, skipping duplicates by (account_id, fill_id). Returns
    (inserted, skipped, touched_account_ids)."""
    accounts_cache: dict[str, models.Account] = {}
    touched: set[int] = set()
    existing_keys: set[tuple[int, str]] = set()

    account_ids_in_batch: dict[str, int] = {}
    for f in fills:
        if f.account_external_id not in accounts_cache:
            accounts_cache[f.account_external_id] = get_or_create_account(db, f.account_external_id)
        account_ids_in_batch[f.account_external_id] = accounts_cache[f.account_external_id].id

    if account_ids_in_batch:
        rows = db.execute(
            select(models.Execution.account_id, models.Execution.fill_id).where(
                models.Execution.account_id.in_(account_ids_in_batch.values())
            )
        ).all()
        existing_keys = {(r[0], r[1]) for r in rows}

    inserted = 0
    skipped = 0
    for f in fills:
        acct = accounts_cache[f.account_external_id]
        if (acct.id, f.fill_id) in existing_keys:
            skipped += 1
            continue
        ex = models.Execution(
            account_id=acct.id,
            upload_batch_id=batch.id,
            fill_id=f.fill_id,
            internal_order_id=f.internal_order_id,
            service_order_id=f.service_order_id,
            parent_internal_order_id=f.parent_internal_order_id,
            fill_time=f.fill_time,
            symbol=f.symbol,
            instrument_root=f.instrument_root,
            side=f.side,
            quantity=f.quantity,
            fill_price=f.fill_price,
            raw_price=f.raw_price,
            order_type=f.order_type,
            open_close=f.open_close,
            position_after=f.position_after,
            high_during_position=f.high_during_position,
            low_during_position=f.low_during_position,
            note=f.note,
            is_automated=f.is_automated,
        )
        db.add(ex)
        existing_keys.add((acct.id, f.fill_id))
        inserted += 1
        touched.add(acct.id)
    db.flush()
    return inserted, skipped, touched


def _refresh_status(db: Session, account: models.Account) -> None:
    """Recompute account lifecycle after trades change."""
    realized = (
        db.query(models.Trade)
        .filter_by(account_id=account.id)
        .with_entities(models.Trade.net_pnl)
        .all()
    )
    pnl = sum(r[0] for r in realized)
    paid = sum(p.amount for p in db.query(models.Payout).filter_by(account_id=account.id).all())
    evaluate_account_lifecycle(db, account, pnl, paid)


def rebuild_trades_for_account(db: Session, account: models.Account) -> int:
    """Delete and rebuild all trades for an account from its raw executions.
    Single source of truth — call after editing commissions/fees. Returns count."""
    db.query(models.Execution).filter_by(account_id=account.id).update(
        {models.Execution.trade_id: None}, synchronize_session=False
    )
    db.query(models.Trade).filter_by(account_id=account.id).delete(synchronize_session=False)
    db.flush()

    execs = (
        db.query(models.Execution)
        .filter_by(account_id=account.id)
        .order_by(models.Execution.fill_time, models.Execution.id)
        .all()
    )
    if not execs:
        return 0

    settings = db.query(models.UserSettings).first()
    tz_name = (settings.timezone if settings else None) or "UTC"
    date_by = (settings.date_by if settings else None) or "exit"
    rate_table = None
    if account.commission_rates:
        try:
            rate_table = _json.loads(account.commission_rates)
        except (ValueError, TypeError):
            rate_table = None

    results = match_executions_to_trades(
        execs,
        account_id=account.id,
        commission_per_side=account.commission_per_side or 0.0,
        fees_per_side=account.fees_per_side or 0.0,
        tz_name=tz_name,
        date_by=date_by,
        rate_table=rate_table,
    )
    count = 0
    for trade, exec_ids in results:
        db.add(trade)
        db.flush()  # populate trade.id
        if exec_ids:
            db.query(models.Execution).filter(models.Execution.id.in_(exec_ids)).update(
                {models.Execution.trade_id: trade.id}, synchronize_session=False
            )
        count += 1
    db.flush()
    _refresh_status(db, account)
    return count


def store_upload(upload_dir: str, filename: str, content: bytes) -> tuple[str, str]:
    os.makedirs(upload_dir, exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    safe = filename.replace("/", "_").replace("\\", "_")
    stored_name = f"{stamp}__{safe}"
    path = os.path.join(upload_dir, stored_name)
    with open(path, "wb") as f:
        f.write(content)
    return stored_name, path
