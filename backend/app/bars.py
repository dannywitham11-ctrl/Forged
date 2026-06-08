"""Generic OHLCV bar parser for market-data uploads. Handles Sierra Chart's
'Write Bar and Study Data to File' exports (CSV or tab-separated) plus common
OHLCV CSV layouts, with header auto-detection and a positional fallback.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from .instruments import get_spec


@dataclass
class ParsedBar:
    ts: datetime
    o: float
    h: float
    l: float
    c: float
    v: float


_DT_FORMATS = (
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M",
    "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M",
    "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M",
)
_DATE_ONLY_FORMATS = ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y")


def _parse_dt(raw_date: str, raw_time: Optional[str]) -> Optional[datetime]:
    s = (raw_date or "").strip()
    if raw_time:
        s = f"{s} {raw_time.strip()}"
    s = re.sub(r"\s+", " ", s)
    for fmt in _DT_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    for fmt in _DATE_ONLY_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


_HEADER_ALIASES = {
    "date": {"date"},
    "time": {"time"},
    "datetime": {"datetime", "datatime", "datetimegmt", "date/time", "barstart", "bartime", "timestamp"},
    "o": {"open", "o"},
    "h": {"high", "h"},
    "l": {"low", "l"},
    "c": {"close", "last", "c"},
    "v": {"volume", "vol", "totalvolume", "totalvol", "v"},
}


def _detect_columns(header: list[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    norm = [_norm(h) for h in header]
    for key, aliases in _HEADER_ALIASES.items():
        for i, h in enumerate(norm):
            if h in aliases:
                out[key] = i
                break
    return out


def _looks_like_number(s: str) -> bool:
    try:
        float(s.replace(",", "").strip())
        return True
    except (ValueError, AttributeError):
        return False


def _flatten(d: dict[str, set[str]]) -> set[str]:
    out: set[str] = set()
    for v in d.values():
        out.update(v)
    return out


def parse_bars(
    file_bytes: bytes,
    symbol: str,
    price_divisor: Optional[float] = None,
    timeframe: str = "1m",
) -> tuple[list[ParsedBar], dict]:
    """Parse a Sierra bar export (or similar CSV). Returns (bars, meta).

    price_divisor: None auto-detects from the symbol; pass 1.0 to skip division.
    """
    text = file_bytes.decode("utf-8", errors="replace").lstrip("﻿")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters="\t,;|")
        delim = dialect.delimiter
    except csv.Error:
        delim = "," if sample.count(",") >= sample.count("\t") else "\t"

    reader = csv.reader(io.StringIO(text), delimiter=delim)
    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return [], {"delim": delim, "row_count": 0}

    header = rows[0]
    first_is_header = not _looks_like_number(header[0]) and any(
        _norm(h) in _flatten(_HEADER_ALIASES) for h in header
    )
    cols = _detect_columns(header) if first_is_header else {}
    data_start = 1 if first_is_header else 0

    # Positional fallback (Sierra default order) if no header detected.
    if not cols:
        if len(rows[0]) >= 7:
            cols = {"date": 0, "time": 1, "o": 2, "h": 3, "l": 4, "c": 5, "v": 6}
        elif len(rows[0]) >= 6:
            cols = {"datetime": 0, "o": 1, "h": 2, "l": 3, "c": 4, "v": 5}
        else:
            return [], {"error": "Could not detect OHLC columns", "first_row": rows[0]}

    if price_divisor is None:
        try:
            sample_close = float(rows[data_start][cols["c"]])
            spec_div = get_spec(symbol)["price_divisor"]
            if spec_div > 1 and sample_close > 50_000:
                price_divisor = spec_div
            else:
                price_divisor = 1.0
        except Exception:
            price_divisor = 1.0

    bars: list[ParsedBar] = []
    for r in rows[data_start:]:
        try:
            if "datetime" in cols:
                ts = _parse_dt(r[cols["datetime"]], None)
            else:
                ts = _parse_dt(r[cols["date"]], r[cols["time"]] if "time" in cols else None)
            if ts is None:
                continue
            o = float(r[cols["o"]]) / price_divisor
            h = float(r[cols["h"]]) / price_divisor
            l = float(r[cols["l"]]) / price_divisor
            c = float(r[cols["c"]]) / price_divisor
            v = float(r[cols["v"]]) if "v" in cols and r[cols["v"]].strip() else 0.0
            bars.append(ParsedBar(ts=ts, o=o, h=h, l=l, c=c, v=v))
        except (ValueError, IndexError):
            continue

    return bars, {
        "delim": delim,
        "row_count": len(rows),
        "data_rows": len(rows) - data_start,
        "parsed": len(bars),
        "price_divisor": price_divisor,
        "header_detected": first_is_header,
        "columns": cols,
        "timeframe": timeframe,
    }
