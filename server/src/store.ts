import Database from 'better-sqlite3';
import { randomBytes, createHmac, createHash } from 'node:crypto';

// Stable signing secret. Survives Render restarts WITHOUT any external service:
// RENDER_SERVICE_ID is auto-injected by Render and is constant for the life of
// the service. Falling back to a fixed salt for local dev. This lets us issue
// self-validating agent tokens so a wiped DB doesn't force re-pairing.
const SECRET =
  process.env.GIT1_SECRET ||
  (process.env.RENDER_SERVICE_ID ? 'rsid:' + process.env.RENDER_SERVICE_ID : '') ||
  'git1-local-dev-secret-v1';

// Deterministic user id derived from email so a re-login after a DB wipe yields
// the SAME id — keeping devices linked to their parent across restarts.
export function deterministicUserId(email: string): string {
  return 'u_' + createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24);
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function hmac(data: string): string {
  return b64url(createHmac('sha256', SECRET).update(data).digest());
}
// A self-validating agent token: base64(payload).hmac. The server can rebuild a
// device row from it even if the DB was wiped — no re-pairing needed, ever.
export function signAgentToken(payload: { deviceId: string; email: string; name: string }): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return body + '.' + hmac(body);
}
export function verifyAgentToken(
  tok: string,
): { deviceId: string; email: string; name: string } | null {
  const dot = tok.lastIndexOf('.');
  if (dot < 0) return null;
  const body = tok.slice(0, dot);
  const sig = tok.slice(dot + 1);
  if (hmac(body) !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (p && p.deviceId && p.email) return p;
  } catch {}
  return null;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  /** Minute-of-day (0-1439) when push notifications go silent. -1 = disabled. */
  quietFromMin?: number;
  /** Minute-of-day (0-1439) when push notifications resume. -1 = disabled. */
  quietToMin?: number;
  /** Send a 21:00 daily summary push? 1=yes, 0=no. */
  dailySummaryOn?: number;
  /** Epoch ms when the parent/guardian accepted the monitoring consent. */
  consentedAt?: number | null;
}

export interface UserPrefs {
  quietFromMin: number;
  quietToMin: number;
  dailySummaryOn: boolean;
  // "Agent offline / possible tamper" alerts. OFF by default — a kid turning
  // the PC off (sleep, outdoors) looks identical to tampering from the server,
  // so this is pure alert-fatigue spam for most families.
  tamperAlertsOn: boolean;
}

/** True if minute-of-day `m` falls inside [fromMin, toMin), handling wrap-around. */
export function inQuietHours(fromMin: number, toMin: number, m: number): boolean {
  if (fromMin < 0 || toMin < 0 || fromMin === toMin) return false;
  if (fromMin < toMin) return m >= fromMin && m < toMin;
  // wrap (e.g. 23:00 -> 07:00)
  return m >= fromMin || m < toMin;
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
  internetBlocked: boolean;
  blocklist: string[];
  alwaysBlocklist: string[];
  shutdownCleanly: boolean;
  selfBorrowEnabled: boolean;
  selfBorrowCapMinutes: number;
  bankedMinutes: number;
  lockedByParent: boolean;
  scheduleOverrideUntil: number;
  vacationUntil: number;
  ndMode: boolean;
  webFilter: boolean;
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
  actions: string[];
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
  usedTodayMinutes INTEGER NOT NULL DEFAULT 0,
  internetBlocked INTEGER NOT NULL DEFAULT 0,
  blocklist TEXT NOT NULL DEFAULT '[]'
);
-- Best-effort migrations for existing DBs (ignore errors if columns exist).
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
  enabled INTEGER NOT NULL,
  actions TEXT NOT NULL DEFAULT '["lock"]'
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
CREATE TABLE IF NOT EXISTS time_requests (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt INTEGER NOT NULL,
  resolvedAt INTEGER
);
CREATE INDEX IF NOT EXISTS time_requests_user_status ON time_requests(userId, status);
CREATE TABLE IF NOT EXISTS chore_requests (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL,
  description TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt INTEGER NOT NULL,
  resolvedAt INTEGER,
  approvedMinutes INTEGER
);
CREATE INDEX IF NOT EXISTS chore_requests_user_status ON chore_requests(userId, status);
CREATE TABLE IF NOT EXISTS bank_ledger (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL,
  delta INTEGER NOT NULL,
  balanceAfter INTEGER NOT NULL,
  reason TEXT NOT NULL,
  sourceId TEXT,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bank_ledger_device ON bank_ledger(deviceId, createdAt DESC);
CREATE TABLE IF NOT EXISTS chore_templates (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chore_templates_device ON chore_templates(deviceId);

CREATE TABLE IF NOT EXISTS web_push_subs (
  endpoint TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS web_push_subs_user ON web_push_subs(userId);

CREATE TABLE IF NOT EXISTS co_parents (
  primaryUserId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coUserId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY (primaryUserId, coUserId)
);
CREATE INDEX IF NOT EXISTS co_parents_co ON co_parents(coUserId);

CREATE TABLE IF NOT EXISTS co_parent_invites (
  code TEXT PRIMARY KEY,
  primaryUserId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt INTEGER NOT NULL,
  claimedAt INTEGER,
  claimedByUserId TEXT
);

CREATE TABLE IF NOT EXISTS geofences (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radiusMeters INTEGER NOT NULL,
  notifyOnEnter INTEGER NOT NULL DEFAULT 1,
  notifyOnExit INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS geofences_device ON geofences(deviceId);

CREATE TABLE IF NOT EXISTS device_locations (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracyMeters REAL,
  recordedAt INTEGER NOT NULL,
  receivedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS device_locations_device_ts ON device_locations(deviceId, recordedAt DESC);

CREATE TABLE IF NOT EXISTS photo_checkins (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '',
  imageData TEXT NOT NULL,
  mimeType TEXT NOT NULL DEFAULT 'image/jpeg',
  lat REAL,
  lng REAL,
  capturedAt INTEGER NOT NULL,
  receivedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS photo_checkins_user_ts ON photo_checkins(userId, capturedAt DESC);

CREATE TABLE IF NOT EXISTS pair_recovery (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  recoveryCode TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  usedAt INTEGER
);
CREATE INDEX IF NOT EXISTS pair_recovery_device ON pair_recovery(deviceId);

-- Daily usage rollups + per-app minutes. Agent reports cumulative numbers each
-- heartbeat; we store the latest for today (date = local YYYY-MM-DD) and keep
-- history forever (rows are tiny: ~50 bytes + per-app JSON).
CREATE TABLE IF NOT EXISTS usage_daily (
  deviceId TEXT NOT NULL,
  date TEXT NOT NULL,
  totalMinutes INTEGER NOT NULL DEFAULT 0,
  appUsage TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (deviceId, date)
);
CREATE INDEX IF NOT EXISTS usage_daily_device ON usage_daily(deviceId, date DESC);
`);

for (const stmt of [
  "ALTER TABLE devices ADD COLUMN internetBlocked INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE devices ADD COLUMN blocklist TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE schedules ADD COLUMN actions TEXT NOT NULL DEFAULT '[\"lock\"]'",
  "ALTER TABLE devices ADD COLUMN selfBorrowEnabled INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE devices ADD COLUMN selfBorrowCapMinutes INTEGER NOT NULL DEFAULT 30",
  "ALTER TABLE devices ADD COLUMN bankedMinutes INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE devices ADD COLUMN lockedByParent INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE devices ADD COLUMN scheduleOverrideUntil INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE devices ADD COLUMN alwaysBlocklist TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE devices ADD COLUMN shutdownCleanly INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE devices ADD COLUMN vacationUntil INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN quietFromMin INTEGER NOT NULL DEFAULT -1",
  "ALTER TABLE users ADD COLUMN quietToMin INTEGER NOT NULL DEFAULT -1",
  "ALTER TABLE users ADD COLUMN dailySummaryOn INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE users ADD COLUMN tamperAlertsOn INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE devices ADD COLUMN ndMode INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN consentedAt INTEGER",
  "ALTER TABLE devices ADD COLUMN webFilter INTEGER NOT NULL DEFAULT 0",
]) {
  try { db.exec(stmt); } catch { /* column already exists */ }
}

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
  internetBlocked: !!r.internetBlocked,
  blocklist: r.blocklist ? JSON.parse(r.blocklist) : [],
  alwaysBlocklist: r.alwaysBlocklist ? JSON.parse(r.alwaysBlocklist) : [],
  shutdownCleanly: !!r.shutdownCleanly,
  selfBorrowEnabled: !!r.selfBorrowEnabled,
  selfBorrowCapMinutes: r.selfBorrowCapMinutes ?? 30,
  bankedMinutes: r.bankedMinutes ?? 0,
  lockedByParent: !!r.lockedByParent,
  scheduleOverrideUntil: Number(r.scheduleOverrideUntil ?? 0),
  vacationUntil: Number(r.vacationUntil ?? 0),
  ndMode: !!r.ndMode,
  webFilter: !!r.webFilter,
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
  actions: r.actions ? JSON.parse(r.actions) : ['lock'],
});

export const store = {
  /** Escape hatch for ad-hoc tables / one-off raw queries (e.g. bug reports). */
  _db() { return db; },

  createUser(email: string, passwordHash: string): User {
    // Deterministic id from email so a re-register after a DB wipe re-links
    // existing devices (whose signed tokens carry the email) to this account.
    const u: User = { id: deterministicUserId(email), email, passwordHash };
    db.prepare('INSERT OR REPLACE INTO users (id, email, passwordHash) VALUES (?, ?, ?)').run(
      u.id,
      u.email,
      u.passwordHash,
    );
    return u;
  },
  findUserByEmail(email: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  },
  setPassword(userId: string, passwordHash: string) {
    db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(passwordHash, userId);
  },
  getConsent(userId: string): number | null {
    const r = db.prepare('SELECT consentedAt FROM users WHERE id = ?').get(userId) as any;
    return r && typeof r.consentedAt === 'number' && r.consentedAt > 0 ? r.consentedAt : null;
  },
  // Record the first time consent was given; preserve the original timestamp on
  // subsequent sign-ins so we keep an honest "consented since" record.
  recordConsent(userId: string, atMs: number): number {
    const existing = this.getConsent(userId);
    if (existing) return existing;
    db.prepare('UPDATE users SET consentedAt = ? WHERE id = ?').run(atMs, userId);
    return atMs;
  },
  getUserPrefs(userId: string): UserPrefs {
    const r = db.prepare('SELECT quietFromMin, quietToMin, dailySummaryOn, tamperAlertsOn FROM users WHERE id = ?').get(userId) as any;
    return {
      quietFromMin: typeof r?.quietFromMin === 'number' ? r.quietFromMin : -1,
      quietToMin: typeof r?.quietToMin === 'number' ? r.quietToMin : -1,
      dailySummaryOn: !!(r?.dailySummaryOn ?? 1),
      tamperAlertsOn: !!(r?.tamperAlertsOn ?? 0),
    };
  },
  allUsersForSummary(): { id: string }[] {
    return db.prepare('SELECT id FROM users').all() as { id: string }[];
  },

  // ---- Self-serve data deletion -----------------------------------------
  // The user (or our delete endpoint) calls these to clear server-held data
  // without touching what lives on the kid's PC. clearHistoryForUser is the
  // soft option (drops the activity/stats trail); deleteUserCompletely is the
  // GDPR-style nuke.
  clearHistoryForUser(userId: string): { tables: Record<string, number> } {
    const ids = (this as any).parentUserIdsFor
      ? (this as any).parentUserIdsFor(userId) as string[]
      : [userId];
    const placeholders = ids.map(() => '?').join(',');
    // Devices owned by this family — used to scope per-device tables.
    const deviceIds = (db
      .prepare(`SELECT id FROM devices WHERE userId IN (${placeholders})`)
      .all(...ids) as { id: string }[]).map((r) => r.id);
    const dPlace = deviceIds.length ? deviceIds.map(() => '?').join(',') : '';
    const counts: Record<string, number> = {};
    const wipe = (sql: string, ...args: any[]) => {
      try {
        const info = db.prepare(sql).run(...args);
        const table = sql.match(/FROM (\w+)/i)?.[1] ?? 'unknown';
        counts[table] = (counts[table] ?? 0) + Number(info.changes ?? 0);
      } catch (e) { console.warn('[clearHistory]', e); }
    };
    wipe(`DELETE FROM activity WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM time_requests WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM chore_requests WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM bank_ledger WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM photo_checkins WHERE userId IN (${placeholders})`, ...ids);
    if (deviceIds.length) {
      wipe(`DELETE FROM usage_daily WHERE deviceId IN (${dPlace})`, ...deviceIds);
      wipe(`DELETE FROM device_locations WHERE deviceId IN (${dPlace})`, ...deviceIds);
    }
    // Also drop bug reports they personally submitted.
    wipe(`DELETE FROM bug_reports WHERE userId = ?`, userId);
    return { tables: counts };
  },

  deleteUserCompletely(userId: string): { tables: Record<string, number> } {
    // Clear history first.
    const counts = this.clearHistoryForUser(userId).tables;
    const ids = (this as any).parentUserIdsFor
      ? (this as any).parentUserIdsFor(userId) as string[]
      : [userId];
    const placeholders = ids.map(() => '?').join(',');
    const wipe = (sql: string, ...args: any[]) => {
      try {
        const info = db.prepare(sql).run(...args);
        const table = sql.match(/FROM (\w+)/i)?.[1] ?? 'unknown';
        counts[table] = (counts[table] ?? 0) + Number(info.changes ?? 0);
      } catch (e) { console.warn('[deleteUser]', e); }
    };
    // Keep deviceIds before we drop them, for geofence cleanup.
    const deviceIds = (db
      .prepare(`SELECT id FROM devices WHERE userId IN (${placeholders})`)
      .all(...ids) as { id: string }[]).map((r) => r.id);
    if (deviceIds.length) {
      const dPlace = deviceIds.map(() => '?').join(',');
      wipe(`DELETE FROM geofences WHERE deviceId IN (${dPlace})`, ...deviceIds);
      wipe(`DELETE FROM chore_templates WHERE deviceId IN (${dPlace})`, ...deviceIds);
    }
    wipe(`DELETE FROM schedules WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM devices WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM co_parents WHERE primaryUserId IN (${placeholders}) OR coParentUserId IN (${placeholders})`, ...ids, ...ids);
    wipe(`DELETE FROM co_parent_invites WHERE primaryUserId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM web_push_subs WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM push_tokens WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM auth_tokens WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM pair_recovery WHERE userId IN (${placeholders})`, ...ids);
    wipe(`DELETE FROM users WHERE id IN (${placeholders})`, ...ids);
    return { tables: counts };
  },
  // -----------------------------------------------------------------------

  emailFor(userId: string): string | null {
    const r = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
    return r?.email ?? null;
  },
  setUserPrefs(userId: string, patch: Partial<UserPrefs>) {
    const cur = this.getUserPrefs(userId);
    const next = {
      quietFromMin: patch.quietFromMin ?? cur.quietFromMin,
      quietToMin: patch.quietToMin ?? cur.quietToMin,
      dailySummaryOn: (patch.dailySummaryOn ?? cur.dailySummaryOn) ? 1 : 0,
      tamperAlertsOn: (patch.tamperAlertsOn ?? cur.tamperAlertsOn) ? 1 : 0,
    };
    db.prepare('UPDATE users SET quietFromMin = ?, quietToMin = ?, dailySummaryOn = ?, tamperAlertsOn = ? WHERE id = ?')
      .run(next.quietFromMin, next.quietToMin, next.dailySummaryOn, next.tamperAlertsOn, userId);
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
  addWebPushSub(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    db.prepare(
      'INSERT OR REPLACE INTO web_push_subs (endpoint, userId, p256dh, auth, createdAt) VALUES (?, ?, ?, ?, ?)',
    ).run(sub.endpoint, userId, sub.keys.p256dh, sub.keys.auth, Date.now());
  },
  removeWebPushSub(endpoint: string) {
    db.prepare('DELETE FROM web_push_subs WHERE endpoint = ?').run(endpoint);
  },
  webPushSubsForUser(userId: string): { endpoint: string; keys: { p256dh: string; auth: string } }[] {
    return (db.prepare('SELECT endpoint, p256dh, auth FROM web_push_subs WHERE userId = ?')
      .all(userId) as any[]).map((r) => ({
      endpoint: r.endpoint,
      keys: { p256dh: r.p256dh, auth: r.auth },
    }));
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
    if (Date.now() - pc.createdAt > 24 * 60 * 60 * 1000) return null;
    const deviceId = id();
    // Issue a self-validating token tied to this device + the parent's email.
    // If the DB is ever wiped, the agent reconnects with this token and the
    // server rebuilds the device row from it — no re-pairing needed.
    const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as
      | { email: string }
      | undefined;
    const signedToken = userRow
      ? signAgentToken({ deviceId, email: userRow.email, name })
      : pc.agentToken;
    const d: DeviceRow = {
      id: deviceId,
      userId,
      name,
      agentToken: signedToken,
      pairedAt: Date.now(),
      lastSeen: null,
      status: 'offline',
      dailyLimitMinutes: 120,
      usedTodayMinutes: 0,
      internetBlocked: false,
      blocklist: [],
      selfBorrowEnabled: false,
      selfBorrowCapMinutes: 30,
      bankedMinutes: 0,
      lockedByParent: false,
      alwaysBlocklist: [],
      shutdownCleanly: false,
      scheduleOverrideUntil: 0,
      vacationUntil: 0,
      ndMode: false,
      webFilter: false,
    };
    db.prepare(
      `INSERT INTO devices (id, userId, name, agentToken, pairedAt, lastSeen, status, dailyLimitMinutes, usedTodayMinutes, internetBlocked, blocklist, selfBorrowEnabled, selfBorrowCapMinutes, bankedMinutes, lockedByParent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', 0, 30, 0, 0)`,
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
    // Store the SIGNED token on the pair_codes row too, so the agent's poll()
    // receives the self-validating token (not the original random placeholder).
    db.prepare(
      'UPDATE pair_codes SET claimedByUserId = ?, deviceId = ?, agentToken = ? WHERE code = ?',
    ).run(userId, d.id, d.agentToken, code);
    return d;
  },
  pollPairing(code: string) {
    return db.prepare('SELECT * FROM pair_codes WHERE code = ?').get(code) as
      | { code: string; agentToken: string; deviceId: string | null }
      | undefined;
  },
  deviceByAgentToken(t: string): DeviceRow | undefined {
    const row = db.prepare('SELECT * FROM devices WHERE agentToken = ?').get(t);
    if (row) return rowToDevice(row);
    // Self-heal: DB may have been wiped (Render free-tier restart). If the token
    // is a valid signed token, rebuild the device row from it so the agent stays
    // paired and comes back online automatically — no re-pairing required.
    const payload = verifyAgentToken(t);
    if (!payload) return undefined;
    const userId = deterministicUserId(payload.email);
    // Ensure a user row exists (so foreign keys + dashboard listing work). The
    // parent re-logs in normally; this just keeps the linkage stable.
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      db.prepare('INSERT OR IGNORE INTO users (id, email, passwordHash) VALUES (?, ?, ?)').run(
        userId,
        payload.email,
        '', // placeholder; real hash restored when the parent logs in again
      );
    }
    db.prepare(
      `INSERT OR IGNORE INTO devices (id, userId, name, agentToken, pairedAt, lastSeen, status, dailyLimitMinutes, usedTodayMinutes, internetBlocked, blocklist, selfBorrowEnabled, selfBorrowCapMinutes, bankedMinutes, lockedByParent)
       VALUES (?, ?, ?, ?, ?, NULL, 'offline', 120, 0, 0, '[]', 0, 30, 0, 0)`,
    ).run(payload.deviceId, userId, payload.name, t, Date.now());
    const rebuilt = db.prepare('SELECT * FROM devices WHERE id = ?').get(payload.deviceId);
    return rebuilt ? rowToDevice(rebuilt) : undefined;
  },
  listDevices(userId: string): DeviceRow[] {
    const ids = this.parentUserIdsFor(userId);
    const placeholders = ids.map(() => '?').join(',');
    return (
      db.prepare(`SELECT * FROM devices WHERE userId IN (${placeholders})`).all(...ids) as any[]
    ).map(rowToDevice);
  },
  allDevices(): DeviceRow[] {
    return (db.prepare('SELECT * FROM devices').all() as any[]).map(rowToDevice);
  },
  getDevice(userId: string, deviceId: string): DeviceRow | undefined {
    const ids = this.parentUserIdsFor(userId);
    const placeholders = ids.map(() => '?').join(',');
    const row = db
      .prepare(`SELECT * FROM devices WHERE id = ? AND userId IN (${placeholders})`)
      .get(deviceId, ...ids);
    return row ? rowToDevice(row) : undefined;
  },
  getDeviceById(deviceId: string): DeviceRow | undefined {
    const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
    return row ? rowToDevice(row) : undefined;
  },
  deleteDevice(deviceId: string) {
    db.prepare('DELETE FROM schedules WHERE deviceId = ?').run(deviceId);
    db.prepare('DELETE FROM bank_ledger WHERE deviceId = ?').run(deviceId);
    db.prepare('DELETE FROM device_locations WHERE deviceId = ?').run(deviceId);
    db.prepare('DELETE FROM geofences WHERE deviceId = ?').run(deviceId);
    db.prepare('DELETE FROM pair_recovery WHERE deviceId = ?').run(deviceId);
    db.prepare('UPDATE pair_codes SET deviceId = NULL WHERE deviceId = ?').run(deviceId);
    db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);
  },

  updateDevice(deviceId: string, patch: Partial<DeviceRow>) {
    const fields = Object.keys(patch).filter((k) => k !== 'id');
    if (!fields.length) return;
    const sets = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => {
      const v = (patch as any)[f];
      if (f === 'blocklist' || f === 'alwaysBlocklist') return JSON.stringify(v ?? []);
      if (f === 'internetBlocked' || f === 'selfBorrowEnabled' || f === 'lockedByParent' || f === 'shutdownCleanly' || f === 'webFilter')
        return v ? 1 : 0;
      return v;
    });
    db.prepare(`UPDATE devices SET ${sets} WHERE id = ?`).run(...values, deviceId);
  },

  listSchedules(userId: string): ScheduleRow[] {
    return (
      db.prepare('SELECT * FROM schedules WHERE userId = ?').all(userId) as any[]
    ).map(rowToSchedule);
  },
  upsertSchedule(userId: string, s: Omit<ScheduleRow, 'userId'>): ScheduleRow {
    const actions = s.actions && s.actions.length ? s.actions : ['lock'];
    db.prepare(
      `INSERT INTO schedules (id, userId, deviceId, name, days, startMinute, endMinute, enabled, actions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         deviceId=excluded.deviceId, name=excluded.name, days=excluded.days,
         startMinute=excluded.startMinute, endMinute=excluded.endMinute,
         enabled=excluded.enabled, actions=excluded.actions`,
    ).run(
      s.id,
      userId,
      s.deviceId,
      s.name,
      JSON.stringify(s.days),
      s.startMinute,
      s.endMinute,
      s.enabled ? 1 : 0,
      JSON.stringify(actions),
    );
    return { ...s, actions, userId };
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

  createTimeRequest(userId: string, deviceId: string, minutes: number, reason: string) {
    const r = {
      id: id(),
      userId,
      deviceId,
      minutes,
      reason,
      status: 'pending' as const,
      createdAt: Date.now(),
      resolvedAt: null as number | null,
    };
    db.prepare(
      `INSERT INTO time_requests (id, userId, deviceId, minutes, reason, status, createdAt, resolvedAt)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)`,
    ).run(r.id, r.userId, r.deviceId, r.minutes, r.reason, r.createdAt);
    return r;
  },
  listTimeRequests(userId: string, status?: 'pending' | 'approved' | 'denied') {
    if (status) {
      return db
        .prepare(
          'SELECT * FROM time_requests WHERE userId = ? AND status = ? ORDER BY createdAt DESC',
        )
        .all(userId, status);
    }
    return db
      .prepare('SELECT * FROM time_requests WHERE userId = ? ORDER BY createdAt DESC LIMIT 50')
      .all(userId);
  },
  getTimeRequest(userId: string, requestId: string) {
    return db
      .prepare('SELECT * FROM time_requests WHERE id = ? AND userId = ?')
      .get(requestId, userId) as
      | {
          id: string;
          userId: string;
          deviceId: string;
          minutes: number;
          reason: string;
          status: string;
          createdAt: number;
          resolvedAt: number | null;
        }
      | undefined;
  },
  resolveTimeRequest(userId: string, requestId: string, status: 'approved' | 'denied') {
    db.prepare(
      `UPDATE time_requests SET status = ?, resolvedAt = ? WHERE id = ? AND userId = ?`,
    ).run(status, Date.now(), requestId, userId);
  },

  createChoreRequest(userId: string, deviceId: string, description: string, minutes: number) {
    const r = {
      id: id(),
      userId,
      deviceId,
      description,
      minutes,
      status: 'pending' as const,
      createdAt: Date.now(),
      resolvedAt: null as number | null,
      approvedMinutes: null as number | null,
    };
    db.prepare(
      `INSERT INTO chore_requests (id, userId, deviceId, description, minutes, status, createdAt)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(r.id, r.userId, r.deviceId, r.description, r.minutes, r.createdAt);
    return r;
  },
  listChoreRequests(userId: string, status?: 'pending' | 'approved' | 'denied') {
    if (status) {
      return db
        .prepare(
          'SELECT * FROM chore_requests WHERE userId = ? AND status = ? ORDER BY createdAt DESC',
        )
        .all(userId, status);
    }
    return db
      .prepare('SELECT * FROM chore_requests WHERE userId = ? ORDER BY createdAt DESC LIMIT 100')
      .all(userId);
  },
  getChoreRequest(userId: string, requestId: string) {
    return db
      .prepare('SELECT * FROM chore_requests WHERE id = ? AND userId = ?')
      .get(requestId, userId) as
      | {
          id: string;
          userId: string;
          deviceId: string;
          description: string;
          minutes: number;
          status: string;
          createdAt: number;
          resolvedAt: number | null;
          approvedMinutes: number | null;
        }
      | undefined;
  },
  resolveChoreRequest(
    userId: string,
    requestId: string,
    status: 'approved' | 'denied',
    approvedMinutes: number | null,
  ) {
    db.prepare(
      `UPDATE chore_requests SET status = ?, resolvedAt = ?, approvedMinutes = ?
       WHERE id = ? AND userId = ?`,
    ).run(status, Date.now(), approvedMinutes, requestId, userId);
  },

  appendBankLedger(
    userId: string,
    deviceId: string,
    delta: number,
    balanceAfter: number,
    reason: string,
    sourceId: string | null,
  ) {
    const row = {
      id: id(),
      userId,
      deviceId,
      delta,
      balanceAfter,
      reason,
      sourceId,
      createdAt: Date.now(),
    };
    db.prepare(
      `INSERT INTO bank_ledger (id, userId, deviceId, delta, balanceAfter, reason, sourceId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.userId,
      row.deviceId,
      row.delta,
      row.balanceAfter,
      row.reason,
      row.sourceId,
      row.createdAt,
    );
    return row;
  },
  listBankLedger(userId: string, deviceId: string, limit = 100) {
    return db
      .prepare(
        `SELECT * FROM bank_ledger WHERE userId = ? AND deviceId = ?
         ORDER BY createdAt DESC LIMIT ?`,
      )
      .all(userId, deviceId, limit);
  },

  listChoreTemplates(userId: string, deviceId?: string) {
    if (deviceId) {
      return db
        .prepare(
          'SELECT * FROM chore_templates WHERE userId = ? AND deviceId = ? ORDER BY createdAt DESC',
        )
        .all(userId, deviceId);
    }
    return db
      .prepare('SELECT * FROM chore_templates WHERE userId = ? ORDER BY createdAt DESC')
      .all(userId);
  },
  createChoreTemplate(userId: string, deviceId: string, description: string, minutes: number) {
    const row = {
      id: id(),
      userId,
      deviceId,
      description,
      minutes,
      createdAt: Date.now(),
    };
    db.prepare(
      `INSERT INTO chore_templates (id, userId, deviceId, description, minutes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(row.id, row.userId, row.deviceId, row.description, row.minutes, row.createdAt);
    return row;
  },
  deleteChoreTemplate(userId: string, templateId: string) {
    db.prepare('DELETE FROM chore_templates WHERE id = ? AND userId = ?').run(
      templateId,
      userId,
    );
  },

  // ── Co-parents (multi-parent sync) ──
  createCoParentInvite(primaryUserId: string): string {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.prepare(
      'INSERT INTO co_parent_invites (code, primaryUserId, createdAt) VALUES (?, ?, ?)',
    ).run(code, primaryUserId, Date.now());
    return code;
  },
  claimCoParentInvite(code: string, coUserId: string): { primaryUserId: string } | null {
    const inv = db.prepare('SELECT * FROM co_parent_invites WHERE code = ?').get(code) as any;
    if (!inv || inv.claimedAt) return null;
    if (Date.now() - inv.createdAt > 24 * 60 * 60 * 1000) return null;
    if (inv.primaryUserId === coUserId) return null;
    db.prepare(
      'INSERT OR IGNORE INTO co_parents (primaryUserId, coUserId, createdAt) VALUES (?, ?, ?)',
    ).run(inv.primaryUserId, coUserId, Date.now());
    db.prepare(
      'UPDATE co_parent_invites SET claimedAt = ?, claimedByUserId = ? WHERE code = ?',
    ).run(Date.now(), coUserId, code);
    return { primaryUserId: inv.primaryUserId };
  },
  listCoParents(userId: string): { primaryUserId: string; coUserId: string }[] {
    return db
      .prepare('SELECT primaryUserId, coUserId FROM co_parents WHERE primaryUserId = ? OR coUserId = ?')
      .all(userId, userId) as any[];
  },
  // Returns every user id that should be notified / has access to this primaryUserId's data.
  parentUserIdsFor(userId: string): string[] {
    const primary =
      (db
        .prepare('SELECT primaryUserId FROM co_parents WHERE coUserId = ? LIMIT 1')
        .get(userId) as any)?.primaryUserId ?? userId;
    const cos = db
      .prepare('SELECT coUserId FROM co_parents WHERE primaryUserId = ?')
      .all(primary) as { coUserId: string }[];
    return Array.from(new Set([primary, ...cos.map((c) => c.coUserId)]));
  },
  removeCoParent(primaryUserId: string, coUserId: string) {
    db.prepare('DELETE FROM co_parents WHERE primaryUserId = ? AND coUserId = ?').run(
      primaryUserId,
      coUserId,
    );
  },

  // ── Geofences ──
  createGeofence(
    userId: string,
    deviceId: string,
    name: string,
    lat: number,
    lng: number,
    radiusMeters: number,
    notifyOnEnter: boolean,
    notifyOnExit: boolean,
  ) {
    const row = {
      id: id(),
      userId,
      deviceId,
      name,
      lat,
      lng,
      radiusMeters,
      notifyOnEnter,
      notifyOnExit,
      createdAt: Date.now(),
    };
    db.prepare(
      `INSERT INTO geofences (id, userId, deviceId, name, lat, lng, radiusMeters, notifyOnEnter, notifyOnExit, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.userId,
      row.deviceId,
      row.name,
      row.lat,
      row.lng,
      row.radiusMeters,
      notifyOnEnter ? 1 : 0,
      notifyOnExit ? 1 : 0,
      row.createdAt,
    );
    return row;
  },
  listGeofences(userId: string, deviceId?: string) {
    if (deviceId) {
      return db
        .prepare('SELECT * FROM geofences WHERE userId = ? AND deviceId = ?')
        .all(userId, deviceId) as any[];
    }
    return db.prepare('SELECT * FROM geofences WHERE userId = ?').all(userId) as any[];
  },
  geofencesForDevice(deviceId: string) {
    return db.prepare('SELECT * FROM geofences WHERE deviceId = ?').all(deviceId) as any[];
  },
  deleteGeofence(userId: string, geofenceId: string) {
    db.prepare('DELETE FROM geofences WHERE id = ? AND userId = ?').run(geofenceId, userId);
  },

  appendLocation(
    userId: string,
    deviceId: string,
    lat: number,
    lng: number,
    accuracyMeters: number | null,
    recordedAt: number,
  ) {
    const row = {
      id: id(),
      userId,
      deviceId,
      lat,
      lng,
      accuracyMeters,
      recordedAt,
      receivedAt: Date.now(),
    };
    db.prepare(
      `INSERT INTO device_locations (id, userId, deviceId, lat, lng, accuracyMeters, recordedAt, receivedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.userId,
      row.deviceId,
      row.lat,
      row.lng,
      row.accuracyMeters,
      row.recordedAt,
      row.receivedAt,
    );
    return row;
  },
  lastLocation(deviceId: string) {
    return db
      .prepare(
        'SELECT * FROM device_locations WHERE deviceId = ? ORDER BY recordedAt DESC LIMIT 1',
      )
      .get(deviceId) as any;
  },
  listLocations(userId: string, deviceId: string, limit = 50) {
    return db
      .prepare(
        `SELECT * FROM device_locations WHERE userId = ? AND deviceId = ?
         ORDER BY recordedAt DESC LIMIT ?`,
      )
      .all(userId, deviceId, limit) as any[];
  },

  // ── Photo check-ins ──
  createPhotoCheckin(
    userId: string,
    deviceId: string,
    caption: string,
    imageData: string,
    mimeType: string,
    lat: number | null,
    lng: number | null,
    capturedAt: number,
  ) {
    const row = {
      id: id(),
      userId,
      deviceId,
      caption,
      imageData,
      mimeType,
      lat,
      lng,
      capturedAt,
      receivedAt: Date.now(),
    };
    db.prepare(
      `INSERT INTO photo_checkins (id, userId, deviceId, caption, imageData, mimeType, lat, lng, capturedAt, receivedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.userId,
      row.deviceId,
      row.caption,
      row.imageData,
      row.mimeType,
      row.lat,
      row.lng,
      row.capturedAt,
      row.receivedAt,
    );
    return row;
  },
  listPhotoCheckins(userId: string, limit = 50) {
    return db
      .prepare(
        `SELECT id, deviceId, caption, mimeType, lat, lng, capturedAt, receivedAt
         FROM photo_checkins WHERE userId = ? ORDER BY capturedAt DESC LIMIT ?`,
      )
      .all(userId, limit) as any[];
  },
  getPhotoCheckin(userId: string, photoId: string) {
    return db
      .prepare('SELECT * FROM photo_checkins WHERE id = ? AND userId = ?')
      .get(photoId, userId) as any;
  },
  deletePhotoCheckin(userId: string, photoId: string) {
    db.prepare('DELETE FROM photo_checkins WHERE id = ? AND userId = ?').run(photoId, userId);
  },

  // ── Pair-code recovery ──
  // Issues a fresh pair code for an already-paired device so the kid can re-pair
  // after wiping the app, without the parent losing settings/history.
  upsertUsageDaily(deviceId: string, date: string, totalMinutes: number, appUsage: Record<string, number>) {
    db.prepare(
      `INSERT INTO usage_daily (deviceId, date, totalMinutes, appUsage)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(deviceId, date) DO UPDATE SET
         totalMinutes = MAX(usage_daily.totalMinutes, excluded.totalMinutes),
         appUsage = excluded.appUsage`,
    ).run(deviceId, date, Math.max(0, totalMinutes | 0), JSON.stringify(appUsage || {}));
  },
  listUsageDaily(deviceId: string, days = 14): Array<{date: string; totalMinutes: number; appUsage: Record<string, number>}> {
    const rows = db
      .prepare('SELECT date, totalMinutes, appUsage FROM usage_daily WHERE deviceId = ? ORDER BY date DESC LIMIT ?')
      .all(deviceId, days) as Array<{date: string; totalMinutes: number; appUsage: string}>;
    return rows.map((r) => ({ date: r.date, totalMinutes: r.totalMinutes, appUsage: JSON.parse(r.appUsage || '{}') }));
  },

  createRecoveryCode(userId: string, deviceId: string): string {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.prepare(
      `INSERT INTO pair_recovery (id, userId, deviceId, recoveryCode, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id(), userId, deviceId, code, Date.now());
    // Also stash in pair_codes table so existing claim flow works.
    const agentToken = token();
    db.prepare(
      'INSERT INTO pair_codes (code, agentToken, createdAt, claimedByUserId, deviceId) VALUES (?, ?, ?, ?, ?)',
    ).run(code, agentToken, Date.now(), userId, deviceId);
    // Rotate the device's agent token so the old install loses access.
    db.prepare('UPDATE devices SET agentToken = ? WHERE id = ?').run(agentToken, deviceId);
    return code;
  },
};
