"""Reader for Sierra Chart's `TradeAccountData_*.data` files.

Binary TLV streams from Sierra's TradeAccountData folder. Repeating records:
    int32_le field_id, int32_le length, byte[length] value.

Confirmed fields (by comparing 2004 to a known broker balance):
    2001 string   account external id (e.g. "APEX-123456-69")
    2002 string   currency code
    2004 float64  current account balance (matches broker)
    2005 float64  high-water / peak balance
    2009 float64  session or open P&L

The remaining ~137 fields are mostly zeros/flags and aren't needed to reconcile.
"""
from __future__ import annotations

import os
import struct
from dataclasses import dataclass
from typing import Iterator, Optional


@dataclass
class TLVRecord:
    field_id: int
    length: int
    value: bytes

    def as_u64(self) -> Optional[int]:
        if self.length != 8:
            return None
        return struct.unpack("<Q", self.value)[0]

    def as_f64(self) -> Optional[float]:
        if self.length != 8:
            return None
        return struct.unpack("<d", self.value)[0]

    def as_u32(self) -> Optional[int]:
        if self.length != 4:
            return None
        return struct.unpack("<I", self.value)[0]

    def as_u8(self) -> Optional[int]:
        if self.length != 1:
            return None
        return self.value[0]

    def as_string(self) -> Optional[str]:
        try:
            return self.value.decode("utf-8")
        except UnicodeDecodeError:
            return None


def iter_records(data: bytes) -> Iterator[TLVRecord]:
    off = 0
    while off + 8 <= len(data):
        fid, ln = struct.unpack_from("<II", data, off)
        off += 8
        if off + ln > len(data):
            break
        yield TLVRecord(fid, ln, data[off:off + ln])
        off += ln


@dataclass
class TradeAccountData:
    external_id: Optional[str]
    currency: Optional[str]
    balance: Optional[float]
    high_water_mark: Optional[float]
    session_pnl: Optional[float]
    raw_records: list[TLVRecord]


KNOWN_FIELDS = {
    2001: ("external_id", "string"),
    2002: ("currency", "string"),
    2004: ("balance", "f64"),
    2005: ("high_water_mark", "f64"),
    2009: ("session_pnl", "f64"),
}


def parse_data_file(path: str) -> TradeAccountData:
    with open(path, "rb") as f:
        data = f.read()
    return parse_data_bytes(data)


def parse_data_bytes(data: bytes) -> TradeAccountData:
    out = TradeAccountData(None, None, None, None, None, [])
    for rec in iter_records(data):
        out.raw_records.append(rec)
        meta = KNOWN_FIELDS.get(rec.field_id)
        if not meta:
            continue
        attr, kind = meta
        if kind == "string":
            setattr(out, attr, rec.as_string())
        elif kind == "f64":
            setattr(out, attr, rec.as_f64())
        elif kind == "u64":
            setattr(out, attr, rec.as_u64())
    return out


def scan_folder(folder: str) -> list[tuple[str, TradeAccountData]]:
    """Parse every TradeAccount*.data file in a folder. Returns (filename, record) pairs."""
    if not os.path.isdir(folder):
        return []
    results = []
    for name in sorted(os.listdir(folder)):
        if not name.lower().endswith(".data"):
            continue
        if "tradeaccount" not in name.lower():
            continue
        full = os.path.join(folder, name)
        try:
            results.append((name, parse_data_file(full)))
        except (OSError, struct.error):
            continue
    return results
