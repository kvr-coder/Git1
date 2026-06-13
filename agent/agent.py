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
import enforcer_logon
import enforcer_net
import enforcer_schedule
import enforcer_vpn
import lockmsg
import location_uploader
import offline_queue
import recovery as recovery_mod
import session_win
import updater

SERVER_HTTP = os.environ.get("GIT1_SERVER", "http://localhost:8080")
SERVER_WS = SERVER_HTTP.replace("http://", "ws://").replace("https://", "wss://")

CONFIG_DIR = Path(os.environ.get("APPDATA", str(Path.home() / ".config"))) / "Git1"
CONFIG_PATH = CONFIG_DIR / "agent.json"
USAGE_PATH = CONFIG_DIR / "usage.json"
# Last policy snapshot, persisted so the agent keeps enforcing the last known
# rules even when the server is asleep/unreachable (fail-closed). When the
# agent runs as a LocalSystem service, CONFIG_DIR is under SYSTEM's profile,
# which a Standard-user child cannot write — so they can't forge a permissive
# policy. (Signed policies are a planned further hardening.)
POLICY_PATH = CONFIG_DIR / "policy.json"
QUEUE_PATH = CONFIG_DIR / "offline-queue.json"
RECOVERY_HINT_PATH = CONFIG_DIR / "recovery.txt"

IDLE_THRESHOLD_SEC = 60
SAMPLE_INTERVAL_SEC = 15
HEARTBEAT_INTERVAL_SEC = 60
RELOCK_INTERVAL_SEC = 5
VPN_CHECK_INTERVAL_SEC = 30
CLOCK_CHECK_INTERVAL_SEC = 600
# Deadman switch: if the agent can't reach the server for this long while
# internet is firewall-blocked, auto-unblock so the parent isn't locked
# out remotely.
NET_DEADMAN_SEC = 5 * 60


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
    """Lock the active console session.

    user32.LockWorkStation() only locks the CALLER's session. When the agent
    runs as a LocalSystem service (session 0), that's a no-op for the user's
    screen — which is exactly the "Lock button does nothing" symptom.

    The correct cross-session way is WTSDisconnectSession on the active console
    session id. Disconnect leaves the session running but presents the lock
    screen, just like Win+L would.
    """
    if sys.platform != "win32":
        print("[lock] non-Windows host, skipping")
        return False
    try:
        wtsapi = ctypes.windll.wtsapi32
        kernel32 = ctypes.windll.kernel32
        sess = kernel32.WTSGetActiveConsoleSessionId()
        if sess == 0xFFFFFFFF:
            print("[lock] no active console session — nothing to lock")
            return False
        # WTSDisconnectSession(hServer=NULL, sessionId, bWait=FALSE)
        ok = wtsapi.WTSDisconnectSession(0, sess, False)
        if ok:
            print(f"[lock] disconnected session {sess} (locked).")
            return True
        err = ctypes.windll.kernel32.GetLastError()
        print(f"[lock] WTSDisconnectSession failed: GetLastError={err}; falling back to LockWorkStation")
    except Exception as e:
        print(f"[lock] WTSDisconnectSession threw {e}; falling back to LockWorkStation")
    # Fallback (works when the agent is running INSIDE the user session).
    return bool(ctypes.windll.user32.LockWorkStation())


def enforce_lock() -> bool:
    """Lock the workstation ONLY when it's safe — i.e. never lock a
    parent/admin session that is recovering the machine.

    Guard (when GIT1_CHILD_USER is configured, which the installer always does):
      * active user == child         -> lock (intended)
      * nobody at the console ("")   -> lock is a no-op login screen, fine
      * active user != child         -> DON'T lock (an admin/parent is on)
      * can't determine (None)       -> DON'T lock (fail safe)
    With no GIT1_CHILD_USER set we fall back to the legacy behaviour (lock).
    This is what guarantees you can always log into your own account to undo a
    runaway lock, even offline.
    """
    child = (os.environ.get("GIT1_CHILD_USER") or "").strip().lower()
    if child:
        active = session_win.active_console_user()
        if active is None:
            print("[lock] active session unknown — NOT locking (fail-safe).")
            return False
        if active and active != child:
            print(f"[lock] '{active}' is not the child ('{child}') — NOT locking.")
            return False
    # Friendly heads-up before locking (debounced — see _last_banner_at).
    _maybe_show_prelock_banner()
    return lock_workstation()


_PRELOCK_STATE = {"last": 0.0}

def _maybe_show_prelock_banner() -> None:
    """Show 'Time's up, next available …' once per ~30 min so the re-lock
    loop doesn't spam banners. Best-effort; never blocks enforcement."""
    now = time.time()
    if now - _PRELOCK_STATE["last"] < 30 * 60:
        return
    _PRELOCK_STATE["last"] = now
    try:
        lockmsg.show_prelock_banner(enforcer_schedule.get_schedules(), seconds=20)
    except Exception:  # noqa: BLE001
        pass


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
def try_recovery() -> str | None:
    return recovery_mod.try_recovery(SERVER_HTTP, RECOVERY_HINT_PATH)


def pair() -> str:
    # Retry the initial pair/start until the server responds. The Cloudflare
    # quick tunnel can take 10-30s after launch before DNS resolves.
    code: str | None = None
    while code is None:
        try:
            r = requests.post(f"{SERVER_HTTP}/agent/pair/start", timeout=10)
            r.raise_for_status()
            code = r.json()["code"]
        except requests.RequestException as e:
            print(f"[pair] server unreachable at {SERVER_HTTP} ({e.__class__.__name__}); retrying in 5s...")
            time.sleep(5)
    # Write the code to a side-file so launchers (.bat) can auto-claim it.
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        (CONFIG_DIR / "last-pair.txt").write_text(code)
    except Exception:
        pass
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

    def unbind(self) -> None:
        self.loop = None
        self.ws = None

    def emit(self, name: str, payload: dict | None = None) -> None:
        loop = self.loop
        ws = self.ws
        # WS down — persist so we can replay after reconnect (offline-first).
        if loop is None or ws is None or loop.is_closed():
            print(f"[bridge] WS down; queueing {name}")
            queue.append(name, payload)
            self.unbind()
            return
        msg = json.dumps({"kind": "event", "name": name, "payload": payload or {}})
        try:
            asyncio.run_coroutine_threadsafe(ws.send(msg), loop)
        except RuntimeError as e:
            print(f"[bridge] emit failed: {e}; queueing {name}")
            queue.append(name, payload)
            self.unbind()


bridge = WSBridge()
# Initialised after server URL/token are known (in main()).
queue: "offline_queue.OfflineQueue" = None  # type: ignore[assignment]


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
        LOCKED_BY_PARENT["value"] = True
        ok = enforce_lock()
        await emit_event(ws, "lock", {"ok": ok})

    elif kind == "unlock":
        LOCKED_BY_PARENT["value"] = False
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
        # Translate lock-schedules into OS-level logon hours (opt-in, safe:
        # no-op unless GIT1_CHILD_USER names a non-agent account).
        enforcer_logon.sync(items)
        lockmsg.sync_logon_message(items)
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
NOTIFICATIONS: list[dict[str, Any]] = []  # recent parent->kid toasts
LOCKED_BY_PARENT: dict[str, bool] = {"value": False}


def apply_policy(msg: dict, usage: "Usage", persist: bool) -> None:
    """Apply a policy snapshot to all enforcers (and optionally cache it).

    Used both for live snapshots from the server and for the cached policy
    loaded at startup, so the agent enforces the last known rules even when
    the server is unreachable (fail-closed).
    """
    scheds = msg.get("schedules") or []
    enforcer_schedule.set_schedules(scheds)
    enforcer_logon.sync(scheds)
    lockmsg.sync_logon_message(scheds)
    enforcer_apps.set_blocklist(msg.get("blocklist") or [])
    BORROW_STATE["enabled"] = bool(msg.get("selfBorrowEnabled", False))
    BORROW_STATE["cap"] = int(msg.get("selfBorrowCapMinutes", 30))
    if "bankedMinutes" in msg:
        usage.set_bank(int(msg.get("bankedMinutes") or 0))
    CHORE_TEMPLATES.clear()
    CHORE_TEMPLATES.extend(msg.get("choreTemplates") or [])
    LOCKED_BY_PARENT["value"] = bool(msg.get("lockedByParent", False))
    if persist:
        try:
            save_json(POLICY_PATH, {
                "schedules": scheds,
                "blocklist": msg.get("blocklist") or [],
                "selfBorrowEnabled": BORROW_STATE["enabled"],
                "selfBorrowCapMinutes": BORROW_STATE["cap"],
                "bankedMinutes": usage.banked_minutes,
                "choreTemplates": list(CHORE_TEMPLATES),
                "lockedByParent": LOCKED_BY_PARENT["value"],
                "cachedAt": time.time(),
            })
        except Exception as e:  # noqa: BLE001
            print(f"[policy] cache write failed: {e}")
    print(
        f"[policy] applied ({'live' if persist else 'cached'}); borrow={BORROW_STATE} "
        f"bank={usage.banked_minutes} templates={len(CHORE_TEMPLATES)} "
        f"lockedByParent={LOCKED_BY_PARENT['value']}"
    )


def push_notification(text: str, kind: str = "info") -> None:
    NOTIFICATIONS.append({"id": int(time.time() * 1000), "text": text, "kind": kind, "ts": time.time()})
    if len(NOTIFICATIONS) > 10:
        del NOTIFICATIONS[:-10]


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

        # 5a. Parent manually locked the device — keep re-locking
        if LOCKED_BY_PARENT.get("value"):
            if now - last_relock >= RELOCK_INTERVAL_SEC:
                last_relock = now
                enforce_lock()

        # 5. Daily-limit gate (always locks)
        schedule_actions = enforcer_schedule.active_actions(clock.now_trusted_dt())
        schedule_allowed = not schedule_actions
        if usage.over_limit():
            if not limit_notified:
                limit_notified = True
                await emit_event(ws, "limit_reached", {"minutes": int(usage.minutes)})
            if now - last_relock >= RELOCK_INTERVAL_SEC:
                last_relock = now
                enforce_lock()
        else:
            limit_notified = False

        # 6. Schedule gate — apply each requested action
        if "lock" in schedule_actions:
            if now - last_relock >= RELOCK_INTERVAL_SEC:
                last_relock = now
                enforce_lock()
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
            notifications=list(NOTIFICATIONS),
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
        # Drain anything we queued while offline.
        if queue is not None and queue.size() > 0:
            try:
                queue.drain(token)
            except Exception as e:  # noqa: BLE001
                print(f"[offline-q] drain at connect failed: {e}")
        loop = asyncio.create_task(enforcer(ws, usage, dash))
        try:
            async for raw in ws:
                msg = json.loads(raw)
                if msg.get("kind") == "command":
                    await handle_command(ws, msg["command"], usage)
                elif msg.get("kind") == "notification":
                    name = msg.get("name", "")
                    payload = msg.get("payload") or {}
                    if name == "request_approved":
                        push_notification(
                            f"✅ Parent approved your request for {payload.get('minutes', 0)} more minutes!",
                            "success",
                        )
                    elif name == "request_denied":
                        push_notification(
                            f"❌ Parent denied your time request",
                            "danger",
                        )
                    elif name == "chore_approved":
                        push_notification(
                            f"✅ Chore approved! +{payload.get('minutes', 0)} min added to your bank.",
                            "success",
                        )
                    elif name == "chore_denied":
                        d = payload.get("description") or "your chore"
                        push_notification(
                            f"❌ Parent denied chore: {d}",
                            "danger",
                        )
                    else:
                        push_notification(str(payload.get("message") or name), "info")
                elif msg.get("kind") == "snapshot":
                    apply_policy(msg, usage, persist=True)
                    # Self-update if the server is deployed at a newer commit.
                    updater.on_server_commit(msg.get("repoCommit"))
        finally:
            loop.cancel()
            bridge.unbind()


def main() -> None:
    global queue
    cfg = load_json(CONFIG_PATH)
    token = cfg.get("agentToken")
    if not token:
        token = pair()
        cfg["agentToken"] = token
        save_json(CONFIG_PATH, cfg)
        print("[pair] success, token saved")
    queue = offline_queue.OfflineQueue(QUEUE_PATH, SERVER_HTTP)
    if queue.size():
        print(f"[offline-q] {queue.size()} event(s) from previous run will replay on connect")
    # Best-effort location reporter (no-op on machines without internet).
    location_uploader.start(SERVER_HTTP, lambda: cfg.get("agentToken"))

    # Initialise NTP anchor + VPN baseline before the loop runs.
    if clock.refresh(force=True) is None:
        print("[clock] NTP unreachable; falling back to local clock")
    enforcer_vpn.init_baseline()
    enforcer_vpn.block_tor_ports()

    # Heal any old GLOBAL firewall block left by a previous agent version.
    # The old block-all rule could sever the agent itself and lock the parent
    # out; removing it on startup recovers a machine that's currently stuck.
    # New blocks are scoped to the child's user SID (see enforcer_net).
    enforcer_net.heal_legacy_block()

    # Self-update: pull new features on a timer (server-signaled path runs from
    # the snapshot handler). Disable with GIT1_AUTOUPDATE=0.
    updater.start_timer()

    usage = Usage()

    # Fail-closed: load and enforce the last cached policy BEFORE we connect,
    # so a sleeping/unreachable server doesn't leave the PC unrestricted. The
    # live snapshot will overwrite this once the WS connects.
    cached = load_json(POLICY_PATH)
    if cached:
        print("[policy] loading cached policy (offline-safe startup)")
        apply_policy(cached, usage, persist=False)

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

    last_connected = time.time()
    backoff = 2
    unauthorized_streak = 0   # consecutive 4401s; re-pair only after sustained failure
    while True:
        try:
            asyncio.run(run(token, usage, dash))
            last_connected = time.time()
            backoff = 2
            unauthorized_streak = 0
        except Exception as e:
            offline_for = time.time() - last_connected
            err_str = str(e)
            print(f"[ws] disconnected: {e}; offline {int(offline_for)}s; retrying in {backoff}s")
            is_unauth = "4401" in err_str or "unauthorized" in err_str.lower()
            if is_unauth:
                # A recovery code waiting? Use it immediately.
                new_token = try_recovery()
                if new_token:
                    token = new_token
                    cfg["agentToken"] = token
                    save_json(CONFIG_PATH, cfg)
                    backoff = 2
                    unauthorized_streak = 0
                    continue
                # Otherwise: a single 4401 can be transient (server cold-start on
                # Render free tier rejects briefly while waking). Do NOT nuke the
                # token on the first one — keep retrying. Only after the token is
                # rejected persistently (server's DB really lost it) do we re-pair,
                # and we do it INLINE (pair() blocks on a fresh code) instead of
                # the old execv loop that spammed new codes every cycle.
                unauthorized_streak += 1
                if unauthorized_streak >= 5:
                    print("[ws] token persistently rejected -> re-pairing (server lost our device).")
                    token = pair()  # prints a code, blocks until the parent claims it
                    cfg["agentToken"] = token
                    save_json(CONFIG_PATH, cfg)
                    backoff = 2
                    unauthorized_streak = 0
                    continue
            else:
                unauthorized_streak = 0
            # Deadman: if internet is firewall-blocked AND we've been offline
            # too long, auto-unblock so parent can recover.
            if enforcer_net.is_blocked() and offline_for > NET_DEADMAN_SEC:
                print(f"[deadman] offline {int(offline_for)}s with internet blocked — auto-unblocking")
                enforcer_net.unblock_internet()
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    main()
