"""Pair-code recovery for the Git1 agent.

When the parent issues a recovery code (e.g. kid wiped/reinstalled the agent),
they drop the 6-digit code in CONFIG_DIR/recovery.txt. The agent polls the
server, exchanges it for a fresh agentToken, and consumes the hint file.
"""
from __future__ import annotations

from pathlib import Path

import requests


def try_recovery(server_http: str, hint_path: Path) -> str | None:
    if not hint_path.exists():
        return None
    try:
        code = hint_path.read_text().strip()
    except Exception:
        return None
    if not (code.isdigit() and len(code) == 6):
        return None
    print(f"[recovery] trying recovery code {code} from {hint_path}")
    try:
        poll = requests.get(
            f"{server_http}/agent/pair/poll", params={"code": code}, timeout=10
        )
        if poll.status_code != 200:
            print(f"[recovery] poll HTTP {poll.status_code}")
            return None
        body = poll.json()
        if body.get("status") != "paired":
            print("[recovery] code not yet paired")
            return None
        token = body["agentToken"]
        try:
            hint_path.unlink()
        except Exception:
            pass
        print("[recovery] success — rotated to new agent token")
        return token
    except requests.RequestException as e:
        print(f"[recovery] request failed: {e}")
        return None
