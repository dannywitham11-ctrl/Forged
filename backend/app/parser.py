"""Sierra Chart Trade Activity Log (Fills export) parser.

Tab-separated, one fill event per row, header in row 1. Relevant columns:
ActivityType, DateTime, Symbol, Quantity, BuySell, FillPrice, TradeAccount,
FillExecutionServiceID, OpenClose, PositionQuantity, OrderType, InternalOrderID,
ServiceOrderID, ParentInternalOrderID, HighDuringPosition, LowDuringPosition,
Note, IsAutomated.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from typing import Iterator, Optional

from .instruments import get_spec


@dataclass
class ParsedFill:
    fill_id: str
    internal_order_id: str
    service_order_id: str
    parent_internal_order_id: Optional[str]
    fill_time: datetime
    symbol: str
    instrument_root: str
    side: str  # 'Buy' or 'Sell'
    quantity: int
    fill_price: float  # normalized to display price
    raw_price: float   # untouched value from file
    order_type: Optional[str]
    open_close: Optional[str]
    account_external_id: str
    position_after: Optional[int]
    high_during_position: Optional[float]
    low_during_position: Optional[float]
    note: Optional[str]
    is_automated: bool


def _parse_float(s: str) -> Optional[float]:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _parse_int(s: str) -> Optional[int]:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def _parse_dt(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    if not s:
        return None
    # Sierra writes "2026-04-28  03:16:21.481192" (note the double space).
    s = " ".join(s.split())
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def parse_sierra_fills(file_path: str) -> Iterator[ParsedFill]:
    with open(file_path, "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            # Only real fill events.
            if (row.get("ActivityType") or "").strip() != "Fills":
                continue
            # Per-event fill size lives in the Quantity column (verified against
            # partial-fill rows). Skip rows without a positive quantity.
            quantity = _parse_int(row.get("Quantity"))
            qty = quantity if quantity and quantity > 0 else None
            if not qty:
                continue
            fill_price_raw = _parse_float(row.get("FillPrice"))
            if fill_price_raw is None or fill_price_raw == 0:
                continue
            dt = _parse_dt(row.get("DateTime"))
            if dt is None:
                continue
            side = (row.get("BuySell") or "").strip()
            if side not in ("Buy", "Sell"):
                continue
            fill_id = (row.get("FillExecutionServiceID") or "").strip()
            if not fill_id:
                continue
            account = (row.get("TradeAccount") or "").strip()
            if not account:
                continue

            symbol = (row.get("Symbol") or "").strip()
            spec = get_spec(symbol)
            divisor = spec["price_divisor"]
            fill_price = fill_price_raw / divisor if divisor else fill_price_raw
            high = _parse_float(row.get("HighDuringPosition"))
            low = _parse_float(row.get("LowDuringPosition"))

            yield ParsedFill(
                fill_id=fill_id,
                internal_order_id=(row.get("InternalOrderID") or "").strip(),
                service_order_id=(row.get("ServiceOrderID") or "").strip(),
                parent_internal_order_id=(row.get("ParentInternalOrderID") or "").strip() or None,
                fill_time=dt,
                symbol=symbol,
                instrument_root=spec["root"],
                side=side,
                quantity=qty,
                fill_price=fill_price,
                raw_price=fill_price_raw,
                order_type=(row.get("OrderType") or "").strip() or None,
                open_close=(row.get("OpenClose") or "").strip() or None,
                account_external_id=account,
                position_after=_parse_int(row.get("PositionQuantity")),
                high_during_position=high / divisor if high and divisor else high,
                low_during_position=low / divisor if low and divisor else low,
                note=(row.get("Note") or "").strip() or None,
                is_automated=(row.get("IsAutomated") or "").strip().upper() == "Y",
            )
