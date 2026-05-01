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
  internetBlocked: boolean;
  blocklist: string[];
  selfBorrowEnabled: boolean;
  selfBorrowCapMinutes: number;
  bankedMinutes: number;
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type ScheduleAction = 'lock' | 'block_internet' | 'block_apps';

export interface Schedule {
  id: string;
  deviceId: string;
  name: string;
  days: DayOfWeek[];
  startMinute: number;
  endMinute: number;
  enabled: boolean;
  actions: ScheduleAction[];
}

export type ActivityKind =
  | 'lock'
  | 'unlock'
  | 'limit_reached'
  | 'app_blocked'
  | 'login'
  | 'vpn_detected'
  | 'clock_tamper'
  | 'request_minutes'
  | 'borrow'
  | 'chore_request'
  | 'bank_spent';

export interface ChoreRequest {
  id: string;
  deviceId: string;
  description: string;
  minutes: number;
  status: 'pending' | 'approved' | 'denied';
  createdAt: number;
  resolvedAt: number | null;
  approvedMinutes: number | null;
}

export interface TimeRequest {
  id: string;
  deviceId: string;
  minutes: number;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: number;
  resolvedAt: number | null;
}

export interface ActivityEvent {
  id: string;
  deviceId: string;
  kind: ActivityKind;
  message: string;
  timestamp: string;
}
