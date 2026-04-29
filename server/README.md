# Git1 Server

Minimal control-plane for the Git1 parental-control app.

## Responsibilities
- **Auth** — parents sign in, get a bearer token used by the mobile app.
- **Device registry** — pairing codes issued by child PCs are exchanged for
  device IDs bound to a parent account.
- **Command bus** — the mobile app POSTs commands (`lock`, `unlock`,
  `grant_minutes`); each connected agent receives them over a WebSocket.
- **Activity log** — agents push events (`limit_reached`, `app_blocked`,
  `boot`, `idle`) which surface in the Activity tab.
- **Push fanout** — important events trigger an Expo push to the parent.

## Stack
- Node 20, TypeScript, `express`, `ws`, `zod`
- SQLite (via `better-sqlite3`) — single-file store, easy to host
- `node-fetch` for Expo push API

## REST surface (v0)
```
POST  /auth/login                   { email, password } → { token }
POST  /push/register                { token }            (auth)
GET   /devices                                          (auth)
POST  /devices/pair                  { code }            (auth)
POST  /devices/:id/command           { kind, payload? }  (auth)
GET   /schedules                                        (auth)
PUT   /schedules/:id                 Schedule            (auth)
DELETE /schedules/:id                                    (auth)
GET   /activity                                         (auth)
```

## WebSocket (agents)
```
GET /agent/ws?token=<agentToken>
  ← server: { kind: "command", id, name, payload }
  → agent:  { kind: "ack", id }
  → agent:  { kind: "event", name, payload }    # e.g. limit_reached
  → agent:  { kind: "heartbeat", usedTodayMinutes }
```

## Pairing flow
1. Agent boots without a token, hits `POST /agent/pair/start` → server returns
   a 6-digit code valid for 10 minutes.
2. Parent enters the code in the mobile app → `POST /devices/pair`.
3. Server marks the code claimed and returns the bound `agentToken` next time
   the agent polls `GET /agent/pair/poll?code=…`.
4. Agent persists the token and opens the WebSocket.
