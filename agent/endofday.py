"""End-of-day summary window shown on the kid's PC.

Fires once per day around the kid's bedtime (or when the day's limit is hit
for the last time). Surfaces a warm, factual recap:

    Today
    -----
    1h 24m used  ·  2h limit
    +10 min earned (made bed, took out trash)
    1 time request (approved)

Why bother: Coyne et al. 2023 found parent–child media communication is a
stronger predictor of healthy use than monitoring intensity. A factual
"here's the day" surface gives the kid material to talk about, with no
judgment, which is the actual protective mechanism.

Best-effort, non-blocking, tkinter only.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.request

DASH_PORT = int(os.environ.get("GIT1_DASHBOARD_PORT", "17654"))
DASH_URL = f"http://127.0.0.1:{DASH_PORT}"


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


def show_summary(seconds: int = 30) -> None:
    """Pop a friendly 30-second recap. Always safe to call once per day."""
    if sys.platform != "win32":
        return
    s = _fetch()
    if not s:
        return
    used = int(s.get("usedTodayMinutes") or 0)
    limit = int(s.get("limitMinutes") or 0)
    bank = int(s.get("bankedMinutes") or 0)
    notifications = s.get("notifications") or []

    earned = sum(int(n.get("minutes") or 0)
                 for n in notifications if n.get("kind") == "success")
    earned_labels = [str(n.get("text", "")).split(":")[0]
                     for n in notifications if n.get("kind") == "success"][:3]

    def _show() -> None:
        try:
            import tkinter as tk
        except Exception:  # noqa: BLE001
            return
        try:
            root = tk.Tk()
            root.title("timeoff — today")
            root.overrideredirect(True)
            root.attributes("-topmost", True)
            root.attributes("-alpha", 0.97)
            BG = "#0f172a"
            FG = "#f1f5f9"
            MUTED = "#94a3b8"
            OK = "#86efac"
            ACCENT = "#60a5fa"
            root.configure(bg=BG)
            f = tk.Frame(root, bg=BG, padx=28, pady=20)
            f.pack()
            tk.Label(f, text="Today", fg=MUTED, bg=BG,
                     font=("Segoe UI", 10)).pack(anchor="w")
            tk.Label(f, text=f"{_fmt(used)} used",
                     fg=FG, bg=BG,
                     font=("Segoe UI Semibold", 22)).pack(anchor="w", pady=(0, 2))
            tk.Label(f, text=f"out of {_fmt(limit) if limit else 'open'} today",
                     fg=MUTED, bg=BG, font=("Segoe UI", 10)).pack(anchor="w")

            if earned > 0:
                tk.Label(f, text=f"+{_fmt(earned)} earned"
                              + (f"  ({', '.join(earned_labels)})" if earned_labels else ""),
                         fg=OK, bg=BG, font=("Segoe UI", 11)).pack(anchor="w", pady=(10, 0))

            if bank > 0:
                tk.Label(f, text=f"Bank: {_fmt(bank)}",
                         fg=ACCENT, bg=BG, font=("Segoe UI", 11)).pack(anchor="w")

            tk.Label(f, text="Nice job. See you tomorrow.",
                     fg=MUTED, bg=BG, font=("Segoe UI", 10, "italic")
                     ).pack(anchor="w", pady=(14, 0))

            root.update_idletasks()
            w, h = root.winfo_reqwidth(), root.winfo_reqheight()
            sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
            root.geometry(f"+{sw - w - 24}+{sh - h - 80}")
            root.after(int(seconds * 1000), root.destroy)
            root.mainloop()
        except Exception:  # noqa: BLE001
            pass

    threading.Thread(target=_show, daemon=True).start()


if __name__ == "__main__":
    # Manual smoke test: python -m agent.endofday
    show_summary(seconds=20)
    time.sleep(22)
