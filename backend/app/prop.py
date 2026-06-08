"""Prop firm rule tracking: drawdown floors, profit targets, payout prediction,
consistency rule (e.g. Apex 30%), payout-number-aware caps, blow detection, and
real-money economics (compute_economics).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from . import models
from .schemas import PropStatus


def _parse_caps(s: Optional[str]) -> list[float]:
    if not s:
        return []
    out = []
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            out.append(float(part))
        except ValueError:
            continue
    return out


def _cap_for_payout(caps: list[float], n: int) -> float:
    """Cap for payout #n (1-indexed). The last cap applies to all later payouts."""
    if not caps:
        return 0.0
    return caps[min(n - 1, len(caps) - 1)]


def compute_prop_status(db: Session, account: models.Account) -> PropStatus:
    trades = (
        db.query(models.Trade)
        .filter_by(account_id=account.id)
        .order_by(models.Trade.exit_time)
        .all()
    )
    payouts = (
        db.query(models.Payout)
        .filter_by(account_id=account.id)
        .order_by(models.Payout.payout_date)
        .all()
    )

    total_payouts = sum(p.amount for p in payouts)
    realized_pnl = sum(t.net_pnl for t in trades)
    computed_equity = (
        account.starting_balance + (account.starting_balance_offset or 0)
        + realized_pnl - total_payouts
    )
    # Broker balance is authoritative when set.
    if account.broker_balance is not None:
        current_equity = float(account.broker_balance)
    else:
        current_equity = computed_equity

    # Walk equity over time to find HWM / trailing peak.
    equity_timeline: list[tuple[datetime, float]] = []
    e = account.starting_balance
    events: list[tuple[datetime, str, float]] = []
    for t in trades:
        events.append((t.exit_time, "trade", t.net_pnl))
    for p in payouts:
        events.append((p.payout_date, "payout", -p.amount))
    events.sort(key=lambda x: x[0])

    high_water = account.starting_balance
    trailing_peak = account.starting_balance
    # trailing_drawdown_cap is the offset from starting that caps the peak (Apex:
    # the peak locks once equity hits starting + max_drawdown).
    cap_offset = account.trailing_drawdown_cap if account.trailing_drawdown_cap > 0 else account.max_drawdown
    trailing_cap = (
        account.starting_balance + cap_offset if account.drawdown_mode == "trailing_realtime" else None
    )

    blown = False
    blown_date_detected: Optional[datetime] = None
    blow_reason_detected: Optional[str] = None

    for ts, kind, delta in events:
        e += delta
        equity_timeline.append((ts, e))
        if e > high_water:
            high_water = e
        if account.drawdown_mode == "trailing_realtime":
            if e > trailing_peak:
                trailing_peak = e
                if trailing_cap is not None and trailing_peak > trailing_cap:
                    trailing_peak = trailing_cap

    # Drawdown floor by mode.
    if account.drawdown_mode == "static" and account.max_drawdown > 0:
        drawdown_floor = account.starting_balance - account.max_drawdown
    elif account.drawdown_mode == "trailing_eod" and account.max_drawdown > 0:
        by_day = {}
        for ts, eq in equity_timeline:
            by_day[ts.date().isoformat()] = eq
        eod_peak = max([account.starting_balance, *by_day.values()])
        if account.trailing_drawdown_cap > 0:
            eod_peak = min(eod_peak, account.starting_balance + account.trailing_drawdown_cap)
        drawdown_floor = eod_peak - account.max_drawdown
    elif account.drawdown_mode == "trailing_realtime" and account.max_drawdown > 0:
        # Honor a broker-reported peak higher than our trades imply.
        effective_peak = trailing_peak
        if account.broker_high_water_mark and account.broker_high_water_mark > effective_peak:
            effective_peak = account.broker_high_water_mark
            if trailing_cap is not None and effective_peak > trailing_cap:
                effective_peak = trailing_cap
        drawdown_floor = effective_peak - account.max_drawdown
    else:
        drawdown_floor = current_equity - 1e12

    distance_to_drawdown = current_equity - drawdown_floor
    drawdown_used_pct = 0.0
    if account.max_drawdown > 0:
        used = max(0.0, account.max_drawdown - distance_to_drawdown)
        drawdown_used_pct = min(1.0, used / account.max_drawdown)
    if account.max_drawdown > 0:
        for ts, eq in equity_timeline:
            if eq < drawdown_floor - 0.01:
                blown = True
                blown_date_detected = ts
                blow_reason_detected = "trailing_dd"
                break

    # Broker above the floor overrides a trade-derived blow.
    if blown and account.broker_balance is not None:
        if account.max_drawdown > 0 and account.broker_balance > drawdown_floor + 0.01:
            blown = False
            blown_date_detected = None
            blow_reason_detected = None
    if blown and account.status not in ("blown", "closed"):
        account.status = "blown"
        if not account.blown_date:
            account.blown_date = blown_date_detected
            account.blow_reason = blow_reason_detected
        db.flush()
    elif not blown and account.status == "blown" and account.broker_balance is not None:
        if account.blow_reason in ("trailing_dd", "static_dd"):
            account.status = "active"
            account.blown_date = None
            account.blow_reason = None
            db.flush()

    # Profit target.
    target_equity = account.starting_balance + (account.profit_target or 0.0)
    distance_to_target = target_equity - current_equity
    target_reached = (account.profit_target or 0.0) > 0 and current_equity >= target_equity

    # Daily P&L today.
    today = datetime.utcnow().date()
    daily_pnl_today = sum(t.net_pnl for t in trades if t.exit_time.date() == today)
    distance_to_daily_loss = (
        account.max_loss_per_day + daily_pnl_today if account.max_loss_per_day > 0 else 0.0
    )

    # Payout state.
    payouts_taken = len(payouts)
    next_n = payouts_taken + 1
    caps = _parse_caps(account.payout_caps)
    payout_max_for_next = _cap_for_payout(caps, next_n) if caps else 0.0

    # "Final payout" = on the largest/last cap tier; the personal extra buffer is
    # waived there. Regular post-balance: start + safety_net + extra_buffer.
    # Final post-balance: start + safety_net (no extra buffer).
    is_final_payout = bool(caps) and next_n >= len(caps)

    firm_safety_net_balance = account.starting_balance + (account.safety_net_amount or 0.0)
    extra_buffer = account.extra_safety_buffer or 0.0
    required_post_balance = (
        firm_safety_net_balance if is_final_payout else firm_safety_net_balance + extra_buffer
    )
    safety_net_balance = required_post_balance  # back-compat field name
    available_above_safety = current_equity - required_post_balance

    # Next payout amount by preference, hard-clamped to the cap.
    if account.payout_preference == "min":
        target_amount = account.payout_min or 0.0
    elif account.payout_preference == "custom" and account.payout_preference_amount > 0:
        target_amount = account.payout_preference_amount
    else:  # max
        target_amount = payout_max_for_next or 0.0
    payout_amount_for_next = max(
        account.payout_min or 0.0, min(target_amount, payout_max_for_next or target_amount)
    )
    if available_above_safety < (account.payout_min or 0.0):
        payout_amount_for_next = min(payout_amount_for_next, max(0.0, available_above_safety))

    trading_days_used = len({t.exit_time.date() for t in trades})
    last_payout_date = payouts[-1].payout_date if payouts else None
    days_since = (datetime.utcnow() - last_payout_date).days if last_payout_date else None

    # Eligibility.
    eligible = True
    reason: Optional[str] = None
    if account.max_payouts and payouts_taken >= account.max_payouts:
        eligible = False
        reason = f"Max payouts reached ({account.max_payouts})"
    elif blown:
        eligible = False
        reason = "Account blown"
    elif trading_days_used < (account.min_trading_days_before_payout or 0):
        eligible = False
        reason = f"Need {account.min_trading_days_before_payout - trading_days_used} more trading day(s)"
    elif days_since is not None and days_since < (account.min_days_between_payouts or 0):
        eligible = False
        reason = f"{account.min_days_between_payouts - days_since} day(s) until next payout window"
    elif available_above_safety < (account.payout_min or 0.0):
        eligible = False
        reason = f"Need ${(account.payout_min or 0.0) - available_above_safety:.2f} more above safety net"

    distance_to_next_payout = max(0.0, (safety_net_balance + payout_amount_for_next) - current_equity)

    recent_avg, predicted_date, days_needed = _predict_payout_date(
        trades, account, current_equity, safety_net_balance, payout_amount_for_next,
        trading_days_used, last_payout_date,
    )

    # Consistency rule.
    consistency_pct = account.consistency_rule_pct or 0.0
    daily_map_pnl: dict = defaultdict(float)
    for t in trades:
        daily_map_pnl[t.exit_time.date()] += t.net_pnl
    largest_day = max((v for v in daily_map_pnl.values()), default=0.0)
    total_realized_positive = realized_pnl
    largest_pct = (largest_day / total_realized_positive) if total_realized_positive > 0 else 0.0
    consistency_compliant = True
    max_today: Optional[float] = None
    extra_needed: Optional[float] = None
    if consistency_pct > 0 and total_realized_positive > 0:
        consistency_compliant = largest_pct <= consistency_pct
        T_before = sum(v for d, v in daily_map_pnl.items() if d != today)
        # today / (T_before + today) <= pct  →  today <= (pct/(1-pct)) * T_before
        if T_before > 0:
            ratio = consistency_pct / (1 - consistency_pct)
            max_today = max(0.0, ratio * T_before - daily_pnl_today)
        else:
            max_today = 0.0
        if largest_pct > consistency_pct:
            needed_total = largest_day / consistency_pct
            extra_needed = max(0.0, needed_total - total_realized_positive)

    return PropStatus(
        account_id=account.id,
        account_type=account.account_type or "personal",
        prop_firm=account.prop_firm,
        starting_balance=account.starting_balance,
        current_equity=round(current_equity, 2),
        realized_pnl=round(realized_pnl, 2),
        total_payouts=round(total_payouts, 2),
        high_water_mark=round(high_water, 2),
        status=account.status or "active",
        drawdown_mode=account.drawdown_mode or "none",
        drawdown_floor=round(drawdown_floor, 2) if account.max_drawdown > 0 else 0.0,
        distance_to_drawdown=round(distance_to_drawdown, 2) if account.max_drawdown > 0 else 0.0,
        drawdown_used_pct=drawdown_used_pct,
        blown=blown,
        blown_date=account.blown_date,
        blow_reason=account.blow_reason,
        profit_target=account.profit_target or 0.0,
        distance_to_target=round(distance_to_target, 2) if account.profit_target > 0 else 0.0,
        target_reached=target_reached,
        daily_pnl_today=round(daily_pnl_today, 2),
        max_loss_per_day=account.max_loss_per_day or 0.0,
        distance_to_daily_loss=round(distance_to_daily_loss, 2) if account.max_loss_per_day > 0 else 0.0,
        payouts_taken=payouts_taken,
        next_payout_number=next_n,
        max_payouts=account.max_payouts or 0,
        is_final_payout=is_final_payout,
        safety_net_balance=round(safety_net_balance, 2),
        safety_net_amount=account.safety_net_amount or 0.0,
        extra_safety_buffer=account.extra_safety_buffer or 0.0,
        available_above_safety_net=round(available_above_safety, 2),
        payout_preference=account.payout_preference or "max",
        payout_min=account.payout_min or 0.0,
        payout_max_for_next=payout_max_for_next,
        payout_amount_for_next=round(payout_amount_for_next, 2),
        distance_to_next_payout=round(distance_to_next_payout, 2),
        eligible_for_payout=eligible and payout_amount_for_next > 0,
        eligibility_reason=reason,
        trading_days_used=trading_days_used,
        last_payout_date=last_payout_date,
        days_since_last_payout=days_since,
        min_days_between_payouts=account.min_days_between_payouts or 0,
        min_trading_days_before_payout=account.min_trading_days_before_payout or 0,
        predicted_next_payout_date=predicted_date,
        predicted_next_payout_amount=payout_amount_for_next if payout_amount_for_next > 0 else None,
        avg_daily_pnl_recent=round(recent_avg, 2),
        days_needed_for_next=days_needed,
        consistency_rule_pct=consistency_pct,
        largest_day_pnl=round(largest_day, 2),
        largest_day_pct_of_total=largest_pct,
        consistency_compliant=consistency_compliant,
        max_profit_today_to_stay_consistent=(round(max_today, 2) if max_today is not None else None),
        extra_profit_needed_to_fix_consistency=(round(extra_needed, 2) if extra_needed is not None else None),
    )


def _predict_payout_date(
    trades, account, current_equity, safety_net_balance, payout_amount,
    trading_days_used, last_payout_date,
):
    if not trades:
        return 0.0, None, None
    by_day: dict = {}
    for t in trades:
        by_day.setdefault(t.exit_time.date(), 0.0)
        by_day[t.exit_time.date()] += t.net_pnl
    days = sorted(by_day.keys())[-10:]
    if not days:
        return 0.0, None, None
    recent_avg = sum(by_day[d] for d in days) / len(days)

    needed_equity = safety_net_balance + (payout_amount or 0.0)
    needed = needed_equity - current_equity

    days_for_pnl = max(0, int(needed / recent_avg) + 1) if recent_avg > 0 else None
    days_for_min_trading = max(0, (account.min_trading_days_before_payout or 0) - trading_days_used)
    if last_payout_date and (account.min_days_between_payouts or 0) > 0:
        ds = (datetime.utcnow() - last_payout_date).days
        days_for_spacing = max(0, (account.min_days_between_payouts or 0) - ds)
    else:
        days_for_spacing = 0

    if recent_avg <= 0 and needed > 0:
        return recent_avg, None, None
    if needed <= 0:
        days_needed = max(days_for_min_trading, days_for_spacing)
    else:
        days_needed = max(days_for_pnl or 0, days_for_min_trading, days_for_spacing)

    return recent_avg, datetime.utcnow() + timedelta(days=days_needed), days_needed


def compute_economics(db: Session, accounts: list[models.Account]) -> dict:
    """Real-money economics: payouts received − costs spent. Path to profitability."""
    from .services import expand_cost_amount

    total_costs = 0.0
    total_payouts = 0.0
    cost_breakdown: dict = defaultdict(float)
    per_account = []
    paper_pnl = 0.0
    blown = active = funded = 0
    monthly_burn = 0.0

    for a in accounts:
        costs = db.query(models.AccountCost).filter_by(account_id=a.id).all()

        per_cost_total = {c.id: expand_cost_amount(c) for c in costs}
        acct_costs_total = sum(per_cost_total.values())
        for c in costs:
            cost_breakdown[c.category] += per_cost_total[c.id]
            if c.is_recurring:
                monthly_burn += c.amount
            elif c.category == "eval_monthly":
                monthly_burn += c.amount  # legacy one-shot eval subs counted once

        payouts = db.query(models.Payout).filter_by(account_id=a.id).all()
        acct_payouts = sum(p.amount for p in payouts)
        total_payouts += acct_payouts
        total_costs += acct_costs_total

        realized = sum(t.net_pnl for t in db.query(models.Trade).filter_by(account_id=a.id).all())
        cur_eq = a.starting_balance + realized - acct_payouts
        days_active = 0
        first_trade = (
            db.query(models.Trade).filter_by(account_id=a.id).order_by(models.Trade.entry_time).first()
        )
        if first_trade:
            days_active = (datetime.utcnow() - first_trade.entry_time).days

        if a.status == "blown":
            blown += 1
        elif a.account_type in ("pa", "funded"):
            funded += 1
            active += 1
        else:
            active += 1

        if a.status not in ("blown", "closed") and a.account_type in ("pa", "funded"):
            paper_pnl += max(0.0, cur_eq - a.starting_balance)

        per_account.append({
            "account_id": a.id,
            "display_name": a.display_name,
            "prop_firm": a.prop_firm,
            "account_type": a.account_type or "personal",
            "status": a.status or "active",
            "starting_balance": a.starting_balance,
            "current_equity": round(cur_eq, 2),
            "realized_pnl": round(realized, 2),
            "total_paid_out": round(acct_payouts, 2),
            "total_costs": round(acct_costs_total, 2),
            "net_real": round(acct_payouts - acct_costs_total, 2),
            "days_active": days_active,
        })

    # Unattached costs (subs not yet tied to a passed account).
    unattached = db.query(models.AccountCost).filter(models.AccountCost.account_id.is_(None)).all()
    for c in unattached:
        eff = expand_cost_amount(c)
        cost_breakdown[c.category] += eff
        total_costs += eff
        if c.is_recurring:
            monthly_burn += c.amount

    net_real = total_payouts - total_costs
    break_even_pct = min(1.0, max(0.0, total_payouts / total_costs)) if total_costs > 0 else 1.0
    amount_to_break_even = max(0.0, total_costs - total_payouts)

    days_to_break_even: Optional[int] = None
    if total_payouts > 0 and amount_to_break_even > 0:
        all_payouts = db.query(models.Payout).order_by(models.Payout.payout_date).all()
        if len(all_payouts) >= 1:
            spread_days = (all_payouts[-1].payout_date - all_payouts[0].payout_date).days
            if spread_days > 0:
                rate_per_day = total_payouts / spread_days
                days_to_break_even = int(amount_to_break_even / rate_per_day) if rate_per_day > 0 else None

    runway = None
    if monthly_burn > 0 and net_real < 0:
        runway = max(0.0, abs(net_real) / monthly_burn)
        if net_real > 0:
            runway = net_real / monthly_burn

    return {
        "total_costs": round(total_costs, 2),
        "total_payouts_received": round(total_payouts, 2),
        "net_real_pnl": round(net_real, 2),
        "paper_pnl_active_accounts": round(paper_pnl, 2),
        "blown_accounts": blown,
        "active_accounts": active,
        "funded_accounts": funded,
        "break_even_progress_pct": break_even_pct,
        "amount_to_break_even": round(amount_to_break_even, 2),
        "days_to_break_even": days_to_break_even,
        "cost_breakdown": {k: round(v, 2) for k, v in cost_breakdown.items()},
        "per_account": per_account,
        "monthly_burn_estimate": round(monthly_burn, 2),
        "runway_months": runway,
        "is_profitable": net_real > 0,
    }
