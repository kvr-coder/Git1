import type { ActivityEvent, Device, Schedule } from './types';

export const mockDevices: Device[] = [
  {
    id: 'd1',
    name: "Emma's Laptop",
    ownerName: 'Emma',
    platform: 'windows',
    status: 'online',
    lastSeen: new Date().toISOString(),
    dailyLimitMinutes: 120,
    usedTodayMinutes: 47,
    internetBlocked: false,
    blocklist: [],
  },
  {
    id: 'd2',
    name: "Liam's PC",
    ownerName: 'Liam',
    platform: 'windows',
    status: 'locked',
    lastSeen: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    dailyLimitMinutes: 90,
    usedTodayMinutes: 90,
    internetBlocked: true,
    blocklist: ['steam.exe'],
  },
  {
    id: 'd3',
    name: "Family iMac",
    ownerName: 'Shared',
    platform: 'macos',
    status: 'offline',
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    dailyLimitMinutes: 180,
    usedTodayMinutes: 0,
    internetBlocked: false,
    blocklist: [],
  },
];

export const mockSchedules: Schedule[] = [
  {
    id: 's1',
    deviceId: 'd1',
    name: 'School nights',
    days: ['mon', 'tue', 'wed', 'thu'],
    startMinute: 16 * 60,
    endMinute: 20 * 60,
    enabled: true,
    actions: ['lock'],
  },
  {
    id: 's2',
    deviceId: 'd2',
    name: 'Bedtime lock',
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    startMinute: 21 * 60,
    endMinute: 7 * 60,
    enabled: true,
    actions: ['lock'],
  },
];

export const mockActivity: ActivityEvent[] = [
  {
    id: 'a1',
    deviceId: 'd2',
    kind: 'limit_reached',
    message: "Liam's PC reached the daily 90 min limit",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: 'a2',
    deviceId: 'd1',
    kind: 'unlock',
    message: "Emma's Laptop unlocked by parent",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'a3',
    deviceId: 'd1',
    kind: 'app_blocked',
    message: 'Blocked launch of "Steam" on Emma\'s Laptop',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];
