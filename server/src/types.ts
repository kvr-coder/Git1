export type CommandKind =
  | 'lock'
  | 'unlock'
  | 'grant_minutes'
  | 'set_limit'
  | 'block_internet'
  | 'unblock_internet'
  | 'set_blocklist'
  | 'set_schedules'
  | 'set_borrow_settings'
  | 'add_bank_minutes'
  | 'set_bank_minutes'
  | 'set_always_blocklist'
  | 'rename'
  | 'set_vacation'
  | 'set_nd_mode'
  | 'set_web_filter'
  | 'clear_local_history';

export interface Command {
  id: string;
  deviceId: string;
  kind: CommandKind;
  payload?: Record<string, unknown>;
  createdAt: number;
}

export type AgentMessage =
  | { kind: 'ack'; id: string }
  | { kind: 'event'; name: string; payload?: Record<string, unknown> }
  | { kind: 'heartbeat'; usedTodayMinutes: number };

export type ServerMessage =
  | { kind: 'command'; command: Command }
  | { kind: 'notification'; name: string; payload?: Record<string, unknown> };
