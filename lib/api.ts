import { realApi } from './api.real';
import { USE_MOCK } from './config';
import { mockActivity, mockDevices, mockSchedules } from './mock';
import type { ActivityEvent, Device, Schedule } from './types';

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
    };
    mockDevices.push(next);
    return next;
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
};

export const api = USE_MOCK ? mockApi : realApi;
