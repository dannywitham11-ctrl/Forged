"""Futures contract specs.

Sierra exports prices as integer ticks (display price * price_divisor), so the
parser divides by ``price_divisor`` to recover the human price. ``point_value``
is the dollar value of one full point. Unknown roots fall back to DEFAULT_SPEC.
"""
import re

INSTRUMENT_SPECS = {
    "MNQ": {"price_divisor": 100.0, "point_value": 2.0, "tick_size": 0.25, "name": "Micro E-mini Nasdaq-100"},
    "MES": {"price_divisor": 100.0, "point_value": 5.0, "tick_size": 0.25, "name": "Micro E-mini S&P 500"},
    "M2K": {"price_divisor": 100.0, "point_value": 5.0, "tick_size": 0.10, "name": "Micro E-mini Russell 2000"},
    "MYM": {"price_divisor": 100.0, "point_value": 0.50, "tick_size": 1.0, "name": "Micro E-mini Dow"},
    "NQ": {"price_divisor": 100.0, "point_value": 20.0, "tick_size": 0.25, "name": "E-mini Nasdaq-100"},
    "ES": {"price_divisor": 100.0, "point_value": 50.0, "tick_size": 0.25, "name": "E-mini S&P 500"},
    "RTY": {"price_divisor": 100.0, "point_value": 50.0, "tick_size": 0.10, "name": "E-mini Russell 2000"},
    "YM": {"price_divisor": 100.0, "point_value": 5.0, "tick_size": 1.0, "name": "E-mini Dow"},
    "GC": {"price_divisor": 10.0, "point_value": 100.0, "tick_size": 0.10, "name": "Gold"},
    "MGC": {"price_divisor": 10.0, "point_value": 10.0, "tick_size": 0.10, "name": "Micro Gold"},
    "SI": {"price_divisor": 1000.0, "point_value": 5000.0, "tick_size": 0.005, "name": "Silver"},
    "SIL": {"price_divisor": 1000.0, "point_value": 1000.0, "tick_size": 0.005, "name": "Micro Silver"},
    "CL": {"price_divisor": 100.0, "point_value": 1000.0, "tick_size": 0.01, "name": "Crude Oil"},
    "MCL": {"price_divisor": 100.0, "point_value": 100.0, "tick_size": 0.01, "name": "Micro Crude Oil"},
    "NG": {"price_divisor": 1000.0, "point_value": 10000.0, "tick_size": 0.001, "name": "Natural Gas"},
    "MBT": {"price_divisor": 1.0, "point_value": 0.10, "tick_size": 5.0, "name": "Micro Bitcoin"},
    "MET": {"price_divisor": 100.0, "point_value": 0.10, "tick_size": 0.50, "name": "Micro Ether"},
    "6E": {"price_divisor": 10000.0, "point_value": 125000.0, "tick_size": 0.00005, "name": "Euro FX"},
    "M6E": {"price_divisor": 10000.0, "point_value": 12500.0, "tick_size": 0.0001, "name": "Micro Euro"},
    # Eurex Bund. Native is €1000/point, tick 0.01 = €10. Prop firms often apply
    # the same 1000 multiplier directly in USD, so this works either way.
    "FGBL": {"price_divisor": 100.0, "point_value": 1000.0, "tick_size": 0.01, "name": "Euro Bund (10y)"},
}

DEFAULT_SPEC = {"price_divisor": 1.0, "point_value": 1.0, "tick_size": 0.01, "name": "Unknown"}

# root + month-code letter + year digit(s) + optional .EXCHANGE
_ROOT_RE = re.compile(r"^([A-Z0-9]{1,4}?)([FGHJKMNQUVXZ])(\d{1,2})(\..+)?$")


def extract_root(symbol: str) -> str:
    if not symbol:
        return ""
    base = symbol.split(".")[0]
    # Longest known root that prefixes the symbol and is followed by month+year.
    for root in sorted(INSTRUMENT_SPECS.keys(), key=len, reverse=True):
        if base.startswith(root) and len(base) >= len(root) + 2:
            rest = base[len(root):]
            if rest[0] in "FGHJKMNQUVXZ" and rest[1:].isdigit():
                return root
    m = _ROOT_RE.match(base)
    if m:
        return m.group(1)
    return base


def get_spec(symbol: str) -> dict:
    root = extract_root(symbol)
    spec = INSTRUMENT_SPECS.get(root, DEFAULT_SPEC).copy()
    spec["root"] = root
    return spec
