"""Parser for MotiveWave executions / order-history CSV exports.

MotiveWave's exported column names vary by version and broker, so instead of a
fixed layout we detect columns by normalized header aliases (time, instrument,
side, qty, price, account, ...). One row per fill -> ParsedFill.

A real MotiveWave export looks like:
    Account,"Order ID",Underlying,Symbol,Exchange,Time,Action,Quantity,Price,"Fill Id"
    LFE...,107858588,MNQ,MNQM6,CME,"05/26/2026 23:09:02.142+1000",BOT,1,29905,

MotiveWave exports don't carry Sierra-style open/close + order-id pairing, so the
matcher reconstructs round trips with its position-to-zero fallback.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Iterator, Optional

from .instruments import get_spec
from .nt_parser import normalize_symbol
from .parser import ParsedFill


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


# First matching alias wins (checked against normalized header cells).
_ALIASES = {
    "datetime": {"datetime", "datetimegmt", "date/time", "filltime", "filldatetime",
                 "executiontime", "exectime", "transactiontime", "tradetime", "timestamp", "time"},
    "date": {"date", "tradedate", "filldate"},
    # Prefer the specific contract symbol over the underlying root.
    "symbol": {"symbol", "contract", "ticker", "product", "localsymbol", "instrument"},
    "underlying": {"underlying", "root", "rootsymbol"},
    "exchange": {"exchange", "mktexchange", "venue", "ecn"},
    "side": {"side", "action", "buysell", "bs", "direction", "ordertype"},
    "qty": {"quantity", "qty", "filled", "filledqty", "filledquantity", "size",
            "amount", "contracts", "volume", "fillsize"},
    "price": {"price", "fillprice", "avgprice", "averageprice", "avgfillprice",
              "executionprice", "filledprice", "tradeprice"},
    "account": {"account", "accountid", "accountname", "acct", "accountno"},
    "execid": {"fillid", "executionid", "execid", "tradeid", "transactionid"},
    "orderid": {"orderid", "order", "orderref", "orderno", "ordernumber"},
}

# Tried in order. %z parses "+1000"; %f parses fractional seconds. Patterns with
# a timezone offset are listed first so MotiveWave's format is matched precisely.
_DT_FORMATS = (
    "%m/%d/%Y %H:%M:%S.%f%z", "%m/%d/%Y %H:%M:%S%z",
    "%d/%m/%Y %H:%M:%S.%f%z", "%d/%m/%Y %H:%M:%S%z",
    "%Y-%m-%d %H:%M:%S.%f%z", "%Y-%m-%d %H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z",
    "%m/%d/%Y %H:%M:%S.%f", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M",
    "%d/%m/%Y %H:%M:%S.%f", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M",
    "%m/%d/%Y %I:%M:%S %p", "%d/%m/%Y %I:%M:%S %p",
    "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
    "%Y/%m/%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
)
_DATE_ONLY = ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y")


def _to_utc_naive(dt: datetime) -> datetime:
    """If tz-aware, convert to UTC and drop tzinfo (the app stores naive UTC)."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _parse_dt(date_part: str, time_part: Optional[str]) -> Optional[datetime]:
    s = (date_part or "").strip()
    if time_part:
        s = f"{s} {time_part.strip()}"
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return None
    for fmt in _DT_FORMATS:
        try:
            return _to_utc_naive(datetime.strptime(s, fmt))
        except ValueError:
            continue
    for fmt in _DATE_ONLY:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _map_side(raw: str) -> Optional[str]:
    v = (raw or "").strip().lower()
    if v in ("buy", "b", "bought", "bot", "long", "buytocover", "cover"):
        return "Buy"
    if v in ("sell", "s", "sold", "sld", "short", "sellshort", "sht"):
        return "Sell"
    if v.startswith("buy"):
        return "Buy"
    if v.startswith("sell"):
        return "Sell"
    return None


def _detect_columns(header: list[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    norm = [_norm(h) for h in header]
    for key, aliases in _ALIASES.items():
        for i, h in enumerate(norm):
            if h in aliases and key not in out:
                out[key] = i
                break
    return out


def looks_like_motivewave_csv(text: str) -> bool:
    """Loose check: a delimited file whose header has a symbol/underlying column,
    a side/action column, and a price column."""
    line = text.splitlines()[0] if text.splitlines() else ""
    for delim in (",", "\t", ";"):
        cols = _detect_columns(line.split(delim))
        if ("symbol" in cols or "underlying" in cols) and "side" in cols and "price" in cols:
            return True
    return False


def parse_motivewave_executions(file_path: str) -> Iterator[ParsedFill]:
    with open(file_path, "r", encoding="utf-8-sig", errors="replace", newline="") as f:
        text = f.read()
    if not text.strip():
        return

    sample = text[:4096]
    try:
        delim = csv.Sniffer().sniff(sample, delimiters=",\t;|").delimiter
    except csv.Error:
        delim = "," if sample.count(",") >= sample.count("\t") else "\t"

    reader = csv.reader(io.StringIO(text), delimiter=delim)
    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return
    header = rows[0]
    cols = _detect_columns(header)

    has_symbol = "symbol" in cols or "underlying" in cols
    has_time = "datetime" in cols or "date" in cols
    if not (has_symbol and "side" in cols and "qty" in cols and "price" in cols and has_time):
        return  # not a recognizable executions layout

    for i, r in enumerate(rows[1:]):
        def cell(key: str) -> str:
            idx = cols.get(key)
            return r[idx].strip() if idx is not None and idx < len(r) else ""

        side = _map_side(cell("side"))
        if side is None:
            continue
        try:
            qty = int(float(cell("qty")))
        except ValueError:
            continue
        if qty <= 0:
            continue
        try:
            price = float(cell("price").replace("$", "").replace(",", ""))
        except ValueError:
            continue
        if price <= 0:
            continue

        if "datetime" in cols:
            ts = _parse_dt(cell("datetime"), None)
        else:
            ts = _parse_dt(cell("date"), None)
        if ts is None:
            continue

        sym_raw = cell("symbol") or cell("underlying")
        if not sym_raw:
            continue
        symbol = normalize_symbol(sym_raw)
        exch = cell("exchange")
        if exch and "." not in symbol:
            symbol = f"{symbol}.{exch}"
        spec = get_spec(symbol)

        account = cell("account") or "motivewave-unknown"
        order_id = cell("orderid")
        exec_id = cell("execid") or order_id
        fill_id = exec_id or f"mw-{ts.isoformat()}-{symbol}-{side}-{qty}-{price}-{i}"

        yield ParsedFill(
            fill_id=fill_id,
            internal_order_id=order_id,
            service_order_id=cell("execid"),
            parent_internal_order_id=None,
            fill_time=ts,
            symbol=symbol,
            instrument_root=spec["root"],
            side=side,
            quantity=qty,
            fill_price=price,
            raw_price=price,
            order_type=None,
            open_close=None,
            account_external_id=account,
            position_after=None,
            high_during_position=None,
            low_during_position=None,
            note=None,
            is_automated=False,
        )
