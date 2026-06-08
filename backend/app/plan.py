"""Multi-account planning: ETAs, payout forecasts, account-purchase suggestions,
and adaptive playbook suggestions when realized drawdown breaches a user alert.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from . import models
from .prop import _cap_for_payout, _parse_caps
from .services import _current_equity_from_broker_or_trades


def _account_recent_avg(trades, n_days=10):
    if not trades:
        return 0.0
    by_day = defaultdict(float)
    for t in trades:
        by_day[t.exit_time.date()] += t.net_pnl
    days = sorted(by_day.keys())[-n_days:]
    if not days:
        return 0.0
    return sum(by_day[d] for d in days) / len(days)


def compute_account_etas(db: Session, accounts: list[models.Account]) -> list[dict]:
    out = []
    today = datetime.utcnow()
    for a in accounts:
        trades = (
            db.query(models.Trade).filter_by(account_id=a.id).order_by(models.Trade.exit_time).all()
        )
        payouts = db.query(models.Payout).filter_by(account_id=a.id).all()
        realized = sum(t.net_pnl for t in trades)
        total_paid = sum(p.amount for p in payouts)
        current_equity = _current_equity_from_broker_or_trades(a, realized, total_paid)
        uses_broker = a.broker_balance is not None
        avg = _account_recent_avg(trades)
        blocked = None

        if a.status == "blown":
            blocked = "Account blown"

        # Eval → funded ETA: distance to profit target.
        days_to_funded: Optional[int] = None
        eta_funded: Optional[datetime] = None
        if a.account_type in ("eval", "personal") and a.profit_target > 0 and not blocked:
            target_equity = a.starting_balance + a.profit_target
            need = target_equity - current_equity
            if need <= 0:
                days_to_funded = 0
                eta_funded = today
            elif avg > 0:
                days_to_funded = int(need / avg) + 1
                eta_funded = today + timedelta(days=days_to_funded)

        # Funded → payout ETAs.
        caps = _parse_caps(a.payout_caps)
        next_n = len(payouts) + 1
        max_for_next = _cap_for_payout(caps, next_n) if caps else 0.0
        safety_net_balance = (
            a.starting_balance + (a.starting_balance_offset or 0)
            + (a.safety_net_amount or 0) + (a.extra_safety_buffer or 0)
        )

        days_to_min: Optional[int] = None
        eta_min: Optional[datetime] = None
        days_to_max: Optional[int] = None
        eta_max: Optional[datetime] = None
        min_amount = a.payout_min or 0
        max_amount = max_for_next

        if a.account_type in ("pa", "funded") and not blocked:
            need_min = (safety_net_balance + min_amount) - current_equity
            need_max = (safety_net_balance + max_amount) - current_equity
            if avg > 0:
                if need_min <= 0:
                    days_to_min = 0
                    eta_min = today
                else:
                    days_to_min = int(need_min / avg) + 1
                    eta_min = today + timedelta(days=days_to_min)
                if need_max <= 0:
                    days_to_max = 0
                    eta_max = today
                else:
                    days_to_max = int(need_max / avg) + 1
                    eta_max = today + timedelta(days=days_to_max)
            # Respect the min-trading-days constraint.
            trading_days_used = len({t.exit_time.date() for t in trades})
            min_days_needed = max(0, (a.min_trading_days_before_payout or 0) - trading_days_used)
            if min_days_needed > 0:
                if days_to_min is not None:
                    days_to_min = max(days_to_min, min_days_needed)
                    eta_min = today + timedelta(days=days_to_min)
                if days_to_max is not None:
                    days_to_max = max(days_to_max, min_days_needed)
                    eta_max = today + timedelta(days=days_to_max)

        out.append({
            "account_id": a.id,
            "display_name": a.display_name,
            "prop_firm": a.prop_firm,
            "account_type": a.account_type or "personal",
            "status": a.status or "active",
            "current_equity": round(current_equity, 2),
            "uses_broker_balance": uses_broker,
            "days_to_funded": days_to_funded,
            "eta_funded_date": eta_funded,
            "days_to_min_payout": days_to_min,
            "eta_min_payout_date": eta_min,
            "min_payout_amount": min_amount,
            "days_to_max_payout": days_to_max,
            "eta_max_payout_date": eta_max,
            "max_payout_amount": max_amount,
            "recent_avg_daily_pnl": round(avg, 2),
            "blocked_reason": blocked,
        })
    return out


def compute_payout_forecast(db: Session, accounts: list[models.Account]) -> dict:
    """Project predicted payouts forward over the next 6 months, bucketed."""
    today = datetime.utcnow()
    horizon_days = 180
    all_predicted: list[dict] = []

    for a in accounts:
        if a.status == "blown" or a.account_type not in ("pa", "funded"):
            continue
        trades = (
            db.query(models.Trade).filter_by(account_id=a.id).order_by(models.Trade.exit_time).all()
        )
        payouts = (
            db.query(models.Payout).filter_by(account_id=a.id).order_by(models.Payout.payout_date).all()
        )
        if not trades:
            continue
        avg = _account_recent_avg(trades)
        if avg <= 0:
            continue

        caps = _parse_caps(a.payout_caps)
        safety_net_balance = (
            a.starting_balance + (a.starting_balance_offset or 0)
            + (a.safety_net_amount or 0) + (a.extra_safety_buffer or 0)
        )
        realized = sum(t.net_pnl for t in trades)
        total_paid = sum(p.amount for p in payouts)
        cur_eq = _current_equity_from_broker_or_trades(a, realized, total_paid)

        n_payouts = len(payouts)
        last_payout_dt = payouts[-1].payout_date if payouts else None
        trading_days_used = len({t.exit_time.date() for t in trades})
        eq = cur_eq
        cursor = today
        for _ in range(20):  # cap at 20 future payouts per account
            n = n_payouts + 1
            if a.max_payouts and n > a.max_payouts:
                break
            cap = _cap_for_payout(caps, n) if caps else 0.0
            if a.payout_preference == "min":
                amount = a.payout_min or 0
            elif a.payout_preference == "custom" and a.payout_preference_amount > 0:
                amount = a.payout_preference_amount
            else:
                amount = cap
            amount = max(a.payout_min or 0, min(amount, cap if cap > 0 else amount))
            if amount <= 0:
                break
            needed_equity = safety_net_balance + amount
            need = needed_equity - eq
            days = max(1, int(need / avg) + 1) if need > 0 else 1
            min_trading_days_remaining = max(0, (a.min_trading_days_before_payout or 0) - trading_days_used)
            days = max(days, min_trading_days_remaining)
            if last_payout_dt and (a.min_days_between_payouts or 0) > 0:
                since = (cursor - last_payout_dt).days
                gap_needed = max(0, (a.min_days_between_payouts or 0) - since)
                days = max(days, gap_needed)
            cursor = cursor + timedelta(days=days)
            if (cursor - today).days > horizon_days:
                break
            eq = eq + days * avg - amount
            all_predicted.append({
                "account_id": a.id,
                "account_name": a.display_name,
                "predicted_date": cursor,
                "amount": round(amount, 2),
                "payout_number": n,
            })
            n_payouts += 1
            trading_days_used += days
            last_payout_dt = cursor

    windows = [
        ("Next 1 week", timedelta(weeks=1)),
        ("Next 2 weeks", timedelta(weeks=2)),
        ("Next 3 weeks", timedelta(weeks=3)),
        ("Next 4 weeks", timedelta(weeks=4)),
        ("Next 2 months", timedelta(days=60)),
        ("Next 3 months", timedelta(days=90)),
        ("Next 4 months", timedelta(days=120)),
        ("Next 5 months", timedelta(days=150)),
        ("Next 6 months", timedelta(days=180)),
    ]
    buckets = []
    for label, delta in windows:
        end = today + delta
        items = [p for p in all_predicted if p["predicted_date"] <= end]
        buckets.append({
            "label": label,
            "end_date": end,
            "payouts": items,
            "total": round(sum(p["amount"] for p in items), 2),
        })
    return {
        "buckets": buckets,
        "total_next_6_months": round(
            sum(p["amount"] for p in all_predicted if (p["predicted_date"] - today).days <= 180), 2
        ),
        "all_predicted": all_predicted,
    }


def suggest_stricter_playbook(playbook: Optional[models.TradingPlaybook], dd_severity_pct: float) -> dict:
    """Given the current playbook and how deep into the DD alert (0..1.5), propose a
    tighter setup: fewer contracts, tighter stop/target."""
    if not playbook or dd_severity_pct <= 0:
        return {
            "triggered": False, "reason": None, "current": None,
            "suggested_contracts": None, "suggested_stop_ticks": None,
            "suggested_target_ticks": None, "explanation": None,
        }

    sev = min(1.5, max(0.0, dd_severity_pct))  # 1.0 = at threshold, 1.5 = 50% past
    new_contracts = max(1, int(playbook.contracts * max(0.25, 1 - sev * 0.5)))
    new_target = max(playbook.stop_ticks * 2, int(playbook.target_ticks * (1 - sev * 0.2)))
    new_stop = max(5, int(playbook.stop_ticks * max(0.7, 1 - sev * 0.1)))

    new_rr = (new_target / new_stop) if new_stop else 0
    explanation = (
        f"Drawdown {dd_severity_pct*100:.0f}% of your alert threshold. "
        f"Halving contracts and tightening to {new_stop}/{new_target} ticks "
        f"({new_rr:.2f}R) cuts $-risk per trade ~{(1 - new_contracts/playbook.contracts)*100:.0f}% "
        f"while keeping a workable reward ratio."
    )
    return {
        "triggered": True,
        "reason": f"Realized DD breached alert threshold ({dd_severity_pct*100:.0f}% of limit)",
        "current": playbook,
        "suggested_contracts": new_contracts,
        "suggested_stop_ticks": new_stop,
        "suggested_target_ticks": new_target,
        "explanation": explanation,
    }


def compute_plan_summary(db: Session) -> dict:
    settings = db.query(models.UserSettings).first()
    if settings is None:
        settings = models.UserSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    accounts = db.query(models.Account).all()
    etas = compute_account_etas(db, accounts)

    pa_playbook = db.get(models.TradingPlaybook, settings.pa_playbook_id) if settings.pa_playbook_id else None
    eval_playbook = db.get(models.TradingPlaybook, settings.eval_playbook_id) if settings.eval_playbook_id else None

    # Aggregate today's drawdown across all active prop accounts.
    today = datetime.utcnow().date()
    agg_today = 0.0
    for a in accounts:
        if a.status == "blown" or a.account_type == "personal":
            continue
        today_trades = db.query(models.Trade).filter_by(account_id=a.id).all()
        agg_today += sum(t.net_pnl for t in today_trades if t.exit_time.date() == today)

    breached = False
    dd_severity = 0.0
    if settings.dd_alert_threshold and settings.dd_alert_threshold < 0 and agg_today < 0:
        dd_severity = min(1.5, abs(agg_today) / abs(settings.dd_alert_threshold))
        breached = abs(agg_today) >= abs(settings.dd_alert_threshold)

    stricter_pa = suggest_stricter_playbook(pa_playbook, dd_severity if breached else 0.0)
    stricter_eval = suggest_stricter_playbook(eval_playbook, dd_severity if breached else 0.0)

    funded_count = sum(1 for a in accounts if a.account_type in ("pa", "funded") and a.status != "blown")
    needed = max(0, (settings.target_pa_count or 0) - funded_count)
    purchase_sug = _suggest_account_purchase(db, settings, needed, accounts)

    return {
        "settings": settings,
        "etas": etas,
        "purchase_suggestion": purchase_sug,
        "stricter_pa_suggestion": stricter_pa,
        "stricter_eval_suggestion": stricter_eval,
        "pa_playbook": pa_playbook,
        "eval_playbook": eval_playbook,
        "aggregate_dd_today": round(agg_today, 2),
        "dd_alert_breached": breached,
    }


def _suggest_account_purchase(
    db: Session, settings: models.UserSettings, needed: int, accounts: list[models.Account]
) -> dict:
    """Suggest when the user could afford the next eval, given recent payout cadence."""
    notes: list[str] = []
    plan_cost = 0.0
    plan_activation = 0.0
    if settings.preferred_firm_key and settings.preferred_plan_key:
        firm = db.query(models.PropFirmDef).filter_by(key=settings.preferred_firm_key).first()
        if firm:
            plan = (
                db.query(models.PropFirmPlanDef)
                .filter_by(firm_id=firm.id, key=settings.preferred_plan_key)
                .first()
            )
            if plan:
                plan_cost = plan.eval_cost_monthly
                plan_activation = plan.activation_fee

    payouts = db.query(models.Payout).all()
    costs = db.query(models.AccountCost).all()
    total_payouts = sum(p.amount for p in payouts)
    total_costs = sum(c.amount for c in costs)
    net_real = total_payouts - total_costs
    monthly_recurring_after = (plan_cost or 0) + (settings.monthly_budget or 0)

    affordable_now = 0
    if plan_cost or plan_activation:
        room = settings.monthly_budget or 0
        if room >= (plan_cost + plan_activation):
            affordable_now = int(room / (plan_cost + plan_activation))

    next_purchase = None
    if needed > 0 and plan_cost > 0:
        deficit = (plan_cost + plan_activation) - max(0.0, settings.monthly_budget or 0)
        if deficit <= 0:
            next_purchase = datetime.utcnow()
            notes.append("You can afford the next account from your monthly budget alone.")
        else:
            if payouts and len(payouts) >= 1:
                first = min(p.payout_date for p in payouts)
                spread = max(1, (datetime.utcnow() - first).days)
                rate_per_day = total_payouts / spread
                if rate_per_day > 0:
                    days = int(deficit / rate_per_day)
                    next_purchase = datetime.utcnow() + timedelta(days=days)
                    notes.append(
                        f"Based on payout rate ${rate_per_day:.2f}/day, ~{days} days until next eval is affordable."
                    )
            else:
                notes.append("No payout history yet — predictions improve once you take a payout.")
    elif needed == 0:
        notes.append(f"Target reached — you already have {(settings.target_pa_count or 0)} funded accounts.")
    if not (settings.preferred_firm_key and settings.preferred_plan_key):
        notes.append("Set a preferred firm/plan in Settings to get cost-aware purchase suggestions.")

    return {
        "needed": needed,
        "affordable_now": affordable_now,
        "next_purchase_date": next_purchase,
        "suggested_firm_key": settings.preferred_firm_key,
        "suggested_plan_key": settings.preferred_plan_key,
        "monthly_recurring_after": round(monthly_recurring_after, 2),
        "notes": notes,
    }
