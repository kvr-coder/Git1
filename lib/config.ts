// Server URL precedence (first non-empty wins):
//   1. runtime override set via Settings → "Server URL" (stored in SecureStore)
//   2. EXPO_PUBLIC_API_BASE env var (.env)
//   3. DEFAULT_BASE below — change this to your deployed server
//   4. empty → mock mode
import { KEYS, storage } from './storage';

const DEFAULT_BASE = 'https://git1-server.onrender.com';
const ENV_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(/\/+$/, '');
let runtimeOverride: string = ''; // hydrated on app boot

export async function loadStoredServerUrl(): Promise<void> {
  const v = await storage.get(KEYS.serverUrl);
  runtimeOverride = (v ?? '').replace(/\/+$/, '');
}

export async function setServerUrl(url: string): Promise<void> {
  const cleaned = url.trim().replace(/\/+$/, '');
  runtimeOverride = cleaned;
  if (cleaned) await storage.set(KEYS.serverUrl, cleaned);
  else await storage.del(KEYS.serverUrl);
}

export function getApiBase(): string {
  return runtimeOverride || ENV_BASE;
}

export function isMockMode(): boolean {
  return !getApiBase();
}

// Legacy exports kept so existing imports still work — they're now
// snapshot getters; prefer the functions above for live values.
export const API_BASE = '';
export const USE_MOCK = true;
