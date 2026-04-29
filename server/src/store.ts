// In-memory store. Swap for SQLite (better-sqlite3) before deploying.
import { randomBytes } from 'node:crypto';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  pushTokens: string[];
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

export interface PairCode {
  code: string;
  agentToken: string;
  createdAt: number;
  claimedByUserId: string | null;
  deviceId: string | null;
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

const users = new Map<string, User>();
const tokens = new Map<string, string>(); // bearer → userId
const devices = new Map<string, DeviceRow>();
const pairCodes = new Map<string, PairCode>();
const schedules = new Map<string, ScheduleRow>();
const activity: ActivityRow[] = [];

const id = () => randomBytes(8).toString('hex');
const token = () => randomBytes(24).toString('hex');

export const store = {
  createUser(email: string, passwordHash: string): User {
    const u: User = { id: id(), email, passwordHash, pushTokens: [] };
    users.set(u.id, u);
    return u;
  },
  findUserByEmail(email: string) {
    for (const u of users.values()) if (u.email === email) return u;
    return undefined;
  },
  issueToken(userId: string) {
    const t = token();
    tokens.set(t, userId);
    return t;
  },
  userFromToken(t: string) {
    const uid = tokens.get(t);
    return uid ? users.get(uid) : undefined;
  },
  addPushToken(userId: string, pushToken: string) {
    const u = users.get(userId);
    if (u && !u.pushTokens.includes(pushToken)) u.pushTokens.push(pushToken);
  },

  startPairing(): PairCode {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const pc: PairCode = {
      code,
      agentToken: token(),
      createdAt: Date.now(),
      claimedByUserId: null,
      deviceId: null,
    };
    pairCodes.set(code, pc);
    return pc;
  },
  claimPairing(code: string, userId: string, name: string): DeviceRow | null {
    const pc = pairCodes.get(code);
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
    devices.set(d.id, d);
    pc.claimedByUserId = userId;
    pc.deviceId = d.id;
    return d;
  },
  pollPairing(code: string) {
    return pairCodes.get(code) ?? null;
  },
  deviceByAgentToken(t: string) {
    for (const d of devices.values()) if (d.agentToken === t) return d;
    return undefined;
  },
  listDevices(userId: string) {
    return [...devices.values()].filter((d) => d.userId === userId);
  },
  getDevice(userId: string, deviceId: string) {
    const d = devices.get(deviceId);
    return d && d.userId === userId ? d : undefined;
  },
  updateDevice(deviceId: string, patch: Partial<DeviceRow>) {
    const d = devices.get(deviceId);
    if (d) Object.assign(d, patch);
  },

  listSchedules(userId: string) {
    return [...schedules.values()].filter((s) => s.userId === userId);
  },
  upsertSchedule(userId: string, s: Omit<ScheduleRow, 'userId'>) {
    const row: ScheduleRow = { ...s, userId };
    schedules.set(row.id, row);
    return row;
  },
  deleteSchedule(userId: string, scheduleId: string) {
    const s = schedules.get(scheduleId);
    if (s && s.userId === userId) schedules.delete(scheduleId);
  },

  appendActivity(row: Omit<ActivityRow, 'id' | 'timestamp'>) {
    const a: ActivityRow = { ...row, id: id(), timestamp: Date.now() };
    activity.push(a);
    if (activity.length > 1000) activity.splice(0, activity.length - 1000);
    return a;
  },
  listActivity(userId: string, limit = 100) {
    return activity
      .filter((a) => a.userId === userId)
      .slice(-limit)
      .reverse();
  },
};
