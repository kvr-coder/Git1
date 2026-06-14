import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiBanner } from '../../components/ApiBanner';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SectionHeader, Segmented } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { getApiBase, setServerUrl } from '../../lib/config';
import { ThemePref, useTheme } from '../../lib/ThemeContext';
import { radius, spacing, typography } from '../../lib/theme';

export default function Settings() {
  const { colors, pref, setPref } = useTheme();
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
      <Text style={[typography.display, { color: colors.text }]}>Settings</Text>
      <ApiBanner />

      <SectionHeader>Appearance</SectionHeader>
      <Card>
        <Segmented<ThemePref>
          value={pref}
          onChange={setPref}
          options={[
            { key: 'light', label: 'Light', icon: 'sunny-outline' },
            { key: 'dark', label: 'Dark', icon: 'moon-outline' },
            { key: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
          ]}
        />
      </Card>

      <SectionHeader>Account</SectionHeader>
      <Card>
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={34} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Signed in as</Text>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{email ?? '—'}</Text>
          </View>
        </View>
      </Card>

      <SectionHeader>Devices</SectionHeader>
      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: colors.text }]}>Pair a new device</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Install the agent on the PC, then enter its 6-digit code.
            </Text>
          </View>
          <Button label="Pair" icon="add" onPress={() => router.push('/pair')} />
        </View>
      </Card>

      <SectionHeader>Connection</SectionHeader>
      <Card>
        <Text style={[typography.h3, { color: colors.text }]}>Server URL</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          The backend address. Default points at the cloud server.
        </Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://git1-server.onrender.com"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
        />
        <Button label="Save" variant="secondary" onPress={save} loading={saving} />
        {savedAt && (
          <Text style={[typography.caption, { color: colors.success }]}>Saved ✓</Text>
        )}
      </Card>

      <SectionHeader>Help</SectionHeader>
      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: colors.text }]}>Report a bug</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Tell us what broke. We get your version + platform automatically.
            </Text>
          </View>
          <Button label="Send" icon="bug-outline" onPress={() => router.push('/feedback')} />
        </View>
      </Card>

      <View style={{ marginTop: spacing.md }}>
        <Button label="Sign out" variant="danger" icon="log-out-outline" onPress={signOut} />
      </View>

      <Text style={[typography.caption, { color: colors.textFaint, textAlign: 'center', marginTop: spacing.md }]}>
        timeoff • v1.0 • rev 3
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    marginTop: spacing.xs,
  },
});
