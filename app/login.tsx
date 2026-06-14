import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiBanner } from '../components/ApiBanner';
import { Button } from '../components/Button';
import { useAuth } from '../lib/auth';
import { getApiBase, isMockMode, setServerUrl } from '../lib/config';
import { useTheme } from '../lib/ThemeContext';
import { radius, spacing, typography } from '../lib/theme';

export default function Login() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState('');
  const [, force] = useState(0);

  useEffect(() => {
    setServer(getApiBase());
  }, []);

  const saveServer = async () => {
    await setServerUrl(server.trim());
    force((n) => n + 1);
  };

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setError(e?.message || 'Could not sign in. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={[styles.wrap, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}>
        {/* Brand */}
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="hourglass-outline" size={30} color={colors.primary} />
          </View>
          <Text style={[typography.display, { color: colors.text }]}>timeoff</Text>
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Calm, confident control of your family's screen time.
          </Text>
        </View>

        <ApiBanner />

        {isMockMode() && (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Server URL</Text>
            <TextInput
              value={server}
              onChangeText={setServer}
              placeholder="https://git1-server.onrender.com"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={inputStyle}
            />
            <Button label="Save server URL" variant="secondary" onPress={saveServer} />
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={inputStyle}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={inputStyle}
            onSubmitEditing={onSubmit}
          />
          {error && (
            <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text>
          )}
          <Button label="Sign in" onPress={onSubmit} loading={loading} />
        </View>

        <Text style={[typography.caption, { color: colors.textFaint, textAlign: 'center' }]}>
          Same account as the web dashboard.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.lg, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 1,
    fontSize: 15,
  },
});
