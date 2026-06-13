"""True OS-level logon block via Windows logon hours.

The old approach (a 5-second `LockWorkStation` re-lock loop) lets the child
use the PC for ~5s each cycle and can't stop them logging on at all. The
robust mechanism Windows provides is **logon hours** (`net user <u> /times`):
outside the allowed weekly windows the child literally cannot log on, and an
active session is locked/logged-off when the window expires.

SAFETY MODEL (important — this can lock a user out of a machine):
  * Does NOTHING unless GIT1_CHILD_USER names a local account.
  * REFUSES to act on the account the agent itself runs under (so it can
    never lock the parent/admin out of their own session).
  * Granularity is whole hours (a Windows limitation).
  * `clear()` restores 24/7 access — call it for recovery.

Allowed windows are derived from the parent's schedules: a schedule whose
actions include "lock" defines a *permitted* usage window (inside the window);
the union of those windows across schedules is when logon is allowed. With no
lock-schedules, access is left unrestricted (24/7).
"""
from __future__ import annotations

import os
import subprocess
import sys

# net user /times day tokens, Monday-first.
_DAYS = ["M", "T", "W", "Th", "F", "Sa", "Su"]


def _run(args: list[str]) -> tuple[int, str]:
    if sys.platform != "win32":
        return 0, "(noop on non-Windows)"
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=10)
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as e:  # noqa: BLE001
        return 1, str(e)


def _agent_user() -> str:
    return (os.environ.get("USERNAME") or "").strip().lower()


def child_user() -> str | None:
    """The local account to govern, or None to disable the whole feature."""
    name = (os.environ.get("GIT1_CHILD_USER") or "").strip()
    if not name:
        return None
    if name.lower() == _agent_user():
        # Never govern our own session — that's the self-lockout footgun.
        print(f"[logon] GIT1_CHILD_USER ({name}) == agent user — refusing (self-lockout guard).")
        return None
    return name


# ---------- schedule -> allowed weekly windows ----------
def _allowed_hours_by_day(schedules: list[dict]) -> dict[int, set[int]] | None:
    """Return {weekday0Mon: {allowed hour ints}} or None if unrestricted.

    Only schedules whose actions include 'lock' constrain logon. The schedule
    window [start,end) is the BLOCK period (lock during it), so allowed hours =
    the full day MINUS the union of block windows. Overnight windows (start>end,
    e.g. 21:00-07:00) are handled by splitting into [start,24) and [0,end).
    """
    lock_scheds = [
        s for s in schedules
        if s.get("enabled", True) and "lock" in (s.get("actions") or [])
    ]
    if not lock_scheds:
        return None  # nothing restricts logon -> leave 24/7

    day_name_to_idx = {
        "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }
    # Start fully allowed; subtract blocked hours per day.
    allowed: dict[int, set[int]] = {d: set(range(24)) for d in range(7)}
    any_block = False
    for s in lock_scheds:
        start_h = max(0, int(s.get("startMinute", 0)) // 60)
        end_min = int(s.get("endMinute", 0))
        end_h = min(24, (end_min + 59) // 60)  # round up so partial last hour is blocked
        if start_h < end_h:
            blocked_hours = set(range(start_h, end_h))
        else:
            # Overnight wrap: block [start,24) and [0,end)
            blocked_hours = set(range(start_h, 24)) | set(range(0, end_h))
        if not blocked_hours:
            continue
        any_block = True
        for d in (s.get("days") or []):
            idx = day_name_to_idx.get(str(d).strip().lower()[:3])
            if idx is not None:
                allowed[idx] -= blocked_hours
    if not any_block:
        return None
    return allowed


def _times_string(allowed: dict[int, set[int]]) -> str:
    """Build a `net user /times` value, e.g. 'M-F,16:00-19:00;Sa,10:00-20:00'."""
    parts: list[str] = []
    for d in range(7):
        hours = sorted(allowed.get(d, set()))
        if not hours:
            continue
        # collapse contiguous hours into ranges
        ranges: list[tuple[int, int]] = []
        run_start = hours[0]
        prev = hours[0]
        for h in hours[1:]:
            if h == prev + 1:
                prev = h
                continue
            ranges.append((run_start, prev))
            run_start = prev = h
        ranges.append((run_start, prev))
        for a, b in ranges:
            # b is the last allowed hour; window end is b+1:00
            parts.append(f"{_DAYS[d]},{a:02d}:00-{(b + 1):02d}:00")
    return ";".join(parts)


# ---------- public API ----------
def sync(schedules: list[dict]) -> None:
    """Apply logon hours for the child user based on schedules. No-op if the
    feature is disabled (no/invalid GIT1_CHILD_USER)."""
    user = child_user()
    if not user:
        return
    allowed = _allowed_hours_by_day(schedules)
    if allowed is None:
        clear()
        return
    times = _times_string(allowed)
    if not times:
        # All lock-schedules but zero allowed hours would mean "never log on".
        # That's almost certainly a misconfig; refuse rather than brick login.
        print("[logon] computed zero allowed hours — refusing (would block all logon).")
        return
    code, out = _run(["net", "user", user, f"/times:{times}"])
    if code != 0:
        print(f"[logon] set times FAILED for {user}: {out}")
    else:
        print(f"[logon] {user} logon hours = {times}")


def clear() -> None:
    """Restore 24/7 logon for the child user (recovery / no restriction)."""
    user = child_user()
    if not user:
        return
    code, out = _run(["net", "user", user, "/times:all"])
    if code != 0:
        print(f"[logon] clear FAILED for {user}: {out}")
    else:
        print(f"[logon] {user} logon hours cleared (24/7).")
