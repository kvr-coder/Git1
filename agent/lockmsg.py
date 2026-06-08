"""Tell the kid when the PC will be usable again.

Two channels (Windows lock screen is a Secure Desktop, so apps can't draw on
it directly):

1. PRE-LOCK BANNER: a 30-second friendly tk window shown by the agent BEFORE
   it issues a lock, so the kid sees "Your time is up. Next available Mon 16:00"
   on their normal desktop. Best-effort — doesn't block enforcement.

2. LOGON-SCREEN MESSAGE: set Windows' built-in legal-notice text (the dialog
   that appears at the lock/login screen before sign-in). We update it whenever
   the schedule changes; Recover-Git1 clears it.

Compute "next available" from the schedule list — the next moment when no
"lock" action is active. If schedules don't restrict logon, returns None.
"""
from __future__ import annotations

import datetime as dt
import subprocess
import sys
import threading
import time
from typing import Iterable, Optional

_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_DAY_IDX = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
            "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
            "friday": 4, "saturday": 5, "sunday": 6}


def _allowed_set(scheds: Iterable[dict]) -> Optional[set[tuple[int, int]]]:
    """{(weekday, minute_of_day)} where logon is allowed. None = unrestricted."""
    lock_scheds = [s for s in scheds
                   if s.get("enabled", True) and "lock" in (s.get("actions") or [])]
    if not lock_scheds:
        return None
    allowed: set[tuple[int, int]] = set()
    for s in lock_scheds:
        start = max(0, int(s.get("startMinute", 0)))
        end   = min(24 * 60, int(s.get("endMinute", 0)))
        for d in (s.get("days") or []):
            idx = _DAY_IDX.get(str(d).strip().lower()[:3])
            if idx is None:
                continue
            for m in range(start, end):
                allowed.add((idx, m))
    return allowed


def next_available(scheds: Iterable[dict], now: dt.datetime | None = None) -> Optional[dt.datetime]:
    """Next moment within the next 7 days when usage is allowed; None if always."""
    allowed = _allowed_set(scheds)
    if allowed is None:
        return None
    now = now or dt.datetime.now()
    cur = now.replace(second=0, microsecond=0)
    for delta in range(7 * 24 * 60):
        t = cur + dt.timedelta(minutes=delta)
        key = (t.weekday(), t.hour * 60 + t.minute)
        if key in allowed:
            return t
    return None


def humanize(t: dt.datetime, now: dt.datetime | None = None) -> str:
    now = now or dt.datetime.now()
    same_day = t.date() == now.date()
    tomorrow = (t.date() - now.date()).days == 1
    hm = t.strftime("%H:%M")
    if same_day:
        return f"today at {hm}"
    if tomorrow:
        return f"tomorrow at {hm}"
    return f"{_DAYS[t.weekday()]} at {hm}"


# ---------- (1) pre-lock banner ----------
def show_prelock_banner(schedules: list[dict], seconds: int = 30) -> None:
    """Show a 30-second friendly window before locking. Best-effort."""
    if sys.platform != "win32":
        return
    next_t = next_available(schedules)
    msg = ("Time's up. " + ("Next available " + humanize(next_t) if next_t else
                            "Ask a parent for more time."))

    def _show() -> None:
        try:
            import tkinter as tk
        except Exception:  # noqa: BLE001
            return
        try:
            root = tk.Tk()
            root.title("Git1")
            root.overrideredirect(True)
            root.attributes("-topmost", True)
            root.attributes("-alpha", 0.95)
            bg = "#0b1220"
            root.configure(bg=bg)
            f = tk.Frame(root, bg=bg, padx=24, pady=18)
            f.pack()
            tk.Label(f, text="Your screen time is up.", fg="#fca5a5", bg=bg,
                     font=("Segoe UI", 18, "bold")).pack()
            tk.Label(f, text=msg, fg="#e8eef7", bg=bg,
                     font=("Segoe UI", 13)).pack(pady=(6, 4))
            tk.Label(f, text="The PC will lock in a few seconds.", fg="#8aa0c0",
                     bg=bg, font=("Segoe UI", 10)).pack()
            root.update_idletasks()
            w, h = root.winfo_reqwidth(), root.winfo_reqheight()
            sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
            root.geometry(f"+{(sw - w)//2}+{(sh - h)//2}")
            root.after(int(seconds * 1000), root.destroy)
            root.mainloop()
        except Exception:  # noqa: BLE001
            pass

    threading.Thread(target=_show, daemon=True).start()


# ---------- (2) logon-screen message ----------
_REG_PATH = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"


def _reg(args: list[str]) -> tuple[int, str]:
    if sys.platform != "win32":
        return 0, "(noop)"
    try:
        r = subprocess.run(["reg", *args], capture_output=True, text=True, timeout=10)
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as e:  # noqa: BLE001
        return 1, str(e)


def sync_logon_message(schedules: list[dict]) -> None:
    """Update the lock-/logon-screen dialog with the next allowed time."""
    next_t = next_available(schedules)
    if not next_t:
        clear_logon_message()
        return
    caption = "Git1 — screen time"
    text = (f"This PC is paused. Next allowed: {humanize(next_t)}\\n\\n"
            "Ask a parent if you need access sooner.")
    _reg(["add", _REG_PATH, "/v", "legalnoticecaption", "/t", "REG_SZ",
          "/d", caption, "/f"])
    _reg(["add", _REG_PATH, "/v", "legalnoticetext", "/t", "REG_SZ",
          "/d", text, "/f"])


def clear_logon_message() -> None:
    _reg(["delete", _REG_PATH, "/v", "legalnoticecaption", "/f"])
    _reg(["delete", _REG_PATH, "/v", "legalnoticetext", "/f"])
