"""UUID v7 — time-ordered UUIDs (RFC 9562).

Why v7 over v4 for primary keys: the leading 48 bits are a Unix timestamp,
so new rows land at the "right edge" of the B-tree index instead of random
pages. At tens of millions of rows this dramatically reduces index bloat
and keeps inserts fast — while staying a standard 128-bit UUID.
"""
import os
import time
import uuid


def uuid7() -> uuid.UUID:
    unix_ms = time.time_ns() // 1_000_000
    rand_a = int.from_bytes(os.urandom(2), "big") & 0x0FFF
    rand_b = int.from_bytes(os.urandom(8), "big") & 0x3FFF_FFFF_FFFF_FFFF

    value = (unix_ms & 0xFFFF_FFFF_FFFF) << 80   # 48-bit timestamp
    value |= 0x7 << 76                            # version 7
    value |= rand_a << 64                         # 12 random bits
    value |= 0b10 << 62                           # RFC variant
    value |= rand_b                               # 62 random bits
    return uuid.UUID(int=value)
