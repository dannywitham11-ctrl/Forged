"""Aggregations over closed trades for the dashboards (pure math, no DB)."""
from __future__ import annotations

from collections import defaultdict
from typing import Optional

from .insight import compute_insight_score
from .models import Strategy, Trade
from .schemas import (
    BreakdownRow,
    DailyPnl,
    DrawdownPoint,
    EquityPoint,
    FullStats,
    StatCards,
)

DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def compute_stats(
    trades: list[Trade],
    starting_balance: float = 0.0,
    total_payouts: float = 0.0,
    strategies_by_id: Optional[dict[int, Strategy]] = None,
    broker_total: Optional[float] = None,
    broker_accounts_covered: int = 0,
    broker_accounts_total: int = 0,
) -> FullStats:
    """When `broker_total` covers all selected accounts, it is used as the
    authoritative current_equity and reported as `broker_pnl` alongside the
    trade-computed P&L."""
    strategies_by_id = strategies_by_id or {}
    trades = sorted(trades, key=lambda t: t.exit_time)

    wins = [t for t in trades if t.net_pnl > 0]
    losses = [t for t in trades if t.net_pnl < 0]
    bes = [t for t in trades if t.net_pnl == 0]

    gross_wins = sum(t.net_pnl for t in wins)
    gross_losses = sum(t.net_pnl for t in losses)
    net = sum(t.net_pnl for t in trades)
    gross = sum(t.gross_pnl for t in trades)
    total_comm = sum(t.commissions + t.fees for t in trades)

    n = len(trades)
    win_rate = (len(wins) / n) if n else 0.0
    pf = (gross_wins / abs(gross_losses)) if gross_losses else (float("inf") if gross_wins > 0 else 0.0)
    avg_win = (gross_wins / len(wins)) if wins else 0.0
    avg_loss = (gross_losses / len(losses)) if losses else 0.0
    largest_win = max((t.net_pnl for t in trades), default=0.0)
    largest_loss = min((t.net_pnl for t in trades), default=0.0)
    expectancy = (net / n) if n else 0.0
    avg_hold = (sum(t.duration_seconds for t in trades) / n) if n else 0.0
    avg_winner_hold = (sum(t.duration_seconds for t in wins) / len(wins)) if wins else 0.0
    avg_loser_hold = (sum(t.duration_seconds for t in losses) / len(losses)) if losses else 0.0
    payoff_ratio = (avg_win / abs(avg_loss)) if avg_loss else 0.0
    expectancy_r = ((avg_win * win_rate) + (avg_loss * (1 - win_rate))) / abs(avg_loss) if avg_loss else 0.0

    # Journal aggregates.
    planned_rrs = [t.planned_rr for t in trades if t.planned_rr is not None]
    avg_planned_rr = (sum(planned_rrs) / len(planned_rrs)) if planned_rrs else None
    realized_rs = [t.realized_r for t in trades if t.realized_r is not None]
    avg_realized_r = (sum(realized_rs) / len(realized_rs)) if realized_rs else None
    plan_adherence = (len(planned_rrs) / n) if n else 0.0
    mistake_rate = (sum(1 for t in trades if t.mistakes) / n) if n else 0.0
    ratings = [t.rating for t in trades if t.rating]
    avg_rating = (sum(ratings) / len(ratings)) if ratings else None

    # Streaks.
    max_w = max_l = cur_w = cur_l = 0
    last_sign = 0
    current_streak = 0
    for t in trades:
        if t.net_pnl > 0:
            cur_w += 1
            cur_l = 0
            max_w = max(max_w, cur_w)
            current_streak = current_streak + 1 if last_sign == 1 else 1
            last_sign = 1
        elif t.net_pnl < 0:
            cur_l += 1
            cur_w = 0
            max_l = max(max_l, cur_l)
            current_streak = current_streak - 1 if last_sign == -1 else -1
            last_sign = -1
        else:
            cur_w = cur_l = 0
            current_streak = 0
            last_sign = 0

    # Equity + drawdown curves.
    equity = starting_balance
    curve: list[EquityPoint] = []
    dd_curve: list[DrawdownPoint] = []
    running_peak = starting_balance
    max_dd_abs = 0.0
    max_dd_pct = 0.0
    cur_dd = 0.0
    for t in trades:
        equity += t.net_pnl
        running_peak = max(running_peak, equity)
        dd = running_peak - equity
        cur_dd = dd
        if dd > max_dd_abs:
            max_dd_abs = dd
            if running_peak > 0:
                max_dd_pct = dd / running_peak
        curve.append(EquityPoint(t=t.exit_time, equity=round(equity, 2), trade_id=t.id))
        dd_curve.append(DrawdownPoint(t=t.exit_time, drawdown=-round(dd, 2), trade_id=t.id))

    # Daily buckets.
    daily_map: dict[str, dict] = defaultdict(lambda: {"net": 0.0, "n": 0, "w": 0, "l": 0, "vol": 0})
    for t in trades:
        key = t.trade_date.strftime("%Y-%m-%d")
        daily_map[key]["net"] += t.net_pnl
        daily_map[key]["n"] += 1
        daily_map[key]["vol"] += t.quantity
        if t.net_pnl > 0:
            daily_map[key]["w"] += 1
        elif t.net_pnl < 0:
            daily_map[key]["l"] += 1
    daily = [
        DailyPnl(date=d, net_pnl=round(v["net"], 2), trade_count=v["n"], win_count=v["w"], loss_count=v["l"])
        for d, v in sorted(daily_map.items())
    ]

    winning_days = [v for v in daily_map.values() if v["net"] > 0]
    losing_days = [v for v in daily_map.values() if v["net"] < 0]
    breakeven_days = [v for v in daily_map.values() if v["net"] == 0]
    trading_days = len(daily_map)
    day_win_rate = (len(winning_days) / trading_days) if trading_days else 0.0
    avg_winning_day = (sum(v["net"] for v in winning_days) / len(winning_days)) if winning_days else 0.0
    avg_losing_day = (sum(v["net"] for v in losing_days) / len(losing_days)) if losing_days else 0.0
    largest_winning_day = max((v["net"] for v in daily_map.values()), default=0.0)
    largest_losing_day = min((v["net"] for v in daily_map.values()), default=0.0)
    avg_daily_pnl = (net / trading_days) if trading_days else 0.0
    avg_daily_volume = (sum(v["vol"] for v in daily_map.values()) / trading_days) if trading_days else 0.0
    avg_trades_per_day = (n / trading_days) if trading_days else 0.0

    # Broker balances become authoritative only when they cover every selection.
    uses_broker = (
        broker_total is not None
        and broker_accounts_total > 0
        and broker_accounts_covered == broker_accounts_total
    )
    if uses_broker:
        current_equity = float(broker_total)
        broker_pnl_val = current_equity - starting_balance
    else:
        current_equity = starting_balance + net - total_payouts
        broker_pnl_val = None
    return_pct_val = ((current_equity - starting_balance) / starting_balance) if starting_balance > 0 else 0.0

    cards = StatCards(
        net_pnl=net, gross_pnl=gross, total_commissions=total_comm,
        current_equity=current_equity, starting_balance=starting_balance,
        return_pct=return_pct_val,
        total_payouts=total_payouts,
        broker_total=broker_total, broker_pnl=broker_pnl_val,
        uses_broker_balance=uses_broker,
        broker_accounts_covered=broker_accounts_covered,
        broker_accounts_total=broker_accounts_total,
        trade_count=n, win_count=len(wins), loss_count=len(losses), breakeven_count=len(bes),
        win_rate=win_rate, profit_factor=pf if pf != float("inf") else 0.0,
        avg_win=avg_win, avg_loss=avg_loss, payoff_ratio=payoff_ratio,
        largest_win=largest_win, largest_loss=largest_loss,
        expectancy=expectancy, expectancy_r=expectancy_r,
        avg_hold_seconds=avg_hold, avg_winner_hold_seconds=avg_winner_hold, avg_loser_hold_seconds=avg_loser_hold,
        max_consec_wins=max_w, max_consec_losses=max_l, current_streak=current_streak,
        total_contracts=sum(t.quantity for t in trades),
        trading_days=trading_days, winning_days=len(winning_days), losing_days=len(losing_days), breakeven_days=len(breakeven_days),
        day_win_rate=day_win_rate, avg_winning_day=avg_winning_day, avg_losing_day=avg_losing_day,
        largest_winning_day=largest_winning_day, largest_losing_day=largest_losing_day,
        avg_daily_pnl=avg_daily_pnl, avg_daily_volume=avg_daily_volume, avg_trades_per_day=avg_trades_per_day,
        max_drawdown=-max_dd_abs, max_drawdown_pct=-max_dd_pct, current_drawdown=-cur_dd,
        avg_planned_rr=avg_planned_rr, avg_realized_r=avg_realized_r,
        plan_adherence=plan_adherence, mistake_rate=mistake_rate, avg_rating=avg_rating,
    )

    by_symbol = _group(trades, lambda t: t.symbol)
    by_dow = _group(trades, lambda t: DOW_NAMES[t.entry_time.weekday()], key_order=DOW_NAMES)
    by_hour = _group(trades, lambda t: f"{t.entry_time.hour:02d}",
                     key_order=[f"{h:02d}" for h in range(24)])
    by_side = _group(trades, lambda t: t.side)
    by_strategy = _group(
        trades,
        lambda t: (
            strategies_by_id.get(t.strategy_id).name
            if t.strategy_id and strategies_by_id.get(t.strategy_id)
            else "Unassigned"
        ),
    )

    # Mistakes: one bucket per mistake tag.
    mistake_buckets: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        if t.mistakes:
            for tag in [x.strip() for x in t.mistakes.split(",") if x.strip()]:
                mistake_buckets[tag].append(t)
    by_mistake: list[BreakdownRow] = []
    for k, items in sorted(mistake_buckets.items()):
        w = sum(1 for x in items if x.net_pnl > 0)
        by_mistake.append(BreakdownRow(
            key=k, net_pnl=round(sum(x.net_pnl for x in items), 2),
            trade_count=len(items), win_rate=(w / len(items)) if items else 0.0,
        ))

    pnl_distribution = _pnl_histogram(trades)
    daily_pnls_list = [d.net_pnl for d in daily]
    insight = compute_insight_score(cards, daily_pnls_list)

    return FullStats(
        cards=cards, equity_curve=curve, drawdown_curve=dd_curve, daily=daily,
        by_symbol=by_symbol, by_dow=by_dow, by_hour=by_hour, by_side=by_side,
        by_strategy=by_strategy, by_mistake=by_mistake,
        pnl_distribution=pnl_distribution, insight=insight,
    )


def _group(trades: list[Trade], keyfn, key_order: list[str] | None = None) -> list[BreakdownRow]:
    bucket: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        bucket[keyfn(t)].append(t)
    rows = []
    keys = key_order if key_order else sorted(bucket.keys())
    for k in keys:
        items = bucket.get(k)
        if not items:
            continue
        wins = sum(1 for t in items if t.net_pnl > 0)
        rows.append(BreakdownRow(
            key=k, net_pnl=round(sum(t.net_pnl for t in items), 2),
            trade_count=len(items), win_rate=(wins / len(items)) if items else 0.0,
        ))
    return rows


def _pnl_histogram(trades: list[Trade], bins: int = 18) -> list[dict]:
    if not trades:
        return []
    pnls = [t.net_pnl for t in trades]
    lo, hi = min(pnls), max(pnls)
    if lo == hi:
        return [{"bucket": f"{lo:.0f}", "count": len(pnls), "low": lo, "high": hi}]
    span = hi - lo
    width = span / bins
    counts = [0] * bins
    for v in pnls:
        idx = min(bins - 1, int((v - lo) / width))
        counts[idx] += 1
    return [
        {"bucket": f"{lo + i * width:.0f}", "count": counts[i],
         "low": round(lo + i * width, 2), "high": round(lo + (i + 1) * width, 2)}
        for i in range(bins)
    ]
