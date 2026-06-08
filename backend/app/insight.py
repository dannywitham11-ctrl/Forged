"""Composite insight score (TradeZella's Zella Score equivalent).

Weighted average of 6 sub-scores (each 0..100): win-rate balance, profit factor,
avg win/loss ratio, consistency, drawdown control, and discipline.
"""
from __future__ import annotations

import math

from .schemas import InsightScore, InsightSub, StatCards


def _grade(score: float) -> str:
    if score >= 90:
        return "A+"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    if score >= 50:
        return "D"
    return "F"


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _winrate_score(rate: float) -> float:
    # 0% → 0, 50% → 55, 70% → 77, 90%+ → 100
    return _clamp(rate * 110)


def _pf_score(pf: float) -> float:
    if pf <= 0:
        return 0.0
    # 1.0 → 50, 1.5 → 60, 2.0 → 70, 3.5 → 100
    return _clamp(40 + (pf - 0.5) * 20)


def _rr_score(rr: float) -> float:
    if rr <= 0:
        return 0.0
    # 0.5 → 17, 1.0 → 35, 2.0 → 70, 3.0+ → 100
    return _clamp(rr * 35)


def _consistency_score(daily_pnls: list[float]) -> float:
    if not daily_pnls:
        return 0.0
    n = len(daily_pnls)
    if n < 2:
        return 60.0  # not enough data
    mean = sum(daily_pnls) / n
    var = sum((x - mean) ** 2 for x in daily_pnls) / n
    std = math.sqrt(var)
    if mean <= 0:
        return 0.0
    cv = std / abs(mean)  # coefficient of variation
    # cv 0 → 100, cv 1 → 75, cv 2 → 50, cv 4+ → 0
    return _clamp(100 - cv * 25)


def _drawdown_score(net: float, max_dd_abs: float) -> float:
    if max_dd_abs <= 0:
        return 95.0  # no drawdown yet
    if net <= 0:
        return _clamp(10 + (net / max_dd_abs) * 5)  # penalize but not zero
    ratio = net / max_dd_abs  # higher = better
    # ratio 0.5 → 44, 1 → 53, 2 → 71, 4+ → 100
    return _clamp(35 + ratio * 18)


def _discipline_score(plan_adherence: float, mistake_rate: float, avg_rating: float) -> float:
    a = plan_adherence * 100          # 0..1
    m = (1 - mistake_rate) * 100      # 0..1
    r = (avg_rating / 5) * 100 if avg_rating > 0 else 60  # neutral if unrated
    return _clamp((a + m + r) / 3)


def compute_insight_score(cards: StatCards, daily_pnls: list[float]) -> InsightScore:
    win_s = _winrate_score(cards.win_rate)
    pf_s = _pf_score(cards.profit_factor)
    rr_s = _rr_score(cards.payoff_ratio)
    con_s = _consistency_score(daily_pnls)
    dd_s = _drawdown_score(cards.net_pnl, abs(cards.max_drawdown))
    dis_s = _discipline_score(
        cards.plan_adherence or 0.0,
        cards.mistake_rate or 0.0,
        cards.avg_rating or 0.0,
    )

    components = [
        InsightSub(key="win", label="Win Rate", score=round(win_s, 1), weight=0.15,
                   value_display=f"{cards.win_rate*100:.1f}%"),
        InsightSub(key="pf", label="Profit Factor", score=round(pf_s, 1), weight=0.20,
                   value_display=f"{cards.profit_factor:.2f}"),
        InsightSub(key="rr", label="Avg Win/Loss", score=round(rr_s, 1), weight=0.15,
                   value_display=f"{cards.payoff_ratio:.2f}R"),
        InsightSub(key="con", label="Consistency", score=round(con_s, 1), weight=0.15,
                   value_display=f"{len(daily_pnls)} days"),
        InsightSub(key="dd", label="Drawdown", score=round(dd_s, 1), weight=0.20,
                   value_display=f"${cards.max_drawdown:.0f}"),
        InsightSub(key="dis", label="Discipline", score=round(dis_s, 1), weight=0.15,
                   value_display=f"{(cards.plan_adherence or 0)*100:.0f}% planned"),
    ]
    overall = sum(c.score * c.weight for c in components)
    grade = _grade(overall)

    summary_parts = []
    if cards.trade_count < 20:
        summary_parts.append("Small sample — score is preliminary.")
    weakest = min(components, key=lambda c: c.score)
    strongest = max(components, key=lambda c: c.score)
    summary_parts.append(f"Strength: {strongest.label} ({strongest.score:.0f}).")
    summary_parts.append(f"Focus area: {weakest.label} ({weakest.score:.0f}).")

    return InsightScore(
        score=round(overall, 1),
        grade=grade,
        components=components,
        summary=" ".join(summary_parts),
    )
