import { createHash, randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import { store, type DeviceRow } from './store.js';
import { notifyUser, sendPush, shouldNotify, webPushPublicKey } from './push.js';
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
app.get('/', (_req, res) => res.type('html').send(ADMIN_HTML));

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

app.post('/auth/register', (req, res) => {
  const p = credSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  if (store.findUserByEmail(p.data.email))
    return res.status(409).json({ error: 'email taken' });
  const u = store.createUser(p.data.email, sha(p.data.password));
  res.json({ token: store.issueToken(u.id) });
});

app.post('/auth/login', (req, res) => {
  const p = credSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const u = store.findUserByEmail(p.data.email);
  if (!u || u.passwordHash !== sha(p.data.password))
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
  ]),
  payload: z.record(z.unknown()).optional(),
});

app.post('/devices/:id/command', auth, (req: AuthedRequest, res) => {
  const d = store.getDevice(req.userId!, req.params.id);
  if (!d) return res.status(404).json({ error: 'device not found' });
  const p = commandSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);

  // Apply server-side state for commands the parent expects to persist.
  if (p.data.kind === 'block_internet') store.updateDevice(d.id, { internetBlocked: true });
  if (p.data.kind === 'unblock_internet') store.updateDevice(d.id, { internetBlocked: false });
  if (p.data.kind === 'lock') store.updateDevice(d.id, { lockedByParent: true });
  if (p.data.kind === 'unlock') store.updateDevice(d.id, { lockedByParent: false });
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
    sendToAgent(r.deviceId, {
      kind: 'command',
      command: {
        id: randomBytes(6).toString('hex'),
        deviceId: r.deviceId,
        kind: 'grant_minutes',
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

// ---------- Agent WebSocket ----------
const agentSockets = new Map<string, WebSocket>();

// Tamper detection: a paired device that stops heartbeating (killed agent,
// uninstall, network cut) is a tamper signal. We alert the parent ONCE per
// offline transition. Tracks deviceIds we've already alerted so we don't spam.
const offlineAlerted = new Set<string>();
const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000; // ~3 missed 60s heartbeats

function sendToAgent(deviceId: string, msg: ServerMessage): boolean {
  const ws = agentSockets.get(deviceId);
  if (!ws || ws.readyState !== ws.OPEN) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/agent/ws' });

function buildSnapshot(d: DeviceRow) {
  return {
    kind: 'snapshot' as const,
    schedules: store.schedulesForDevice(d.id),
    blocklist: d.blocklist,
    internetBlocked: d.internetBlocked,
    selfBorrowEnabled: d.selfBorrowEnabled,
    selfBorrowCapMinutes: d.selfBorrowCapMinutes,
    bankedMinutes: d.bankedMinutes,
    choreTemplates: store.listChoreTemplates(d.userId, d.id),
    lockedByParent: d.lockedByParent,
    repoCommit: REPO_COMMIT,
  };
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
  agentSockets.set(device.id, ws);
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
      store.updateDevice(device.id, {
        lastSeen: Date.now(),
        usedTodayMinutes: msg.usedTodayMinutes,
      });
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
    agentSockets.delete(device.id);
    store.updateDevice(device.id, { status: 'offline' });
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
  };
}

// Tamper sweep: every minute, alert the parent about devices that have gone
// silent (agent killed/uninstalled/offline) and weren't already flagged.
const TAMPER_SWEEP_MS = 60 * 1000;
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
