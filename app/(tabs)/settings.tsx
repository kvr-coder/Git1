import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiBanner } from '../../components/ApiBanner';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SectionHeader, Segmented } from '../../components/ui';
import { realApi } from '../../lib/api.real';
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
  const [quietFrom, setQuietFrom] = useState('');
  const [quietTo, setQuietTo] = useState('');
  const [summaryOn, setSummaryOn] = useState(true);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    setUrl(getApiBase());
    (async () => {
      try {
        const p = await realApi.getPrefs();
        setQuietFrom(p.quietFromMin >= 0 ? fmtHHMM(p.quietFromMin) : '');
        setQuietTo(p.quietToMin >= 0 ? fmtHHMM(p.quietToMin) : '');
        setSummaryOn(p.dailySummaryOn);
      } catch {}
    })();
  }, []);

  const savePrefs = async () => {
    const f = parseHHMM(quietFrom);
    const t = parseHHMM(quietTo);
    try {
      await realApi.setPrefs({ quietFromMin: f, quietToMin: t, dailySummaryOn: summaryOn });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 1500);
    } catch {}
  };

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

      <SectionHeader>Privacy</SectionHeader>
      <Card>
        <Text style={[typography.h3, { color: colors.text }]}>What we collect</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          • Used minutes + app names on the kid PC (not chats, not screen contents){'\n'}
          • Time/chore requests your kid sends{'\n'}
          • Lock/unlock events
        </Text>
        <Text style={[typography.h3, { color: colors.text, marginTop: spacing.sm }]}>
          What we never collect
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          • Messages, DMs, screenshots, search history{'\n'}
          • Browsing URLs{'\n'}
          • No third-party ad SDKs. No analytics. No data sale, ever.
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
          Data lives only on your server ({getApiBase()}). EPFL found ~70% of
          parental-control apps share kid data without consent. timeoff is built
          to be the opposite.
        </Text>
        <Button
          label="Show your kid what's tracked"
          variant="secondary"
          icon="eye-outline"
          onPress={() => Linking.openURL(`${getApiBase()}/kid`).catch(() => {})}
        />
      </Card>

      <SectionHeader>Notifications</SectionHeader>
      <Card>
        <Text style={[typography.h3, { color: colors.text }]}>Quiet hours</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Don&apos;t ping during these hours (24h, e.g. 23:00 → 07:00). Leave blank for no quiet hours.
          Urgent alerts (tamper, clock changes) still come through.
        </Text>
        <View style={[styles.row, { marginTop: spacing.xs }]}>
          <TextInput
            value={quietFrom}
            onChangeText={setQuietFrom}
            placeholder="23:00"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, flex: 1 }]}
          />
          <Text style={[typography.body, { color: colors.textMuted }]}>→</Text>
          <TextInput
            value={quietTo}
            onChangeText={setQuietTo}
            placeholder="07:00"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, flex: 1 }]}
          />
        </View>
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Daily summary at 21:00</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              One push per evening: used minutes, requests, chores.
            </Text>
          </View>
          <Button
            label={summaryOn ? 'On' : 'Off'}
            variant={summaryOn ? 'primary' : 'secondary'}
            onPress={() => setSummaryOn(!summaryOn)}
          />
        </View>
        <Button label="Save" variant="secondary" onPress={savePrefs} />
        {prefsSaved && (
          <Text style={[typography.caption, { color: colors.success }]}>Saved ✓</Text>
        )}
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
        timeoff • v1.1 • rev 10 • OTA LIVE
      </Text>
    </Screen>
  );
}

function parseHHMM(s: string): number {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 23 || mm > 59) return -1;
  return h * 60 + mm;
}
function fmtHHMM(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
