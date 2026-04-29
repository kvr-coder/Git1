"""Git1 child-PC agent.

Pairs once with the Git1 server, then maintains a WebSocket and executes
lock/unlock commands sent from the parent's mobile app.
"""
from __future__ import annotations

import asyncio
import ctypes
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


def load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def save_config(data: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(data, indent=2))


def lock_workstation() -> bool:
    if sys.platform != "win32":
        print("[lock] non-Windows host, skipping LockWorkStation")
        return False
    return bool(ctypes.windll.user32.LockWorkStation())


def pair() -> str:
    r = requests.post(f"{SERVER_HTTP}/agent/pair/start", timeout=10)
    r.raise_for_status()
    code = r.json()["code"]
    print(f"\n*** Pairing code: {code} ***\nEnter this in the Git1 mobile app.\n")
    while True:
        time.sleep(3)
        poll = requests.get(f"{SERVER_HTTP}/agent/pair/poll", params={"code": code}, timeout=10)
        if poll.status_code != 200:
            continue
        body = poll.json()
        if body.get("status") == "paired":
            return body["agentToken"]


async def handle_command(ws, command: dict) -> None:
    kind = command.get("kind")
    cid = command.get("id")
    print(f"[cmd] {kind} ({cid})")

    if kind == "lock":
        ok = lock_workstation()
        await ws.send(json.dumps({"kind": "event", "name": "lock", "payload": {"ok": ok}}))
    elif kind == "unlock":
        await ws.send(json.dumps({"kind": "event", "name": "unlock"}))
    elif kind == "grant_minutes":
        minutes = int(command.get("payload", {}).get("minutes", 0))
        print(f"[grant] +{minutes} min")
    elif kind == "set_limit":
        minutes = int(command.get("payload", {}).get("minutes", 0))
        print(f"[limit] = {minutes} min")

    await ws.send(json.dumps({"kind": "ack", "id": cid}))


async def heartbeat(ws) -> None:
    used = 0
    while True:
        await asyncio.sleep(30)
        used += 1  # TODO: real session-time tracking
        try:
            await ws.send(json.dumps({"kind": "heartbeat", "usedTodayMinutes": used}))
        except websockets.ConnectionClosed:
            return


async def run(token: str) -> None:
    url = f"{SERVER_WS}/agent/ws?token={token}"
    print(f"[ws] connecting to {url}")
    async with websockets.connect(url) as ws:
        print("[ws] connected")
        hb = asyncio.create_task(heartbeat(ws))
        try:
            async for raw in ws:
                msg = json.loads(raw)
                if msg.get("kind") == "command":
                    await handle_command(ws, msg["command"])
        finally:
            hb.cancel()


def main() -> None:
    cfg = load_config()
    token = cfg.get("agentToken")
    if not token:
        token = pair()
        cfg["agentToken"] = token
        save_config(cfg)
        print("[pair] success, token saved")

    backoff = 2
    while True:
        try:
            asyncio.run(run(token))
            backoff = 2
        except Exception as e:
            print(f"[ws] disconnected: {e}; retrying in {backoff}s")
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    main()
