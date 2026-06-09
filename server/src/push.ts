// Push fan-out. Two channels:
//   * Expo Push (legacy / iOS dev-build path) — kept as-is.
//   * Web Push (W3C) — instant phone notifications via the browser dashboard,
//     no Apple Developer account needed. iPhone needs Add-to-Home-Screen once.
import webpush from 'web-push';
import { store } from './store.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoMessage {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'high';
}

// ---- VAPID identity ----
// Reads from env (set these in Render so subscriptions survive restarts).
// If absent, generates ephemeral keys + logs them so you can paste into env.
let VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? '';
let VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:kvara@test.com';

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  const k = webpush.generateVAPIDKeys();
  VAPID_PUBLIC = k.publicKey;
  VAPID_PRIVATE = k.privateKey;
  console.warn(
    '[webpush] VAPID keys not set in env — generated EPHEMERAL keys for this boot.\n' +
      '  Paste into Render env to make notifications survive restarts:\n' +
      `  VAPID_PUBLIC_KEY=${VAPID_PUBLIC}\n` +
      `  VAPID_PRIVATE_KEY=${VAPID_PRIVATE}`,
  );
}
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

export function webPushPublicKey(): string {
  return VAPID_PUBLIC;
}

// ---- Combined fan-out: Expo + Web Push for one user ----
export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  // Expo path (kept for backwards compatibility; quietly no-ops without tokens).
  void sendPush(store.pushTokensForUser(userId), title, body, data);

  // Web Push path — instant, browser-based, free.
  const subs = store.webPushSubsForUser(userId);
  if (!subs.length) return;
  const payload = JSON.stringify({ title, body, data });
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s as any, payload, { TTL: 600 });
      } catch (e: any) {
        // 404/410 = subscription expired; drop it. Anything else: log + keep.
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint);
        else console.warn('[webpush]', e?.statusCode, e?.body || e?.message);
      }
    }),
  );
  for (const ep of dead) store.removeWebPushSub(ep);
}

export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
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
  'chore_request',
  'bank_spent',
  'tamper_offline',
  'device_online',
]);

export function shouldNotify(kind: string): boolean {
  return NOTIFY_KINDS.has(kind);
}
