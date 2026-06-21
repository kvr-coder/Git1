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

# Shared IPC folder both the SYSTEM service and the user-session tray can
# read/write (Public profile is writable by all users). The service drops
# lock.signal here; this tray — running IN the child's session — performs the
# actual LockWorkStation (a clean Win+L, no Explorer breakage). The tray also
# touches tray.alive so the service knows the in-session locker is available.
IPC_DIR = r"C:\Users\Public\Git1"
LOCK_SIGNAL = os.path.join(IPC_DIR, "lock.signal")
TRAY_ALIVE = os.path.join(IPC_DIR, "tray.alive")


APPUSAGE = os.path.join(IPC_DIR, "appusage.json")
FG_SAMPLE_SEC = 7          # how often to check the foreground app
FG_IDLE_SEC = 90           # don't credit time while the kid is away
# Windows shell/system surfaces that can briefly hold focus but aren't "apps".
_FG_IGNORE = {
    "explorer.exe", "searchhost.exe", "shellexperiencehost.exe",
    "startmenuexperiencehost.exe", "textinputhost.exe", "lockapp.exe",
    "applicationframehost.exe", "dwm.exe", "sihost.exe", "",
}


def _idle_seconds() -> float:
    """Seconds since the last keyboard/mouse input in THIS session."""
    import ctypes

    class _LASTINPUTINFO(ctypes.Structure):
        _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

    info = _LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(info)
    if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
        return 0.0
    millis = ctypes.windll.kernel32.GetTickCount() - info.dwTime
    return max(0.0, millis / 1000.0)


def _foreground_proc() -> str:
    """Lowercased exe name of the process owning the foreground window."""
    import ctypes

    import psutil  # type: ignore

    user32 = ctypes.windll.user32
    # Declare proper types or a 64-bit HWND gets truncated to 32 bits.
    user32.GetForegroundWindow.restype = ctypes.c_void_p
    user32.GetWindowThreadProcessId.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong)]
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return ""
    pid = ctypes.c_ulong(0)
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if not pid.value:
        return ""
    try:
        return (psutil.Process(pid.value).name() or "").strip().lower()
    except Exception:
        return ""


def _foreground_tracker() -> None:
    """Sample the active-window app and write per-app seconds to the shared IPC
    file. Runs IN the kid's session, so unlike the SYSTEM service it can read the
    real foreground window — this is what makes Stats reflect apps the kid
    actually uses (Discord, games, browser) instead of background helpers."""
    if sys.platform != "win32":
        return
    import datetime as _dt
    import json as _json

    def today() -> str:
        return _dt.date.today().isoformat()

    day = today()
    secs: dict[str, float] = {}
    last = time.time()
    while True:
        time.sleep(FG_SAMPLE_SEC)
        now = time.time()
        elapsed, last = now - last, now
        d = today()
        if d != day:                      # new day -> fresh counters
            day, secs = d, {}
        try:
            if _idle_seconds() > FG_IDLE_SEC:
                continue
            name = _foreground_proc()
            if name and name not in _FG_IGNORE:
                secs[name] = secs.get(name, 0.0) + elapsed
            os.makedirs(IPC_DIR, exist_ok=True)
            tmp = APPUSAGE + ".tmp"
            with open(tmp, "w") as f:
                _json.dump({"date": day, "apps": {k: round(v) for k, v in secs.items()}}, f)
            os.replace(tmp, APPUSAGE)
        except Exception as e:  # noqa: BLE001
            print(f"[tray] foreground tracker error: {e}")


def _lock_watcher() -> None:
    """Poll for the service's lock signal; lock this session cleanly when set."""
    if sys.platform != "win32":
        return
    import ctypes
    try:
        os.makedirs(IPC_DIR, exist_ok=True)
    except Exception:
        pass
    while True:
        try:
            # Heartbeat so the service knows in-session locking is available.
            with open(TRAY_ALIVE, "w") as f:
                f.write(str(int(time.time())))
        except Exception:
            pass
        try:
            if os.path.exists(LOCK_SIGNAL):
                os.remove(LOCK_SIGNAL)  # consume first so we don't loop-lock
                ctypes.windll.user32.LockWorkStation()
                print("[tray] locked this session (clean Win+L).")
        except Exception as e:  # noqa: BLE001
            print(f"[tray] lock watcher error: {e}")
        time.sleep(2)


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


def _ask_more(_icon=None, _item=None) -> None:
    webbrowser.open(DASH_URL + "/?save=1")


def _do_chore(_icon=None, _item=None) -> None:
    # Jump straight to the chore section.
    webbrowser.open(DASH_URL + "/#chore-templates")


def main() -> None:
    icon = pystray.Icon(
        "timeoff",
        _icon_image((96, 165, 250)),  # soft blue (matches dashboard palette)
        "timeoff — my time",
        menu=pystray.Menu(
            pystray.MenuItem("Open my dashboard", _open_dashboard, default=True),
            pystray.MenuItem("Ask for more time", _ask_more),
            pystray.MenuItem("Earn time (chore)", _do_chore),
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
            tip = f"timeoff — {_fmt(left)} left today"
            if bank:
                tip += f"  ·  bank {_fmt(bank)}"
            if blocked:
                tip += "  ·  internet off"
            if not s:
                tip = "timeoff — agent not running"
            try:
                icon.title = tip
                # Match the dashboard palette: blue (paused/blocked, not red),
                # amber under 15 min, green when ample. Reactance research:
                # red signals threat, so reserve it for genuine errors.
                color = (
                    (96, 165, 250) if over or blocked
                    else (251, 191, 36) if limit and left <= 15
                    else (134, 239, 172) if limit else (148, 163, 184)
                )
                icon.icon = _icon_image(color)
            except Exception:  # noqa: BLE001
                pass
            time.sleep(POLL_SEC)

    threading.Thread(target=updater, name="git1-tray-updater", daemon=True).start()
    threading.Thread(target=_lock_watcher, name="git1-tray-lock", daemon=True).start()
    threading.Thread(target=_foreground_tracker, name="git1-tray-fg", daemon=True).start()
    icon.run()


if __name__ == "__main__":
    main()
