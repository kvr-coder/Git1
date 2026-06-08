# Git1 — Status & Handoff

Last updated: 2026-05-03. Branch: `claude/test-hub-web-launch-tAo7u`.

This file is the single source of truth for "where we are" so a new session
can continue without re-deriving everything. Pairs with `IDEAS.md` (backlog)
and the component READMEs.

---

## What Git1 is
Parental-control system for Windows PCs, driven from an iPhone (Expo Go).
- **Server**: Node + Express + ws + SQLite, deployed on Render free tier at
  `https://git1-server.onrender.com`.
- **Mobile app** (`app/`, `lib/`, `components/`): React Native / Expo Router.
- **Agent** (`agent/`): Python service on the child PC; WebSocket to server;
  enforces policy; serves a localhost kid dashboard on `127.0.0.1:17654`.
- **Launchers** (`scripts/*.bat`): `Git1.bat` (full launch) and
  `Git1-Pair.bat` (re-pair only). Both self-elevate to admin.

## Default credentials / config (dev)
- Server URL default baked into `lib/config.ts`: `https://git1-server.onrender.com`
- Login prefilled in `app/login.tsx`: `kvara@test.com` / `hunter22`
- App auto-registers on login failure (so a wiped DB doesn't block sign-in)
- Launcher account vars at top of each `.bat`

## How it runs end to end
1. Server lives on Render (permanent HTTPS URL, but free tier sleeps after
   ~15 min and **wipes SQLite on every redeploy**).
2. Phone app talks to server over HTTPS from any network.
3. Kid PC runs the agent (`python agent.py`, `GIT1_SERVER` env points at
   Render). Agent holds a WebSocket, receives commands + snapshots.
4. Metro/Expo is tunnelled to the phone via a Cloudflare quick tunnel
   (NOT ngrok — ngrok throws "Cannot read properties of undefined
   (reading 'body')" on this setup). Cloudflare quick-tunnel URLs rotate
   each launch, so the QR must be re-scanned every session.

---

## Feature inventory (all implemented + working)
- Auth: login/register/auto-register-on-failure, bearer tokens, 401 clears token
- Devices list (polls every 5s while focused)
- Device detail: Lock now (sticky), Unlock, Grant +15, Internet toggle,
  Self-borrow (+cap), Bank (balance, ± adjust, history, manage templates),
  app blocklist editor
- Schedules: per-day windows, per-schedule actions (lock / block_internet /
  block_apps), shown in list + editor
- Activity log with icons
- Time requests (kid asks → parent approve/deny → grant_minutes)
- Chores (kid submits → parent approve w/ adjustable minutes → bank credit)
- Chore templates (parent-defined, kid taps to prefill)
- Bank ledger (every delta logged: chore/parent_adjust/parent_set/kid_spent)
- Kid dashboard: live status, submit chore (+ template chips), ask for time,
  borrow from tomorrow (with next-day warning), bank + spend, auto-spend
  banner when out of time, parent-resolution toasts (approved/denied)
- Agent enforcement: idle-aware time tracking, daily-limit auto-lock,
  schedule enforcement, app kill loop (psutil), internet kill (netsh),
  VPN/Tor detection, clock-tamper detection (NTP), deadman auto-unblock

---

## KNOWN ISSUES / IN-FLIGHT (read before continuing)

### 1. Internet block lockout — FIXED (per-child-SID block)
**Resolved.** `enforcer_net.block_internet()` now scopes the firewall block to
the **child's user SID** via the documented `localuser="D:(A;;CC;;;<SID>)"`
SDDL condition, instead of a global block-all rule. The agent's own connection
(a different security principal — LocalSystem once installed as a service, or a
different user) is never severed, so the parent can always send `unblock`.
Child SID resolves from `GIT1_CHILD_SID` env → active console-session user →
current process owner. If no SID can be resolved it **refuses to block**
(fail-safe) rather than risk a global lockout.
- **Self-healing:** `heal_legacy_block()` runs at agent startup and on every
  `unblock`, deleting old global `Git1Block`/`Git1AllowAgent` rules — so a
  machine currently locked out by the old agent recovers as soon as the new
  agent runs.
- Deadman switch (5-min offline auto-unblock) retained as belt-and-suspenders.
- New rule name is `Git1BlockChild` (old: `Git1Block`/`Git1AllowAgent`).
- Requires `pywin32` on the agent for SID lookup (win32api/win32security/win32ts).
- Firewall rules PERSIST across reboot — restarting the PC does NOT clear them.

### 2. Lock — scheduled logon block ADDED; ad-hoc lock still a loop
- **Scheduled windows now enforce a true OS logon block** via
  `enforcer_logon.py`: lock-schedules are translated into Windows logon hours
  (`net user <child> /times:`), so outside allowed windows the child cannot log
  on at all. **Opt-in + safe:** does nothing unless `GIT1_CHILD_USER` names a
  local account, and REFUSES to govern the agent's own account (no self-lockout).
  Recovery: `net user <child> /times:all` (or `enforcer_logon.clear()`).
  Granularity is whole hours (Windows limitation).
- **Ad-hoc parent "Lock now" is still the 5s `LockWorkStation` re-lock loop**
  (kid can use the PC ~5s/cycle). A robust event-based re-lock needs the agent
  to run as a service with WTS session notifications — comes with Tier 0 #0.1
  (agent-as-service). Until then, scheduled blocks are the strong path.

### 3. Render free tier (DB wipe — FIXED via Litestream; sleep — keep-alive)
- **DB wipe FIXED (free):** `start.sh` now runs the server under **Litestream**,
  which replicates the SQLite DB to Cloudflare R2 (free 10GB) and restores it
  on boot, so data survives every redeploy/restart. Opt-in via env vars
  (`LITESTREAM_REPLICA_URL` + R2 creds); blank = old ephemeral behaviour, so
  nothing breaks unconfigured. Binary installed in build via
  `scripts/install-litestream.sh`. Full setup: `server/DEPLOY_RENDER.md`.
- **Sleep (~30s cold start):** set a free uptime pinger (cron-job.org /
  UptimeRobot) on `/health` every ~10 min to keep it warm. Launchers also
  ping `/health` and wait.
- Alternative to Litestream: $7/mo Render disk + `GIT1_DB=/var/data/git1.db`.

### 4. Expo Go push notifications
Apple/Expo removed remote push from Expo Go. No lock-screen banners without
a $99/yr Apple Developer account + EAS dev build. In-app toasts only.

---

## Gotchas learned (don't repeat)
- PowerShell ≠ cmd: `%VAR%` doesn't expand (use `$env:VAR`); `del /s /q`,
  `copy /Y`, `rmdir /s` are cmd-only (use `Remove-Item`, `Copy-Item`).
- ngrok tunnel is broken here → use Cloudflare quick tunnels for Metro too.
- Render healthcheck must hit `/health` (public 200), not `/devices` (401).
- Server must `listen(PORT, '0.0.0.0')` or Render healthcheck times out.
- `better-sqlite3` needs `@types/better-sqlite3`; `tsx` must be a prod dep
  (Render strips devDeps).
- Agent firewall commands need Administrator → launchers self-elevate (UAC).
- Cloudflare quick-tunnel prints scary `ERR control stream...` lines then
  succeeds with `Registered tunnel connection` — that noise is fine.

---

## Repo map
- `app/` — Expo Router screens (`(tabs)/`, `device/[id]`, `device-bank/[id]`,
  `device-templates/[id]`, `schedule/[id]`, `pair`, `login`, `_layout`)
- `components/` — Screen, Card, Button, StatusBadge, DeviceCard, RequestCard,
  ChoreCard, ApiBanner
- `lib/` — api (proxy dispatch mock/real), api.real, config, auth, storage,
  push, theme, types, format, mock
- `server/src/` — index.ts (routes + ws), store.ts (SQLite), push.ts, types.ts
- `agent/` — agent.py, dashboard.py, clock.py, enforcer_{net,apps,schedule,vpn}.py,
  INSTALL_SERVICE.md, DEPLOY note
- `scripts/` — launch-cloudflare.bat, Git1-Pair.bat, dev-watch.ps1/.sh, seed.json
- `render.yaml`, `IDEAS.md`, `server/DEPLOY_RENDER.md`

## Suggested next step
Fix issue #1 properly (per-user or per-app internet block) so internet
control is safe to use remotely. That's the biggest real-world blocker.
