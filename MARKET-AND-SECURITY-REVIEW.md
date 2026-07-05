# Git1 — Market & Security Review

Independent, critical assessment: is this worth launching, and is it safe enough
to run on your own kids' PCs? Written 2026-07-05. Honest, not flattering.

Two questions are answered separately because they have different answers:
1. **Should you launch it commercially?** — Mostly no. See §1–§3.
2. **Is it good/safe enough for your own kids?** — Yes, after 4 security fixes. See §4–§5.

---

## 1. What Git1 actually is

A parental-control system that controls a **child's Windows PC** from a parent's
**iPhone/Android** (or any browser). Three parts: a React-Native/Expo app, a
Node+SQLite server on Render, and a Python agent that runs as **LocalSystem** on
the kid's PC. Enforcement: idle-aware daily time limit, schedule → Windows
logon-hours block, per-child-SID internet cutoff, process kill blocklist,
VPN/Tor + clock-tamper detection, offline policy cache. Differentiator claimed:
a **"time economy"** — kids do chores → parent approves → minutes bank → kid
spends/borrows.

Engineering quality is genuinely high for a solo project. The anti-lockout
safety model in particular is better than several paid products.

---

## 2. Market verdict: don't launch it to "beat Windows incumbents"

### 2.1 The core differentiator is not unique
The pitch rests on "chores earn screen time" being novel. It isn't. Confirmed
competitors that already ship a chore/earn-time mechanic:

| Product | Chore→time feature | Controls a Windows PC? |
|---|---|---|
| **Screen Time Labs** | Yes — "Tasks": kid marks done + **photo proof** → parent approval queue → minutes. *Nearly identical to Git1's flow.* | No (no Windows agent) |
| **Salfeld Child Control** | Yes — "Time Codes" + bonus apps | Yes (real Windows agent) |
| **FamiSafe** | Yes — reward extra time for tasks | Yes (buggy Windows agent) |
| **Kidslox** | Yes — assign chores/quiz → extra time | Limited Windows client |
| **Mobicip** | Soft — schedule-based "after chores" | Yes (crash-prone) |
| **ScreenCoach** | Yes — dedicated chore-reward model | Mobile-first |
| Microsoft Family Safety, Qustodio, Norton, Kaspersky, Net Nanny, Bark | **No** chore economy — only "ask for more time" | Varies |

So the **truly** uncommon thing isn't chores. It's the *combination*: real
Windows enforcement + phone control + VPN/Tor/clock-tamper detection +
fail-safe recovery + the earn-time economy, in one product. Every individual
piece exists somewhere; the bundle is rarer. That's a weaker wedge than "we
invented earning screen time," which is what the premise assumed.

### 2.2 Windows-PC-only is a shrinking beachhead
Kids' screen time has shifted overwhelmingly to phones, tablets, and consoles.
A Windows-only control addresses mostly gaming rigs and homework laptops.
**Every serious competitor is multi-platform**; Windows-only reads as a gap, not
a niche. The biggest adjacent market is an Android child agent (already noted in
your own IDEAS.md #15).

### 2.3 Microsoft Family Safety is a brutal price floor
It's **free, pre-installed, and "good enough"** for most parents. It's genuinely
weak (Edge-only filtering, poor Win32 app-blocking, 24–48h sync lag, no VPN/Tor
detection, local-account and WinRE bypasses, only "ask for more time"), but
"free and already there" beats "unknown paid indie" for the median parent. Paid
products survive by being **multi-platform and more reliable**, not by doing
Windows better than Microsoft.

### 2.4 The market is real but hostile to indies
Parental-control software is a real, growing category (broadly cited ~$1–2B+,
high-single-digit to low-double-digit % annual growth — *treat exact figures as
unverified; web verification was blocked this session*). But:
- Incumbents' review scores are **mediocre across the board** (Qustodio ~2.4,
  Net Nanny ~2.1, Bark ~2.9, Mobicip ~2.4 Play, plus universal complaints of
  buggy Windows agents, billing dark patterns, and bad support). Parents are
  dissatisfied — **yet that dissatisfaction has not translated into indie
  success**, because the barriers below gate it.
- It's a **low-trust, high-churn, support-heavy** category. Kids actively fight
  the product; parents blame the product when a kid bypasses it.

### 2.5 The barriers that specifically kill a solo indie here
This is the decisive part.

- **Antivirus / SmartScreen false positives (structural, not bad luck).** A
  Python agent that kills processes, edits firewall rules, runs as SYSTEM, and
  auto-updates itself is a textbook RAT profile. PyInstaller output is *routinely*
  flagged by Defender/Windows because malware uses the same bootloader — this is
  a documented, recurring problem PyInstaller's maintainers have a standing issue
  template for, with the blunt conclusion "we have no control over other
  organisations' broken antivirus software." Established vendors don't get
  "globally whitelisted"; they code-sign, accrue file-hash reputation over a
  large install base, and **publish AV-exclusion instructions their customers
  must apply** (Qustodio/Linewize and Net Nanny both literally tell users to
  disable AV during install, then whitelist paths). Git1 currently sidesteps this
  by *not packaging* — raw git checkout + system Python + admin PowerShell —
  which is clever but means **only a developer can install it**. No non-technical
  parent will run `Install-Git1-Kid.ps1`.
- **Code signing no longer buys an instant pass.** Key 2025/2026 change:
  **Microsoft removed EV code-signing's instant-SmartScreen-reputation benefit**
  (EV OIDs dropped from the Trusted Root program ~Aug 2024). Both OV *and* EV
  certs now must build reputation the slow way — via accumulated clean
  downloads tied to file hash / publisher; one Microsoft source describes this
  as potentially "years" for a low-volume app. Certs run ~$65–420/yr (OV) and
  ~$249–576/yr (EV), now legally require a hardware token / cloud HSM, and are
  capped at ~459-day validity from early 2026. So for a no-budget solo dev,
  signing is a real recurring cost that *still* leaves early users staring at
  SmartScreen warnings.
- **The one clean SmartScreen bypass conflicts with the architecture.** Apps
  shipped via the **Microsoft Store are re-signed by Microsoft and carry full
  reputation from day one** — no SmartScreen warning ever. But Store policy
  appears to restrict background **NT services**, which is exactly how the
  enforcement agent must run, and — tellingly — **no incumbent ships their
  Windows agent through the Store** (Qustodio and Bark both distribute a direct
  `.exe`; Bark only puts a browser extension in the Store). The whole category
  treats direct-download installers as the norm precisely because of the
  privileged-service friction. Real strategic tension, not a solved path.
- **Trust cold-sell, and the category's reputational baggage.** Convincing a
  stranger to grant SYSTEM-level, auto-updating, process-killing,
  network-severing software from an unknown individual onto their child's PC is
  close to impossible without a brand — and a 2025 UCL/arXiv study
  ("Surveillance Disguised as Protection") specifically finds that *sideloaded,
  non-store* parental-control apps tend toward excessive data access and hidden
  presence, so an indie direct-download agent inherits that suspicion regardless
  of how clean the code is. This compounds with the AV problem: the same deep
  system access that trips antivirus is what makes parents wary of unknown
  publishers. This is the #1 reason indie parental-control apps stay tiny.
- **COPPA / GDPR-K / UK Children's Code.** The moment your server holds *other
  families'* data — kids' usage, chore text, device identifiers — you're a data
  controller of children's data. US COPPA amendments (finalized Jan 2025,
  compliance by **22 Apr 2026**) tighten consent, data-minimization, retention,
  and security-program requirements; there's an *open legal question* (no FTC
  precedent found) whether a parent-installed monitoring tool even triggers
  COPPA's operator/consent machinery, since the parent is the customer and
  consenter — but the safe posture is to adopt the practices anyway. The **UK
  ICO Age Appropriate Design Code** is the clearer obligation: it applies
  extraterritorially to any service likely accessed by UK under-18s, demands
  privacy-by-default, data minimization, and geolocation-off-by-default. The
  current server (weak auth, Render free tier) is nowhere near compliant for
  multi-tenant use. Fine for your own family; a real liability the day a third
  family joins. *(Get a proper legal opinion before going multi-tenant — this is
  research, not legal advice.)*
- **Precedent.** The successes are **funded** (Bark, Qustodio) or
  **platform-owned and free** (Apple Screen Time, Google Family Link, MS Family
  Safety). Indie/open-source efforts stay hobby-niche. *(Directional, from
  domain knowledge; not independently re-verified this session.)*

**Conclusion:** as a commercial product aimed at out-competing Windows
incumbents, the evidence says this is a multi-year uphill fight against trust,
antivirus, and compliance — not a feature fight you can win with better code.

---

## 3. Where there *is* a real opening (if you want one)

Two honest options that fit a solo dev with no budget:

1. **Open-source / self-hostable** (your IDEAS.md #20). The privacy-first,
   self-hosted angle is the *only* indie path with any supporting evidence — it
   targets the HN/Reddit/self-hoster crowd who *will* install SYSTEM software
   from source they can read, and it eliminates the trust cold-sell, billing,
   support SLA, and COPPA/GDPR burden (each family hosts their own data). It
   won't make money, but it can get real users and is a strong portfolio piece.
   Git1 is already 90% shaped for this (git-based, self-hostable server).

2. **Personal tool + small paid "managed cloud" later, maybe.** Use it for your
   family now; if it proves itself, a paid hosted tier for non-technical friends
   is a *small* possibility — but only after solving signing + a real installer,
   and only with eyes open about compliance.

Position, if you pursue either: **the anti-surveillance parental control.** You
deliberately do *not* read messages or screenshots (unlike Bark/Qustodio). You
build trust via the transparent kid dashboard, the earn-time economy, and a
guaranteed can't-get-locked-out recovery model. That's a real, defensible story
against the "creepy monitoring" incumbents — and it's philosophically yours.

---

## 4. Security review (server + agent on the kid's PC)

Ranked by real risk. Fix the four **[CRITICAL/HIGH]** before you trust this with
your kids — they matter even in a family deployment.

### [CRITICAL] Auto-update = remote-code-execution-as-SYSTEM
`agent/updater.py` runs `git pull --ff-only` on a tracked branch, then
`os.execv` as **LocalSystem**, both on a timer and when the server signals a new
commit. **Whatever lands on that branch runs as SYSTEM on every paired kid PC.**
- The repo is public (`github.com/kvr-coder/git1`) and the tracked branch is a
  throwaway `claude/…` dev branch.
- Attack/failure surface: GitHub account compromise → instant SYSTEM RCE on all
  kids' PCs; an accidental bad push bricks/locks every machine; any weakness in
  branch protection widens it. There is **no commit-signature verification**
  before execution.
- **Fix:** dedicate a protected branch only you can push to; enable GitHub
  branch protection + 2FA; ideally verify a signed tag / pinned commit hash in
  `updater.py` before `execv`; or gate updates behind a manual allowlist.
  At minimum, stop tracking a `claude/*` branch. This is the single most
  dangerous design choice in the project.

### [HIGH] Unauthenticated pairing-poll leaks the agent token
`GET /agent/pair/poll?code=` returns the `agentToken` to **anyone** who presents
a paired code. Codes are 6-digit, generated with `Math.random()` (not a CSPRNG),
valid 10 min, with **no rate limiting**. Brute-forcing/racing the ~900k space
yields an agent token → full control of a child's PC (lock/unlock, blocklist,
internet cut). *(server/src/index.ts `pair/poll`, store.ts `startPairing`.)*
- **Fix:** return the token only to a poller that presents an agent-generated
  secret/nonce created at `pair/start`; use `crypto.randomInt`; rate-limit and
  lock after N attempts; shorten the window.

### [HIGH] Passwords hashed with unsalted SHA-256; tokens never expire
`sha256(password)` with no salt and no bcrypt/argon2/scrypt (server/src/index.ts
`sha`). A DB/server leak → instant GPU/rainbow-table cracking; identical
passwords hash identically. Auth tokens are permanent (no expiry/rotation).
- **Fix:** bcrypt or argon2id; add token expiry + rotation + server-side
  revocation.

### [HIGH] No rate limiting anywhere
`/auth/login`, `/auth/register`, and the pairing endpoints have no throttling —
free brute-force of passwords and pairing codes.
- **Fix:** `express-rate-limit` (or similar) on all three.

### [MEDIUM] Smaller issues
- WebSocket auth token is in the URL query string → leaks into proxy/server
  logs. Prefer a header or short-lived ticket.
- Kid dashboard on `127.0.0.1` has no auth: any local process/other local user
  can drive `/spend`, `/borrow`, `/chore`. Impact is limited to the kid's own
  economy, but a scripted kid could auto-spend the bank. Consider a per-session
  token the agent injects.
- Hardcoded default creds (`kvara@test.com` / `hunter22`) in `app/login.tsx` +
  auto-register-on-failure. Fine for personal dev; **remove before any wider
  use.**
- Invite code compared with `!==` (not constant-time) — minor timing leak.
- Ephemeral VAPID keys if env unset (documented) — set them to persist push.
- Clock-tamper detection silently degrades to the local clock if the kid blocks
  NTP (firewall/hosts). Consider alerting when NTP is unreachable, not just on
  drift.

### What's genuinely well done (credit)
- **Parameterized SQL everywhere** — no injection.
- **Fail-safe locking**: refuses to lock any non-child session, and refuses when
  it can't tell — you can always get into your own account. Excellent.
- **Per-child-SID firewall scoping** so an internet block never severs the agent
  or parent — sophisticated and correct.
- **Anti-lockout stack**: deadman auto-unblock, offline `Recover-Git1.bat`, Safe
  Mode fallback, `Test-Git1` auto-disarm timer. This is the strongest part of
  the codebase and beats several commercial products.
- **Correct Windows hardening model**: Standard child user + LocalSystem service
  + ACL-locked install dir + watchdog. This is exactly what the paid competitors
  require too.
- Agent token is 24-byte CSPRNG — strong.

### The unavoidable truth about Windows enforcement
**If the child has or gains local admin, everything is bypassable** — Safe Mode,
`msconfig`, Task-Manager kill, uninstall. This is true for Git1 **and every
commercial competitor** (Microsoft Family Safety falls to a WinRE shell and
local-account conversion; Kaspersky to Safe Mode/`msconfig`; Norton depends on a
standard account; Net Nanny had legacy uninstall passwords). Git1 is **on par**
here. The only real defenses — standard child account + BIOS/UEFI password +
disable external boot — are the ones Git1 already documents. Don't over-invest
trying to "solve" this; nobody has.

---

## 5. Bottom line

- **For your own kids: yes, use it.** It's well-built and, on the safety model
  that matters most (never getting a kid or yourself permanently locked out),
  it's better than several paid apps. **But fix the four ranked security issues
  first** — especially the SYSTEM-level auto-update, which is a real hazard even
  in a family, and the pairing-token leak.
- **As a commercial product to beat Windows incumbents: no.** The differentiator
  isn't unique, Windows-only is a shrinking and free-Microsoft-floored segment,
  and the barriers that kill indie parental-control apps (antivirus/signing
  trust, cold-sell of SYSTEM access, COPPA/GDPR-K) are exactly the ones you'd
  hit. That's not a code problem you can out-engineer.
- **If you want impact beyond your family: open-source it** as a privacy-first,
  self-hostable, anti-surveillance parental control. It's the only indie path
  with evidence behind it, it removes the trust/compliance walls, and Git1 is
  already shaped for it.

*Research caveat: automated web fetching was blocked (HTTP 403) for this
session, so competitor findings came via search snippets and market-size /
distribution figures lean on domain knowledge. Competitor feature/pricing
claims are well-corroborated across multiple sources; treat specific dollar and
market-size figures as directional and worth a manual spot-check before you cite
them anywhere.*
