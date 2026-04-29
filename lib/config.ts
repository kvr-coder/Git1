// Set EXPO_PUBLIC_API_BASE in .env to point at the Git1 server.
// When unset, the mobile app uses the in-memory mock API.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';
export const USE_MOCK = !API_BASE;
