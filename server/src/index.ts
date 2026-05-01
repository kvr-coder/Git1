import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import { store, type DeviceRow } from './store.js';
import { sendPush, shouldNotify } from './push.js';
import type { AgentMessage, Command, ServerMessage } from './types.js';

const PORT = Number(process.env.PORT ?? 8080);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const app = express();
app.use(express.json());

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
    store.updateDevice(d.id, { bankedMinutes: d.bankedMinutes + m });
  }
  if (p.data.kind === 'set_bank_minutes') {
    const m = Math.max(0, Number(p.data.payload?.minutes ?? 0) | 0);
    store.updateDevice(d.id, { bankedMinutes: m });
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
  const row = store.upsertSchedule(req.userId!, p.data);
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
  res.json({ ok: true, status: p.data.status });
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
      store.updateDevice(d.id, { bankedMinutes: d.bankedMinutes + minutes });
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
  res.json({ ok: true, status: p.data.status, minutes });
});

// ---------- Agent WebSocket ----------
const agentSockets = new Map<string, WebSocket>();

function sendToAgent(deviceId: string, msg: ServerMessage): boolean {
  const ws = agentSockets.get(deviceId);
  if (!ws || ws.readyState !== ws.OPEN) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/agent/ws' });

function pushSchedulesToAllAgentsFor(userId: string) {
  for (const d of store.listDevices(userId)) {
    const ws = agentSockets.get(d.id);
    if (!ws || ws.readyState !== ws.OPEN) continue;
    ws.send(
      JSON.stringify({
        kind: 'snapshot',
        schedules: store.schedulesForDevice(d.id),
        blocklist: d.blocklist,
        internetBlocked: d.internetBlocked,
        selfBorrowEnabled: d.selfBorrowEnabled,
        selfBorrowCapMinutes: d.selfBorrowCapMinutes,
        bankedMinutes: d.bankedMinutes,
      }),
    );
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
  store.updateDevice(device.id, { status: 'online', lastSeen: Date.now() });

  // Push current schedules + blocklist + internet state immediately.
  ws.send(
    JSON.stringify({
      kind: 'snapshot',
      schedules: store.schedulesForDevice(device.id),
      blocklist: device.blocklist,
      internetBlocked: device.internetBlocked,
      selfBorrowEnabled: device.selfBorrowEnabled,
      selfBorrowCapMinutes: device.selfBorrowCapMinutes,
      bankedMinutes: device.bankedMinutes,
    }),
  );
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
        const tokens = store.pushTokensForUser(device.userId);
        sendPush(tokens, 'Time request', message, {
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
        const tokens = store.pushTokensForUser(device.userId);
        sendPush(tokens, 'Time borrowed', message, {
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
        const tokens = store.pushTokensForUser(device.userId);
        sendPush(tokens, 'Chore submitted', message, {
          deviceId: device.id,
          kind: 'chore_request',
          requestId: cr.id,
        });
      } else if (msg.name === 'bank_spent') {
        const minutes = Number((msg.payload as any)?.minutes ?? 0);
        const remaining = Number((msg.payload as any)?.remaining ?? 0);
        store.updateDevice(device.id, { bankedMinutes: remaining });
        message = `${device.name}: spent ${minutes} bank min (${remaining} left)`;
        store.appendActivity({
          userId: device.userId,
          deviceId: device.id,
          kind: 'bank_spent',
          message,
        });
        const tokens = store.pushTokensForUser(device.userId);
        sendPush(tokens, 'Bank spent', message, { deviceId: device.id, kind: 'bank_spent' });
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
          const tokens = store.pushTokensForUser(device.userId);
          sendPush(tokens, 'Git1', message, { deviceId: device.id, kind: msg.name });
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

httpServer.listen(PORT, () => {
  console.log(`git1-server listening on http://localhost:${PORT}`);
});
