import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthContext } from '../lib/auth';

export default function RootLayout() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  const segments = useSegments();

  const auth = useMemo(
    () => ({
      signedIn,
      email,
      signIn: async (e: string, _p: string) => {
        setEmail(e);
        setSignedIn(true);
      },
      signOut: () => {
        setEmail(null);
        setSignedIn(false);
      },
    }),
    [signedIn, email],
  );

  useEffect(() => {
    const inAuth = segments[0] === 'login';
    if (!signedIn && !inAuth) router.replace('/login');
    if (signedIn && inAuth) router.replace('/');
  }, [signedIn, segments, router]);

  return (
    <AuthContext.Provider value={auth}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="device/[id]" options={{ headerShown: true, title: 'Device' }} />
      </Stack>
    </AuthContext.Provider>
  );
}
