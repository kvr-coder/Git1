import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export interface DeviceRow {
  id: string;
  userId: string;
  name: string;
  agentToken: string;
  pairedAt: number;
  lastSeen: number | null;
  status: 'online' | 'offline' | 'locked';
  dailyLimitMinutes: number;
  usedTodayMinutes: number;
}

export interface ScheduleRow {
  id: string;
  userId: string;
  deviceId: string;
  name: string;
  days: string[];
  startMinute: number;
  endMinute: number;
  enabled: boolean;
}

export interface ActivityRow {
  id: string;
  userId: string;
  deviceId: string;
  kind: string;
  message: string;
  timestamp: number;
}

const DB_PATH = process.env.GIT1_DB ?? 'git1.db';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS push_tokens (
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  PRIMARY KEY (userId, token)
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  agentToken TEXT UNIQUE NOT NULL,
  pairedAt INTEGER NOT NULL,
  lastSeen INTEGER,
  status TEXT NOT NULL DEFAULT 'offline',
  dailyLimitMinutes INTEGER NOT NULL DEFAULT 120,
  usedTodayMinutes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pair_codes (
  code TEXT PRIMARY KEY,
  agentToken TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  claimedByUserId TEXT,
  deviceId TEXT
);
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days TEXT NOT NULL,
  startMinute INTEGER NOT NULL,
  endMinute INTEGER NOT NULL,
  enabled INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_user_ts ON activity(userId, timestamp DESC);
`);

const id = () => randomBytes(8).toString('hex');
const token = () => randomBytes(24).toString('hex');

const rowToDevice = (r: any): DeviceRow => ({
  id: r.id,
  userId: r.userId,
  name: r.name,
  agentToken: r.agentToken,
  pairedAt: r.pairedAt,
  lastSeen: r.lastSeen,
  status: r.status,
  dailyLimitMinutes: r.dailyLimitMinutes,
  usedTodayMinutes: r.usedTodayMinutes,
});

const rowToSchedule = (r: any): ScheduleRow => ({
  id: r.id,
  userId: r.userId,
  deviceId: r.deviceId,
  name: r.name,
  days: JSON.parse(r.days),
  startMinute: r.startMinute,
  endMinute: r.endMinute,
  enabled: !!r.enabled,
});

export const store = {
  createUser(email: string, passwordHash: string): User {
    const u: User = { id: id(), email, passwordHash };
    db.prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)').run(
      u.id,
      u.email,
      u.passwordHash,
    );
    return u;
  },
  findUserByEmail(email: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  },
  issueToken(userId: string): string {
    const t = token();
    db.prepare('INSERT INTO auth_tokens (token, userId) VALUES (?, ?)').run(t, userId);
    return t;
  },
  userFromToken(t: string): User | undefined {
    const row = db
      .prepare(
        'SELECT u.* FROM users u JOIN auth_tokens a ON a.userId = u.id WHERE a.token = ?',
      )
      .get(t) as User | undefined;
    return row;
  },
  addPushToken(userId: string, pushToken: string) {
    db.prepare(
      'INSERT OR IGNORE INTO push_tokens (userId, token) VALUES (?, ?)',
    ).run(userId, pushToken);
  },
  pushTokensForUser(userId: string): string[] {
    return (
      db.prepare('SELECT token FROM push_tokens WHERE userId = ?').all(userId) as {
        token: string;
      }[]
    ).map((r) => r.token);
  },

  startPairing() {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const agentToken = token();
    db.prepare(
      'INSERT INTO pair_codes (code, agentToken, createdAt) VALUES (?, ?, ?)',
    ).run(code, agentToken, Date.now());
    return { code, agentToken };
  },
  claimPairing(code: string, userId: string, name: string): DeviceRow | null {
    const pc = db.prepare('SELECT * FROM pair_codes WHERE code = ?').get(code) as any;
    if (!pc || pc.claimedByUserId) return null;
    if (Date.now() - pc.createdAt > 10 * 60 * 1000) return null;
    const d: DeviceRow = {
      id: id(),
      userId,
      name,
      agentToken: pc.agentToken,
      pairedAt: Date.now(),
      lastSeen: null,
      status: 'offline',
      dailyLimitMinutes: 120,
      usedTodayMinutes: 0,
    };
    db.prepare(
      `INSERT INTO devices (id, userId, name, agentToken, pairedAt, lastSeen, status, dailyLimitMinutes, usedTodayMinutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      d.id,
      d.userId,
      d.name,
      d.agentToken,
      d.pairedAt,
      d.lastSeen,
      d.status,
      d.dailyLimitMinutes,
      d.usedTodayMinutes,
    );
    db.prepare('UPDATE pair_codes SET claimedByUserId = ?, deviceId = ? WHERE code = ?').run(
      userId,
      d.id,
      code,
    );
    return d;
  },
  pollPairing(code: string) {
    return db.prepare('SELECT * FROM pair_codes WHERE code = ?').get(code) as
      | { code: string; agentToken: string; deviceId: string | null }
      | undefined;
  },
  deviceByAgentToken(t: string): DeviceRow | undefined {
    const row = db.prepare('SELECT * FROM devices WHERE agentToken = ?').get(t);
    return row ? rowToDevice(row) : undefined;
  },
  listDevices(userId: string): DeviceRow[] {
    return (db.prepare('SELECT * FROM devices WHERE userId = ?').all(userId) as any[]).map(
      rowToDevice,
    );
  },
  getDevice(userId: string, deviceId: string): DeviceRow | undefined {
    const row = db
      .prepare('SELECT * FROM devices WHERE id = ? AND userId = ?')
      .get(deviceId, userId);
    return row ? rowToDevice(row) : undefined;
  },
  updateDevice(deviceId: string, patch: Partial<DeviceRow>) {
    const fields = Object.keys(patch).filter((k) => k !== 'id');
    if (!fields.length) return;
    const sets = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => (patch as any)[f]);
    db.prepare(`UPDATE devices SET ${sets} WHERE id = ?`).run(...values, deviceId);
  },

  listSchedules(userId: string): ScheduleRow[] {
    return (
      db.prepare('SELECT * FROM schedules WHERE userId = ?').all(userId) as any[]
    ).map(rowToSchedule);
  },
  upsertSchedule(userId: string, s: Omit<ScheduleRow, 'userId'>): ScheduleRow {
    db.prepare(
      `INSERT INTO schedules (id, userId, deviceId, name, days, startMinute, endMinute, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         deviceId=excluded.deviceId, name=excluded.name, days=excluded.days,
         startMinute=excluded.startMinute, endMinute=excluded.endMinute, enabled=excluded.enabled`,
    ).run(
      s.id,
      userId,
      s.deviceId,
      s.name,
      JSON.stringify(s.days),
      s.startMinute,
      s.endMinute,
      s.enabled ? 1 : 0,
    );
    return { ...s, userId };
  },
  deleteSchedule(userId: string, scheduleId: string) {
    db.prepare('DELETE FROM schedules WHERE id = ? AND userId = ?').run(scheduleId, userId);
  },
  schedulesForDevice(deviceId: string): ScheduleRow[] {
    return (
      db.prepare('SELECT * FROM schedules WHERE deviceId = ?').all(deviceId) as any[]
    ).map(rowToSchedule);
  },

  appendActivity(row: Omit<ActivityRow, 'id' | 'timestamp'>): ActivityRow {
    const a: ActivityRow = { ...row, id: id(), timestamp: Date.now() };
    db.prepare(
      'INSERT INTO activity (id, userId, deviceId, kind, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(a.id, a.userId, a.deviceId, a.kind, a.message, a.timestamp);
    return a;
  },
  listActivity(userId: string, limit = 100): ActivityRow[] {
    return db
      .prepare('SELECT * FROM activity WHERE userId = ? ORDER BY timestamp DESC LIMIT ?')
      .all(userId, limit) as ActivityRow[];
  },
};
