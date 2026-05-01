import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiBanner } from '../../components/ApiBanner';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../lib/auth';
import { getApiBase, setServerUrl } from '../../lib/config';
import { colors, radius, spacing, typography } from '../../lib/theme';

export default function Settings() {
  const { email, signOut } = useAuth();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setUrl(getApiBase());
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setServerUrl(url.trim());
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ApiBanner />
      <Text style={[typography.h1, { color: colors.text }]}>Settings</Text>

      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Server URL</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Where your Git1 backend is running. Use the PC's LAN IP, e.g.
          {' '}<Text style={{ color: colors.text }}>http://192.168.1.42:8080</Text>.
        </Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.42:8080"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />
        <Button label="Save server URL" onPress={save} loading={saving} />
        {savedAt && (
          <Text style={[typography.caption, { color: colors.success }]}>
            Saved. New requests use this URL immediately.
          </Text>
        )}
      </Card>

      <Card>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Signed in as</Text>
        <Text style={[typography.body, { color: colors.text }]}>{email ?? '—'}</Text>
      </Card>

      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Pair a new device</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Install the Git1 agent on your child's PC and enter the 6-digit code shown there.
        </Text>
        <Button label="Enter pairing code" onPress={() => router.push('/pair')} />
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <Button label="Sign out" variant="danger" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});
