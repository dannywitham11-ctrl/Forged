"""Order-based trade matching.

Sierra's Trade Activity Log marks every fill with open_close ('Open'/'Close'),
internal_order_id (the order this fill belongs to), and parent_internal_order_id
(for closes, the opening order this close pairs with).

The user's trades are 1:1 with **opening orders**: each opener (possibly several
partial-fill rows sharing an internal_order_id) plus all its closes (orders that
point back via parent_internal_order_id) form one round-trip trade. Orphan closes
(no parent) are FIFO-matched to the oldest unclosed opener of the opposite side on
the same symbol. When a symbol's fills carry no open_close markers at all (rare,
non-Sierra data), we fall back to a position-to-zero crossing matcher.

trade_date follows the user's timezone + date_by preference (exit by default, the
TradeZella convention: a trade closed Fri 00:10 local is a Friday trade).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from .instruments import get_spec
from .models import Execution, Trade

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python <3.9; we run 3.12 so this never trips
    ZoneInfo = None


def _trade_date(t_entry: datetime, t_exit: datetime, tz_name: str, date_by: str) -> datetime:
    """Calendar date a trade is filed under, in the user's tz/preference."""
    base = t_exit if date_by == "exit" else t_entry
    if not tz_name or tz_name == "UTC" or ZoneInfo is None:
        return base
    try:
        from datetime import timezone as _tz
        tz = ZoneInfo(tz_name)
        # base is naive UTC: attach UTC, convert, then strip tzinfo.
        return base.replace(tzinfo=_tz.utc).astimezone(tz).replace(tzinfo=None)
    except Exception:
        return base


@dataclass
class _Leg:
    qty: int
    price: float


@dataclass
class _PendingTrade:
    opener_id: str
    symbol: str
    instrument_root: str
    side: str  # 'Long' / 'Short'
    entry_time: datetime
    entries: list[_Leg] = field(default_factory=list)
    exits: list[_Leg] = field(default_factory=list)
    exit_time: Optional[datetime] = None
    exec_ids: list[int] = field(default_factory=list)
    hi: Optional[float] = None
    lo: Optional[float] = None

    def add_entry(self, qty: int, price: float, t: datetime, exec_id: int, hi, lo):
        self.entries.append(_Leg(qty, price))
        self.exec_ids.append(exec_id)
        self._update_excursion(hi, lo)

    def add_exit(self, qty: int, price: float, t: datetime, exec_id: int, hi, lo):
        self.exits.append(_Leg(qty, price))
        if self.exit_time is None or t > self.exit_time:
            self.exit_time = t
        if exec_id not in self.exec_ids:
            self.exec_ids.append(exec_id)
        self._update_excursion(hi, lo)

    def _update_excursion(self, hi, lo):
        if hi is not None and hi > 0:
            self.hi = hi if self.hi is None else max(self.hi, hi)
        if lo is not None and lo > 0:
            self.lo = lo if self.lo is None else min(self.lo, lo)

    @property
    def entry_qty(self) -> int:
        return sum(l.qty for l in self.entries)

    @property
    def exit_qty(self) -> int:
        return sum(l.qty for l in self.exits)

    @property
    def avg_entry(self) -> float:
        q = self.entry_qty
        return sum(l.qty * l.price for l in self.entries) / q if q else 0.0

    @property
    def avg_exit(self) -> float:
        q = self.exit_qty
        return sum(l.qty * l.price for l in self.exits) / q if q else 0.0


def _make_trade(
    o: _PendingTrade,
    account_id: int,
    commission_per_side: float,
    fees_per_side: float,
    tz_name: str = "UTC",
    date_by: str = "exit",
    rate_table: dict | None = None,
) -> tuple[Trade, list[int]]:
    spec = get_spec(o.symbol)
    pv = spec["point_value"]
    matched_qty = min(o.entry_qty, o.exit_qty)
    side_sign = 1 if o.side == "Long" else -1
    gross = (o.avg_exit - o.avg_entry) * matched_qty * pv * side_sign

    # Per-root commission override wins over the flat per-side rate.
    if rate_table and o.instrument_root in rate_table:
        per_side = float(rate_table[o.instrument_root])
    else:
        per_side = commission_per_side
    commissions = per_side * (matched_qty * 2)
    fees = fees_per_side * (matched_qty * 2)
    net = gross - commissions - fees

    mfe = mae = mfe_pnl = mae_pnl = None
    if o.hi is not None and o.lo is not None:
        if o.side == "Long":
            mfe = o.hi - o.avg_entry
            mae = o.lo - o.avg_entry
        else:
            mfe = o.avg_entry - o.lo
            mae = o.avg_entry - o.hi
        mfe_pnl = mfe * matched_qty * pv
        mae_pnl = mae * matched_qty * pv

    duration = int((o.exit_time - o.entry_time).total_seconds()) if o.entry_time and o.exit_time else 0
    trade = Trade(
        account_id=account_id,
        symbol=o.symbol,
        instrument_root=o.instrument_root,
        side=o.side,
        entry_time=o.entry_time,
        exit_time=o.exit_time,
        quantity=matched_qty,
        avg_entry_price=o.avg_entry,
        avg_exit_price=o.avg_exit,
        gross_pnl=gross,
        commissions=commissions,
        fees=fees,
        net_pnl=net,
        point_value=pv,
        duration_seconds=duration,
        mfe=mfe,
        mae=mae,
        mfe_pnl=mfe_pnl,
        mae_pnl=mae_pnl,
        trade_date=_trade_date(o.entry_time, o.exit_time, tz_name, date_by),
    )
    return trade, o.exec_ids


def match_executions_to_trades(
    executions: list[Execution],
    account_id: int,
    commission_per_side: float = 0.0,
    fees_per_side: float = 0.0,
    tz_name: str = "UTC",
    date_by: str = "exit",
    rate_table: dict | None = None,
) -> list[tuple[Trade, list[int]]]:
    """Build round-trip trades from fills, keyed by Sierra opener internal_order_id."""
    by_symbol: dict[str, list[Execution]] = {}
    for e in executions:
        by_symbol.setdefault(e.symbol, []).append(e)

    results: list[tuple[Trade, list[int]]] = []

    for symbol, execs in by_symbol.items():
        execs.sort(key=lambda x: (x.fill_time, x.id or 0))

        # Sierra fills carry order-id markers; non-Sierra data may not.
        has_markers = any(e.open_close in ("Open", "Close") and e.internal_order_id for e in execs)
        if not has_markers:
            results.extend(
                _position_walk_fallback(
                    execs, account_id, commission_per_side, fees_per_side,
                    tz_name, date_by, rate_table,
                )
            )
            continue

        # Pass 1: collect openers grouped by internal_order_id.
        pending: dict[str, _PendingTrade] = {}
        for e in execs:
            if e.open_close == "Open" and e.internal_order_id:
                p = pending.get(e.internal_order_id)
                if p is None:
                    p = _PendingTrade(
                        opener_id=e.internal_order_id,
                        symbol=e.symbol,
                        instrument_root=e.instrument_root,
                        side="Long" if e.side == "Buy" else "Short",
                        entry_time=e.fill_time,
                    )
                    pending[e.internal_order_id] = p
                p.add_entry(e.quantity, e.fill_price, e.fill_time, e.id,
                            e.high_during_position, e.low_during_position)

        # Pass 2: closes with an explicit parent route directly.
        unmatched_closes: list[Execution] = []
        for e in execs:
            if e.open_close != "Close":
                continue
            parent = e.parent_internal_order_id
            if parent and parent in pending:
                pending[parent].add_exit(e.quantity, e.fill_price, e.fill_time, e.id,
                                         e.high_during_position, e.low_during_position)
            else:
                unmatched_closes.append(e)

        # Pass 3: orphan closes — FIFO against the oldest unfilled opposite opener.
        def remaining_qty(p: _PendingTrade) -> int:
            return p.entry_qty - p.exit_qty

        for close in unmatched_closes:
            close_side = "Long" if close.side == "Sell" else "Short"  # Sell closes a Long
            qty_left = close.quantity
            # Only consider openers that existed BEFORE this close fired.
            for p in sorted(pending.values(), key=lambda x: x.entry_time):
                if p.entry_time > close.fill_time:
                    break  # ascending sort: everything after is later too
                if qty_left <= 0:
                    break
                if p.side != close_side:
                    continue
                r = remaining_qty(p)
                if r <= 0:
                    continue
                take = min(qty_left, r)
                p.add_exit(take, close.fill_price, close.fill_time, close.id,
                           close.high_during_position, close.low_during_position)
                qty_left -= take
            # Leftover qty_left here means a truly orphaned close — ignored.

        # Pass 4: merge sibling openers that fire (and close) at the same instant
        # on the same side/symbol — TradeZella treats them as one logical trade.
        closed = [p for p in pending.values() if p.exit_qty > 0]
        closed.sort(key=lambda x: x.entry_time)
        merged: list[_PendingTrade] = []
        for p in closed:
            target = merged[-1] if merged else None
            if (
                target
                and target.side == p.side
                and abs((p.entry_time - target.entry_time).total_seconds()) <= 1.0
                and target.exit_time and p.exit_time
                and abs((p.exit_time - target.exit_time).total_seconds()) <= 1.0
            ):
                target.entries.extend(p.entries)
                target.exits.extend(p.exits)
                target.exec_ids.extend(p.exec_ids)
                if p.hi is not None:
                    target.hi = p.hi if target.hi is None else max(target.hi, p.hi)
                if p.lo is not None:
                    target.lo = p.lo if target.lo is None else min(target.lo, p.lo)
            else:
                merged.append(p)

        # Pass 5: build trades.
        for p in merged:
            results.append(
                _make_trade(p, account_id, commission_per_side, fees_per_side,
                            tz_name, date_by, rate_table)
            )

    return results


def _position_walk_fallback(
    execs, account_id, commission_per_side, fees_per_side,
    tz_name="UTC", date_by="exit", rate_table=None,
):
    """Position-to-zero matcher, used when fills carry no open_close markers."""
    results = []
    position = 0
    current: Optional[_PendingTrade] = None
    for ex in execs:
        signed_qty = ex.quantity if ex.side == "Buy" else -ex.quantity
        remaining = abs(signed_qty)
        direction = 1 if signed_qty > 0 else -1
        while remaining > 0:
            if position == 0:
                current = _PendingTrade(
                    opener_id=f"pw_{ex.id}",
                    symbol=ex.symbol,
                    instrument_root=ex.instrument_root,
                    side="Long" if direction > 0 else "Short",
                    entry_time=ex.fill_time,
                )
                current.add_entry(remaining, ex.fill_price, ex.fill_time, ex.id,
                                  ex.high_during_position, ex.low_during_position)
                position += direction * remaining
                remaining = 0
            else:
                pos_sign = 1 if position > 0 else -1
                if direction == pos_sign:
                    current.add_entry(remaining, ex.fill_price, ex.fill_time, ex.id,
                                      ex.high_during_position, ex.low_during_position)
                    position += direction * remaining
                    remaining = 0
                else:
                    close_qty = min(remaining, abs(position))
                    current.add_exit(close_qty, ex.fill_price, ex.fill_time, ex.id,
                                     ex.high_during_position, ex.low_during_position)
                    position += direction * close_qty
                    remaining -= close_qty
                    if position == 0:
                        results.append(
                            _make_trade(current, account_id,
                                        commission_per_side, fees_per_side,
                                        tz_name, date_by, rate_table)
                        )
                        current = None
    return results
