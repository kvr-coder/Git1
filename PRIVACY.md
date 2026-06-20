# timeoff — Privacy Policy

**Effective date: 20 June 2026**

timeoff (also referred to as "Git1") is a parental screen-time tool: a phone
app for the parent, a Windows agent on the child's PC, and a small sync server.
This policy describes exactly what data we hold, why, and for how long. It
mirrors the actual database schema 1:1 — there is nothing collected that is not
listed here. The same breakdown is shown in the app at **Settings → Privacy**.

The canonical, always-current version of this policy is served at:
**https://git1-server.onrender.com/privacy**

---

## Who we are

- Product: **timeoff** parental screen-time management.
- Server: `https://git1-server.onrender.com` (open source — see below).
- Contact: kvaraciejus@gmail.com

The server is open source and can be **self-hosted**. If you point the app at
your own server (Settings → Server URL), your data never touches our
infrastructure at all.

---

## What we collect

### Account & plumbing (required to operate)
| Data | Why | Kept |
|---|---|---|
| Email + password hash | Log you in | Until you delete the account |
| Session tokens | Keep you signed in on your phone | Until you sign out |
| Push tokens (iOS / Web Push) | Send you alerts | Until you remove the device |
| Paired kid PCs (id, name, agent token) | Reconnect the PC after restarts | Until you unpair |
| Pairing codes (6-digit) | One-shot device pairing | Auto-deleted after 10 minutes |
| Co-parent links | Let both parents see the same kid | Until you unlink |

### Settings (so the kid PC stays in sync)
| Data | Why | Kept |
|---|---|---|
| Daily limit, schedule, blocklist, bank balance, ND mode, vacation | The kid PC needs them on every reconnect | Until you change them |
| Chore templates (e.g. "Make bed → +5m") | Show the kid consistent options | Until you delete them |
| Geofences (zones you defined) | Only if you set one up | Until you delete them |

### History (wipeable any time)
| Data | Why | Kept |
|---|---|---|
| Activity log (lock / unlock / "limit reached") | The Activity tab | Until you clear history |
| Time requests ("+15 min please") | Review past requests | Until you clear history |
| Chore submissions (description + minutes) | Review + approve flow | Until you clear history |
| Bank ledger (every credit / debit) | The Bank screen history | Until you clear history |
| Daily stats (minutes used + per-app minutes) | The Stats tab (trends) | Until you clear history |
| Location points + geofence enter/exit | Only if you ever uploaded location | Last 100 per device, then trimmed |
| Photo check-ins (JPEGs) | Only if your kid ever sent one | Until you clear history |
| Bug reports you submit | So we can fix what you reported | Indefinitely |

---

## What we NEVER collect

- Message contents (DMs, Discord, iMessage, anything)
- Screenshots or screen contents
- Search history
- Browsing URLs
- Any third-party analytics SDKs
- Any advertising IDs
- We **never sell or share** any data with anyone, for any reason.

---

## Children's data

timeoff is operated **by a parent/guardian** to manage their own child's
device. The data about the child (PC name, screen-time usage, optional location
or photo check-ins) is collected **at the parent's direction** and is visible
**only to that parent** (and any co-parent they explicitly invite). We do not
build profiles, do not use this data for advertising, and do not disclose it to
third parties.

---

## Your controls

- **Clear my history on the server** — Settings → Privacy. Wipes everything in
  the "History" section above without unpairing your devices.
- **Delete my account** — Settings → Privacy. Removes the account and all
  associated data.
- **Self-host** — run the open-source server yourself; your data never reaches
  us.

---

## Where data lives

On the timeoff server (Render) at `https://git1-server.onrender.com`, in a
SQLite database. The server code is public at
https://github.com/kvr-coder/git1.

---

## Changes to this policy

If we change what we collect, we update this document and the in-app
Settings → Privacy screen together. The effective date at the top reflects the
latest version.

## Contact

Questions or data requests: **kvaraciejus@gmail.com**
</content>
