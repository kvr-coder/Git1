import { mockActivity, mockDevices, mockSchedules } from './mock';
import type { ActivityEvent, Device, Schedule } from './types';

// TODO: replace with real backend (REST/WS) once the agent service is built.
// The agent on each child PC will connect to the backend; this client is the
// parent-side phone client that issues commands and reads state.

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const api = {
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
  async listSchedules(): Promise<Schedule[]> {
    await delay(150);
    return mockSchedules;
  },
  async listActivity(): Promise<ActivityEvent[]> {
    await delay(150);
    return mockActivity;
  },
};
