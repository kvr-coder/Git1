# Git1 Agent (Windows)

A small Python service that runs on the child's PC, connects to the Git1
server, and executes lock/unlock commands.

## Why Python
- Single-file packaging via PyInstaller
- One-line workstation lock via `ctypes` → `user32!LockWorkStation`
- Easy to install as a Windows service later (`pywin32` or NSSM)

## Files
- `agent.py` — main loop: pair on first run, then maintain a WebSocket
- `requirements.txt` — `websockets`, `requests`

## First run (pairing)
1. `python agent.py` — prints a 6-digit code from `POST /agent/pair/start`
2. Parent enters the code in the mobile app
3. Agent polls `/agent/pair/poll` until it receives an `agentToken`, saves it
   to `%APPDATA%\Git1\agent.json`
4. Agent connects to `wss://<server>/agent/ws?token=…`

## Commands handled
- `lock` → `user32.LockWorkStation()`
- `unlock` → no-op on Windows; logs an event (you cannot programmatically
  unlock a locked Windows session — this command exists to restore the
  *allowed* state so the next limit-reached lock won't fire immediately)
- `grant_minutes` → adjusts the local daily counter
- `set_limit` → updates the local daily limit

## Roadmap
- Track active session time (idle detection via `GetLastInputInfo`)
- Enforce schedules locally so behavior is correct even if offline
- Process killer / app blocker (allow-list of `.exe` names)
- Install as a Windows Service so it survives logout
- macOS / Linux ports
