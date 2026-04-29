export type DevicePlatform = 'windows' | 'macos' | 'linux';

export type DeviceStatus = 'online' | 'offline' | 'locked';

export interface Device {
  id: string;
  name: string;
  ownerName: string;
  platform: DevicePlatform;
  status: DeviceStatus;
  lastSeen: string;
  dailyLimitMinutes: number;
  usedTodayMinutes: number;
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Schedule {
  id: string;
  deviceId: string;
  name: string;
  days: DayOfWeek[];
  startMinute: number;
  endMinute: number;
  enabled: boolean;
}

export type ActivityKind = 'lock' | 'unlock' | 'limit_reached' | 'app_blocked' | 'login';

export interface ActivityEvent {
  id: string;
  deviceId: string;
  kind: ActivityKind;
  message: string;
  timestamp: string;
}
