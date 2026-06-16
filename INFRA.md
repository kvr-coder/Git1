# Infrastructure suggestions

Captured Jun 16 2026 during a stretch where Render's free tier wiped the
SQLite DB ~20 times in one afternoon. Pairs with `IDEAS.md` (product) and
`MARKETING.md` (GTM).

---

## The acute problem: continuous data loss on the current setup

You're running the server on **Render's free web-service tier** with
**SQLite on the container's ephemeral disk**. That disk is wiped:

- on **every redeploy** (each `git push` to the deployed branch), and
- after **~15 min of no traffic** the service spins down; the next request
  cold-starts a fresh container with a fresh empty disk.

So in practice the DB has **two simultaneous "expiration" mechanisms** — git
pushes and idle timeouts. During a busy day of pushes, the family data
effectively never persists for more than a few minutes.

### What self-heal covers, and what it doesn't

The HMAC-signed agent-token flow in `server/src/store.ts` (`signAgentToken`
+ `verifyAgentToken`) rebuilds the **device row** when the agent reconnects
after a wipe — that's why paired kid PCs reappear within ~30s of an outage.

**Nothing else self-heals.** Each wipe loses:

- Activity log
- Time/chore requests history
- Bank ledger
- Daily stats + per-app minutes (the Stats screen goes blank)
- Schedules (until the parent app re-pushes them or the agent re-syncs)
- Co-parent links
- Push subscription tokens
- Bug reports
- User passwords (the placeholder-hash recovery path catches re-logins, but
  any in-flight auth tokens are invalid)

This makes every iteration session look like the product is broken.

---

## Options to actually fix it

| Option | Cost | Expiration | Latency to server | Notes |
|---|---|---|---|---|
| **Current (free SQLite + ephemeral disk)** | $0 | **Every redeploy + every idle spin-down** | local | This is the bleeding source |
| **Render paid persistent disk** | ~$0.25/GB-mo on Render Disks; ~$7/mo Starter web | Never | local | Keeps SQLite, just gives it a real disk |
| **Render Postgres free** | $0 | **Wiped at 90 days** | local (co-located) | Free DB has a hard 90-day expiration; data is deleted at the end of the period |
| **Render Postgres Basic 256MB** | **$7/mo** | Never | local (co-located) | Daily backups, no gotchas |
| **Neon free** | $0 | Never | ~30ms (US East) | Cold-starts ~1s after idle; otherwise great |
| **Supabase free** | $0 | Never | ~30–60ms (us-east, cross-internet hop) | Adds latency on every heartbeat |

---

## Recommendation

**Migrate to Render Postgres Basic ($7/mo)** as the single durable cure.

Why:
- Co-located with the web service → near-zero latency on the
  heartbeat-heavy `/agent/ws` path.
- No 90-day wipe, no cold-start gotchas, daily backups.
- One vendor, one dashboard, one bill. Total Render spend so far has been
  $0; one $7 line item ends the wipe saga for good.
- Cheaper than the engineering cost of any half-measure, given the
  fragility has already burned hours of this session.

For a product about to charge ~$79/yr per family (`MARKETING.md`), $7/mo of
infra is noise.

### If "$0" is the constraint

Use **Neon free**. It's a night-and-day improvement over today (no wipes,
no idle reset of data) and the ~1s cold-start is acceptable for a
low-traffic family app. Skip Supabase here because of the cross-region
latency on the heartbeat path.

Skip Render's free Postgres for production — the **90-day forced wipe**
would re-create the exact "where did my devices go?" problem this fix is
meant to solve.

### What to NOT do

- Keep SQLite on Render's ephemeral disk hoping self-heal covers it. It
  doesn't — only the device row heals; everything else is lost on every
  push.
- Move to a non-co-located DB (Supabase, AWS RDS US East from Render EU,
  etc.) without measuring heartbeat-path latency first. The agent
  heartbeats every ~30s and the dashboard polls; cross-region round-trips
  on every one of those will be felt.

---

## Migration sketch (whichever Postgres host you pick)

Roughly half a day of careful work; idle-safe (SQLite fallback stays in
code until Postgres is verified live).

1. Provision the Postgres instance, copy the connection string into
   Render's env vars as `DATABASE_URL`.
2. Swap `better-sqlite3` for `pg` (or `postgres`/`drizzle` — your
   preference). Wrap the existing `db.prepare(...).run/get/all` calls in a
   thin adapter so the call sites don't change much.
3. Port the schema in `server/src/store.ts` into one idempotent SQL file
   (`CREATE TABLE IF NOT EXISTS` + each `ALTER TABLE ADD COLUMN IF NOT
   EXISTS`). Postgres-equivalents: `INTEGER` → `INTEGER`, `TEXT` → `TEXT`,
   defaults stay the same.
4. Rewrite the SQL dialect quirks: `INSERT OR IGNORE` → `INSERT … ON
   CONFLICT DO NOTHING`; the `excluded.*` upsert syntax mostly works
   as-is.
5. Deploy. Verify against a smoke test (login, pair, lock/unlock, stats,
   clear history, delete account). Once green, drop the SQLite fallback in
   a follow-up commit.

---

## What this does NOT fix

- The **misleading "your server" copy** — separately addressed in the
  privacy redesign (already shipped); the data is on `our` server, just
  now a persistent one.
- The **architectural question** of whether the server should be a
  durable store at all (vs. ephemeral relay + PC-as-record). Persistence
  + the existing model is the right *near-term* fix; the relay-only
  rewrite is a separate, larger decision tracked elsewhere (see "What if
  we deleted everything after delivery?" in the chat history — to be
  written up if/when pursued).

---

## Decision checklist (for the next iteration)

- [ ] Pick a host (recommended: **Render Postgres Basic $7/mo**).
- [ ] Provision DB, capture `DATABASE_URL` into Render env vars.
- [ ] Land the migration PR with SQLite fallback intact.
- [ ] Smoke-test in prod.
- [ ] Drop SQLite fallback in a follow-up.
- [ ] Update `CLAUDE.md` to remove the "DB can be wiped any time" caveat,
  which will no longer be true.
