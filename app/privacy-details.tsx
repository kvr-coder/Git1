// What's stored on the server — explicit, honest, category-by-category.
// Linked from Settings → Privacy. Mirrors the actual server schema 1:1.
// If the schema changes, update this file alongside.
import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/ui';
import { getApiBase } from '../lib/config';
import { useTheme } from '../lib/ThemeContext';
import { spacing, typography } from '../lib/theme';

interface Row { label: string; kept: string; why: string; sensitivity: 'low' | 'mid' | 'high' }

const ESSENTIAL: Row[] = [
  { label: 'Email + password hash',           kept: 'Until you delete the account',  why: 'Log you in',                                                       sensitivity: 'mid' },
  { label: 'Session tokens',                  kept: 'Until you sign out',            why: 'Stay signed in on this phone',                                     sensitivity: 'low' },
  { label: 'Push tokens (iOS / Web Push)',    kept: 'Until you remove the device',   why: 'So we can reach your phone with alerts',                           sensitivity: 'low' },
  { label: 'Paired kid PCs (id, name, agent token)', kept: 'Until you unpair',       why: 'So the kid PC can reconnect after restarts',                       sensitivity: 'mid' },
  { label: 'Pairing codes (6-digit)',         kept: 'Auto-deleted after 10 min',     why: 'One-shot, then gone',                                              sensitivity: 'low' },
  { label: 'Co-parent links',                 kept: 'Until you unlink',              why: 'So both parents see the same kid',                                 sensitivity: 'low' },
];

const SETTINGS: Row[] = [
  { label: 'Daily limit, schedule, blocklist, bank balance, ND mode, vacation', kept: 'Until you change them', why: 'Kid PC needs them on every reconnect', sensitivity: 'mid' },
  { label: 'Chore templates ("Make bed → +5m")', kept: 'Until you delete them', why: 'So the kid sees the same options on their dashboard', sensitivity: 'low' },
  { label: 'Geofences (zones you defined)',   kept: 'Until you delete them',          why: 'Only present if you ever set one up',                              sensitivity: 'mid' },
];

const HISTORY: Row[] = [
  { label: 'Activity log: lock / unlock / "limit reached" events', kept: 'Until you clear history',          why: 'For the Activity tab',                       sensitivity: 'mid' },
  { label: 'Time requests ("+15 min please")',                     kept: 'Until you clear history',          why: 'So you can review past requests',            sensitivity: 'mid' },
  { label: 'Chore submissions (description + minutes)',            kept: 'Until you clear history',          why: 'Review + approve flow',                      sensitivity: 'mid' },
  { label: 'Bank ledger (every credit/debit)',                     kept: 'Until you clear history',          why: 'So Bank screen shows history',               sensitivity: 'low' },
  { label: 'Daily stats: minutes used + per-app minutes',          kept: 'Until you clear history',          why: 'For the Stats tab (week-over-week trends)',  sensitivity: 'mid' },
  { label: 'Location points + geofence enter/exit',                kept: 'Last 100 per device, then trims', why: 'Only if you ever uploaded location',         sensitivity: 'high' },
  { label: 'Photo check-ins (base64 JPEGs)',                       kept: 'Until you clear history',          why: 'Only if your kid ever sent one',             sensitivity: 'high' },
  { label: 'Bug reports you submit via "Report a bug"',            kept: 'Indefinitely',                     why: 'So we can fix what you reported',            sensitivity: 'low' },
];

const NEVER = [
  'Message contents (DMs, Discord, iMessage, anything)',
  'Screenshots or screen contents',
  'Search history',
  'Browsing URLs',
  'Any third-party analytics SDKs',
  'Any advertising IDs',
  'Sale or sharing of any data with anyone, ever',
];

export default function PrivacyDetails() {
  const { colors } = useTheme();
  const tone = (s: Row['sensitivity']) =>
    s === 'high' ? colors.danger : s === 'mid' ? colors.warning : colors.success;

  return (
    <Screen>
      <Text style={[typography.display, { color: colors.text }]}>What&apos;s on our server</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Every category of data we hold, why we hold it, and how long. Mirrors
        the actual database schema. Server: {getApiBase()}
      </Text>

      <SectionHeader>Account & plumbing — required</SectionHeader>
      {ESSENTIAL.map((r, i) => <RowCard key={i} row={r} tone={tone(r.sensitivity)} />)}

      <SectionHeader>Settings — required for the kid PC to sync</SectionHeader>
      {SETTINGS.map((r, i) => <RowCard key={i} row={r} tone={tone(r.sensitivity)} />)}

      <SectionHeader>History — wipeable any time</SectionHeader>
      {HISTORY.map((r, i) => <RowCard key={i} row={r} tone={tone(r.sensitivity)} />)}
      <Card>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Use <Text style={{ color: colors.text, fontWeight: '600' }}>&quot;Clear my history on the server&quot;</Text> in
          Settings → Privacy to drop everything in this section without
          unpairing your devices.
        </Text>
      </Card>

      <SectionHeader>Never collected</SectionHeader>
      <Card>
        {NEVER.map((line, i) => (
          <View key={i} style={styles.neverRow}>
            <Ionicons name="close-circle" size={16} color={colors.danger} />
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{line}</Text>
          </View>
        ))}
      </Card>

      <SectionHeader>Where it lives</SectionHeader>
      <Card>
        <Text style={[typography.body, { color: colors.text }]}>
          Currently on the timeoff server at <Text style={{ fontWeight: '600' }}>{getApiBase()}</Text>.
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          The server is open source. For maximum privacy, self-host it (free,
          ~10 min) and change the Server URL in Settings — then your data
          literally never touches us.
        </Text>
        <Text
          style={[typography.caption, { color: colors.primary, marginTop: spacing.sm, fontWeight: '600' }]}
          onPress={() => Linking.openURL('https://github.com/kvr-coder/git1').catch(() => {})}
        >
          See the code on GitHub →
        </Text>
      </Card>

      <Card>
        <Text style={[typography.h3, { color: colors.text }]}>The bottom line</Text>
        <Text style={[typography.body, { color: colors.text, marginTop: spacing.xs }]}>
          We hold what we need to operate the product. We never sell, share,
          or analyse it. You can wipe the history any time and delete the
          account whenever you want — both buttons live in Settings → Privacy.
        </Text>
      </Card>
    </Screen>
  );
}

function RowCard({ row, tone }: { row: Row; tone: string }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>{row.label}</Text>
      </View>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{row.why}</Text>
      <Text style={[typography.tiny, { color: colors.textFaint, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
        Kept: {row.kept}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  neverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
});
