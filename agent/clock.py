"""NTP-anchored time + clock-tamper detection.

We can't trust the local clock for limit calculations because the kid can
shift it back. On startup we query a public NTP server and compute an
offset; the agent uses `now_trusted()` everywhere a tamper-resistant
timestamp matters.

If the local clock subsequently drifts more than `TAMPER_THRESHOLD_SEC`
from NTP, we emit a `clock_tamper` event.
"""
from __future__ import annotations

import datetime as dt
import time
from typing import Optional

import ntplib

NTP_SERVERS = ["time.windows.com", "time.google.com", "pool.ntp.org"]
TAMPER_THRESHOLD_SEC = 60.0

_offset: float = 0.0          # seconds to add to time.time() to get trusted unix
_last_check: float = 0.0
_last_drift: float = 0.0


def _query_ntp() -> Optional[float]:
    client = ntplib.NTPClient()
    for host in NTP_SERVERS:
        try:
            r = client.request(host, version=3, timeout=3)
            return r.tx_time - time.time()
        except Exception:
            continue
    return None


def refresh(force: bool = False) -> Optional[float]:
    """Re-sync with NTP. Returns the new offset, or None if all servers failed."""
    global _offset, _last_check
    now = time.time()
    if not force and (now - _last_check) < 600:  # at most every 10 min
        return _offset
    o = _query_ntp()
    if o is None:
        return None
    _offset = o
    _last_check = now
    return _offset


def now_trusted() -> float:
    """Unix timestamp anchored to NTP time."""
    return time.time() + _offset


def now_trusted_dt() -> dt.datetime:
    return dt.datetime.fromtimestamp(now_trusted())


def check_drift() -> float:
    """Compare the *currently observed* offset to the cached one. A sudden
    jump indicates the kid changed the local clock.
    """
    global _last_drift
    fresh = _query_ntp()
    if fresh is None:
        return _last_drift
    drift = abs(fresh - _offset)
    _last_drift = drift
    return drift


def is_tampered() -> bool:
    return _last_drift > TAMPER_THRESHOLD_SEC
