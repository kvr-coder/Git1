import { createHash, createHmac, randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import { store, type DeviceRow } from './store.js';
import { notifyUser as notifyOne, sendPush, shouldNotify, webPushPublicKey } from './push.js';

// Fan a notification out across the primary parent and all co-parents.
async function notifyUser(userId: string, title: string, body: string, data: any) {
  for (const uid of store.parentUserIdsFor(userId)) {
    await notifyOne(uid, title, body, data);
  }
}
import type { AgentMessage, Command, ServerMessage } from './types.js';

const PORT = Number(process.env.PORT ?? 8080);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// The commit this server is deployed at. Advertised to agents in the snapshot
// so they can self-update to match (one `git push` updates server + agents).
// Render injects RENDER_GIT_COMMIT; fall back to a local git lookup.
const REPO_COMMIT: string =
  process.env.RENDER_GIT_COMMIT ??
  (() => {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  })();

const app = express();
app.use(express.json());

// Force no caching on every response — otherwise the browser's disk cache can
// keep showing deleted/edited items until a hard refresh.
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  next();
});

// Public health endpoint for Render / uptime monitors.
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Browser parent dashboard — open the server URL in any phone browser, log in
// with the app account, control devices. No Expo / app install needed.
const ADMIN_HTML = (() => {
  try {
    return readFileSync(new URL('../public/admin.html', import.meta.url), 'utf8');
  } catch {
    return '<h1>Git1</h1><p>dashboard not found</p>';
  }
})();
app.get('/', (_req, res) => {
  // Force browsers to fetch the latest dashboard on every load — otherwise users
  // see the old UI for hours/days after a redeploy.
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.type('html').send(ADMIN_HTML);
});

// Service worker + PWA manifest — required for Web Push and iOS A2HS.
const SW_JS = (() => {
  try { return readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'); } catch { return ''; }
})();
app.get('/sw.js', (_req, res) => res.type('application/javascript').send(SW_JS));
app.get('/manifest.webmanifest', (_req, res) => res.json({
  name: 'Git1 — Parent', short_name: 'Git1',
  start_url: '/', display: 'standalone',
  background_color: '#0b1220', theme_color: '#0b1220',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
}));
// Tiny inline PNG icons (blue circle) so install works without binary assets.
const ICON_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
app.get('/icon-192.png', (_req, res) => res.type('png').send(ICON_PNG));
app.get('/icon-512.png', (_req, res) => res.type('png').send(ICON_PNG));

// ----- Kid dashboard PREVIEW (no agent, no locking) -----
// Lets you see the kid UI from anywhere by hitting /kid in a browser. All
// endpoints are mock and never affect any real device.
const KID_HTML = (() => {
  try {
    return readFileSync(new URL('../public/kid.html', import.meta.url), 'utf8');
  } catch {
    return '<h1>kid preview not found</h1>';
  }
})();
app.get('/kid', (_req, res) => res.type('html').send(KID_HTML));
app.get('/kid/status', (_req, res) =>
  res.json({
    usedTodayMinutes: 72,
    limitMinutes: 120,
    baseLimitMinutes: 120,
    tomorrowProjectedLimit: 120,
    tomorrowDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    internetBlocked: false,
    blocklist: ['discord.exe', 'steam.exe', 'minecraft.exe'],
    schedules: [
      { name: 'School nights', days: ['Mon','Tue','Wed','Thu'],
        startMinute: 16*60, endMinute: 19*60, enabled: true,
        actions: ['lock','block_internet'] },
      { name: 'Bedtime', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        startMinute: 21*60, endMinute: 22*60, enabled: true, actions: ['lock'] },
    ],
    scheduleAllowed: true,
    selfBorrowEnabled: true,
    selfBorrowCapMinutes: 30,
    bankedMinutes: 45,
    choreTemplates: [
      { description: 'Make bed', minutes: 5 },
      { description: 'Take out trash', minutes: 10 },
      { description: 'Read 20 min', minutes: 15 },
    ],
    notifications: [
      { id: 1, text: 'Chore approved: +10 min to bank', kind: 'success', ts: 0 },
    ],
  }),
);
app.post('/kid/request', (_req, res) => res.json({ ok: true, demo: true }));
app.post('/kid/borrow',  (_req, res) => res.json({ newLimit: 135, fromDate: 'tomorrow', demo: true }));
app.post('/kid/chore',   (_req, res) => res.json({ submitted: true, demo: true }));
app.post('/kid/spend',   (req: any, res) => res.json({ spent: Number(req.body?.minutes ?? 0), remaining: 30, demo: true }));

interface AuthedRequest extends Request {
  userId?: string;
}

const auth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = store.userFromToken(token);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.userId = user.id;
  next();
};

// ---------- Auth ----------
const credSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

// Invite-code gate: only people who know PARENT_INVITE_CODE may register.
// Unset = registration disabled entirely (use this once both parents are in).
const INVITE_CODE = process.env.PARENT_INVITE_CODE ?? '';
app.post('/auth/register', (req, res) => {
  const p = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    invite: z.string().optional(),
  }).safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  if (!INVITE_CODE) return res.status(403).json({ error: 'registration disabled' });
  if (p.data.invite !== INVITE_CODE) return res.status(403).json({ error: 'invalid invite code' });
  const existing = store.findUserByEmail(p.data.email);
  if (existing) {
    // If it's a placeholder account recreated by device self-heal, let this
    // registration claim it (sets the password). Otherwise it's truly taken.
    if (existing.passwordHash === '') {
      store.setPassword(existing.id, sha(p.data.password));
      return res.json({ token: store.issueToken(existing.id) });
    }
    return res.status(409).json({ error: 'email taken' });
  }
  const u = store.createUser(p.data.email, sha(p.data.password));
  res.json({ token: store.issueToken(u.id) });
});

app.post('/auth/login', (req, res) => {
  const p = credSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const u = store.findUserByEmail(p.data.email);
  if (!u) return res.status(401).json({ error: 'bad credentials' });
  // Reclaim path: after a DB wipe the agent's self-heal recreated this account
  // with an empty placeholder hash. The first correct-format login sets the
  // real password, so the parent logs straight back in (no re-registration).
  if (u.passwordHash === '') {
    store.setPassword(u.id, sha(p.data.password));
    return res.json({ token: store.issueToken(u.id) });
  }
  if (u.passwordHash !== sha(p.data.password))
    return res.status(401).json({ error: 'bad credentials' });
  res.json({ token: store.issueToken(u.id) });
});

app.post('/push/register', auth, (req: AuthedRequest, res) => {
  const t = z.object({ token: z.string() }).safeParse(req.body);
  if (!t.success) return res.status(400).json(t.error);
  store.addPushToken(req.userId!, t.data.token);
  res.json({ ok: true });
});

// ---------- Web Push (browser dashboard) ----------
// Public key for the dashboard to subscribe with (no auth — it's public).
app.get('/webpush/key', (_req, res) => res.json({ key: webPushPublicKey() }));
const webSubSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});
app.post('/webpush/subscribe', auth, (req: AuthedRequest, res) => {
  const p = webSubSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  store.addWebPushSub(req.userId!, p.data);
  res.json({ ok: true });
});
app.post('/webpush/unsubscribe', auth, (req: AuthedRequest, res) => {
  const p = z.object({ endpoint: z.string().url() }).safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  store.removeWebPushSub(p.data.endpoint);
  res.json({ ok: true });
});
// Lets the parent verify push works end-to-end without bothering the kid.
// ── User-submitted bug reports ─────────────────────────────
// Stored to a tiny table so we can see them in Render's shell, and printed to
// the server log so they show up in Render's live tail.
try {
  store._db().exec(
    'CREATE TABLE IF NOT EXISTS bug_reports (id TEXT PRIMARY KEY, userId TEXT, email TEXT, ts INTEGER, app TEXT, version TEXT, platform TEXT, body TEXT)',
  );
} catch {}
app.post('/feedback', auth, (req: AuthedRequest, res) => {
  const body = String((req.body as any)?.body ?? '').slice(0, 5000);
  const app = String((req.body as any)?.app ?? '').slice(0, 64);
  const version = String((req.body as any)?.version ?? '').slice(0, 64);
  const platform = String((req.body as any)?.platform ?? '').slice(0, 32);
  const email = String((req.body as any)?.email ?? '').slice(0, 128);
  const id = randomBytes(8).toString('hex');
  try {
    store._db().prepare(
      'INSERT INTO bug_reports (id,userId,email,ts,app,version,platform,body) VALUES (?,?,?,?,?,?,?,?)',
    ).run(id, req.userId!, email, Date.now(), app, version, platform, body);
  } catch (e) { console.warn('[feedback] db write failed', e); }
  console.log(`[feedback] ${platform} ${app}@${version} <${email}> ${body.slice(0, 200)}`);
  res.json({ ok: true, id });
});

// ---- User prefs (quiet hours + daily summary toggle) ----
app.get('/me/prefs', auth, (req: AuthedRequest, res) => {
  res.json(store.getUserPrefs(req.userId!));
});
app.put('/me/prefs', auth, (req: AuthedRequest, res) => {
  const p = z.object({
    quietFromMin: z.number().int().min(-1).max(24 * 60 - 1).optional(),
    quietToMin: z.number().int().min(-1).max(24 * 60 - 1).optional(),
    dailySummaryOn: z.boolean().optional(),
    tamperAlertsOn: z.boolean().optional(),
  }).safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  store.setUserPrefs(req.userId!, p.data);
  res.json(store.getUserPrefs(req.userId!));
});

// ---- Installer distribution ----
// Single permanent URL — GitHub redirects /releases/latest/download to the
// current tagged release. The mobile app reads this + the SHA256 from the
// release's .sha256 file so users can verify against the release page.
const INSTALLER_URL =
  'https://github.com/kvr-coder/git1/releases/latest/download/timeoff-agent-setup.exe';
const INSTALLER_SHA256_URL =
  'https://github.com/kvr-coder/git1/releases/latest/download/timeoff-agent-setup.exe.sha256';
// BAT fallback — when an AV blocks the unsigned .exe, the .bat usually goes
// through (no PE header to flag), and vice versa. Ship both so the parent
// always has a working path.
const INSTALLER_BAT_URL =
  'https://github.com/kvr-coder/git1/releases/latest/download/timeoff-agent-setup.bat';
const INSTALLER_BAT_SHA256_URL =
  'https://github.com/kvr-coder/git1/releases/latest/download/timeoff-agent-setup.bat.sha256';

app.get('/installer/latest', auth, async (_req: AuthedRequest, res) => {
  const readSha = async (u: string) => {
    try {
      const r = await fetch(u);
      if (r.ok) return (await r.text()).trim().split(/\s+/)[0] ?? '';
    } catch {}
    return '';
  };
  const [sha, shaBat] = await Promise.all([readSha(INSTALLER_SHA256_URL), readSha(INSTALLER_BAT_SHA256_URL)]);
  res.json({
    exe: { url: INSTALLER_URL, sha256: sha },
    bat: { url: INSTALLER_BAT_URL, sha256: shaBat },
    // Back-compat for clients reading the old shape.
    url: INSTALLER_URL,
    sha256: sha,
  });
});

// One-shot pair-code-bearing installer URL — Inno Setup picks up /code= and
// the kid PC pre-fills it. Avoids the kid having to type the code twice.
function installerLinkWithCode(code: string): string {
  // Note: GitHub strips query strings from binary downloads; we instead pass
  // the code via a wrapping landing page (server-hosted) that JS-redirects
  // to the binary AND copies the code to clipboard.
  return `${getPublicBase()}/installer/go?code=${encodeURIComponent(code)}`;
}
function getPublicBase(): string {
  // Render injects RENDER_EXTERNAL_URL; fallback to localhost for dev.
  return process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${PORT}`;
}

app.get('/installer/go', (req, res) => {
  const code = String(req.query.code ?? '').replace(/[^0-9]/g, '').slice(0, 6);
  const safeCode = code ? code : '';
  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Installing timeoff</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#0b1220}
.code{font-size:42px;letter-spacing:8px;font-weight:700;text-align:center;background:#f0f4ff;border-radius:12px;padding:18px;margin:20px 0;color:#1d4ed8}
a.btn{display:block;background:#1d4ed8;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:12px;font-weight:600}</style>
</head><body>
<h1>Install the timeoff agent</h1>
<p>On the <b>kid's PC</b> (not your phone), tap the button below. The installer is unsigned for now — Windows will show "Unrecognized app"; click <i>More info → Run anyway</i>.</p>
${safeCode ? `<p>When asked, enter this pairing code:</p><div class="code">${safeCode}</div>` : ''}
<a class="btn" href="${INSTALLER_URL}">Download .exe installer</a>
<p style="margin:14px 0 6px 0;font-size:14px;color:#475569">If your antivirus blocks the .exe, use the script installer instead:</p>
<a class="btn" style="background:#475569" href="${INSTALLER_BAT_URL}">Download .bat installer (fallback)</a>
<p style="margin-top:24px;font-size:14px;color:#475569">Both do the same thing. Verify SHA256 on the
<a href="https://github.com/kvr-coder/git1/releases/latest">release page</a>. This page can be reopened any time — the link doesn't expire.</p>
</body></html>`);
});

// QR PNG for the parent app — encodes the /installer/go?code=XXXXXX URL so
// the kid PC's camera or a browser at that URL lands on the installer.
app.get('/qr.png', (req, res) => {
  const text = String(req.query.text ?? '').slice(0, 512);
  if (!text) return res.status(400).end();
  res.type('png');
  QRCode.toFileStream(res, text, { width: 480, margin: 2 }).catch(() => res.end());
});

// Email the installer link to the parent's account email.
let mailer: nodemailer.Transporter | null = null;
function getMailer(): nodemailer.Transporter | null {
  if (mailer) return mailer;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  mailer = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return mailer;
}

app.post('/installer/email', auth, async (req: AuthedRequest, res) => {
  const p = z.object({ code: z.string().regex(/^\d{6}$/).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const email = store.emailFor(req.userId!);
  if (!email) return res.status(404).json({ error: 'no email on file' });
  const link = p.data.code ? installerLinkWithCode(p.data.code) : INSTALLER_URL;
  const m = getMailer();
  if (!m) {
    // Email infra not configured yet — return the link so the parent app can
    // copy/share it manually. Logged for the parent to see in console.
    console.warn(`[installer] SMTP not configured; would email ${email}: ${link}`);
    return res.json({ ok: true, sent: false, link });
  }
  try {
    await m.sendMail({
      from: process.env.SMTP_FROM ?? 'timeoff <noreply@timeoff.app>',
      to: email,
      subject: 'Install timeoff on the kid\'s PC',
      text:
        `Open this link on the kid's PC to install timeoff:\n\n${link}\n\n` +
        (p.data.code ? `Pairing code: ${p.data.code}\n\n` : '') +
        `The page offers two installers:\n` +
        `  * .exe (Inno Setup) — preferred\n` +
        `  * .bat (script) — fallback when antivirus blocks the .exe\n\n` +
        `Both are unsigned for now — Windows will show "Unrecognized app". ` +
        `Click "More info → Run anyway". SHA256s are on the release page.\n\n` +
        `This link doesn't expire — you can re-open it any time, and you can ` +
        `also re-send this email from the app whenever you need to.`,
    });
    res.json({ ok: true, sent: true, link });
  } catch (e: any) {
    console.warn('[installer] email failed', e?.message);
    res.json({ ok: false, sent: false, link, error: e?.message ?? 'send failed' });
  }
});

// ---- Self-serve data deletion ----
// "Clear my history" — soft: drops activity / requests / chores / bank ledger /
// stats / locations / photos. Devices stay paired, schedules stay, account
// stays. Anyone reasonably privacy-minded can run this any time, no penalty.
app.post('/me/clear-history', auth, (req: AuthedRequest, res) => {
  const p = z.object({ confirm: z.string() }).safeParse(req.body);
  if (!p.success || p.data.confirm !== 'CLEAR') {
    return res.status(400).json({ error: 'type CLEAR to confirm' });
  }
  const result = store.clearHistoryForUser(req.userId!);
  console.log(`[history-cleared] user=${req.userId} tables=${JSON.stringify(result.tables)}`);
  res.json({ ok: true, ...result });
});

// "Delete my account" — hard: wipes everything tied to this user, revokes
// agent tokens, signs out. Kid PC will fail to authenticate on next reconnect
// and would need to be re-paired (the parent gets a fresh 6-digit code).
// GDPR-compliant nuke.
app.post('/me/delete', auth, async (req: AuthedRequest, res) => {
  const p = z.object({ confirm: z.string(), email: z.string().email().optional() }).safeParse(req.body);
  if (!p.success || p.data.confirm !== 'DELETE') {
    return res.status(400).json({ error: 'type DELETE to confirm' });
  }
  // Optional second check: must match the account email.
  const onFile = store.emailFor(req.userId!) ?? '';
  if (p.data.email && p.data.email.trim().toLowerCase() !== onFile.toLowerCase()) {
    return res.status(400).json({ error: 'email does not match account' });
  }
  // Tell every paired kid PC to wipe its own local history files BEFORE we
  // drop the row + close the socket — otherwise the agent never gets the
  // signal and historical JSON sits on disk forever. Best-effort: the
  // command rides the existing WS; agents that are offline right now miss
  // it (they re-pair on next reconnect anyway, since the row is gone).
  const ownedDevices = store.listDevices(req.userId!);
  for (const d of ownedDevices) {
    sendToAgent(d.id, {
      kind: 'command',
      command: {
        id: randomBytes(6).toString('hex'),
        deviceId: d.id,
        kind: 'clear_local_history',
        createdAt: Date.now(),
      },
    });
  }
  // Give the wipe command a moment to flush over the wire before we yank
  // the sockets (otherwise the ack-and-close race can drop the command).
  await new Promise((r) => setTimeout(r, 500));
  for (const d of ownedDevices) {
    const ws = agentSockets.get(d.id);
    if (ws && ws.readyState === ws.OPEN) {
      try { ws.close(4401, 'account_deleted'); } catch {}
      agentSockets.delete(d.id);
    }
  }
  const result = store.deleteUserCompletely(req.userId!);
  console.log(`[account-deleted] user=${req.userId} tables=${JSON.stringify(result.tables)}`);
  res.json({ ok: true, ...result });
});

app.post('/webpush/test', auth, async (req: AuthedRequest, res) => {
  await notifyUser(req.userId!, 'Git1 test', 'Push notifications are working.', { kind: 'test' });
  res.json({ ok: true });
});

// ---------- Pairing ----------
app.post('/agent/pair/start', (_req, res) => {
  const pc = store.startPairing();
  res.json({ code: pc.code });
});

app.get('/agent/pair/poll', (req, res) => {
  const code = String(req.query.code ?? '');
  const pc = store.pollPairing(code);
  if (!pc) return res.status(404).json({ error: 'unknown code' });
  if (!pc.deviceId) return res.json({ status: 'pending' });
  res.json({ status: 'paired', agentToken: pc.agentToken, deviceId: pc.deviceId });
});

app.post('/devices/pair', auth, (req: AuthedRequest, res) => {
  const p = z.object({ code: z.string().regex(/^\d{6}$/), name: z.string().optional() }).safeParse(
    req.body,
  );
  if (!p.success) return res.status(400).json(p.error);
  const d = store.claimPairing(p.data.code, req.userId!, p.data.name ?? 'New PC');
  if (!d) return res.status(400).json({ error: 'invalid or expired code' });
  res.json(toPublicDevice(d));
});

// ---------- Devices ----------
app.get('/devices', auth, (req: AuthedRequest, res) => {
  res.json(store.listDevices(req.userId!).map(toPublicDevice));
});

const commandSchema = z.object({
  kind: z.enum([
    'lock',
    'unlock',
    'grant_minutes',
    'set_limit',
    'block_internet',
    'unblock_internet',
    'set_blocklist',
    'set_always_blocklist',
    'set_schedules',
    'set_borrow_settings',
    'add_bank_minutes',
    'set_bank_minutes',
    'rename',
    'set_vacation',
    'set_nd_mode',
    'clear_local_history',
  ]),
  payload: z.record(z.unknown()).optional(),
});

app.delete('/devices/:id', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  // Close any open agent socket and revoke the token.
  const ws = agentSockets.get(d.id);
  if (ws && ws.readyState === ws.OPEN) {
    try { ws.close(4401, 'unpaired'); } catch {}
    agentSockets.delete(d.id);
  }
  store.deleteDevice(d.id);
  res.json({ ok: true });
});

app.post('/devices/:id/command', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  const p = commandSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);

  // Apply server-side state for commands the parent expects to persist.
  if (p.data.kind === 'block_internet') store.updateDevice(d.id, { internetBlocked: true });
  if (p.data.kind === 'unblock_internet') store.updateDevice(d.id, { internetBlocked: false });
  if (p.data.kind === 'set_limit') {
    const m = Math.max(0, Math.min(24 * 60, Number(p.data.payload?.minutes ?? 0) | 0));
    store.updateDevice(d.id, { dailyLimitMinutes: m });
  }
  if (p.data.kind === 'grant_minutes') {
    // Grant adds today-only minutes. Mirror the change server-side so the
    // parent dashboard reflects the new total immediately (and offline agents
    // pick it up on next reconnect via the snapshot).
    const m = Math.max(0, Math.min(24 * 60, Number(p.data.payload?.minutes ?? 0) | 0));
    if (m > 0) {
      const newLimit = Math.min(24 * 60, (d.dailyLimitMinutes || 0) + m);
      store.updateDevice(d.id, { dailyLimitMinutes: newLimit });
    }
  }
  if (p.data.kind === 'lock') {
    // Parent forced a lock -> clear any active schedule override so we don't
    // immediately unlock again on the next tick. Also flip status so the
    // dashboard reflects the new effective state straight away.
    store.updateDevice(d.id, { lockedByParent: true, scheduleOverrideUntil: 0, status: 'locked' });
    pushSnapshotToAgent(d.id);
  }
  if (p.data.kind === 'unlock') {
    // Unlock = clear ALL active restrictions: stop locking, lift internet block,
    // and suppress the schedule until its current window ends. (Parent's
    // explicit "let them back on now" button.) Also reset status='online' so the
    // dashboard's unified lock indicator flips immediately — a leftover 'locked'
    // status from an earlier schedule lock was making the button snap back.
    const overrideUntil = computeScheduleEndForDevice(d.id, Date.now());
    store.updateDevice(d.id, {
      lockedByParent: false,
      internetBlocked: false,
      scheduleOverrideUntil: overrideUntil,
      status: 'online',
    });
    // Tell the agent to lift the firewall block right now (don't wait for the
    // snapshot), then push the snapshot so the schedule override applies too.
    sendToAgent(d.id, {
      kind: 'command',
      command: {
        id: randomBytes(6).toString('hex'),
        deviceId: d.id,
        kind: 'unblock_internet',
        createdAt: Date.now(),
      },
    });
    pushSnapshotToAgent(d.id);
  }
  if (p.data.kind === 'set_blocklist') {
    const apps = (p.data.payload?.apps as string[]) ?? [];
    store.updateDevice(d.id, { blocklist: apps });
  }
  if (p.data.kind === 'set_always_blocklist') {
    const apps = (p.data.payload?.apps as string[]) ?? [];
    store.updateDevice(d.id, { alwaysBlocklist: apps });
  }
  if (p.data.kind === 'set_borrow_settings') {
    const enabled = !!p.data.payload?.enabled;
    const capRaw = Number(p.data.payload?.capMinutes ?? 30);
    const cap = Math.max(0, Math.min(240, isFinite(capRaw) ? capRaw : 30));
    store.updateDevice(d.id, { selfBorrowEnabled: enabled, selfBorrowCapMinutes: cap });
  }
  if (p.data.kind === 'add_bank_minutes') {
    const m = Math.max(0, Number(p.data.payload?.minutes ?? 0) | 0);
    const after = d.bankedMinutes + m;
    store.updateDevice(d.id, { bankedMinutes: after });
    store.appendBankLedger(req.userId!, d.id, m, after, 'parent_adjust', null);
  }
  if (p.data.kind === 'set_bank_minutes') {
    const m = Math.max(0, Number(p.data.payload?.minutes ?? 0) | 0);
    const delta = m - d.bankedMinutes;
    store.updateDevice(d.id, { bankedMinutes: m });
    if (delta !== 0)
      store.appendBankLedger(req.userId!, d.id, delta, m, 'parent_set', null);
  }

  if (p.data.kind === 'set_nd_mode') {
    // ND / executive-function support: longer pre-lock warnings, gentler
    // countdown wording, ADHD/ASD tips in Wisdom. Persisted per device and
    // shipped in the snapshot so the agent honours it.
    const on = !!p.data.payload?.on;
    store.updateDevice(d.id, { ndMode: on });
    store.appendActivity({
      userId: req.userId!,
      deviceId: d.id,
      kind: on ? 'nd_mode_on' : 'nd_mode_off',
      message: `${d.name}: executive-function support ${on ? 'enabled' : 'disabled'}`,
    });
    pushSnapshotToAgent(d.id);
  }

  if (p.data.kind === 'set_vacation') {
    // Until-epoch-ms; 0 = vacation off. Agent suspends schedules + blocklist
    // while now < vacationUntil. The mobile UI sets this via a day picker.
    const until = Math.max(0, Number(p.data.payload?.until ?? 0) | 0);
    store.updateDevice(d.id, { vacationUntil: until });
    store.appendActivity({
      userId: req.userId!,
      deviceId: d.id,
      kind: until > Date.now() ? 'vacation_on' : 'vacation_off',
      message: until > Date.now()
        ? `${d.name}: vacation mode until ${new Date(until).toLocaleString()}`
        : `${d.name}: vacation mode off`,
    });
    pushSnapshotToAgent(d.id);
  }

  if (p.data.kind === 'rename') {
    const name = String(p.data.payload?.name ?? '').trim().slice(0, 40);
    if (name) store.updateDevice(d.id, { name });
  }

  const cmd: Command = {
    id: randomBytes(6).toString('hex'),
    deviceId: d.id,
    kind: p.data.kind,
    payload: p.data.payload,
    createdAt: Date.now(),
  };
  const sent = sendToAgent(d.id, { kind: 'command', command: cmd });
  res.json({ enqueued: true, delivered: sent, command: cmd });
});

// ---------- Schedules ----------
const scheduleSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  name: z.string(),
  days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])),
  startMinute: z.number().int().min(0).max(24 * 60 - 1),
  endMinute: z.number().int().min(0).max(24 * 60 - 1),
  enabled: z.boolean(),
  actions: z.array(z.enum(['lock', 'block_internet', 'block_apps'])).optional(),
});

app.get('/schedules', auth, (req: AuthedRequest, res) => {
  res.json(store.listSchedules(req.userId!));
});

app.put('/schedules/:id', auth, (req: AuthedRequest, res) => {
  const p = scheduleSchema.safeParse({ ...req.body, id: req.params.id });
  if (!p.success) return res.status(400).json(p.error);
  const actions = p.data.actions && p.data.actions.length ? p.data.actions : (['lock'] as const);
  const row = store.upsertSchedule(req.userId!, { ...p.data, actions: [...actions] });
  pushSchedulesToAllAgentsFor(req.userId!);
  res.json(row);
});

app.delete('/schedules/:id', auth, (req: AuthedRequest, res) => {
  store.deleteSchedule(req.userId!, req.params.id);
  pushSchedulesToAllAgentsFor(req.userId!);
  res.json({ ok: true });
});

// ---------- Activity ----------
app.get('/activity', auth, (req: AuthedRequest, res) => {
  res.json(store.listActivity(req.userId!));
});

// ---------- Time requests (kid → parent) ----------
app.get('/requests', auth, (req: AuthedRequest, res) => {
  const status = (req.query.status as 'pending' | 'approved' | 'denied' | undefined) ?? undefined;
  res.json(store.listTimeRequests(req.userId!, status));
});

app.post('/requests/:id/resolve', auth, (req: AuthedRequest, res) => {
  const p = z.object({ status: z.enum(['approved', 'denied']) }).safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const r = store.getTimeRequest(req.userId!, req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  if (r.status !== 'pending') return res.status(409).json({ error: 'already resolved' });
  store.resolveTimeRequest(req.userId!, r.id, p.data.status);
  // Co-parent audit: who actually clicked approve/deny?
  const who = store.emailFor(req.userId!)?.split('@')[0] ?? 'parent';
  store.appendActivity({
    userId: r.userId,
    deviceId: r.deviceId,
    kind: p.data.status === 'approved' ? 'request_approved' : 'request_denied',
    message: `${who} ${p.data.status} ${r.minutes} min request`,
  });
  if (p.data.status === 'approved') {
    // Land the approved minutes in the BANK so the kid sees them under "Bank"
    // and can spend them whenever (matches the UI). Previously this sent
    // grant_minutes, which only extended today's limit and bypassed the bank.
    const d = store.getDevice(req.userId!, r.deviceId);
    if (d) {
      const after = d.bankedMinutes + r.minutes;
      store.updateDevice(d.id, { bankedMinutes: after });
      store.appendBankLedger(req.userId!, d.id, r.minutes, after, 'request_approved', r.id);
    }
    sendToAgent(r.deviceId, {
      kind: 'command',
      command: {
        id: randomBytes(6).toString('hex'),
        deviceId: r.deviceId,
        kind: 'add_bank_minutes',
        payload: { minutes: r.minutes },
        createdAt: Date.now(),
      },
    });
  }
  sendToAgent(r.deviceId, {
    kind: 'notification',
    name: p.data.status === 'approved' ? 'request_approved' : 'request_denied',
    payload: { minutes: r.minutes, reason: r.reason },
  });
  res.json({ ok: true, status: p.data.status });
});

// ---------- Bank ledger ----------
app.get('/devices/:id/bank-ledger', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  res.json(store.listBankLedger(req.userId!, d.id));
});

// ---------- Chore templates ----------
app.get('/devices/:id/stats', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  const days = Math.min(60, Math.max(1, Number(req.query.days ?? 14) | 0));
  res.json({ daily: store.listUsageDaily(d.id, days) });
});

app.get('/devices/:id/chore-templates', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  res.json(store.listChoreTemplates(req.userId!, d.id));
});

app.post('/devices/:id/chore-templates', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  const p = z
    .object({
      description: z.string().min(1).max(240),
      minutes: z.number().int().min(1).max(480),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const row = store.createChoreTemplate(req.userId!, d.id, p.data.description, p.data.minutes);
  pushSnapshotToAgent(d.id);
  res.json(row);
});

app.delete('/devices/:id/chore-templates/:templateId', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  store.deleteChoreTemplate(req.userId!, req.params.templateId);
  pushSnapshotToAgent(d.id);
  res.json({ ok: true });
});

// ---------- Chore requests (kid → parent → bank) ----------
app.get('/chores', auth, (req: AuthedRequest, res) => {
  const status = (req.query.status as 'pending' | 'approved' | 'denied' | undefined) ?? undefined;
  res.json(store.listChoreRequests(req.userId!, status));
});

app.post('/chores/:id/resolve', auth, (req: AuthedRequest, res) => {
  const p = z
    .object({ status: z.enum(['approved', 'denied']), minutes: z.number().int().min(0).max(480).optional() })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const r = store.getChoreRequest(req.userId!, req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  if (r.status !== 'pending') return res.status(409).json({ error: 'already resolved' });

  const approved = p.data.status === 'approved';
  const minutes = approved ? (p.data.minutes ?? r.minutes) : null;
  store.resolveChoreRequest(req.userId!, r.id, p.data.status, minutes);
  const choreWho = store.emailFor(req.userId!)?.split('@')[0] ?? 'parent';
  store.appendActivity({
    userId: r.userId,
    deviceId: r.deviceId,
    kind: approved ? 'chore_approved' : 'chore_denied',
    message: `${choreWho} ${approved ? 'approved' : 'denied'} chore "${r.description.slice(0, 60)}"`,
  });

  if (approved && minutes && minutes > 0) {
    const d = store.getDevice(req.userId!, r.deviceId);
    if (d) {
      const after = d.bankedMinutes + minutes;
      store.updateDevice(d.id, { bankedMinutes: after });
      store.appendBankLedger(
        req.userId!,
        d.id,
        minutes,
        after,
        `chore: ${r.description.slice(0, 80)}`,
        r.id,
      );
      sendToAgent(r.deviceId, {
        kind: 'command',
        command: {
          id: randomBytes(6).toString('hex'),
          deviceId: r.deviceId,
          kind: 'add_bank_minutes',
          payload: { minutes },
          createdAt: Date.now(),
        },
      });
    }
  }
  sendToAgent(r.deviceId, {
    kind: 'notification',
    name: approved ? 'chore_approved' : 'chore_denied',
    payload: { description: r.description, minutes: minutes ?? r.minutes },
  });
  res.json({ ok: true, status: p.data.status, minutes });
});

// ---------- Co-parents (multi-parent sync) ----------
// Primary parent generates a 6-digit invite; second parent enters it after
// registering. Both then share the same devices/activity/notifications.
app.post('/co-parents/invite', auth, (req: AuthedRequest, res) => {
  const code = store.createCoParentInvite(req.userId!);
  res.json({ code, expiresInHours: 24 });
});
app.post('/co-parents/claim', auth, (req: AuthedRequest, res) => {
  const p = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const claim = store.claimCoParentInvite(p.data.code, req.userId!);
  if (!claim) return res.status(400).json({ error: 'invalid or expired code' });
  res.json({ ok: true, primaryUserId: claim.primaryUserId });
});
app.get('/co-parents', auth, (req: AuthedRequest, res) => {
  res.json(store.listCoParents(req.userId!));
});

// ---------- Pair-code recovery ----------
// Parent re-issues a pair code for an existing device (e.g. kid reinstalled).
// Rotates the agent token so the old install is locked out.
app.post('/devices/:id/recovery-code', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  const code = store.createRecoveryCode(req.userId!, d.id);
  store.appendActivity({
    userId: req.userId!,
    deviceId: d.id,
    kind: 'recovery_code_issued',
    message: `${d.name}: recovery pair code issued`,
  });
  res.json({ code, expiresInMinutes: 10 });
});

// ---------- Geofences ----------
const geofenceSchema = z.object({
  deviceId: z.string(),
  name: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(20).max(10000),
  notifyOnEnter: z.boolean().optional(),
  notifyOnExit: z.boolean().optional(),
});
app.get('/geofences', auth, (req: AuthedRequest, res) => {
  const deviceId = (req.query.deviceId as string | undefined) ?? undefined;
  res.json(store.listGeofences(req.userId!, deviceId));
});
app.post('/geofences', auth, (req: AuthedRequest, res) => {
  const p = geofenceSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const d = store.getDevice(req.userId!, p.data.deviceId);
  if (!d) return res.status(404).json({ error: 'device not found' });
  const row = store.createGeofence(
    req.userId!,
    p.data.deviceId,
    p.data.name,
    p.data.lat,
    p.data.lng,
    p.data.radiusMeters,
    p.data.notifyOnEnter ?? true,
    p.data.notifyOnExit ?? true,
  );
  pushSnapshotToAgent(d.id);
  res.json(row);
});
app.delete('/geofences/:id', auth, (req: AuthedRequest, res) => {
  store.deleteGeofence(req.userId!, req.params.id);
  res.json({ ok: true });
});

// Kid-side: bulk location upload (supports offline replay — array of points).
const locUploadSchema = z.object({
  points: z
    .array(
      z.object({
        lat: z.number(),
        lng: z.number(),
        accuracyMeters: z.number().optional(),
        recordedAt: z.number().int(),
      }),
    )
    .min(1)
    .max(200),
});
app.post('/agent/locations', (req, res) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  const device = store.deviceByAgentToken(token);
  if (!device) return res.status(401).json({ error: 'unauthorized' });
  const p = locUploadSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const fences = store.geofencesForDevice(device.id);
  const previous = store.lastLocation(device.id);
  let prevInside: Record<string, boolean> = {};
  if (previous) {
    for (const f of fences) {
      prevInside[f.id] = haversine(previous.lat, previous.lng, f.lat, f.lng) <= f.radiusMeters;
    }
  }
  for (const pt of p.data.points) {
    store.appendLocation(
      device.userId,
      device.id,
      pt.lat,
      pt.lng,
      pt.accuracyMeters ?? null,
      pt.recordedAt,
    );
    for (const f of fences) {
      const inside = haversine(pt.lat, pt.lng, f.lat, f.lng) <= f.radiusMeters;
      const wasInside = prevInside[f.id] ?? inside;
      if (inside !== wasInside) {
        const kind = inside ? 'geofence_enter' : 'geofence_exit';
        const message = `${device.name}: ${inside ? 'arrived at' : 'left'} ${f.name}`;
        store.appendActivity({ userId: device.userId, deviceId: device.id, kind, message });
        if ((inside && f.notifyOnEnter) || (!inside && f.notifyOnExit)) {
          notifyUser(device.userId, inside ? 'Arrived' : 'Left', message, {
            deviceId: device.id,
            kind,
            geofenceId: f.id,
          });
        }
      }
      prevInside[f.id] = inside;
    }
  }
  res.json({ ok: true, accepted: p.data.points.length });
});
app.get('/devices/:id/locations', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  res.json(store.listLocations(req.userId!, d.id, 100));
});

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- Photo check-ins ----------
// Kid uploads base64 JPEG via agent token. Server caps size to ~2MB after b64
// (≈ 1.5MB raw). Parent dashboard lists thumbnails; full image via /photos/:id.
const photoSchema = z.object({
  caption: z.string().max(240).optional(),
  imageData: z.string().min(20).max(4_000_000), // base64
  mimeType: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  capturedAt: z.number().int().optional(),
});
app.post('/agent/photo', (req, res) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  const device = store.deviceByAgentToken(token);
  if (!device) return res.status(401).json({ error: 'unauthorized' });
  const p = photoSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const row = store.createPhotoCheckin(
    device.userId,
    device.id,
    p.data.caption ?? '',
    p.data.imageData,
    p.data.mimeType ?? 'image/jpeg',
    p.data.lat ?? null,
    p.data.lng ?? null,
    p.data.capturedAt ?? Date.now(),
  );
  const message = `${device.name}: photo check-in${p.data.caption ? ` — "${p.data.caption.slice(0, 60)}"` : ''}`;
  store.appendActivity({
    userId: device.userId,
    deviceId: device.id,
    kind: 'photo_checkin',
    message,
  });
  notifyUser(device.userId, 'Photo check-in', message, {
    deviceId: device.id,
    kind: 'photo_checkin',
    photoId: row.id,
  });
  res.json({ ok: true, id: row.id });
});
app.get('/photos', auth, (req: AuthedRequest, res) => {
  res.json(store.listPhotoCheckins(req.userId!));
});
app.get('/photos/:id', auth, (req: AuthedRequest, res) => {
  const row = store.getPhotoCheckin(req.userId!, req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const buf = Buffer.from(row.imageData, 'base64');
  res.type(row.mimeType || 'image/jpeg').send(buf);
});
app.delete('/photos/:id', auth, (req: AuthedRequest, res) => {
  store.deletePhotoCheckin(req.userId!, req.params.id);
  res.json({ ok: true });
});

// ---------- Offline-sync inbox (kid-app replay) ----------
// Kid app stores events while offline; on reconnect it POSTs the batch here and
// the server replays them in order. Keeps the wire format identical to live
// WS events for code reuse.
const offlineBatchSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.string(),
        payload: z.record(z.unknown()).optional(),
        capturedAt: z.number().int().optional(),
      }),
    )
    .min(1)
    .max(500),
});
app.post('/agent/offline-sync', (req, res) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  const device = store.deviceByAgentToken(token);
  if (!device) return res.status(401).json({ error: 'unauthorized' });
  const p = offlineBatchSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  for (const ev of p.data.events) {
    store.appendActivity({
      userId: device.userId,
      deviceId: device.id,
      kind: `offline:${ev.name}`,
      message: `${device.name}: [offline] ${ev.name}`,
    });
  }
  res.json({ ok: true, replayed: p.data.events.length });
});

// ---------- Agent WebSocket ----------
const agentSockets = new Map<string, WebSocket>();

// Tamper detection: a paired device that stops heartbeating (killed agent,
// uninstall, network cut) is a tamper signal. We alert the parent ONCE per
// offline transition. Tracks deviceIds we've already alerted so we don't spam.
const offlineAlerted = new Set<string>();
const OFFLINE_THRESHOLD_MS = 90 * 1000; // ~3 missed 30s heartbeats -> tamper caught in ~90s

function sendToAgent(deviceId: string, msg: ServerMessage): boolean {
  const ws = agentSockets.get(deviceId);
  if (!ws || ws.readyState !== ws.OPEN) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/agent/ws' });

// Heartbeat ping loop: every 25s ping all connected agents so Render's idle
// proxy timeout doesn't drop them. We DO NOT terminate on a missed pong — a
// slow Render free-tier round-trip would otherwise wrongly kill a healthy
// agent every minute (which is exactly the "seen 45s ago but offline" loop
// we used to have). The real TCP disconnect handler still fires for genuinely
// dead sockets, so they're cleaned up there.
const WS_PING_MS = 25_000;
setInterval(() => {
  for (const ws of wss.clients) {
    try { ws.ping(); } catch {}
  }
}, WS_PING_MS);

function buildSnapshot(d: DeviceRow) {
  // Schedules normally bind to a device, but re-pairing changes the device id
  // and would orphan them. If this device has none of its own, fall back to all
  // of the parent's schedules so a single-PC household never loses them.
  let scheds = store.schedulesForDevice(d.id);
  if (!scheds.length) {
    const all = store.listSchedules(d.userId);
    if (all.length) scheds = all;
  }
  return {
    kind: 'snapshot' as const,
    schedules: scheds,
    blocklist: d.blocklist,
    alwaysBlocklist: d.alwaysBlocklist,
    internetBlocked: d.internetBlocked,
    // Parent's chosen daily limit (the BASE, in minutes). The agent reconciles
    // its own usage.limit_minutes to this on every snapshot so a value the kid
    // dashboard shows (e.g. 4h) can't drift from what the parent app shows (2h).
    dailyLimitMinutes: d.dailyLimitMinutes,
    selfBorrowEnabled: d.selfBorrowEnabled,
    selfBorrowCapMinutes: d.selfBorrowCapMinutes,
    bankedMinutes: d.bankedMinutes,
    choreTemplates: store.listChoreTemplates(d.userId, d.id),
    geofences: store.geofencesForDevice(d.id),
    lockedByParent: d.lockedByParent,
    // While now < scheduleOverrideUntil the agent ignores schedule-driven lock
    // and block_internet — so parent's Unlock genuinely unlocks until the
    // current window ends. Reset to 0 once the window passes (or another lock).
    scheduleOverrideUntil: d.scheduleOverrideUntil ?? 0,
    // While now < vacationUntil the agent treats schedules + blocklist as off.
    vacationUntil: (d as any).vacationUntil ?? 0,
    // Executive-function support: longer pre-lock warnings + gentler copy.
    ndMode: !!(d as any).ndMode,
    repoCommit: REPO_COMMIT,
  };
}

// Compute the end-of-current-active-window for the device, in epoch ms. Used
// when the parent presses Unlock during an active lock schedule: we treat the
// override as expiring when that window naturally ends.
function computeScheduleEndForDevice(deviceId: string, nowMs: number): number {
  // Walk minute-by-minute over the next 24h: the override expires at the FIRST
  // moment when NO enabled lock schedule is active for this device. That way,
  // overlapping or back-to-back windows (e.g. 21–07 + 23–13 + 06–11:30) collapse
  // into a single continuous block — Unlock keeps the PC free until ALL of them
  // are over, instead of re-locking the instant the first one ends.
  const scheds = store.schedulesForDevice(deviceId).filter(s =>
    s.enabled && (s.actions || []).some((a: string) => a === 'lock' || a === 'block_internet' || a === 'block_apps')
  );
  const inWindow = (s: any, dayKey: string, m: number) => {
    if (!(s.days || []).includes(dayKey)) return false;
    const a = s.startMinute, b = s.endMinute;
    if (a <= b) return m >= a && m < b;
    return m >= a || m < b; // overnight wrap
  };
  const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];
  let cursor = new Date(nowMs);
  const MAX_HORIZON_MIN = 24 * 60; // give up after 24h
  for (let i = 0; i < MAX_HORIZON_MIN; i++) {
    const dayKey = DAYS[cursor.getDay()];
    const m = cursor.getHours() * 60 + cursor.getMinutes();
    const anyActive = scheds.some(s => inWindow(s, dayKey, m));
    if (!anyActive) return cursor.getTime();
    cursor = new Date(cursor.getTime() + 60_000); // step 1 minute
  }
  // Safety: schedules cover the entire next 24h — apply override for 24h max.
  return nowMs + 24 * 3600_000;
}

function pushSnapshotToAgent(deviceId: string) {
  const ws = agentSockets.get(deviceId);
  if (!ws || ws.readyState !== ws.OPEN) return;
  const d = store.getDeviceById(deviceId);
  if (!d) return;
  ws.send(JSON.stringify(buildSnapshot(d)));
}

function pushSchedulesToAllAgentsFor(userId: string) {
  for (const d of store.listDevices(userId)) {
    const ws = agentSockets.get(d.id);
    if (!ws || ws.readyState !== ws.OPEN) continue;
    ws.send(JSON.stringify(buildSnapshot(d)));
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  const t = url.searchParams.get('token') ?? '';
  const device = store.deviceByAgentToken(t);
  if (!device) {
    ws.close(4401, 'unauthorized');
    return;
  }
  // Keepalive: mark alive on every pong. The interval below pings all clients
  // every 25s so Render's proxy never sees an idle connection and silently
  // drops it ("no close frame" on the agent). Dead sockets get terminated.
  (ws as any).isAlive = true;
  ws.on('pong', () => { (ws as any).isAlive = true; });
  // If an older socket for this device lingers, retire it first so its delayed
  // close handler can't later clobber this fresh connection.
  const prev = agentSockets.get(device.id);
  if (prev && prev !== ws) { try { prev.terminate(); } catch {} }
  agentSockets.set(device.id, ws);
  // Anti-replay: track the highest heartbeat sequence we've accepted on this
  // connection. The agent signs each seq with its token; a replayed or spoofed
  // beat fails the signature or doesn't advance the counter.
  let lastSeq = 0;
  const agentTok = t;
  // If this device was previously flagged offline (tamper), notify recovery.
  if (offlineAlerted.delete(device.id)) {
    notifyUser(device.userId,'Device back online', `${device.name} reconnected`, {
      deviceId: device.id,
      kind: 'device_online',
    });
    store.appendActivity({
      userId: device.userId,
      deviceId: device.id,
      kind: 'device_online',
      message: `${device.name}: agent reconnected`,
    });
  }
  store.updateDevice(device.id, { status: 'online', lastSeen: Date.now(), shutdownCleanly: false });

  // Push current state to agent immediately.
  ws.send(JSON.stringify(buildSnapshot(device)));
  // If internet should be blocked but we just (re)connected, re-issue.
  if (device.internetBlocked) {
    sendToAgent(device.id, {
      kind: 'command',
      command: {
        id: randomBytes(6).toString('hex'),
        deviceId: device.id,
        kind: 'block_internet',
        createdAt: Date.now(),
      },
    });
  }
  if (device.lockedByParent) {
    sendToAgent(device.id, {
      kind: 'command',
      command: {
        id: randomBytes(6).toString('hex'),
        deviceId: device.id,
        kind: 'lock',
        createdAt: Date.now(),
      },
    });
  }

  ws.on('message', (raw) => {
    let msg: AgentMessage;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.kind === 'heartbeat') {
      // Verify the rotating nonce: signature must match, and the sequence must
      // advance. A spoofed/replayed heartbeat fails this and is ignored (so it
      // can't keep a tampered device looking "alive").
      const seq = Number((msg as any).seq ?? 0);
      const sig = String((msg as any).sig ?? '');
      if (seq && sig) {
        const expect = createHmac('sha256', agentTok).update(String(seq)).digest('hex').slice(0, 32);
        if (sig !== expect || seq <= lastSeq) {
          console.warn(`[tamper] ${device.id} bad/stale heartbeat nonce (seq=${seq})`);
          return; // do not refresh lastSeen — let the offline sweep catch it
        }
        lastSeq = seq;
      }
      // The agent is authoritative on the bank balance; trust its heartbeat so
      // the parent dashboard reflects spends/credits in real time (and the
      // snapshot no longer fights the agent over the bank value).
      const patch: Record<string, unknown> = {
        lastSeen: Date.now(),
        usedTodayMinutes: (msg as any).usedTodayMinutes,
      };
      if (typeof (msg as any).bankedMinutes === 'number')
        patch.bankedMinutes = (msg as any).bankedMinutes;
      store.updateDevice(device.id, patch);
      // Roll up today's usage + per-app minutes for the Stats tab.
      const m = msg as any;
      if (m.date && typeof m.usedTodayMinutes === 'number') {
        store.upsertUsageDaily(device.id, m.date, m.usedTodayMinutes | 0, m.appUsage || {});
      }
    } else if (msg.kind === 'event') {
      console.log(`[event] ${device.id} ${msg.name}`, msg.payload ?? {});
      let message = `${device.name}: ${msg.name.replace(/_/g, ' ')}`;
      if (msg.name === 'request_minutes') {
        const minutes = Number((msg.payload as any)?.minutes ?? 0);
        const reason = String((msg.payload as any)?.reason ?? '');
        const req = store.createTimeRequest(device.userId, device.id, minutes, reason);
        message = `${device.name}: requested ${minutes} more minutes${reason ? ` — "${reason}"` : ''}`;
        store.appendActivity({
          userId: device.userId,
          deviceId: device.id,
          kind: 'request_minutes',
          message,
        });
        notifyUser(device.userId,'Time request', message, {
          deviceId: device.id,
          kind: 'request_minutes',
          requestId: req.id,
        });
      } else if (msg.name === 'borrow') {
        const minutes = Number((msg.payload as any)?.minutes ?? 0);
        const fromDate = String((msg.payload as any)?.fromDate ?? '');
        message = `${device.name}: self-borrowed ${minutes} min from ${fromDate || 'tomorrow'}`;
        store.appendActivity({
          userId: device.userId,
          deviceId: device.id,
          kind: 'borrow',
          message,
        });
        notifyUser(device.userId,'Time borrowed', message, {
          deviceId: device.id,
          kind: 'borrow',
          minutes,
          fromDate,
        });
      } else if (msg.name === 'chore_request') {
        const minutes = Number((msg.payload as any)?.minutes ?? 0);
        const description = String((msg.payload as any)?.description ?? '').slice(0, 240);
        const cr = store.createChoreRequest(device.userId, device.id, description, minutes);
        message = `${device.name}: chore "${description}" — ${minutes} min reward`;
        store.appendActivity({
          userId: device.userId,
          deviceId: device.id,
          kind: 'chore_request',
          message,
        });
        notifyUser(device.userId,'Chore submitted', message, {
          deviceId: device.id,
          kind: 'chore_request',
          requestId: cr.id,
        });
      } else if (msg.name === 'bank_spent') {
        const minutes = Number((msg.payload as any)?.minutes ?? 0);
        const remaining = Number((msg.payload as any)?.remaining ?? 0);
        store.updateDevice(device.id, { bankedMinutes: remaining });
        if (minutes > 0)
          store.appendBankLedger(
            device.userId,
            device.id,
            -minutes,
            remaining,
            'kid_spent',
            null,
          );
        message = `${device.name}: spent ${minutes} bank min (${remaining} left)`;
        store.appendActivity({
          userId: device.userId,
          deviceId: device.id,
          kind: 'bank_spent',
          message,
        });
        notifyUser(device.userId,'Bank spent', message, { deviceId: device.id, kind: 'bank_spent' });
      } else {
        // Friendlier titles/messages for the real tamper signals.
        let title = 'timeoff';
        let notifyMsg = message;
        if (msg.name === 'code_tamper') {
          title = 'Tampering detected';
          const n = Array.isArray((msg.payload as any)?.files) ? (msg.payload as any).files.length : 0;
          notifyMsg = `${device.name}: agent files were edited${n ? ` (${n} file${n > 1 ? 's' : ''})` : ''} — reverted automatically`;
        } else if (msg.name === 'clock_tamper') {
          title = 'Clock tampering';
          notifyMsg = `${device.name}: system clock was changed to gain time`;
        } else if (msg.name === 'vpn_detected') {
          title = 'VPN detected';
          notifyMsg = `${device.name}: a VPN/proxy appeared — may be dodging the blocklist`;
        }
        store.appendActivity({
          userId: device.userId,
          deviceId: device.id,
          kind: msg.name,
          message: notifyMsg,
        });
        if (msg.name === 'lock') store.updateDevice(device.id, { status: 'locked' });
        if (msg.name === 'unlock') store.updateDevice(device.id, { status: 'online' });
        if (msg.name === 'shutdown') store.updateDevice(device.id, { shutdownCleanly: true });
        if (shouldNotify(msg.name)) {
          notifyUser(device.userId, title, notifyMsg, { deviceId: device.id, kind: msg.name });
        }
      }
    }
  });

  ws.on('close', () => {
    // Only mark offline if THIS socket is still the registered one. On reconnect
    // (e.g. after the agent restarts) a new socket registers first; the old
    // socket's delayed close must not delete the new entry or flag offline.
    if (agentSockets.get(device.id) === ws) {
      agentSockets.delete(device.id);
      store.updateDevice(device.id, { status: 'offline' });
    }
  });
});

function toPublicDevice(d: DeviceRow) {
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    lastSeen: d.lastSeen,
    dailyLimitMinutes: d.dailyLimitMinutes,
    usedTodayMinutes: d.usedTodayMinutes,
    internetBlocked: d.internetBlocked,
    blocklist: d.blocklist,
    alwaysBlocklist: d.alwaysBlocklist,
    selfBorrowEnabled: d.selfBorrowEnabled,
    selfBorrowCapMinutes: d.selfBorrowCapMinutes,
    bankedMinutes: d.bankedMinutes,
    choreTemplates: store.listChoreTemplates(d.userId, d.id),
    // Tamper hint for the dashboard: the agent went silent very recently
    // (within ~3 minutes of its last heartbeat). Anything longer is treated as
    // "PC is off / asleep" — normal, no alarm. A graceful shutdown sets
    // d.shutdownCleanly, which suppresses the banner too.
    vacationUntil: (d as any).vacationUntil ?? 0,
    ndMode: !!(d as any).ndMode,
    tamperSuspected:
      d.status === 'offline' &&
      !!d.lastSeen &&
      !d.shutdownCleanly &&
      Date.now() - d.lastSeen < 3 * 60 * 1000,
    shutdownCleanly: !!d.shutdownCleanly,
  };
}

// Tamper sweep: keep marking devices offline, but DON'T spam the parent.
// A PC that's simply turned off (kid asleep, outdoors) is indistinguishable
// from a tampered agent over the socket, so "agent offline" alerts are pure
// noise for most families. We:
//   * still update status to 'offline' (dashboard stays accurate),
//   * only PUSH an alert when the parent has opted in (tamperAlertsOn),
//   * never alert on a clean shutdown,
//   * require a much longer silence (15 min) so brief sleeps/blips are ignored,
//   * still write a quiet activity-log entry for the record,
//   * route the push through notifyUser, which now honours quiet hours.
const TAMPER_SWEEP_MS = 20 * 1000;
const TAMPER_ALERT_AFTER_MS = 15 * 60 * 1000; // 15 min, not 90s
setInterval(() => {
  const now = Date.now();
  for (const d of store.allDevices()) {
    const silentFor = d.lastSeen ? now - d.lastSeen : Infinity;
    const live = agentSockets.has(d.id);
    if (!live && d.lastSeen && silentFor > OFFLINE_THRESHOLD_MS && !offlineAlerted.has(d.id)) {
      offlineAlerted.add(d.id);
      if (d.status !== 'offline') store.updateDevice(d.id, { status: 'offline' });
      const mins = Math.round(silentFor / 60000);
      // Log it quietly regardless (parent can review in Activity).
      store.appendActivity({
        userId: d.userId,
        deviceId: d.id,
        kind: 'device_offline',
        message: `${d.name}: went offline`,
      });
      // Offline is NOT tampering — a turned-off PC and a killed agent look
      // identical here, and both have innocent explanations. We never call
      // this "tamper". Real tampering is ACTIVE behaviour the agent actually
      // detects and reports (clock rolled back, VPN to dodge the blocklist) —
      // those alert separately and always. Here we only push a plain
      // "offline" notice if the parent explicitly opted in.
      const prefs = store.getUserPrefs(d.userId);
      if (prefs.tamperAlertsOn && !d.shutdownCleanly && silentFor > TAMPER_ALERT_AFTER_MS) {
        const message = `${d.name}: agent offline for ${mins} min`;
        notifyUser(d.userId, 'Agent offline', message, {
          deviceId: d.id,
          kind: 'tamper_offline',
        });
      }
    }
  }
}, TAMPER_SWEEP_MS).unref();

// ---- Daily summary push (server's local 21:00) ----
// Fires once per minute; sends to each user whose dailySummaryOn is true and who
// hasn't already received today's summary. Quiet hours are respected by
// notifyUser. Aggregates today's usage + bank deltas + requests per device.
let lastSummaryDay = '';
function maybeSendDailySummary() {
  const now = new Date();
  if (now.getHours() !== 21 || now.getMinutes() !== 0) return;
  const day = now.toISOString().slice(0, 10);
  if (day === lastSummaryDay) return;
  lastSummaryDay = day;
  try {
    const users = store.allUsersForSummary?.() ?? [];
    for (const u of users) {
      const prefs = store.getUserPrefs(u.id);
      if (!prefs.dailySummaryOn) continue;
      const devices = store.listDevices(u.id);
      if (!devices.length) continue;
      const lines = devices.map((d) => {
        const used = d.usedTodayMinutes | 0;
        const limit = d.dailyLimitMinutes | 0;
        const h = Math.floor(used / 60), m = used % 60;
        return `${d.name}: ${h}h ${m}m / ${Math.floor(limit / 60)}h`;
      });
      notifyUser(
        u.id,
        'Today in your family',
        lines.join(' · '),
        { kind: 'daily_summary' },
      );
    }
  } catch (e) { console.warn('[summary] failed', e); }
}
setInterval(maybeSendDailySummary, 60 * 1000).unref();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`git1-server listening on http://0.0.0.0:${PORT}`);
});
