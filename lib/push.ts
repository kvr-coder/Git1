import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { KEYS, storage } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await storage.set(KEYS.pushToken, token);
    await api.registerPushToken(token);
    return token;
  } catch (e) {
    console.warn('[push] failed to get token', e);
    return null;
  }
}
