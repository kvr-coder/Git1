"""NTP-anchored time + clock-tamper detection.

We can't trust the local clock for limit calculations because the kid can
shift it back. On startup we query a public NTP server and compute an
offset; the agent uses `now_trusted()` everywhere a tamper-resistant
timestamp matters.

The offset is also PERSISTED to disk so an offline reboot can't reset it.
On startup we load it back; if NTP is unreachable (no network), enforcement
still uses the last-known-good anchor instead of the shifted local clock.

If the local clock subsequently drifts more than `TAMPER_THRESHOLD_SEC`
from NTP, we emit a `clock_tamper` event.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import time
from pathlib import Path
from typing import Optional

import ntplib

NTP_SERVERS = ["time.windows.com", "time.google.com", "pool.ntp.org"]
TAMPER_THRESHOLD_SEC = 60.0

# Persist next to the agent's other state, so SYSTEM owns/writes it (the kid
# can't tamper with the offset file).
_PERSIST_DIR = Path(
    os.environ.get("APPDATA", str(Path.home() / ".config"))
) / "Git1"
_PERSIST_PATH = _PERSIST_DIR / "clock-anchor.json"

_offset: float = 0.0          # seconds to add to time.time() to get trusted unix
_last_check: float = 0.0
_last_drift: float = 0.0
_last_trusted: float = 0.0    # highest trusted time we've ever seen (ratchet)


def _load_persist() -> None:
    """Restore the last NTP anchor + ratchet from disk on startup."""
    global _offset, _last_check, _last_trusted
    try:
        if _PERSIST_PATH.exists():
            d = json.loads(_PERSIST_PATH.read_text())
            _offset = float(d.get("offset") or 0.0)
            _last_check = float(d.get("lastCheck") or 0.0)
            _last_trusted = float(d.get("lastTrusted") or 0.0)
    except Exception:
        pass


def _save_persist() -> None:
    try:
        _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        _PERSIST_PATH.write_text(
            json.dumps({"offset": _offset, "lastCheck": _last_check, "lastTrusted": _last_trusted}),
        )
    except Exception:
        pass


_load_persist()


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
    _save_persist()
    return _offset


def now_trusted() -> float:
    """Unix timestamp anchored to NTP time. NEVER goes backwards: a kid who
    shifts the local clock back AFTER we've seen a higher trusted time gets a
    ratcheted "stuck" trusted time instead of the rolled-back one — so
    bedtime stays bedtime even on a sneaky reboot."""
    global _last_trusted
    candidate = time.time() + _offset
    if candidate < _last_trusted:
        # Local clock was rolled back. Don't trust it.
        return _last_trusted
    if candidate > _last_trusted:
        _last_trusted = candidate
        # Cheap persist: only every ~10s so we don't hammer the disk.
        if int(candidate) % 10 == 0:
            _save_persist()
    return candidate


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
