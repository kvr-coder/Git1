"""Process/app blocker.

Maintains an in-memory deny-list of executable names (case-insensitive,
matched against `proc.name()`). The kill loop is meant to be polled from
the agent's main loop.
"""
from __future__ import annotations

from typing import Iterable

import psutil

_blocklist: set[str] = set()


def set_blocklist(names: Iterable[str]) -> None:
    global _blocklist
    _blocklist = {n.strip().lower() for n in names if n.strip()}


def get_blocklist() -> list[str]:
    return sorted(_blocklist)


def kill_blocked() -> list[str]:
    """Iterate processes and kill any whose name matches the deny-list.

    Returns the list of killed process names (with PID for logging).
    """
    if not _blocklist:
        return []
    killed: list[str] = []
    for proc in psutil.process_iter(attrs=["pid", "name"]):
        try:
            name = (proc.info.get("name") or "").lower()
            if name in _blocklist:
                proc.kill()
                killed.append(f"{name}({proc.info['pid']})")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return killed
