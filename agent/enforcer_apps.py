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


_SYSTEM_PROCESS_NAMES = {
    "system", "system idle process", "registry", "memory compression",
    "svchost.exe", "services.exe", "lsass.exe", "smss.exe", "csrss.exe",
    "winlogon.exe", "fontdrvhost.exe", "dwm.exe", "wininit.exe", "spoolsv.exe",
    "searchindexer.exe", "searchprotocolhost.exe", "searchfilterhost.exe",
    "audiodg.exe", "conhost.exe", "ctfmon.exe", "runtimebroker.exe", "applicationframehost.exe",
    "sihost.exe", "taskhostw.exe", "explorer.exe",
    "nssm.exe", "python.exe", "pythonw.exe",
}

def running_user_apps_by_session(session_id: int) -> list[str]:
    """Return distinct lowercased exe names of processes in the given session,
    skipping common system/agent processes so per-app usage stays meaningful."""
    seen: set[str] = set()
    if session_id is None:
        return []
    for p in psutil.process_iter(attrs=["pid", "name"]):
        try:
            # psutil exposes session id on Windows via win_service-or-process detail.
            # Cheapest check: psutil.Process(pid).num_handles fails for cross-session;
            # use _ppid/exe walking? Simpler: read p._proc.session_id() on Windows.
            try:
                sid = p._proc.session_id()  # type: ignore[attr-defined]
            except Exception:
                sid = None
            if sid is None or int(sid) != int(session_id):
                continue
            name = (p.info.get("name") or "").strip().lower()
            if not name or name in _SYSTEM_PROCESS_NAMES:
                continue
            seen.add(name)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return sorted(seen)


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
