"""Git1 child-PC agent.

Pairs once with the Git1 server, then maintains a WebSocket and enforces:
  - daily session-time limit (idle-aware via GetLastInputInfo)
  - schedules (allowed windows pushed from server)
  - process deny-list (kills blocked apps)
  - internet kill-switch (via Windows Firewall)
"""
from __future__ import annotations

import asyncio
import ctypes
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

import requests
import websockets

import enforcer_apps
import enforcer_net
import enforcer_schedule

SERVER_HTTP = os.environ.get("GIT1_SERVER", "http://localhost:8080")
SERVER_WS = SERVER_HTTP.replace("http://", "ws://").replace("https://", "wss://")

CONFIG_DIR = Path(os.environ.get("APPDATA", str(Path.home() / ".config"))) / "Git1"
CONFIG_PATH = CONFIG_DIR / "agent.json"
USAGE_PATH = CONFIG_DIR / "usage.json"

IDLE_THRESHOLD_SEC = 60
SAMPLE_INTERVAL_SEC = 15
HEARTBEAT_INTERVAL_SEC = 60
RELOCK_INTERVAL_SEC = 5     # how often to re-lock if outside allowed window


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
    return dt.date.today().isoformat()


class Usage:
    def __init__(self) -> None:
        data = load_json(USAGE_PATH)
        if data.get("date") != today_key():
            data = {"date": today_key(), "minutes": 0, "limitMinutes": data.get("limitMinutes", 120)}
        self.date: str = data["date"]
        self.minutes: float = float(data.get("minutes", 0))
        self.limit_minutes: int = int(data.get("limitMinutes", 120))

    def save(self) -> None:
        save_json(
            USAGE_PATH,
            {"date": self.date, "minutes": self.minutes, "limitMinutes": self.limit_minutes},
        )

    def roll_if_new_day(self) -> None:
        if self.date != today_key():
            self.date = today_key()
            self.minutes = 0
            self.save()

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


# ---------- Command handler ----------
async def emit_event(ws, name: str, payload: dict | None = None) -> None:
    try:
        await ws.send(json.dumps({"kind": "event", "name": name, "payload": payload or {}}))
    except websockets.ConnectionClosed:
        pass


async def handle_command(ws, command: dict, usage: Usage) -> None:
    kind = command.get("kind")
    cid = command.get("id")
    payload = command.get("payload") or {}
    print(f"[cmd] {kind} ({cid}) payload={payload}")

    if kind == "lock":
        ok = lock_workstation()
        await emit_event(ws, "lock", {"ok": ok})

    elif kind == "unlock":
        # Cannot programmatically unlock Windows; clear net block as a
        # convenience so a kid blocked from the web is restored.
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

    await ws.send(json.dumps({"kind": "ack", "id": cid}))


# ---------- Enforcement loop ----------
async def enforcer(ws, usage: Usage) -> None:
    last_sample = time.time()
    last_heartbeat = 0.0
    last_relock = 0.0
    limit_notified = False

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

        # 3. Daily-limit gate
        if usage.over_limit():
            if not limit_notified:
                limit_notified = True
                await emit_event(ws, "limit_reached", {"minutes": int(usage.minutes)})
            if now - last_relock >= RELOCK_INTERVAL_SEC:
                last_relock = now
                lock_workstation()
        else:
            limit_notified = False

        # 4. Schedule gate
        if not enforcer_schedule.is_currently_allowed():
            if now - last_relock >= RELOCK_INTERVAL_SEC:
                last_relock = now
                lock_workstation()
                await emit_event(ws, "schedule_lock")

        # 5. Heartbeat
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


async def run(token: str, usage: Usage) -> None:
    url = f"{SERVER_WS}/agent/ws?token={token}"
    print(f"[ws] connecting to {url}")
    async with websockets.connect(url) as ws:
        print("[ws] connected")
        loop = asyncio.create_task(enforcer(ws, usage))
        try:
            async for raw in ws:
                msg = json.loads(raw)
                if msg.get("kind") == "command":
                    await handle_command(ws, msg["command"], usage)
                elif msg.get("kind") == "snapshot":
                    enforcer_schedule.set_schedules(msg.get("schedules") or [])
                    enforcer_apps.set_blocklist(msg.get("blocklist") or [])
                    print("[snapshot] schedules + blocklist applied")
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

    usage = Usage()
    backoff = 2
    while True:
        try:
            asyncio.run(run(token, usage))
            backoff = 2
        except Exception as e:
            print(f"[ws] disconnected: {e}; retrying in {backoff}s")
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    main()
