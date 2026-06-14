import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiBanner } from '../components/ApiBanner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useAuth } from '../lib/auth';
import { getApiBase, isMockMode, setServerUrl } from '../lib/config';
import { colors, radius, spacing, typography } from '../lib/theme';

export default function Login() {
  const { signIn } = useAuth();
  // Pre-filled with the same defaults the desktop launcher (.bat) registers.
  // Override either field if you used a different account.
  const [email, setEmail] = useState('kvara@test.com');
  const [password, setPassword] = useState('hunter22');
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState('');
  const [, force] = useState(0);

  useEffect(() => {
    setServer(getApiBase());
  }, []);

  const saveServer = async () => {
    await setServerUrl(server.trim());
    force((n) => n + 1); // re-render banner
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      await signIn(email, password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ApiBanner />
      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <Text style={[typography.h1, { color: colors.text }]}>Welcome back</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          Sign in to manage your family's devices.
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          timeoff • OTA rev 1 ✓
        </Text>
      </View>
      {isMockMode() && (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Server URL (your PC's LAN IP, e.g. http://192.168.1.42:8080)
          </Text>
          <TextInput
            value={server}
            onChangeText={setServer}
            placeholder="http://192.168.1.42:8080"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <Button label="Save server URL" variant="secondary" onPress={saveServer} />
        </View>
      )}
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <Button label="Sign in" onPress={onSubmit} loading={loading} />
        <Button label="Continue as demo" variant="secondary" onPress={onSubmit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    color: colors.text,
    fontSize: 15,
  },
});
