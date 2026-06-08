"""Sierra Chart .scid binary intraday-data reader.

Format: https://www.sierrachart.com/index.php?page=doc/IntradayDataFileFormat.html

  Header (56 bytes): 'SCID', int32 HeaderSize, int32 RecordSize(40), int16 Version,
                     int16 Unused, int32 UTCStartIndex, char[36] Reserve.
  Record (40 bytes): int64 StartDateTime (µs since 1899-12-30 UTC), float O/H/L/C,
                     uint32 NumTrades, TotalVolume, BidVolume, AskVolume.

Records hold either tick events (O=H=L=C=price, volume=1) or pre-bucketed bars;
we aggregate raw records into bars at the requested timeframe. The SCDateTime
epoch (1899-12-30) is 25,569 days before the Unix epoch.
"""
from __future__ import annotations

import os
import struct
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterator, Optional

SC_EPOCH_OFFSET_SECONDS = 25569 * 86_400  # 2,209,161,600

HEADER_FMT = "<4siihhi36s"
HEADER_SIZE = struct.calcsize(HEADER_FMT)  # 56
RECORD_FMT = "<qffffIIII"
RECORD_SIZE = struct.calcsize(RECORD_FMT)  # 40


@dataclass
class ScidHeader:
    magic: bytes
    header_size: int
    record_size: int
    version: int
    utc_start_index: int


@dataclass
class ScidRecord:
    ts: datetime
    o: float
    h: float
    l: float
    c: float
    num_trades: int
    total_volume: int
    bid_volume: int
    ask_volume: int


def parse_header(data: bytes) -> ScidHeader:
    if len(data) < HEADER_SIZE:
        raise ValueError(f"File too small to be a .scid header ({len(data)} bytes)")
    magic, header_size, record_size, version, _unused, utc_start_index, _reserve = struct.unpack(
        HEADER_FMT, data[:HEADER_SIZE]
    )
    if magic != b"SCID":
        raise ValueError(f"Not a .scid file — magic was {magic!r}, expected b'SCID'")
    if record_size != RECORD_SIZE:
        raise ValueError(f"Unsupported .scid record size {record_size} (expected {RECORD_SIZE})")
    return ScidHeader(magic, header_size, record_size, version, utc_start_index)


def _to_dt(sc_us: int) -> Optional[datetime]:
    unix_us = sc_us - SC_EPOCH_OFFSET_SECONDS * 1_000_000
    try:
        return datetime.fromtimestamp(unix_us / 1_000_000, tz=timezone.utc).replace(tzinfo=None)
    except (ValueError, OSError, OverflowError):
        return None


def iter_records(data: bytes) -> Iterator[ScidRecord]:
    """Iterate records from an in-memory buffer (small files only)."""
    header = parse_header(data)
    offset = header.header_size
    end = len(data) - ((len(data) - header.header_size) % RECORD_SIZE)
    record_struct = struct.Struct(RECORD_FMT)
    while offset + RECORD_SIZE <= end:
        sc_us, o, h, l, c, n, tv, bv, av = record_struct.unpack_from(data, offset)
        offset += RECORD_SIZE
        ts = _to_dt(sc_us)
        if ts is None:
            continue
        yield ScidRecord(ts, o, h, l, c, n, tv, bv, av)


def iter_records_path(path: str, chunk_records: int = 65_536) -> Iterator[ScidRecord]:
    """Stream records from a .scid file on disk; memory stays bounded."""
    record_struct = struct.Struct(RECORD_FMT)
    with open(path, "rb") as f:
        header_bytes = f.read(HEADER_SIZE)
        header = parse_header(header_bytes)
        if header.header_size > HEADER_SIZE:
            f.read(header.header_size - HEADER_SIZE)  # skip padding
        chunk_size = chunk_records * RECORD_SIZE
        while True:
            buf = f.read(chunk_size)
            if not buf:
                break
            usable = len(buf) - (len(buf) % RECORD_SIZE)
            for offset in range(0, usable, RECORD_SIZE):
                sc_us, o, h, l, c, n, tv, bv, av = record_struct.unpack_from(buf, offset)
                ts = _to_dt(sc_us)
                if ts is None:
                    continue
                yield ScidRecord(ts, o, h, l, c, n, tv, bv, av)


_INTERVAL_SECONDS = {
    "1s": 1, "5s": 5, "10s": 10, "15s": 15, "30s": 30,
    "1m": 60, "2m": 120, "3m": 180, "5m": 300, "10m": 600, "15m": 900, "30m": 1800,
    "1h": 3600, "2h": 7200, "4h": 14400,
    "1d": 86400,
}


@dataclass
class Bar:
    ts: datetime
    o: float
    h: float
    l: float
    c: float
    v: float


def _is_valid_price(p: float) -> bool:
    """Reject Sierra's invalid/sentinel prices (0, NaN, huge negatives). The
    ``p == p`` test rejects NaN."""
    return p == p and 1e-6 < p < 1e10


def _sanitize(rec: ScidRecord) -> Optional[tuple[float, float, float, float, int]]:
    """Replace invalid OHLC values with the close; None if even the close is junk."""
    c = rec.c
    if not _is_valid_price(c):
        for fallback in (rec.o, rec.h, rec.l):
            if _is_valid_price(fallback):
                c = fallback
                break
        else:
            return None
    o = rec.o if _is_valid_price(rec.o) else c
    h = rec.h if _is_valid_price(rec.h) else c
    l = rec.l if _is_valid_price(rec.l) else c
    h = max(h, o, c)
    l = min(l, o, c)
    return (o, h, l, c, rec.total_volume)


def aggregate_to_bars(records: Iterator[ScidRecord], timeframe: str = "1m") -> Iterator[Bar]:
    interval = _INTERVAL_SECONDS.get(timeframe)
    if not interval:
        raise ValueError(f"Unknown timeframe '{timeframe}'. Try one of: {list(_INTERVAL_SECONDS)}")
    current_bucket: Optional[int] = None
    cur_o = cur_h = cur_l = cur_c = 0.0
    cur_v = 0
    for r in records:
        san = _sanitize(r)
        if san is None:
            continue
        o, h, l, c, v = san
        bucket = int(r.ts.timestamp()) // interval * interval
        if current_bucket is None:
            current_bucket = bucket
            cur_o, cur_h, cur_l, cur_c, cur_v = o, h, l, c, v
            continue
        if bucket != current_bucket:
            yield Bar(ts=datetime.utcfromtimestamp(current_bucket),
                      o=cur_o, h=cur_h, l=cur_l, c=cur_c, v=cur_v)
            current_bucket = bucket
            cur_o, cur_h, cur_l, cur_c, cur_v = o, h, l, c, v
        else:
            cur_h = max(cur_h, h)
            cur_l = min(cur_l, l)
            cur_c = c
            cur_v += v
    if current_bucket is not None:
        yield Bar(ts=datetime.utcfromtimestamp(current_bucket),
                  o=cur_o, h=cur_h, l=cur_l, c=cur_c, v=cur_v)


def read_scid_bytes(data: bytes, timeframe: str = "1m") -> list[Bar]:
    return list(aggregate_to_bars(iter_records(data), timeframe))


def read_scid_path(path: str, timeframe: str = "1m") -> Iterator[Bar]:
    """Stream-aggregate a .scid file from disk into bars."""
    return aggregate_to_bars(iter_records_path(path), timeframe)


def scid_file_stats(path: str) -> dict:
    """Basic stats about a .scid file without fully parsing it."""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        header_bytes = f.read(HEADER_SIZE)
        header = parse_header(header_bytes)
    record_count = (size - header.header_size) // RECORD_SIZE
    return {"size_bytes": size, "version": header.version, "record_count": record_count}
