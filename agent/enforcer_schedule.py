"""Schedule enforcement.

A schedule defines an *allowed window* on a set of days. When the wall
clock falls outside the union of all enabled schedule windows for a day,
the agent should keep the workstation locked.

Schedules are pushed from the server as a list of dicts with the same
shape as the mobile-app `Schedule` type.
"""
from __future__ import annotations

import datetime as dt
from typing import Any

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

_schedules: list[dict[str, Any]] = []


def set_schedules(items: list[dict[str, Any]]) -> None:
    global _schedules
    _schedules = list(items)


def get_schedules() -> list[dict[str, Any]]:
    return list(_schedules)


def _now_minute(now: dt.datetime | None = None) -> tuple[str, int]:
    n = now or dt.datetime.now()
    return DAY_KEYS[n.weekday()], n.hour * 60 + n.minute


def _in_window(start: int, end: int, minute: int) -> bool:
    if start <= end:
        return start <= minute < end
    # Window wraps midnight (e.g. 21:00 → 07:00)
    return minute >= start or minute < end


def is_currently_allowed(now: dt.datetime | None = None) -> bool:
    """Back-compat: True if at least one enabled schedule covers now."""
    return not active_actions(now)


def active_actions(now: dt.datetime | None = None) -> set[str]:
    """Union of enforcement actions whose windows are currently *outside*.

    A schedule is in deny-mode when its day matches today AND `now` falls
    OUTSIDE the schedule's allowed window. Each deny-mode schedule
    contributes its `actions` (e.g. {"lock", "block_internet"}). Schedules
    that don't apply today (wrong weekday) are ignored entirely so that a
    'School nights' Mon-Thu schedule doesn't lock the PC on Friday.
    """
    actions: set[str] = set()
    day, minute = _now_minute(now)
    for s in _schedules:
        if not s.get("enabled"):
            continue
        if day not in (s.get("days") or []):
            continue
        if _in_window(int(s["startMinute"]), int(s["endMinute"]), minute):
            continue  # currently allowed by this schedule
        for a in s.get("actions") or ["lock"]:
            actions.add(a)
    return actions
