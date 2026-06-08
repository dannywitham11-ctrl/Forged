"""Parser for NinjaTrader's Trade Performance > Executions CSV grid export.

Expected header:
  Instrument,Action,Quantity,Price,Time,ID,E/X,Position,Order ID,Name,
  Commission,Rate,Account,Connection,

NinjaTrader's `MES 06-26` symbol is normalized to Sierra-style `MESM6.CME` so
trades on the same instrument from either source aggregate together.
"""
from __future__ import annotations

import csv
import re
from datetime import datetime
from typing import Iterator, Optional

from .instruments import get_spec
from .parser import ParsedFill

# CME month codes, Jan..Dec.
_MONTH_CODES = "FGHJKMNQUVXZ"

# Default exchange per root; unknown roots fall back to CME.
_EXCHANGE_BY_ROOT = {
    "MNQ": "CME", "MES": "CME", "M2K": "CME", "MYM": "CME",
    "NQ": "CME", "ES": "CME", "YM": "CME", "RTY": "CME",
    "GC": "COMEX", "MGC": "COMEX", "SI": "COMEX", "SIL": "COMEX",
    "CL": "NYMEX", "MCL": "NYMEX", "NG": "NYMEX",
    "MBT": "CME", "MET": "CME",
    "6E": "CME", "M6E": "CME", "6J": "CME", "6B": "CME", "6A": "CME",
}


def normalize_symbol(nt_symbol: str) -> str:
    """`MES 06-26` -> `MESM6.CME`. Returns the input unchanged when it doesn't
    match NinjaTrader's spaced format (some come through as 'MESM6' already)."""
    if not nt_symbol:
        return nt_symbol
    s = nt_symbol.strip()
    m = re.match(r"^([A-Z0-9]{1,5})\s+(\d{1,2})-(\d{2,4})$", s)
    if not m:
        return s
    root, mm, yy = m.group(1), int(m.group(2)), m.group(3)
    if not (1 <= mm <= 12):
        return s
    code = _MONTH_CODES[mm - 1]
    yr_short = yy[-1]  # last digit of year (Sierra convention)
    exchange = _EXCHANGE_BY_ROOT.get(root.upper(), "CME")
    return f"{root.upper()}{code}{yr_short}.{exchange}"


def _parse_money(s: str) -> float:
    s = (s or "").strip()
    if not s:
        return 0.0
    s = s.replace("$", "").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_nt_time(s: str) -> Optional[datetime]:
    """NinjaTrader writes timestamps in the user's Windows locale; try the
    common variants in order (AU/UK D/M/Y, US M/D/Y, ISO, 12h and 24h)."""
    s = (s or "").strip()
    if not s:
        return None
    for fmt in (
        "%d/%m/%Y %I:%M:%S %p",  # AU / UK / EU 12-hour
        "%m/%d/%Y %I:%M:%S %p",  # US 12-hour
        "%d/%m/%Y %H:%M:%S",     # 24-hour
        "%m/%d/%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",     # ISO-ish
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def looks_like_ninjatrader_csv(text: str) -> bool:
    head = text[:1000].splitlines()[:1]
    if not head:
        return False
    h = head[0]
    return "Instrument" in h and "E/X" in h and "Action" in h and ("ID" in h or "Order ID" in h)


def parse_ninjatrader_executions(file_path: str) -> Iterator[ParsedFill]:
    with open(file_path, "r", encoding="utf-8-sig", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sym_raw = (row.get("Instrument") or "").strip()
            if not sym_raw:
                continue
            symbol = normalize_symbol(sym_raw)
            spec = get_spec(symbol)

            action = (row.get("Action") or "").strip()
            if action in ("Buy", "BuyToCover", "Cover"):
                side = "Buy"
            elif action in ("Sell", "SellShort", "Short"):
                side = "Sell"
            else:
                continue

            try:
                qty = int(float(row.get("Quantity") or "0"))
            except ValueError:
                continue
            if qty <= 0:
                continue
            try:
                price = float(row.get("Price") or "0")
            except ValueError:
                continue
            if price <= 0:
                continue

            ts = _parse_nt_time(row.get("Time") or "")
            if ts is None:
                continue

            fill_id = (row.get("ID") or "").strip()
            order_id = (row.get("Order ID") or "").strip() or fill_id

            ex_marker = (row.get("E/X") or "").strip().lower()
            if ex_marker.startswith("entry") or ex_marker.startswith("open"):
                open_close = "Open"
            elif ex_marker.startswith("exit") or ex_marker.startswith("close"):
                open_close = "Close"
            else:
                open_close = None

            account_num = (row.get("Account") or "").strip()
            connection = (row.get("Connection") or "").strip()
            # Stable external_id: prefer "Connection-Account", else either alone.
            if connection and account_num:
                acct_ext = f"{connection}-{account_num}"
            elif account_num:
                acct_ext = account_num
            elif connection:
                acct_ext = connection
            else:
                acct_ext = "ninjatrader-unknown"

            yield ParsedFill(
                fill_id=fill_id or f"nt-{ts.isoformat()}-{symbol}-{qty}-{price}",
                internal_order_id=order_id,
                service_order_id=fill_id,
                parent_internal_order_id=None,
                fill_time=ts,
                symbol=symbol,
                instrument_root=spec["root"],
                side=side,
                quantity=qty,
                fill_price=price,
                raw_price=price,
                order_type=None,
                open_close=open_close,
                account_external_id=acct_ext,
                position_after=None,
                high_during_position=None,
                low_during_position=None,
                note=None,
                is_automated=False,
            )
