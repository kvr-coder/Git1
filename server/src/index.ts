import { createHash, createHmac, randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
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
    'set_schedules',
    'set_borrow_settings',
    'add_bank_minutes',
    'set_bank_minutes',
    'rename',
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
  if (p.data.kind === 'lock') {
    // Parent forced a lock -> clear any active schedule override so we don't
    // immediately unlock again on the next tick.
    store.updateDevice(d.id, { lockedByParent: true, scheduleOverrideUntil: 0 });
    pushSnapshotToAgent(d.id); // so the agent learns override=0 immediately
  }
  if (p.data.kind === 'unlock') {
    // Unlock = clear ALL active restrictions: stop locking, lift internet block,
    // and suppress the schedule until its current window ends. (Parent's
    // explicit "let them back on now" button.)
    const overrideUntil = computeScheduleEndForDevice(d.id, Date.now());
    store.updateDevice(d.id, {
      lockedByParent: false,
      internetBlocked: false,
      scheduleOverrideUntil: overrideUntil,
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
    internetBlocked: d.internetBlocked,
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
    repoCommit: REPO_COMMIT,
  };
}

// Compute the end-of-current-active-window for the device, in epoch ms. Used
// when the parent presses Unlock during an active lock schedule: we treat the
// override as expiring when that window naturally ends.
function computeScheduleEndForDevice(deviceId: string, nowMs: number): number {
  const scheds = store.schedulesForDevice(deviceId);
  const d = new Date(nowMs);
  const dayKey = ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()];
  const todayMin = d.getHours() * 60 + d.getMinutes();
  let bestEndMin: number | null = null;
  for (const s of scheds) {
    if (!s.enabled) continue;
    if (!(s.days || []).includes(dayKey)) continue;
    if (!(s.actions || []).some((a: string) => a === 'lock' || a === 'block_internet' || a === 'block_apps')) continue;
    const start = s.startMinute, end = s.endMinute;
    // Same-day window
    if (start <= end && todayMin >= start && todayMin < end) {
      bestEndMin = Math.max(bestEndMin ?? 0, end);
    }
    // Overnight window (e.g. 21:00 -> 07:00) — if currently in either side
    if (start > end) {
      if (todayMin >= start) {
        // override until tomorrow's `end` minute
        const tomorrow = new Date(nowMs); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0);
        return tomorrow.getTime() + end * 60_000;
      }
      if (todayMin < end) {
        const today0 = new Date(nowMs); today0.setHours(0,0,0,0);
        return today0.getTime() + end * 60_000;
      }
    }
  }
  if (bestEndMin == null) {
    // Not in any active window — 6h grace, prevents instant re-lock if a
    // schedule starts in 1 minute.
    return nowMs + 6 * 3600_000;
  }
  const today0 = new Date(nowMs); today0.setHours(0,0,0,0);
  return today0.getTime() + bestEndMin * 60_000;
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
  store.updateDevice(device.id, { status: 'online', lastSeen: Date.now() });

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
        store.appendActivity({
          userId: device.userId,
          deviceId: device.id,
          kind: msg.name,
          message,
        });
        if (msg.name === 'lock') store.updateDevice(device.id, { status: 'locked' });
        if (msg.name === 'unlock') store.updateDevice(device.id, { status: 'online' });
        if (shouldNotify(msg.name)) {
          notifyUser(device.userId, 'Git1', message, { deviceId: device.id, kind: msg.name });
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
    selfBorrowEnabled: d.selfBorrowEnabled,
    selfBorrowCapMinutes: d.selfBorrowCapMinutes,
    bankedMinutes: d.bankedMinutes,
    choreTemplates: store.listChoreTemplates(d.userId, d.id),
    // Tamper hint for the dashboard: offline but seen within the last 10 min =
    // the agent went silent recently (killed / network-cut), not a PC that's
    // been off all day. The dashboard shows a red banner for these.
    tamperSuspected:
      d.status === 'offline' &&
      !!d.lastSeen &&
      Date.now() - d.lastSeen < 10 * 60 * 1000,
    lastSeen: d.lastSeen,
  };
}

// Tamper sweep: every minute, alert the parent about devices that have gone
// silent (agent killed/uninstalled/offline) and weren't already flagged.
const TAMPER_SWEEP_MS = 20 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const d of store.allDevices()) {
    const silentFor = d.lastSeen ? now - d.lastSeen : Infinity;
    const live = agentSockets.has(d.id);
    if (!live && d.lastSeen && silentFor > OFFLINE_THRESHOLD_MS && !offlineAlerted.has(d.id)) {
      offlineAlerted.add(d.id);
      if (d.status !== 'offline') store.updateDevice(d.id, { status: 'offline' });
      const mins = Math.round(silentFor / 60000);
      const message = `${d.name}: agent offline for ${mins} min — possible tamper`;
      console.warn(`[tamper] ${message}`);
      store.appendActivity({ userId: d.userId, deviceId: d.id, kind: 'tamper_offline', message });
      notifyUser(d.userId, 'Agent offline', message, {
        deviceId: d.id,
        kind: 'tamper_offline',
      });
    }
  }
}, TAMPER_SWEEP_MS).unref();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`git1-server listening on http://0.0.0.0:${PORT}`);
});
