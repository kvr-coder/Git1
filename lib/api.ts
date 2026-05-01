import { realApi } from './api.real';
import { isMockMode } from './config';
import { mockActivity, mockDevices, mockSchedules } from './mock';
import type {
  ActivityEvent,
  BankLedgerEntry,
  ChoreRequest,
  ChoreTemplate,
  Device,
  Schedule,
  TimeRequest,
} from './types';

const mockLedger: BankLedgerEntry[] = [
  {
    id: 'l1',
    deviceId: 'd2',
    delta: 30,
    balanceAfter: 25,
    reason: 'chore: Cleaned my room',
    sourceId: 'c1',
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
  },
  {
    id: 'l2',
    deviceId: 'd2',
    delta: -15,
    balanceAfter: 10,
    reason: 'kid_spent',
    sourceId: null,
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: 'l3',
    deviceId: 'd2',
    delta: 15,
    balanceAfter: 25,
    reason: 'parent_adjust',
    sourceId: null,
    createdAt: Date.now() - 1000 * 60 * 30,
  },
];

const mockTemplates: ChoreTemplate[] = [
  {
    id: 't1',
    deviceId: 'd1',
    description: 'Make bed',
    minutes: 5,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 't2',
    deviceId: 'd1',
    description: 'Take out trash',
    minutes: 10,
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
  },
];

const mockRequests: TimeRequest[] = [
  {
    id: 'r1',
    deviceId: 'd1',
    minutes: 15,
    reason: 'Just one more episode!',
    status: 'pending',
    createdAt: Date.now() - 1000 * 60 * 3,
    resolvedAt: null,
  },
];

const mockChores: ChoreRequest[] = [
  {
    id: 'c1',
    deviceId: 'd1',
    description: 'Cleaned my room and vacuumed',
    minutes: 30,
    status: 'pending',
    createdAt: Date.now() - 1000 * 60 * 8,
    resolvedAt: null,
    approvedMinutes: null,
  },
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mockApi = {
  async listDevices(): Promise<Device[]> {
    await delay(150);
    return mockDevices;
  },
  async getDevice(id: string): Promise<Device | undefined> {
    await delay(100);
    return mockDevices.find((d) => d.id === id);
  },
  async lockDevice(id: string): Promise<void> {
    await delay(200);
    const d = mockDevices.find((x) => x.id === id);
    if (d) d.status = 'locked';
  },
  async unlockDevice(id: string): Promise<void> {
    await delay(200);
    const d = mockDevices.find((x) => x.id === id);
    if (d) d.status = 'online';
  },
  async grantBonusMinutes(id: string, minutes: number): Promise<void> {
    await delay(150);
    const d = mockDevices.find((x) => x.id === id);
    if (d) d.dailyLimitMinutes += minutes;
  },
  async pairDevice(code: string): Promise<Device> {
    await delay(400);
    if (!/^\d{6}$/.test(code)) throw new Error('Invalid code');
    const next: Device = {
      id: `d${mockDevices.length + 1}`,
      name: `New PC (${code})`,
      ownerName: 'Unassigned',
      platform: 'windows',
      status: 'online',
      lastSeen: new Date().toISOString(),
      dailyLimitMinutes: 120,
      usedTodayMinutes: 0,
      internetBlocked: false,
      blocklist: [],
      selfBorrowEnabled: false,
      selfBorrowCapMinutes: 30,
      bankedMinutes: 0,
    };
    mockDevices.push(next);
    return next;
  },
  async setInternetBlocked(id: string, blocked: boolean): Promise<void> {
    await delay(150);
    const d = mockDevices.find((x) => x.id === id);
    if (d) d.internetBlocked = blocked;
  },
  async setBlocklist(id: string, apps: string[]): Promise<void> {
    await delay(150);
    const d = mockDevices.find((x) => x.id === id);
    if (d) d.blocklist = apps;
  },
  async setBorrowSettings(id: string, enabled: boolean, capMinutes: number): Promise<void> {
    await delay(150);
    const d = mockDevices.find((x) => x.id === id);
    if (d) {
      d.selfBorrowEnabled = enabled;
      d.selfBorrowCapMinutes = capMinutes;
    }
  },
  async listSchedules(): Promise<Schedule[]> {
    await delay(150);
    return mockSchedules;
  },
  async getSchedule(id: string): Promise<Schedule | undefined> {
    await delay(80);
    return mockSchedules.find((s) => s.id === id);
  },
  async upsertSchedule(s: Schedule): Promise<void> {
    await delay(150);
    const i = mockSchedules.findIndex((x) => x.id === s.id);
    if (i >= 0) mockSchedules[i] = s;
    else mockSchedules.push(s);
  },
  async deleteSchedule(id: string): Promise<void> {
    await delay(150);
    const i = mockSchedules.findIndex((x) => x.id === id);
    if (i >= 0) mockSchedules.splice(i, 1);
  },
  async listActivity(): Promise<ActivityEvent[]> {
    await delay(150);
    return mockActivity;
  },
  async registerPushToken(token: string): Promise<void> {
    await delay(80);
    console.log('[mock api] push token:', token);
  },
  async listRequests(status?: 'pending' | 'approved' | 'denied'): Promise<TimeRequest[]> {
    await delay(120);
    return status ? mockRequests.filter((r) => r.status === status) : mockRequests;
  },
  async resolveRequest(id: string, status: 'approved' | 'denied'): Promise<void> {
    await delay(150);
    const r = mockRequests.find((x) => x.id === id);
    if (!r) return;
    r.status = status;
    r.resolvedAt = Date.now();
    if (status === 'approved') {
      const d = mockDevices.find((x) => x.id === r.deviceId);
      if (d) d.dailyLimitMinutes += r.minutes;
    }
  },
  async listChores(status?: 'pending' | 'approved' | 'denied'): Promise<ChoreRequest[]> {
    await delay(120);
    return status ? mockChores.filter((c) => c.status === status) : mockChores;
  },
  async resolveChore(id: string, status: 'approved' | 'denied', minutes?: number): Promise<void> {
    await delay(150);
    const c = mockChores.find((x) => x.id === id);
    if (!c) return;
    c.status = status;
    c.resolvedAt = Date.now();
    if (status === 'approved') {
      const m = minutes ?? c.minutes;
      c.approvedMinutes = m;
      const d = mockDevices.find((x) => x.id === c.deviceId);
      if (d) d.bankedMinutes += m;
    }
  },
  async addBankMinutes(id: string, minutes: number): Promise<void> {
    await delay(120);
    const d = mockDevices.find((x) => x.id === id);
    if (d) d.bankedMinutes += minutes;
  },
  async setBankMinutes(id: string, minutes: number): Promise<void> {
    await delay(120);
    const d = mockDevices.find((x) => x.id === id);
    if (d) d.bankedMinutes = Math.max(0, minutes);
  },
  async listBankLedger(id: string): Promise<BankLedgerEntry[]> {
    await delay(100);
    return mockLedger.filter((l) => l.deviceId === id);
  },
  async listChoreTemplates(id: string): Promise<ChoreTemplate[]> {
    await delay(100);
    return mockTemplates.filter((t) => t.deviceId === id);
  },
  async createChoreTemplate(id: string, description: string, minutes: number): Promise<ChoreTemplate> {
    await delay(120);
    const t: ChoreTemplate = {
      id: `t${Date.now()}`,
      deviceId: id,
      description,
      minutes,
      createdAt: Date.now(),
    };
    mockTemplates.push(t);
    return t;
  },
  async deleteChoreTemplate(_id: string, templateId: string): Promise<void> {
    await delay(80);
    const i = mockTemplates.findIndex((t) => t.id === templateId);
    if (i >= 0) mockTemplates.splice(i, 1);
  },
};

// Dispatches per call so toggling the server URL at runtime takes effect
// without restarting the app.
type ApiShape = typeof realApi;
export const api: ApiShape = new Proxy({} as ApiShape, {
  get(_t, prop) {
    const target = isMockMode() ? mockApi : realApi;
    return (target as unknown as Record<string, unknown>)[prop as string];
  },
}) as ApiShape;
