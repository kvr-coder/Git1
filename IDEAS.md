# Git1 — Roadmap & Feature Ideas

A backlog of features that would extend Git1 beyond the current MVP and
position it to compete with Qustodio, Bark, Norton Family, and Microsoft
Family Safety.

Grouped by impact. Tier 1 directly counters the #1 user complaint about
existing products (kids bypass them); Tier 5 are differentiating moonshots.

---

## Already shipped (MVP)
- Parent mobile app: tabs (Devices / Schedules / Activity / Settings), login, secure-store auth, push notifications
- Pairing flow (6-digit code on the agent)
- Device controls: Lock now, Unlock, Grant +15 min
- Schedule editor with day chips + time steppers
- Internet kill-switch (toggle in Device detail)
- App blocklist editor (chips)
- Server: Express + ws + SQLite, push fanout to Expo
- Windows agent: idle-aware session-time tracking, daily-limit auto-lock,
  schedule enforcement loop, app/process killer, internet kill via
  `netsh advfirewall`
- NSSM Windows-Service install guide

---

## Tier 1 — Defends against bypass (the #1 complaint)

### 1. Tamper-proof service hardening
- Agent runs as `LocalSystem` (already documented via NSSM)
- Watchdog process that restarts the agent if killed
- File ACLs that prevent the kid's user from reading/writing `agent.json`
- Signed installer (Authenticode)

### 2. Boot-time lock
- Agent starts before user logon (Windows Service auto-start; check)
- Refuse logon outside allowed windows via `net user <kid> /times:...`
- Scheduled Task at boot that re-applies policy before any user shell

### 3. VPN / Tor / proxy detection
- Detect new `tun*` / `tap*` adapters → emit `vpn_detected`, optionally cut net
- Kill known VPN client `.exe`s (NordVPN, ProtonVPN, OpenVPN, etc.)
- Block outbound TCP 9001 (Tor relay) and 9050 (SOCKS) at firewall

### 4. Clock-tamper detection
- Agent pings NTP every minute, pins server-issued time
- Ignore the local clock for limit calculations if drift > 60 s
- Emit `clock_tamper` event

### 5. DNS lock
- Write a DNS allow-list (NextDNS family / OpenDNS Family) into the
  active adapter and re-apply if changed
- Detect DoH (Cloudflare 1.1.1.1, NextDNS) and block via firewall

### 6. Uninstall resistance
- MSI installer to `C:\Program Files\Git1\` (admin only)
- Group Policy registry pin
- Persist a hidden Scheduled Task that bootstraps re-install if files
  vanish

---

## Tier 2 — Smarter than the competition

### 7. Local on-device content classification
- Small local NSFW image classifier (ONNX, < 50 MB) for screenshots
- Local sentiment / bullying classifier for chat windows
- **Pitch:** "Your kid's data never leaves the home" — privacy advantage
  over Qustodio/Bark cloud OCR (which has 48 h delays)

### 8. Per-app time budgets
- 30 min/day YouTube, 1 h/day Steam, etc.
- Reuse the existing `enforcer_apps` polling loop with per-name accounting

### 9. Reward / chore system
- Parent defines chores → kid checks done → parent approves → +N minutes
- New tab in mobile app, new server endpoints, new agent command

### 10. Flat-rate family pricing
- Unlimited devices for one monthly fee (advertised loudly)
- Counter-positioning vs Qustodio's per-device cost stacking

---

## Tier 3 — Trust & transparency (counters "relationship damage")

### 11. Kid-side dashboard (on the child's PC)
- Tray icon shows: "47 min left today · 2 schedules active · 1 app blocked"
- No surprises = less resentment
- Could be a tiny Tauri/Electron tray app or a webview to a localhost
  server endpoint

### 12. 5-minute warning toast before auto-lock
- Windows toast notification ("4 min remaining today")
- Configurable thresholds (10/5/1 min)

### 13. Negotiation flow
- Kid taps "request 15 more min" in tray app → push to parent
- Parent approves / denies / counter-offers in one tap → minutes granted
- Activity log of all requests + outcomes

### 14. Parent action audit log visible to the kid
- Kid sees when/why a rule changed, who changed it
- Counters the "parent silently changed the rules" resentment pattern

---

## Tier 4 — Cross-platform parity (the iOS / Android gap)

### 15. Android child agent
- React Native / Kotlin background service
- Lock via `DevicePolicyManager.lockNow()`
- App-block via `UsageStatsManager` + Accessibility service
- Same WS protocol as the Windows agent
- **Biggest market after Windows.**

### 16. macOS agent
- LaunchDaemon
- Lock via `caffeinate -d` and Screen Time / `pmset displaysleepnow`
- App-block via process kill (same as Windows)

### 17. Browser extension
- Chrome / Edge / Firefox MV3 extension
- Web filtering, time accounting, idle detection
- Fills the iOS monitoring gap (Apple won't let you monitor much native,
  but a browser extension on Safari is fine)

---

## Tier 5 — Differentiating moonshots

### 18. Home-router agent
- Install on OpenWRT / pfSense / OPNsense
- Block sites by kid-device MAC regardless of which laptop they use
- Catches the "kid borrows sister's laptop" scenario
- No per-device install for *web* filtering

### 19. AI homework helper
- "You can use ChatGPT 10 min only after entering your homework into
  our prompt template" — productive use as the unlock
- Built-in homework templates (math, essay outlining, code review)
- Position as "AI tool that *requires* learning, not avoiding it"

### 20. Open-source / self-hostable tier
- Qustodio is closed-cloud SaaS
- A self-hostable parental control would win privacy-conscious parents
  (HN/Reddit/Mastodon demographic)
- Free OSS core; paid managed-cloud / mobile push add-ons

---

## Smaller polish / hygiene items

- Replace SHA-256 password hash with `bcrypt`/`argon2` (server)
- Server: rate-limit `/auth/login` and `/agent/pair/start`
- Server: rotate agent tokens periodically
- Mobile: dark / light theme switcher (currently dark only)
- Mobile: device avatar / per-device color
- Mobile: "this week" usage chart on device detail
- Mobile: tap-to-call / tap-to-message the kid (iOS/Android intents)
- Server: weekly summary email to the parent
- Server: webhook on events (Slack/Discord for tech-savvy parents)
- Agent: log rotation (currently NSSM appends forever)

---

## Research sources (Qustodio + competitors)

- [Qustodio Reviews — Trustpilot](https://www.trustpilot.com/review/www.qustodio.com) — 2.4/5, common complaints: tech issues, billing, support
- [Qustodio Review 2026 — SafetyDetectives](https://www.safetydetectives.com/best-parental-control/qustodio/)
- [Qustodio vs Norton Family — Impulsec](https://impulsec.com/parental-control-software/qustodio-vs-norton-family/)
- [Best Parental Control Apps 2026 — TechRadar](https://www.techradar.com/best/best-parental-control-app-of-year)
- [How kids bypass Parental Controls on Windows — TheWindowsClub](https://www.thewindowsclub.com/how-kids-bypass-and-get-around-parental-controls)
- [Microsoft Family Safety Bypass — Mobicip](https://www.mobicip.com/blog/bypass-microsoft-family-safety)

### Key takeaways from the research
1. **32 % of parents** report kids bypassing controls (TechJury survey)
2. Top bypass methods: VPN, Tor on USB, DNS swap, clock drift, uninstall+reinstall
3. Trustpilot 2.4/5 for Qustodio, BBB C-rating for unanswered complaints
4. iOS is the weakest target for every product — sandbox prevents real monitoring
5. False-alert fatigue: Bark/Qustodio flag harmless, miss real threats
6. Cost stacks per device — pain point for families with 3+ kids
7. Teen relationship damage is a real product risk — surveillance vibe

---

## Suggested next two

If picking two for max differentiation per dev hour:

- **#11 (kid dashboard) + #13 (request more time)** — solves the
  relationship-damage complaint nobody else addresses. Mostly mobile work,
  low risk.
- **#3 + #4 (VPN + clock-tamper detection)** — kills the #1 complaint
  about every competitor. Pure agent code.
