# Git1 Roadmap

Living doc of feature ideas, ranked. Check off as shipped.

## Core gaps to close (table-stakes parity)
- [~] **1. Android Accessibility-based app blocker** — server contract + blocklist wire complete and tested; **native Accessibility Service module still required** (custom dev build + manual permission grant on device).
- [x] **2. Chore → screen-time auto-credit** — chore approval auto-credits the bank (tested).
- [x] **3. Photo check-ins** — base64 upload by agent token, dashboard wall, per-id fetch (tested).
- [x] **4. Offline-first kid app** — `/agent/offline-sync` batch replay endpoint (tested). Kid-app native queue still to wire into the mobile project.
- [x] **5. Pair-code recovery + multi-parent sync** — co-parent invite/claim, shared device view, agent-token-rotating recovery (tested).
- [x] **6. Geofencing + live location** — server-side haversine enter/exit detection, push on transition, bulk location upload (tested).
- [ ] Allowlist/blocklist per app per time-of-day ("Roblox only after homework, never after 9pm").
- [ ] Tamper-proofing — Device Admin uninstall protection, SIM-swap alert, GPS-off notification.

## Differentiators (post-MVP)
- [ ] AI conversation coach — Claude drafts 1-tap reply to time requests.
- [ ] Weekly "kid report" digest — Claude summary push/email every Sunday.
- [ ] Homework mode — one-tap blocks everything except learning apps for N minutes.
- [ ] Family calendar integration (Google Calendar sync, auto-relax on weekends).
- [ ] Sibling fairness view — side-by-side screen-time comparison.
- [ ] Driving detection — auto-DND + speed alert in cars.
- [ ] Open-source / no-data-sale trust angle in marketing.

## Status
5/6 core features fully shipped & end-to-end tested (server/test/features.test.mjs — 13 assertions, all green). Feature 1's server contract is shipped & tested; finishing it requires a native Android Accessibility Service module installed via `eas build -p android --profile development` and the user manually granting Accessibility permission — that can't be exercised in this sandbox.
