// Expo push fanout. https://docs.expo.dev/push-notifications/sending-notifications/
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoMessage {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'high';
}

export async function sendPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
  const valid = tokens.filter((t) => t.startsWith('ExponentPushToken'));
  if (!valid.length) return;
  const messages: ExpoMessage[] = valid.map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high',
  }));
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) console.warn('[push] expo responded', res.status, await res.text());
  } catch (e) {
    console.warn('[push] failed', e);
  }
}

const NOTIFY_KINDS = new Set([
  'limit_reached',
  'app_blocked',
  'lock',
  'boot_blocked',
  'vpn_detected',
  'clock_tamper',
  'request_minutes',
  'borrow',
]);

export function shouldNotify(kind: string): boolean {
  return NOTIFY_KINDS.has(kind);
}
