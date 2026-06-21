"""Process/app blocker.

Maintains an in-memory deny-list of executable names (case-insensitive,
matched against `proc.name()`). The kill loop is meant to be polled from
the agent's main loop.
"""
from __future__ import annotations

import sys
from typing import Iterable

import psutil

try:
    import ctypes  # stdlib; used for the Win32 session-id lookup below
except Exception:  # pragma: no cover
    ctypes = None  # type: ignore

# Resolve a process's Windows session id via the Win32 API. psutil exposes no
# public session-id accessor; the previous code used a PRIVATE attribute
# (p._proc.session_id()) that doesn't exist on standard psutil builds, so it
# raised for every process and per-app Stats were ALWAYS empty. ctypes ->
# kernel32!ProcessIdToSessionId is reliable and callable from the LocalSystem
# service (session 0).
_ProcessIdToSessionId = None
if sys.platform == "win32" and ctypes is not None:
    try:
        _ProcessIdToSessionId = ctypes.windll.kernel32.ProcessIdToSessionId
    except Exception:
        _ProcessIdToSessionId = None


def _session_of(pid: int) -> int | None:
    if _ProcessIdToSessionId is None:
        return None
    out = ctypes.c_ulong(0)  # type: ignore[union-attr]
    try:
        if _ProcessIdToSessionId(int(pid), ctypes.byref(out)):  # type: ignore[union-attr]
            return int(out.value)
    except Exception:
        return None
    return None


# Two separate kill lists with different policies:
#  _blocklist      — killed only while the PC is in a locked state
#                    (bedtime/limit/parent-lock). Outside lock = free play.
#  _always_blocklist — killed every tick, no matter what (true permanent ban).
_blocklist: set[str] = set()
_always_blocklist: set[str] = set()


def set_blocklist(names: Iterable[str]) -> None:
    global _blocklist
    _blocklist = {n.strip().lower() for n in names if n.strip()}


def set_always_blocklist(names: Iterable[str]) -> None:
    global _always_blocklist
    _always_blocklist = {n.strip().lower() for n in names if n.strip()}


def get_blocklist() -> list[str]:
    return sorted(_blocklist)


def get_always_blocklist() -> list[str]:
    return sorted(_always_blocklist)


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
            sid = _session_of(p.info["pid"])
            if sid is None or int(sid) != int(session_id):
                continue
            name = (p.info.get("name") or "").strip().lower()
            if not name or name in _SYSTEM_PROCESS_NAMES:
                continue
            seen.add(name)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return sorted(seen)


def kill_matching(names: set[str]) -> list[str]:
    """Kill any running processes whose exe name is in `names` and return their
    name+pid for logging."""
    if not names:
        return []
    killed: list[str] = []
    for proc in psutil.process_iter(attrs=["pid", "name"]):
        try:
            name = (proc.info.get("name") or "").lower()
            if name in names:
                proc.kill()
                killed.append(f"{name}({proc.info['pid']})")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return killed


def kill_blocked() -> list[str]:
    """Kill processes on the lock-only deny-list (caller decides when)."""
    return kill_matching(_blocklist)


def kill_always_blocked() -> list[str]:
    """Kill processes on the always-deny list (every tick, no exceptions)."""
    return kill_matching(_always_blocklist)
