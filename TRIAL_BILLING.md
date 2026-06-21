# timeoff — Trial & billing architecture (design, not yet built)

> **Status: DESIGN ONLY.** Nothing here is implemented yet. This is the plan for a
> *30-day free trial → paid subscription* model, with the anti-abuse design that
> stops users from just making a new account to get another free trial.
>
> Companion docs: `INSTALL_ARCHITECTURE.md` (installer), `INSTALLER_TRUST.md` (AV),
> `PRIVACY.md` (data). Written 2026-06-21.

---

## 0. The one idea that matters

**Anchor the trial to the kid's PC (a hardware fingerprint), NOT the email/account.**

Accounts use deterministic IDs derived from email (`u_<sha256(email)>`), so a "new
account" is just a new email — free and infinite. Email is a **useless** anti-cheat
anchor. The thing the product actually controls — the kid's **physical Windows PC**
— is something a parent can't trivially duplicate. So the trial clock belongs to
the hardware, recorded server-side, and it **survives account deletion**.

---

## 1. Data model (server / `store.ts`)

### 1a. Account plan — extend `users`
```
ALTER TABLE users ADD COLUMN plan          TEXT    NOT NULL DEFAULT 'trial';  -- 'trial' | 'paid' | 'expired'
ALTER TABLE users ADD COLUMN trialStartedAt INTEGER;                          -- epoch ms, set on first device pair
ALTER TABLE users ADD COLUMN stripeCustomerId TEXT;
ALTER TABLE users ADD COLUMN stripeSubId      TEXT;
ALTER TABLE users ADD COLUMN paidUntil        INTEGER;                        -- epoch ms; from Stripe current_period_end
```

### 1b. Device trial ledger — the anti-abuse anchor (NEW table)
```
CREATE TABLE IF NOT EXISTS device_trials (
  hardwareFingerprint TEXT PRIMARY KEY,   -- hash(BIOS UUID + MachineGuid + ...)
  firstPairedAt       INTEGER NOT NULL,   -- epoch ms, first time ANY account paired this hardware
  trialEndsAt         INTEGER NOT NULL,   -- firstPairedAt + 30d, FIXED — never reset
  lastUserId          TEXT,               -- most recent account that paired it (for support)
  pairCount           INTEGER NOT NULL DEFAULT 1  -- how many times re-paired (high = suspicious)
);
```
This row is **never deleted by account deletion** (it's keyed by hardware, not user).
That's the whole point: a new email re-pairing the same PC inherits the existing
(likely expired) `trialEndsAt`.

### 1c. Effective entitlement (the resolver)
```
effectiveTrialEnd = device_trials.trialEndsAt        // hardware clock wins
plan = 'paid'      if users.paidUntil > now
     = 'trial'     if now < effectiveTrialEnd
     = 'expired'   otherwise
```
Per-account trial *window* for friendliness, but the **device ledger is the backstop**
that prevents a fresh trial on already-seen hardware.

---

## 2. Hardware fingerprint (agent / `agent.py`)

The agent runs as SYSTEM, so it can read stable IDs and send them at registration:
- **BIOS / motherboard UUID** — `Win32_ComputerSystemProduct.UUID` (survives Windows reinstall)
- **MachineGuid** — `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`
- (optional) primary disk serial

```
fingerprint = sha256(f"{bios_uuid}|{machine_guid}").hexdigest()[:32]
```
Sent in the WebSocket `register` message and/or `POST /agent/pair/start`. The server
records it in `device_trials` and ties it to the paired device.

**Robustness notes**
- Compute server-side from agent-reported raw values where possible, and store the
  raw components so a later algorithm change can re-match.
- A single weird value (VM, cloned image) shouldn't reset the clock — match on BIOS
  UUID primarily, MachineGuid secondarily.

---

## 3. Trial start & enforcement flow

1. **First pair of a PC:** server looks up `device_trials[fingerprint]`.
   - **Unseen** → create row, `trialEndsAt = now + 30d`; if the account has no
     `trialStartedAt`, set it.
   - **Seen** → reuse the existing `trialEndsAt` (no reset). Bump `pairCount`.
2. **Every snapshot** to the agent includes the resolved `plan` + `trialEndsAt`
   (see §5). Server is the only source of truth.
3. **On expiry (`plan = 'expired'`):** the agent enters **degraded mode** —
   - stops enforcing limits/locks (kid regains free time),
   - shows "Trial ended — subscribe to keep timeoff controls,"
   - the parent app turns control actions read-only with an upsell.
   This is the conversion lever: the parent feels the loss immediately and pays.
4. **On payment:** Stripe webhook flips `plan = 'paid'`, sets `paidUntil`; the next
   snapshot re-arms enforcement automatically.

---

## 4. Payment (Stripe)

- **Checkout:** app opens a Stripe Checkout / Billing Portal link from
  `POST /billing/checkout` (server creates the session with `stripeCustomerId`).
- **Webhook:** `POST /billing/webhook` (Stripe-signed) handles
  `checkout.session.completed`, `customer.subscription.updated|deleted`,
  `invoice.paid` → updates `users.plan`, `stripeSubId`, `paidUntil`.
- **Source of truth:** `paidUntil` comes from Stripe's `current_period_end`. Never
  trust the client. The app/agent only *read* `plan` from the server.
- **Read endpoint:** `GET /me/plan` → `{ plan, trialEndsAt, paidUntil }` for the app.

---

## 5. Plumbing `plan` to the agent (snapshot)

`buildSnapshot()` (`server/src/index.ts`) already sends per-device policy. Add:
```js
// resolved from the device's owner account + device_trials ledger
plan: resolvePlan(d),            // 'trial' | 'paid' | 'expired'
trialEndsAt: deviceTrialEnd(d),  // epoch ms
```
The agent reads `plan`; if `expired`, it degrades enforcement. The kid dashboard
and parent app read the same fields. (App reads via `GET /me/plan`.)

---

## 6. Cheat → automatic defense

| Cheat | Defense |
|---|---|
| New email/account, re-pair same PC | Trial keyed to **hardware fingerprint** → "already used on this device" |
| Reinstall Windows / wipe agent | Fingerprint uses **BIOS UUID** (survives reinstall) + server-side ledger |
| Set PC clock back | Trial dates are **server timestamps**; existing **NTP clock-tamper detection** |
| Tamper agent to fake fingerprint | Agent runs as SYSTEM + existing **tamper/integrity detection**; flag implausible resets / high `pairCount` |
| Delete + recreate account | `device_trials` persists (keyed by hardware, not user) |
| Self-host the open-source server | **Accept it** — tiny fraction; "hosted + zero setup" is the product |

---

## 7. Scope / non-goals

- **Audience is parents, not hackers.** The realistic cheat is "another email." The
  fingerprint anchor kills that automatically. Do **not** over-engineer against
  VM-resetting evasion — it risks false positives that block legit re-pairs.
- **Legit new-PC re-pair:** a parent who genuinely buys a new kid PC starts a new
  device trial — that's fine/expected. For "my motherboard died" edge cases, a
  **manual support override** (reset a fingerprint row) is enough; don't automate.
- **Grace window:** consider a 2–3 day soft-expiry grace before degrading, to avoid
  punishing a parent mid-billing-hiccup.

---

## 8. Required privacy disclosures (ship in the SAME PR as the feature)

The hardware fingerprint is a **persistent unique identifier → personal data**
(GDPR "online identifier"; Apple "Device ID"). It **must be disclosed**. No consent
prompt is needed — abuse/fraud prevention is a valid **legitimate-interest** basis —
but disclosure is mandatory.

**Already disclosed as *planned*** (in advance, marked "not collected yet") across:
`PRIVACY.md`, `server/public/privacy.html`, `app/privacy-details.tsx`,
`app/(tabs)/settings.tsx`. The policy framing was changed from "mirrors the schema
1:1" to **"complete list — we never collect anything not on it; planned items are
labeled until live,"** which is what allows the advance disclosure to sit inline.

**When the feature actually ships, in the SAME PR:**
- [ ] Drop the `— planned` / "not collected yet" markers in all four surfaces above
      (the rows are already there; just flip them to active)
- [ ] **Apple App Privacy label** (App Store Connect) — declare *Identifiers →
      Device ID*, purpose *App Functionality / Fraud Prevention*; keep it OUT of "Tracking"
- [ ] Re-confirm the **"Never collected"** lists stay truthful — a fraud hash is NOT
      an advertising ID, so those promises still hold

## 9. Build order when ready

1. `device_trials` table + `users` plan columns + `resolvePlan()` resolver.
2. Agent: compute + send hardware fingerprint on register.
3. Server: record fingerprint on pair; start/lookup trial.
4. Snapshot: add `plan` + `trialEndsAt`; agent degraded-mode handling.
5. `GET /me/plan` + app trial banner / upsell + read-only-on-expiry.
6. Stripe: checkout endpoint + signed webhook + `paidUntil`.
7. App: "Subscribe" screen → Stripe Checkout.
</content>
