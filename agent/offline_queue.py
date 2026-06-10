"""Offline event queue for the Git1 agent.

When the WebSocket is down (server asleep, no internet) outbound events would
normally be dropped. This module persists them to a tiny JSON file and replays
them via POST /agent/offline-sync once the agent is back online.

Design:
  - append-only, capped at MAX_QUEUE entries (oldest dropped)
  - thread-safe (lock + atomic rewrite)
  - drained by a background worker on every successful WS reconnect
"""
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

import requests

MAX_QUEUE = 2000
BATCH_SIZE = 200


class OfflineQueue:
    def __init__(self, path: Path, server_http: str) -> None:
        self.path = path
        self.server_http = server_http
        self._lock = threading.Lock()
        self._items: list[dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            try:
                self._items = json.loads(self.path.read_text()) or []
            except Exception:
                self._items = []

    def _save_unlocked(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._items))
        os.replace(tmp, self.path)

    def append(self, name: str, payload: dict | None = None) -> None:
        with self._lock:
            self._items.append({
                "name": name,
                "payload": payload or {},
                "capturedAt": int(time.time() * 1000),
            })
            if len(self._items) > MAX_QUEUE:
                # Drop oldest to stay within bounds.
                self._items = self._items[-MAX_QUEUE:]
            self._save_unlocked()

    def size(self) -> int:
        with self._lock:
            return len(self._items)

    def drain(self, token: str) -> int:
        """POST queued events to the server in batches; clear on success.

        Returns total events successfully replayed (0 on failure).
        """
        with self._lock:
            if not self._items:
                return 0
            snapshot = list(self._items)

        sent = 0
        for i in range(0, len(snapshot), BATCH_SIZE):
            batch = snapshot[i : i + BATCH_SIZE]
            try:
                r = requests.post(
                    f"{self.server_http}/agent/offline-sync",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"events": batch},
                    timeout=15,
                )
                if r.status_code != 200:
                    print(f"[offline-q] drain HTTP {r.status_code}; aborting batch")
                    break
                sent += len(batch)
            except requests.RequestException as e:
                print(f"[offline-q] drain failed: {e}")
                break

        if sent > 0:
            with self._lock:
                # Drop the events we successfully sent (from the head).
                self._items = self._items[sent:]
                self._save_unlocked()
            print(f"[offline-q] replayed {sent} event(s); {self.size()} remain")
        return sent
