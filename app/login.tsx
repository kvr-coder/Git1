import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiBanner } from '../components/ApiBanner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useAuth } from '../lib/auth';
import { colors, radius, spacing, typography } from '../lib/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      await signIn(email || 'parent@example.com', password);
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
      </View>
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
