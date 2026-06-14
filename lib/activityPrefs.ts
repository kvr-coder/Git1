// Activity-list preferences, persisted across launches.
import { KEYS, storage } from './storage';

export type Retention = 7 | 30 | 90 | 0; // 0 = "All"
export const DEFAULT_RETENTION: Retention = 30;

export async function getActivityRetention(): Promise<Retention> {
  const raw = await storage.get(KEYS.activityRetention);
  const n = Number(raw);
  if (n === 0 || n === 7 || n === 30 || n === 90) return n as Retention;
  return DEFAULT_RETENTION;
}

export async function setActivityRetention(days: Retention): Promise<void> {
  await storage.set(KEYS.activityRetention, String(days));
}

// Bucket label for a timestamp. Used to group the activity feed instead of an
// endless flat stream.
export function activityBucket(ts: string): 'Today' | 'Yesterday' | 'Last 7 days' | 'Last 30 days' | 'Earlier' {
  const now = new Date();
  const then = new Date(ts);
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const days = (startOfToday.getTime() - then.getTime()) / 86_400_000;
  if (then >= startOfToday) return 'Today';
  if (then >= startOfYesterday) return 'Yesterday';
  if (days < 7) return 'Last 7 days';
  if (days < 30) return 'Last 30 days';
  return 'Earlier';
}
