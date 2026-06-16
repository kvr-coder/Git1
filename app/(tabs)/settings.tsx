import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [tamperOn, setTamperOn] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setUrl(getApiBase());
    (async () => {
      try {
        const p = await realApi.getPrefs();
        setQuietFrom(p.quietFromMin >= 0 ? fmtHHMM(p.quietFromMin) : '');
        setQuietTo(p.quietToMin >= 0 ? fmtHHMM(p.quietToMin) : '');
        setSummaryOn(p.dailySummaryOn);
        setTamperOn(!!p.tamperAlertsOn);
      } catch {}
    })();
  }, []);

  const savePrefs = async () => {
    const f = parseHHMM(quietFrom);
    const t = parseHHMM(quietTo);
    try {
      await realApi.setPrefs({ quietFromMin: f, quietToMin: t, dailySummaryOn: summaryOn, tamperAlertsOn: tamperOn });
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
          • Lock/unlock events{'\n'}
          • Your settings: schedule, blocklist, daily limit, bank balance
        </Text>
        <Text style={[typography.h3, { color: colors.text, marginTop: spacing.sm }]}>
          What we never collect
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          • Messages, DMs, screenshots, search history{'\n'}
          • Browsing URLs{'\n'}
          • No third-party ad SDKs. No analytics. No data sale, ever.
        </Text>
        <Text style={[typography.h3, { color: colors.text, marginTop: spacing.sm }]}>
          Where it lives
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          Honestly: on our timeoff server ({getApiBase()}) so the kid PC and your
          phone can sync through it. We don&apos;t sell it, share it, or analyse it
          — but it does pass through us. Open source — every line is on GitHub.
          {'\n\n'}
          For maximum privacy you can self-host the server (free, takes ~10 min)
          and point this app at it via &quot;Server URL&quot; below — then your data
          literally never touches us.
        </Text>
        <Button
          label="Show your kid what's tracked"
          variant="secondary"
          icon="eye-outline"
          onPress={() => Linking.openURL(`${getApiBase()}/kid`).catch(() => {})}
        />
        <Button
          label="Clear my history on the server"
          variant="secondary"
          icon="trash-outline"
          onPress={() => {
            Alert.alert(
              'Clear server history?',
              'Drops every activity log, request, chore, bank ledger entry, stat, photo, and location from our server. Your paired kid PCs and your settings (schedule, blocklist, limit, bank balance) are NOT touched.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const r = await realApi.clearHistory();
                      const total = Object.values(r.tables ?? {}).reduce((s, n) => s + n, 0);
                      Alert.alert('Cleared', `${total} server-side records removed. Devices and settings untouched.`);
                    } catch (e: any) {
                      Alert.alert('Could not clear', e?.message ?? 'network error');
                    }
                  },
                },
              ],
            );
          }}
        />
        <Button
          label="Delete my account & all data"
          variant="danger"
          icon="warning-outline"
          onPress={() => setDeleteOpen(true)}
        />
      </Card>

      {/* Delete confirm — typed phrase + email match, two factors. */}
      <Modal
        visible={deleteOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: spacing.lg }}
          onPress={() => !deleting && setDeleteOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}
          >
            <Text style={[typography.h2, { color: colors.danger }]}>Delete account?</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Wipes everything tied to this account from our server: devices,
              schedules, history, settings — everything. Every paired kid PC
              will fail to reconnect and need re-pairing.
            </Text>
            <Text style={[typography.caption, { color: colors.text, marginTop: spacing.sm }]}>
              Type <Text style={{ fontWeight: '700' }}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              value={deletePhrase}
              onChangeText={setDeletePhrase}
              autoCapitalize="characters"
              placeholder="DELETE"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
            />
            <Text style={[typography.caption, { color: colors.text, marginTop: spacing.xs }]}>
              Confirm account email:
            </Text>
            <TextInput
              value={deleteEmail}
              onChangeText={setDeleteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={email ?? 'you@example.com'}
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setDeleteOpen(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Delete"
                  variant="danger"
                  loading={deleting}
                  disabled={deletePhrase !== 'DELETE' || !deleteEmail.trim()}
                  onPress={async () => {
                    setDeleting(true);
                    try {
                      await realApi.deleteAccount(deleteEmail.trim());
                      await signOut();
                      setDeleteOpen(false);
                      Alert.alert('Done', 'Account deleted. Signed out.');
                    } catch (e: any) {
                      Alert.alert('Could not delete', e?.message ?? 'network error');
                    } finally {
                      setDeleting(false);
                    }
                  }}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>“Agent offline” alerts</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Off by default. A PC that&apos;s simply turned off (asleep, outdoors) looks
              like tampering — leave off unless you want those pings.
            </Text>
          </View>
          <Button
            label={tamperOn ? 'On' : 'Off'}
            variant={tamperOn ? 'primary' : 'secondary'}
            onPress={() => setTamperOn(!tamperOn)}
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
        timeoff • v1.1 • rev 11 • OTA OK
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
