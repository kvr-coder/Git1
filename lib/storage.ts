import * as SecureStore from 'expo-secure-store';

export const storage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  del: (key: string) => SecureStore.deleteItemAsync(key),
};

export const KEYS = {
  authToken: 'git1.authToken',
  authEmail: 'git1.authEmail',
  pushToken: 'git1.pushToken',
  serverUrl: 'git1.serverUrl',
  themePref: 'git1.themePref',
  activityRetention: 'git1.activityRetentionDays',
};
