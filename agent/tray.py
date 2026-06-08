"""Kid-side system tray icon (runs in the CHILD's logon session, not the
SYSTEM service). Lives in the notification area; click -> opens the dashboard;
tooltip shows time left + bank.

The hardened LocalSystem service does the enforcement (and is unkillable by
the child). This tray app is the friendly face the kid sees: it's expendable
— if they close it, nothing changes about enforcement. The installer registers
it as a per-user startup item so it runs automatically when the kid logs in.

Polls the SAME /status endpoint the dashboard uses, so the tooltip stays in
sync with what the kid sees in the dashboard.
"""
from __future__ import annotations

import os
import sys
import threading
import time
import urllib.request
import webbrowser

try:
    import pystray  # type: ignore
    from PIL import Image, ImageDraw  # type: ignore
except Exception as e:  # noqa: BLE001
    print(f"[tray] missing deps ({e}); run 'pip install pystray pillow'")
    sys.exit(1)

DASH_PORT = int(os.environ.get("GIT1_DASHBOARD_PORT", "17654"))
DASH_URL = f"http://127.0.0.1:{DASH_PORT}"
POLL_SEC = 15


def _icon_image(color: tuple[int, int, int]) -> "Image.Image":
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((4, 4, 60, 60), fill=color, outline=(255, 255, 255, 220), width=3)
    # clock hands
    d.line((32, 32, 32, 16), fill=(255, 255, 255), width=4)
    d.line((32, 32, 46, 36), fill=(255, 255, 255), width=4)
    return img


def _fetch_status() -> dict:
    try:
        with urllib.request.urlopen(DASH_URL + "/status", timeout=3) as r:
            import json
            return json.loads(r.read())
    except Exception:  # noqa: BLE001
        return {}


def _fmt(m: int) -> str:
    m = max(0, int(m or 0))
    h, mm = divmod(m, 60)
    return f"{h}h {mm}m" if h else f"{mm}m"


def _open_dashboard(_icon=None, _item=None) -> None:
    webbrowser.open(DASH_URL)


def main() -> None:
    icon = pystray.Icon(
        "Git1",
        _icon_image((59, 130, 246)),  # blue
        "Git1 — My time",
        menu=pystray.Menu(
            pystray.MenuItem("Open my dashboard", _open_dashboard, default=True),
            pystray.MenuItem("Quit", lambda i, _: i.stop()),
        ),
    )

    def updater() -> None:
        while True:
            s = _fetch_status()
            used = int(s.get("usedTodayMinutes") or 0)
            limit = int(s.get("limitMinutes") or 0)
            left = max(0, limit - used)
            bank = int(s.get("bankedMinutes") or 0)
            over = limit and used >= limit
            blocked = bool(s.get("internetBlocked"))
            tip = f"Git1 — {_fmt(left)} left today"
            if bank:
                tip += f"  ·  bank {_fmt(bank)}"
            if blocked:
                tip += "  ·  internet off"
            if not s:
                tip = "Git1 — agent not running"
            try:
                icon.title = tip
                color = (
                    (239, 68, 68) if over or blocked
                    else (245, 158, 11) if limit and left <= 15
                    else (34, 197, 94) if limit else (148, 163, 184)
                )
                icon.icon = _icon_image(color)
            except Exception:  # noqa: BLE001
                pass
            time.sleep(POLL_SEC)

    threading.Thread(target=updater, name="git1-tray-updater", daemon=True).start()
    icon.run()


if __name__ == "__main__":
    main()
