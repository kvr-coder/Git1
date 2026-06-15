import { AgeBand } from './wisdom';
import { KEYS, storage } from './storage';

const keyOf = (deviceId: string) => KEYS.deviceAgePrefix + deviceId;

export async function getDeviceAge(deviceId: string): Promise<AgeBand | undefined> {
  const v = await storage.get(keyOf(deviceId));
  return v === '6-9' || v === '10-13' || v === '14-16' ? v : undefined;
}

export async function setDeviceAge(deviceId: string, age: AgeBand): Promise<void> {
  await storage.set(keyOf(deviceId), age);
}

const ndKey = (deviceId: string) => KEYS.deviceNdPrefix + deviceId;
export async function getDeviceNd(deviceId: string): Promise<boolean> {
  return (await storage.get(ndKey(deviceId))) === '1';
}
export async function setDeviceNd(deviceId: string, on: boolean): Promise<void> {
  await storage.set(ndKey(deviceId), on ? '1' : '0');
}
