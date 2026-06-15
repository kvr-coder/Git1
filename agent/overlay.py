"""Subtle always-on-top desktop overlay showing time left.

Designed to reduce reactance (Van Petegem 2015 / SDT) by giving the kid
predictable, low-drama rhythm instead of surprise lockouts:

* Soft amber when <=10 minutes remain (warning) — not red.
* Red is reserved for actual emergencies (server unreachable, tampered).
* Shows "next thing" (bedtime/schedule) so the kid is never surprised.
* At <=2 minutes a "save my game" hint surfaces; the kid clicks the
  overlay itself to open the dashboard and tap the inline "+3 min to save"
  button (one-tap parent approval flow).

Built on tkinter (stdlib) so it adds no install footprint. Polls the same
local /status the dashboard uses. Right-click to hide; relaunch from tray.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import threading
import time
import tkinter as tk
import urllib.request
import webbrowser

DASH_PORT = int(os.environ.get("GIT1_DASHBOARD_PORT", "17654"))
DASH_URL = f"http://127.0.0.1:{DASH_PORT}"
POLL_SEC = 15
PAD = 12  # pixels from screen edge


def _fetch() -> dict:
    try:
        with urllib.request.urlopen(DASH_URL + "/status", timeout=3) as r:
            return json.loads(r.read())
    except Exception:  # noqa: BLE001
        return {}


def _fmt(m: int) -> str:
    m = max(0, int(m or 0))
    h, mm = divmod(m, 60)
    return f"{h}h {mm}m" if h else f"{mm}m"


def _next_event(status: dict) -> str:
    """One-line 'what's next' so the kid is never surprised by a lock."""
    scheds = status.get("schedules") or []
    if not scheds:
        return ""
    # Find the soonest enabled schedule that contains 'lock'.
    now = dt.datetime.now()
    cur_min = now.hour * 60 + now.minute
    cur_day = now.strftime("%a").lower()[:3]
    soonest = None  # type: ignore[var-annotated]
    for s in scheds:
        if not s.get("enabled", True):
            continue
        if "lock" not in (s.get("actions") or []):
            continue
        start = int(s.get("startMinute", 0))
        days = [str(d).lower()[:3] for d in (s.get("days") or [])]
        if cur_day not in days:
            continue
        if start <= cur_min:
            continue
        if soonest is None or start < soonest[0]:
            soonest = (start, s.get("name") or "Bedtime")
    if not soonest:
        return ""
    h, m = divmod(soonest[0], 60)
    return f"{soonest[1]} {h:02d}:{m:02d}"


def main() -> None:
    root = tk.Tk()
    root.title("timeoff")
    root.overrideredirect(True)
    root.attributes("-topmost", True)
    root.attributes("-alpha", 0.86)
    try:
        root.attributes("-toolwindow", True)
    except Exception:  # noqa: BLE001
        pass

    # Warm dark, not danger-red. timeoff palette.
    BG = "#111827"
    FG = "#f3f4f6"
    MUTED = "#94a3b8"
    OK = "#86efac"      # plenty of time
    WARN = "#fbbf24"    # amber, ~10 min
    SOFT = "#60a5fa"    # bedtime/scheduled, not "danger"
    DANGER = "#f87171"  # only for actual errors

    root.configure(bg=BG)
    frame = tk.Frame(root, bg=BG, padx=12, pady=8)
    frame.pack()
    # Row 1: big number + unit
    top = tk.Frame(frame, bg=BG)
    top.pack()
    num = tk.Label(top, text="…", fg=FG, bg=BG, font=("Segoe UI Semibold", 18))
    num.pack(side="left")
    unit = tk.Label(top, text=" left", fg=MUTED, bg=BG, font=("Segoe UI", 11))
    unit.pack(side="left", pady=(4, 0))
    # Row 2: what's next (e.g. "Bedtime 21:00")
    nxt = tk.Label(frame, text="", fg=MUTED, bg=BG, font=("Segoe UI", 9))
    nxt.pack(anchor="w")
    # Row 3: hint that appears under 2 min
    hint = tk.Label(frame, text="", fg=SOFT, bg=BG, font=("Segoe UI", 9, "italic"))
    hint.pack(anchor="w")

    state = {"dx": 0, "dy": 0}

    def start_drag(e: tk.Event) -> None:
        state["dx"], state["dy"] = e.x, e.y

    def drag(e: tk.Event) -> None:
        root.geometry(f"+{e.x_root - state['dx']}+{e.y_root - state['dy']}")

    def open_dash(_e: tk.Event) -> None:
        # Left-click on the body (after a click without drag) opens the dashboard
        # so the kid can hit "save my game / +3 min" in one move.
        try:
            webbrowser.open(DASH_URL)
        except Exception:  # noqa: BLE001
            pass

    for w in (root, frame, top, num, unit, nxt, hint):
        w.bind("<Button-1>", start_drag)
        w.bind("<B1-Motion>", drag)
        w.bind("<Double-Button-1>", open_dash)
        w.bind("<Button-3>", lambda _e: root.withdraw())

    def position_default() -> None:
        root.update_idletasks()
        w, h = root.winfo_reqwidth(), root.winfo_reqheight()
        sw, _sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"+{sw - w - PAD}+{PAD}")

    position_default()

    def update_label() -> None:
        s = _fetch()
        used = int(s.get("usedTodayMinutes") or 0)
        limit = int(s.get("limitMinutes") or 0)
        left = max(0, limit - used)
        bank = int(s.get("bankedMinutes") or 0)
        blocked = bool(s.get("internetBlocked"))
        nxt_text = _next_event(s)

        if not s:
            num.config(text="…", fg=MUTED); unit.config(text=""); hint.config(text="")
        elif blocked and used >= limit:
            num.config(text="Paused", fg=SOFT); unit.config(text="")
            hint.config(text="Open dashboard to ask for time")
        elif blocked:
            num.config(text="No internet", fg=SOFT); unit.config(text="")
            hint.config(text="")
        elif limit == 0:
            num.config(text="∞", fg=OK); unit.config(text="  open"); hint.config(text="")
        elif used >= limit and bank > 0:
            num.config(text=_fmt(bank), fg=WARN); unit.config(text="  in bank")
            hint.config(text="Double-click to spend bank time")
        elif used >= limit:
            num.config(text="Time's up", fg=SOFT); unit.config(text="")
            hint.config(text="Double-click to ask for more")
        else:
            color = OK if left > 15 else (WARN if left > 2 else SOFT)
            num.config(text=_fmt(left), fg=color); unit.config(text=" left")
            if left <= 2:
                hint.config(text="Double-click to save your game (+3 min)")
            elif left <= 10:
                hint.config(text="Heads up — under 10 min")
            else:
                hint.config(text="")

        nxt.config(text=("· " + nxt_text) if nxt_text else "")

    def loop() -> None:
        while True:
            try:
                root.after(0, update_label)
            except Exception:  # noqa: BLE001
                return
            time.sleep(POLL_SEC)

    threading.Thread(target=loop, daemon=True).start()
    root.mainloop()


if __name__ == "__main__":
    main()
