"""Subtle always-on-top desktop overlay showing time left, à la MS Family.

A frameless, click-through-friendly tkinter widget that sits in the corner of
the kid's screen and shows "18m left" / "OFF" without them opening anything.
Runs in the kid's logon session (same process as the tray, or stand-alone).

Built on tkinter (stdlib) so it adds no install footprint. Polls the same
local /status the dashboard uses. Right-click to hide; relaunch from the tray.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import tkinter as tk
import urllib.request

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


def main() -> None:
    root = tk.Tk()
    root.title("Git1")
    root.overrideredirect(True)        # no titlebar
    root.attributes("-topmost", True)  # always on top
    root.attributes("-alpha", 0.78)    # translucent
    # Stay out of taskbar / Alt-Tab if supported.
    try:
        root.attributes("-toolwindow", True)
    except Exception:  # noqa: BLE001
        pass

    bg = "#0b1220"
    root.configure(bg=bg)
    frame = tk.Frame(root, bg=bg, padx=10, pady=6)
    frame.pack()
    label = tk.Label(frame, text="…", fg="#e8eef7", bg=bg,
                     font=("Segoe UI", 14, "bold"))
    label.pack()
    sub = tk.Label(frame, text="", fg="#8aa0c0", bg=bg,
                   font=("Segoe UI", 9))
    sub.pack()

    # Drag to move; right-click to hide.
    state = {"dx": 0, "dy": 0}

    def start_drag(e: tk.Event) -> None:
        state["dx"], state["dy"] = e.x, e.y

    def drag(e: tk.Event) -> None:
        root.geometry(f"+{e.x_root - state['dx']}+{e.y_root - state['dy']}")

    for w in (root, frame, label, sub):
        w.bind("<Button-1>", start_drag)
        w.bind("<B1-Motion>", drag)
        w.bind("<Button-3>", lambda _e: root.withdraw())

    def position_default() -> None:
        root.update_idletasks()
        w, h = root.winfo_reqwidth(), root.winfo_reqheight()
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"+{sw - w - PAD}+{PAD}")  # top-right corner

    position_default()

    def update_label() -> None:
        s = _fetch()
        used = int(s.get("usedTodayMinutes") or 0)
        limit = int(s.get("limitMinutes") or 0)
        left = max(0, limit - used)
        bank = int(s.get("bankedMinutes") or 0)
        blocked = bool(s.get("internetBlocked"))
        if not s:
            text, fg = "Git1 …", "#8aa0c0"
        elif blocked and used >= limit:
            text, fg = "Locked", "#fca5a5"
        elif blocked:
            text, fg = "No internet", "#fca5a5"
        elif limit == 0:
            text, fg = "Unlimited", "#86efac"
        elif used >= limit and bank > 0:
            text, fg = f"bank {_fmt(bank)}", "#fcd34d"
        elif used >= limit:
            text, fg = "Time's up", "#fca5a5"
        else:
            text, fg = f"{_fmt(left)} left", \
                ("#fcd34d" if left <= 15 else "#86efac")
        label.config(text=text, fg=fg)
        sub.config(text=(f"bank {_fmt(bank)}" if bank and "bank" not in text else ""))

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
