import { getApiBase } from './config';
import { KEYS, storage } from './storage';
import type {
  ActivityEvent,
  BankLedgerEntry,
  ChoreRequest,
  ChoreTemplate,
  Device,
  Schedule,
  TimeRequest,
} from './types';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await storage.get(KEYS.authToken);
  const base = getApiBase();
  if (!base) throw new Error('Server URL not set');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && token) {
    // Stale token (server DB likely reset). Clear it so the next render
    // bounces the user to the login screen.
    await storage.del(KEYS.authToken);
    await storage.del(KEYS.authEmail);
    throw new Error('Session expired — please sign in again');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface ServerDevice {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'locked';
  lastSeen: number | null;
  dailyLimitMinutes: number;
  usedTodayMinutes: number;
  internetBlocked?: boolean;
  blocklist?: string[];
  selfBorrowEnabled?: boolean;
  selfBorrowCapMinutes?: number;
  bankedMinutes?: number;
  vacationUntil?: number;
  ndMode?: boolean;
}

const adaptDevice = (d: ServerDevice): Device => ({
  id: d.id,
  name: d.name,
  ownerName: '',
  platform: 'windows',
  status: d.status,
  lastSeen: d.lastSeen ? new Date(d.lastSeen).toISOString() : new Date(0).toISOString(),
  dailyLimitMinutes: d.dailyLimitMinutes,
  usedTodayMinutes: d.usedTodayMinutes,
  internetBlocked: !!d.internetBlocked,
  blocklist: d.blocklist ?? [],
  selfBorrowEnabled: !!d.selfBorrowEnabled,
  selfBorrowCapMinutes: d.selfBorrowCapMinutes ?? 30,
  bankedMinutes: d.bankedMinutes ?? 0,
  vacationUntil: d.vacationUntil ?? 0,
  ndMode: !!d.ndMode,
});

interface ServerActivity {
  id: string;
  deviceId: string;
  kind: string;
  message: string;
  timestamp: number;
}

export const realApi = {
  async login(email: string, password: string): Promise<string> {
    const r = await request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return r.token;
  },
  async register(email: string, password: string): Promise<string> {
    const r = await request<{ token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return r.token;
  },
  async listDevices(): Promise<Device[]> {
    const ds = await request<ServerDevice[]>('/devices');
    return ds.map(adaptDevice);
  },
  async getDevice(id: string): Promise<Device | undefined> {
    const all = await this.listDevices();
    return all.find((d) => d.id === id);
  },
  async lockDevice(id: string) {
    await request(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'lock' }),
    });
  },
  async unlockDevice(id: string) {
    await request(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'unlock' }),
    });
  },
  async grantBonusMinutes(id: string, minutes: number) {
    await request(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'grant_minutes', payload: { minutes } }),
    });
  },
  async setDailyLimit(id: string, minutes: number) {
    await request(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'set_limit', payload: { minutes } }),
    });
  },
  async setInternetBlocked(id: string, blocked: boolean) {
    await request(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: blocked ? 'block_internet' : 'unblock_internet' }),
    });
  },
  async setBlocklist(id: string, apps: string[]) {
    await request(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'set_blocklist', payload: { apps } }),
    });
  },
  async setBorrowSettings(id: string, enabled: boolean, capMinutes: number) {
    await request(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'set_borrow_settings',
        payload: { enabled, capMinutes },
      }),
    });
  },
  async pairDevice(code: string): Promise<Device> {
    const d = await request<ServerDevice>('/devices/pair', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return adaptDevice(d);
  },
  async listSchedules(): Promise<Schedule[]> {
    return request<Schedule[]>('/schedules');
  },
  async getSchedule(id: string) {
    const all = await this.listSchedules();
    return all.find((s) => s.id === id);
  },
  async upsertSchedule(s: Schedule) {
    await request(`/schedules/${s.id}`, { method: 'PUT', body: JSON.stringify(s) });
  },
  async deleteSchedule(id: string) {
    await request(`/schedules/${id}`, { method: 'DELETE' });
  },
  async listActivity(): Promise<ActivityEvent[]> {
    const events = await request<ServerActivity[]>('/activity');
    return events.map((e) => ({
      id: e.id,
      deviceId: e.deviceId,
      kind: ([
        'lock',
        'unlock',
        'limit_reached',
        'app_blocked',
        'login',
        'vpn_detected',
        'clock_tamper',
        'request_minutes',
        'borrow',
        'chore_request',
        'bank_spent',
      ].includes(e.kind)
        ? e.kind
        : 'login') as ActivityEvent['kind'],
      message: e.message,
      timestamp: new Date(e.timestamp).toISOString(),
    }));
  },
  async registerPushToken(token: string) {
    await request('/push/register', { method: 'POST', body: JSON.stringify({ token }) });
  },
  async getPrefs(): Promise<{ quietFromMin: number; quietToMin: number; dailySummaryOn: boolean; tamperAlertsOn: boolean }> {
    return request('/me/prefs');
  },
  async setPrefs(patch: Partial<{ quietFromMin: number; quietToMin: number; dailySummaryOn: boolean; tamperAlertsOn: boolean }>) {
    return request('/me/prefs', { method: 'PUT', body: JSON.stringify(patch) });
  },
  async getConsent(): Promise<{ consentedAt: number | null }> {
    return request('/me/consent');
  },
  async recordConsent(): Promise<{ consentedAt: number | null }> {
    return request('/me/consent', { method: 'POST' });
  },
  async setVacation(deviceId: string, until: number) {
    await request(`/devices/${deviceId}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'set_vacation', payload: { until } }),
    });
  },
  async clearHistory(): Promise<{ ok: boolean; tables: Record<string, number> }> {
    return request('/me/clear-history', { method: 'POST', body: JSON.stringify({ confirm: 'CLEAR' }) });
  },
  async deleteAccount(email: string): Promise<{ ok: boolean; tables: Record<string, number> }> {
    return request('/me/delete', { method: 'POST', body: JSON.stringify({ confirm: 'DELETE', email }) });
  },
  async setNdMode(deviceId: string, on: boolean) {
    await request(`/devices/${deviceId}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'set_nd_mode', payload: { on } }),
    });
  },
  async wipeKidPcHistory(deviceId: string) {
    await request(`/devices/${deviceId}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'clear_local_history' }),
    });
  },
  async getStats(id: string, days = 28): Promise<{ daily: { date: string; totalMinutes: number; appUsage: Record<string, number> }[] }> {
    return request(`/devices/${id}/stats?days=${days}`);
  },
  async emailInstaller(code?: string): Promise<{ ok: boolean; sent: boolean; link: string }> {
    return request('/installer/email', {
      method: 'POST',
      body: JSON.stringify(code ? { code } : {}),
    });
  },
  async sendFeedback(payload: { body: string; app?: string; version?: string; platform?: string; email?: string }) {
    await request('/feedback', { method: 'POST', body: JSON.stringify(payload) });
  },
  async listRequests(status?: 'pending' | 'approved' | 'denied'): Promise<TimeRequest[]> {
    const qs = status ? `?status=${status}` : '';
    return request<TimeRequest[]>(`/requests${qs}`);
  },
  async resolveRequest(id: string, status: 'approved' | 'denied') {
    await request(`/requests/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },
  async listChores(status?: 'pending' | 'approved' | 'denied'): Promise<ChoreRequest[]> {
    const qs = status ? `?status=${status}` : '';
    return request<ChoreRequest[]>(`/chores${qs}`);
  },
  async resolveChore(id: string, status: 'approved' | 'denied', minutes?: number) {
    await request(`/chores/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status, ...(minutes !== undefined ? { minutes } : {}) }),
    });
  },
  async addBankMinutes(id: string, minutes: number) {
    await request(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'add_bank_minutes', payload: { minutes } }),
    });
  },
  async setBankMinutes(id: string, minutes: number) {
    await request(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'set_bank_minutes', payload: { minutes } }),
    });
  },
  async listBankLedger(id: string): Promise<BankLedgerEntry[]> {
    return request<BankLedgerEntry[]>(`/devices/${id}/bank-ledger`);
  },
  async listChoreTemplates(id: string): Promise<ChoreTemplate[]> {
    return request<ChoreTemplate[]>(`/devices/${id}/chore-templates`);
  },
  async createChoreTemplate(id: string, description: string, minutes: number) {
    return request<ChoreTemplate>(`/devices/${id}/chore-templates`, {
      method: 'POST',
      body: JSON.stringify({ description, minutes }),
    });
  },
  async deleteChoreTemplate(id: string, templateId: string) {
    await request(`/devices/${id}/chore-templates/${templateId}`, { method: 'DELETE' });
  },
};
