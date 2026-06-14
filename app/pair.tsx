import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useTheme } from '../lib/ThemeContext';
import { radius, spacing, typography } from '../lib/theme';

export default function Pair() {
  const { colors } = useTheme();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (code.trim().length !== 6) {
      setError('Pairing code is 6 digits.');
      return;
    }
    setBusy(true);
    try {
      await api.pairDevice(code.trim());
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pairing failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen topInset={false}>
      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Pair a child's PC</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          1. Install the timeoff agent on the PC.{'\n'}2. It shows a 6-digit code.{'\n'}3. Enter it
          below.
        </Text>
      </Card>
      <View style={{ gap: spacing.sm }}>
        <TextInput
          placeholder="••••••"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
        />
        {error && <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text>}
        <Button label="Pair device" icon="link" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: 10,
    fontWeight: '700',
  },
});
