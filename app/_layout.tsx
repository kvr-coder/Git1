import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { LoadingDots } from '../components/AnimatedIcons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { realApi } from '../lib/api.real';
import { AuthContext } from '../lib/auth';
import { getApiBase, isMockMode, loadStoredServerUrl } from '../lib/config';
import { registerForPush } from '../lib/push';
import { KEYS, storage } from '../lib/storage';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';

function RootNav() {
  const { colors } = useTheme();
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
          ? '[timeoff] DEMO MODE — set the Server URL in Settings'
          : `[timeoff] using server: ${getApiBase()}`,
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
        let token: string;
        if (isMockMode()) {
          token = `demo-${Date.now()}`;
        } else {
          try {
            token = await realApi.login(e, p);
          } catch (err) {
            try {
              token = await realApi.register(e, p);
            } catch {
              throw err;
            }
          }
        }
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
    if (signedIn) {
      registerForPush();
      // First-time parents: route through onboarding once.
      storage.get(KEYS.onboarded).then((v) => {
        if (!v && segments[0] !== 'onboarding') router.replace('/onboarding');
      });
    }
  }, [signedIn, segments, router, ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingDots size={90} />
      </View>
    );
  }

  const stackHeader = {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.bg },
  };

  return (
    <AuthContext.Provider value={auth}>
      <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="device/[id]" options={{ headerShown: true, title: '', ...stackHeader }} />
        <Stack.Screen
          name="pair"
          options={{ headerShown: true, title: 'Pair device', presentation: 'modal', ...stackHeader }}
        />
        <Stack.Screen name="schedule/[id]" options={{ headerShown: true, title: 'Schedule', ...stackHeader }} />
        <Stack.Screen name="device-bank/[id]" options={{ headerShown: true, title: 'Bank history', ...stackHeader }} />
        <Stack.Screen name="device-templates/[id]" options={{ headerShown: true, title: 'Chores', ...stackHeader }} />
        <Stack.Screen name="feedback" options={{ headerShown: true, title: 'Bug report', presentation: 'modal', ...stackHeader }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
    </AuthContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNav />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
