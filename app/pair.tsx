import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { colors, radius, spacing, typography } from '../lib/theme';

export default function Pair() {
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
    <Screen>
      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Pair a child's PC</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          1. Install the Git1 agent on the PC.{'\n'}2. The agent shows a 6-digit code.{'\n'}3. Enter
          it below.
        </Text>
      </Card>
      <View style={{ gap: spacing.sm }}>
        <TextInput
          placeholder="123456"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          style={styles.input}
        />
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        <Button label="Pair device" onPress={submit} loading={busy} />
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
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 8,
  },
});
