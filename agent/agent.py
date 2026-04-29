"""Git1 child-PC agent.

Pairs once with the Git1 server, then maintains a WebSocket and executes
lock/unlock commands sent from the parent's mobile app. Tracks active
session time using Windows GetLastInputInfo so idle minutes don't count.
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

SERVER_HTTP = os.environ.get("GIT1_SERVER", "http://localhost:8080")
SERVER_WS = SERVER_HTTP.replace("http://", "ws://").replace("https://", "wss://")

CONFIG_DIR = Path(os.environ.get("APPDATA", str(Path.home() / ".config"))) / "Git1"
CONFIG_PATH = CONFIG_DIR / "agent.json"
USAGE_PATH = CONFIG_DIR / "usage.json"

IDLE_THRESHOLD_SEC = 60        # seconds of no input before we stop counting
SAMPLE_INTERVAL_SEC = 30       # how often to sample activity
HEARTBEAT_INTERVAL_SEC = 60    # how often to push heartbeat to server


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
    """Seconds since last keyboard/mouse input. 0 on non-Windows."""
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


# ---------- Usage tracking ----------
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


# ---------- WebSocket loop ----------
async def handle_command(ws, command: dict, usage: Usage) -> None:
    kind = command.get("kind")
    cid = command.get("id")
    payload = command.get("payload") or {}
    print(f"[cmd] {kind} ({cid})")

    if kind == "lock":
        ok = lock_workstation()
        await ws.send(json.dumps({"kind": "event", "name": "lock", "payload": {"ok": ok}}))
    elif kind == "unlock":
        await ws.send(json.dumps({"kind": "event", "name": "unlock"}))
    elif kind == "grant_minutes":
        usage.grant(int(payload.get("minutes", 0)))
        await ws.send(
            json.dumps(
                {"kind": "event", "name": "grant_minutes", "payload": {"limit": usage.limit_minutes}},
            )
        )
    elif kind == "set_limit":
        usage.set_limit(int(payload.get("minutes", 120)))
        await ws.send(
            json.dumps(
                {"kind": "event", "name": "set_limit", "payload": {"limit": usage.limit_minutes}},
            )
        )

    await ws.send(json.dumps({"kind": "ack", "id": cid}))


async def tracker(ws, usage: Usage) -> None:
    last_sample = time.time()
    last_heartbeat = 0.0
    limit_notified = False
    while True:
        await asyncio.sleep(SAMPLE_INTERVAL_SEC)
        usage.roll_if_new_day()
        now = time.time()
        active = idle_seconds() < IDLE_THRESHOLD_SEC
        elapsed = now - last_sample
        last_sample = now
        if active:
            usage.add_seconds(elapsed)

        if usage.over_limit() and not limit_notified:
            limit_notified = True
            try:
                await ws.send(
                    json.dumps(
                        {
                            "kind": "event",
                            "name": "limit_reached",
                            "payload": {"minutes": int(usage.minutes)},
                        },
                    )
                )
                lock_workstation()
                await ws.send(json.dumps({"kind": "event", "name": "lock", "payload": {"auto": True}}))
            except websockets.ConnectionClosed:
                return
        if not usage.over_limit():
            limit_notified = False

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
        track = asyncio.create_task(tracker(ws, usage))
        try:
            async for raw in ws:
                msg = json.loads(raw)
                if msg.get("kind") == "command":
                    await handle_command(ws, msg["command"], usage)
        finally:
            track.cancel()


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
