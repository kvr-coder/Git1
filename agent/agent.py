"""Git1 child-PC agent.

Pairs once with the Git1 server, then maintains a WebSocket and enforces:
  - daily session-time limit (idle-aware via GetLastInputInfo)
  - schedules (allowed windows pushed from server)
  - process deny-list (kills blocked apps)
  - internet kill-switch (via Windows Firewall)
  - VPN / Tor adapter detection
  - clock-tamper detection (NTP-anchored time)
Also serves a localhost dashboard the kid can open in a browser, with a
"request more time" button that round-trips through the parent's app.
"""
from __future__ import annotations

import asyncio
import ctypes
import datetime as dt
import json
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any

import requests
import websockets

import clock
import dashboard
import enforcer_apps
import enforcer_net
import enforcer_schedule
import enforcer_vpn

SERVER_HTTP = os.environ.get("GIT1_SERVER", "http://localhost:8080")
SERVER_WS = SERVER_HTTP.replace("http://", "ws://").replace("https://", "wss://")

CONFIG_DIR = Path(os.environ.get("APPDATA", str(Path.home() / ".config"))) / "Git1"
CONFIG_PATH = CONFIG_DIR / "agent.json"
USAGE_PATH = CONFIG_DIR / "usage.json"

IDLE_THRESHOLD_SEC = 60
SAMPLE_INTERVAL_SEC = 15
HEARTBEAT_INTERVAL_SEC = 60
RELOCK_INTERVAL_SEC = 5
VPN_CHECK_INTERVAL_SEC = 30
CLOCK_CHECK_INTERVAL_SEC = 600


# ---------- Config ----------
def load_json(path: Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return {}
    return {}


def save_json(path: Path, data: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


# ---------- Windows ----------
class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


def idle_seconds() -> float:
    if sys.platform != "win32":
        return 0.0
    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(lii)
    if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii)):
        return 0.0
    millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
    return millis / 1000.0


def lock_workstation() -> bool:
    if sys.platform != "win32":
        print("[lock] non-Windows host, skipping LockWorkStation")
        return False
    return bool(ctypes.windll.user32.LockWorkStation())


# ---------- Usage ----------
def today_key() -> str:
    return dt.datetime.fromtimestamp(clock.now_trusted()).date().isoformat()


class Usage:
    def __init__(self) -> None:
        data = load_json(USAGE_PATH)
        self.future_adjustments: dict[str, int] = dict(data.get("futureAdjustments") or {})
        self.banked_minutes: int = int(data.get("bankedMinutes", 0))
        if data.get("date") != today_key():
            new_date = today_key()
            adjustment = int(self.future_adjustments.pop(new_date, 0))
            base_limit = int(data.get("limitMinutes", 120))
            data = {
                "date": new_date,
                "minutes": 0,
                "limitMinutes": max(0, base_limit + adjustment),
            }
        self.date: str = data["date"]
        self.minutes: float = float(data.get("minutes", 0))
        self.limit_minutes: int = int(data.get("limitMinutes", 120))
        self.save()

    def save(self) -> None:
        save_json(
            USAGE_PATH,
            {
                "date": self.date,
                "minutes": self.minutes,
                "limitMinutes": self.limit_minutes,
                "futureAdjustments": self.future_adjustments,
                "bankedMinutes": self.banked_minutes,
            },
        )

    def roll_if_new_day(self) -> None:
        if self.date != today_key():
            new_date = today_key()
            adjustment = int(self.future_adjustments.pop(new_date, 0))
            self.date = new_date
            self.minutes = 0
            self.limit_minutes = max(0, self.limit_minutes + adjustment)
            self.save()

    def borrow_from(self, date_iso: str, minutes: int) -> None:
        self.limit_minutes += minutes
        self.future_adjustments[date_iso] = (
            int(self.future_adjustments.get(date_iso, 0)) - minutes
        )
        self.save()

    def projected_limit_for(self, date_iso: str, base_limit: int) -> int:
        return max(0, base_limit + int(self.future_adjustments.get(date_iso, 0)))

    def add_bank(self, minutes: int) -> None:
        self.banked_minutes = max(0, self.banked_minutes + int(minutes))
        self.save()

    def set_bank(self, minutes: int) -> None:
        self.banked_minutes = max(0, int(minutes))
        self.save()

    def spend_bank(self, minutes: int) -> int:
        """Move up to `minutes` from bank into today's limit. Returns
        actual minutes spent (capped by current bank balance).
        """
        spend = max(0, min(int(minutes), self.banked_minutes))
        if spend > 0:
            self.banked_minutes -= spend
            self.limit_minutes += spend
            self.save()
        return spend

    def add_seconds(self, sec: float) -> None:
        self.minutes += sec / 60.0
        self.save()

    def grant(self, minutes: int) -> None:
        self.limit_minutes += minutes
        self.save()

    def set_limit(self, minutes: int) -> None:
        self.limit_minutes = minutes
        self.save()

    def over_limit(self) -> bool:
        return self.minutes >= self.limit_minutes


# ---------- Pairing ----------
def pair() -> str:
    r = requests.post(f"{SERVER_HTTP}/agent/pair/start", timeout=10)
    r.raise_for_status()
    code = r.json()["code"]
    print(f"\n*** Pairing code: {code} ***\nEnter this in the Git1 mobile app.\n")
    while True:
        time.sleep(3)
        try:
            poll = requests.get(
                f"{SERVER_HTTP}/agent/pair/poll", params={"code": code}, timeout=10
            )
        except requests.RequestException:
            continue
        if poll.status_code != 200:
            continue
        body = poll.json()
        if body.get("status") == "paired":
            return body["agentToken"]


# ---------- Outgoing event helper (thread-safe) ----------
class WSBridge:
    """Allows non-async code (HTTP request handler thread, etc.) to enqueue
    events that get sent on the asyncio websocket.
    """

    def __init__(self) -> None:
        self.loop: asyncio.AbstractEventLoop | None = None
        self.ws: Any = None  # type: ignore[var-annotated]

    def bind(self, loop: asyncio.AbstractEventLoop, ws: Any) -> None:
        self.loop = loop
        self.ws = ws

    def emit(self, name: str, payload: dict | None = None) -> None:
        if self.loop is None or self.ws is None:
            return
        msg = json.dumps({"kind": "event", "name": name, "payload": payload or {}})
        asyncio.run_coroutine_threadsafe(self.ws.send(msg), self.loop)


bridge = WSBridge()


# ---------- Command handler ----------
async def emit_event(ws: Any, name: str, payload: dict | None = None) -> None:
    try:
        await ws.send(json.dumps({"kind": "event", "name": name, "payload": payload or {}}))
    except websockets.ConnectionClosed:
        pass


async def handle_command(ws: Any, command: dict, usage: Usage) -> None:
    kind = command.get("kind")
    cid = command.get("id")
    payload = command.get("payload") or {}
    print(f"[cmd] {kind} ({cid}) payload={payload}")

    if kind == "lock":
        ok = lock_workstation()
        await emit_event(ws, "lock", {"ok": ok})

    elif kind == "unlock":
        enforcer_net.unblock_internet()
        await emit_event(ws, "unlock")

    elif kind == "grant_minutes":
        usage.grant(int(payload.get("minutes", 0)))
        await emit_event(ws, "grant_minutes", {"limit": usage.limit_minutes})

    elif kind == "set_limit":
        usage.set_limit(int(payload.get("minutes", 120)))
        await emit_event(ws, "set_limit", {"limit": usage.limit_minutes})

    elif kind == "block_internet":
        ok = enforcer_net.block_internet()
        await emit_event(ws, "block_internet", {"ok": ok})

    elif kind == "unblock_internet":
        ok = enforcer_net.unblock_internet()
        await emit_event(ws, "unblock_internet", {"ok": ok})

    elif kind == "set_blocklist":
        names = list(payload.get("apps") or [])
        enforcer_apps.set_blocklist(names)
        await emit_event(ws, "set_blocklist", {"count": len(names)})

    elif kind == "set_schedules":
        items = list(payload.get("schedules") or [])
        enforcer_schedule.set_schedules(items)
        await emit_event(ws, "set_schedules", {"count": len(items)})

    elif kind == "set_borrow_settings":
        BORROW_STATE["enabled"] = bool(payload.get("enabled", False))
        BORROW_STATE["cap"] = int(payload.get("capMinutes", 30))
        await emit_event(ws, "set_borrow_settings", BORROW_STATE.copy())

    elif kind == "add_bank_minutes":
        usage.add_bank(int(payload.get("minutes", 0)))
        await emit_event(ws, "set_bank_minutes", {"minutes": usage.banked_minutes})

    elif kind == "set_bank_minutes":
        usage.set_bank(int(payload.get("minutes", 0)))
        await emit_event(ws, "set_bank_minutes", {"minutes": usage.banked_minutes})

    await ws.send(json.dumps({"kind": "ack", "id": cid}))


# Module-level so dashboard handler thread can read it.
BORROW_STATE: dict[str, Any] = {"enabled": False, "cap": 30}
CHORE_TEMPLATES: list[dict[str, Any]] = []


# ---------- Enforcement loop ----------
async def enforcer(ws: Any, usage: Usage, dash: dashboard.Dashboard) -> None:
    last_sample = time.time()
    last_heartbeat = 0.0
    last_relock = 0.0
    last_vpn_check = 0.0
    last_clock_check = 0.0
    limit_notified = False
    was_schedule_blocking_net = False

    while True:
        await asyncio.sleep(SAMPLE_INTERVAL_SEC)
        usage.roll_if_new_day()
        now = time.time()

        # 1. Track active session time
        active = idle_seconds() < IDLE_THRESHOLD_SEC
        elapsed = now - last_sample
        last_sample = now
        if active:
            usage.add_seconds(elapsed)

        # 2. Kill blocked apps
        killed = enforcer_apps.kill_blocked()
        if killed:
            print(f"[apps] killed: {killed}")
            await emit_event(ws, "app_blocked", {"apps": killed})

        # 3. VPN / Tor adapter check
        if now - last_vpn_check >= VPN_CHECK_INTERVAL_SEC:
            last_vpn_check = now
            new_tunnels = enforcer_vpn.detect_new_tunnels()
            if new_tunnels:
                print(f"[vpn] new tunnel adapter(s): {new_tunnels}")
                await emit_event(ws, "vpn_detected", {"adapters": new_tunnels})

        # 4. Clock tamper check
        if now - last_clock_check >= CLOCK_CHECK_INTERVAL_SEC:
            last_clock_check = now
            drift = clock.check_drift()
            if clock.is_tampered():
                print(f"[clock] drift {drift:.1f}s — tamper")
                await emit_event(ws, "clock_tamper", {"driftSec": drift})

        # 5. Daily-limit gate (always locks)
        schedule_actions = enforcer_schedule.active_actions(clock.now_trusted_dt())
        schedule_allowed = not schedule_actions
        if usage.over_limit():
            if not limit_notified:
                limit_notified = True
                await emit_event(ws, "limit_reached", {"minutes": int(usage.minutes)})
            if now - last_relock >= RELOCK_INTERVAL_SEC:
                last_relock = now
                lock_workstation()
        else:
            limit_notified = False

        # 6. Schedule gate — apply each requested action
        if "lock" in schedule_actions:
            if now - last_relock >= RELOCK_INTERVAL_SEC:
                last_relock = now
                lock_workstation()
                await emit_event(ws, "schedule_lock")
        # Internet block (idempotent; only flip when state changes)
        want_net_block = "block_internet" in schedule_actions
        if want_net_block and not enforcer_net.is_blocked():
            enforcer_net.block_internet()
            await emit_event(ws, "schedule_internet_block")
        elif (
            not want_net_block
            and not schedule_actions  # no schedule requesting block
            and was_schedule_blocking_net
            and enforcer_net.is_blocked()
        ):
            # Only lift the firewall block if *we* (schedule) put it there.
            enforcer_net.unblock_internet()
            await emit_event(ws, "schedule_internet_unblock")
        was_schedule_blocking_net = want_net_block
        # block_apps action — kill loop already runs every tick (#2 above).
        # Future: we could maintain a separate per-schedule app list.

        # 7. Update kid dashboard state
        tomorrow = (clock.now_trusted_dt() + dt.timedelta(days=1)).date().isoformat()
        # base_limit = whatever today's limit *would* be without borrowing
        # — best effort: we treat current limit_minutes as the base unless
        # adjustments are scheduled. The displayed "tomorrow" includes pending.
        projected_tomorrow = usage.projected_limit_for(tomorrow, int(usage.limit_minutes))
        dash.update(
            usedTodayMinutes=int(usage.minutes),
            limitMinutes=int(usage.limit_minutes),
            baseLimitMinutes=int(usage.limit_minutes),
            tomorrowProjectedLimit=projected_tomorrow,
            tomorrowDate=tomorrow,
            internetBlocked=enforcer_net.is_blocked(),
            blocklist=enforcer_apps.get_blocklist(),
            schedules=enforcer_schedule.get_schedules(),
            scheduleAllowed=schedule_allowed,
            selfBorrowEnabled=BORROW_STATE.get("enabled", False),
            selfBorrowCapMinutes=BORROW_STATE.get("cap", 30),
            bankedMinutes=usage.banked_minutes,
            choreTemplates=list(CHORE_TEMPLATES),
        )

        # 8. Heartbeat
        if now - last_heartbeat >= HEARTBEAT_INTERVAL_SEC:
            last_heartbeat = now
            try:
                await ws.send(
                    json.dumps(
                        {"kind": "heartbeat", "usedTodayMinutes": int(usage.minutes)},
                    )
                )
            except websockets.ConnectionClosed:
                return


async def run(token: str, usage: Usage, dash: dashboard.Dashboard) -> None:
    url = f"{SERVER_WS}/agent/ws?token={token}"
    print(f"[ws] connecting to {url}")
    async with websockets.connect(url) as ws:
        print("[ws] connected")
        bridge.bind(asyncio.get_running_loop(), ws)
        loop = asyncio.create_task(enforcer(ws, usage, dash))
        try:
            async for raw in ws:
                msg = json.loads(raw)
                if msg.get("kind") == "command":
                    await handle_command(ws, msg["command"], usage)
                elif msg.get("kind") == "snapshot":
                    enforcer_schedule.set_schedules(msg.get("schedules") or [])
                    enforcer_apps.set_blocklist(msg.get("blocklist") or [])
                    BORROW_STATE["enabled"] = bool(msg.get("selfBorrowEnabled", False))
                    BORROW_STATE["cap"] = int(msg.get("selfBorrowCapMinutes", 30))
                    if "bankedMinutes" in msg:
                        usage.set_bank(int(msg.get("bankedMinutes") or 0))
                    CHORE_TEMPLATES.clear()
                    CHORE_TEMPLATES.extend(msg.get("choreTemplates") or [])
                    print(
                        f"[snapshot] applied; borrow={BORROW_STATE} "
                        f"bank={usage.banked_minutes} templates={len(CHORE_TEMPLATES)}"
                    )
        finally:
            loop.cancel()


def main() -> None:
    cfg = load_json(CONFIG_PATH)
    token = cfg.get("agentToken")
    if not token:
        token = pair()
        cfg["agentToken"] = token
        save_json(CONFIG_PATH, cfg)
        print("[pair] success, token saved")

    # Initialise NTP anchor + VPN baseline before the loop runs.
    if clock.refresh(force=True) is None:
        print("[clock] NTP unreachable; falling back to local clock")
    enforcer_vpn.init_baseline()
    enforcer_vpn.block_tor_ports()

    usage = Usage()

    # Kid dashboard on http://127.0.0.1:<port>. Override with GIT1_DASHBOARD_PORT.
    dash_port = int(os.environ.get("GIT1_DASHBOARD_PORT", dashboard.DEFAULT_PORT))
    dash = dashboard.Dashboard(port=dash_port)
    dash.on_request(lambda minutes, reason: bridge.emit(
        "request_minutes", {"minutes": minutes, "reason": reason}
    ))

    def _do_borrow(minutes: int) -> dict:
        tomorrow = (clock.now_trusted_dt() + dt.timedelta(days=1)).date().isoformat()
        usage.borrow_from(tomorrow, minutes)
        bridge.emit("borrow", {"minutes": minutes, "fromDate": tomorrow})
        return {"newLimit": usage.limit_minutes, "fromDate": tomorrow}

    def _submit_chore(description: str, minutes: int) -> dict:
        bridge.emit("chore_request", {"description": description, "minutes": minutes})
        return {"submitted": True}

    def _spend_bank(minutes: int) -> dict:
        spent = usage.spend_bank(minutes)
        if spent > 0:
            bridge.emit(
                "bank_spent", {"minutes": spent, "remaining": usage.banked_minutes}
            )
        return {"spent": spent, "remaining": usage.banked_minutes}

    dash.on_borrow(_do_borrow)
    dash.on_chore(_submit_chore)
    dash.on_spend(_spend_bank)
    dash.start()

    backoff = 2
    while True:
        try:
            asyncio.run(run(token, usage, dash))
            backoff = 2
        except Exception as e:
            print(f"[ws] disconnected: {e}; retrying in {backoff}s")
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    main()
