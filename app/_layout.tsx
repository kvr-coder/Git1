import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { realApi } from '../lib/api.real';
import { AuthContext } from '../lib/auth';
import { getApiBase, isMockMode, loadStoredServerUrl } from '../lib/config';
import { registerForPush } from '../lib/push';
import { KEYS, storage } from '../lib/storage';
import { colors } from '../lib/theme';

export default function RootLayout() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      await loadStoredServerUrl();
      console.log(
        isMockMode()
          ? '[git1] MOCK MODE — set the Server URL in Settings'
          : `[git1] using server: ${getApiBase()}`,
      );
      const [token, savedEmail] = await Promise.all([
        storage.get(KEYS.authToken),
        storage.get(KEYS.authEmail),
      ]);
      if (token) {
        setSignedIn(true);
        setEmail(savedEmail);
      }
      setReady(true);
    })();
  }, []);

  const auth = useMemo(
    () => ({
      signedIn,
      email,
      ready,
      signIn: async (e: string, p: string) => {
        const token = isMockMode() ? `demo-${Date.now()}` : await realApi.login(e, p);
        await storage.set(KEYS.authToken, token);
        await storage.set(KEYS.authEmail, e);
        setEmail(e);
        setSignedIn(true);
      },
      signOut: async () => {
        await storage.del(KEYS.authToken);
        await storage.del(KEYS.authEmail);
        setEmail(null);
        setSignedIn(false);
      },
    }),
    [signedIn, email, ready],
  );

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === 'login';
    if (!signedIn && !inAuth) router.replace('/login');
    if (signedIn && inAuth) router.replace('/');
    if (signedIn) registerForPush();
  }, [signedIn, segments, router, ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen
          name="device/[id]"
          options={{ headerShown: true, title: 'Device', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}
        />
        <Stack.Screen
          name="pair"
          options={{ headerShown: true, title: 'Pair device', presentation: 'modal', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}
        />
        <Stack.Screen
          name="schedule/[id]"
          options={{ headerShown: true, title: 'Edit schedule', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}
        />
        <Stack.Screen
          name="device-bank/[id]"
          options={{ headerShown: true, title: 'Bank history', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}
        />
        <Stack.Screen
          name="device-templates/[id]"
          options={{ headerShown: true, title: 'Chore templates', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}
        />
      </Stack>
    </AuthContext.Provider>
  );
}
