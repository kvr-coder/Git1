import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { ChoreCard } from '../../components/ChoreCard';
import { DeviceCard } from '../../components/DeviceCard';
import { FamilyRecap } from '../../components/FamilyRecap';
import { RequestCard } from '../../components/RequestCard';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/ui';
import { Card } from '../../components/Card';
import { api } from '../../lib/api';
import { useTheme } from '../../lib/ThemeContext';
import { spacing, typography } from '../../lib/theme';
import type { ChoreRequest, Device, TimeRequest } from '../../lib/types';
import { AnimatedNumber, BounceIn } from '../../components/animated';
import { Confetti } from '../../components/Confetti';
import { RingingBell, WaveIcon } from '../../components/AnimatedIcons';
import Animated, { FadeInDown } from 'react-native-reanimated';

function greetingMeta(): { text: string; icon: keyof typeof Ionicons.glyphMap; tint: 'morning' | 'day' | 'evening' } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', icon: 'sunny', tint: 'morning' };
  if (h < 18) return { text: 'Good afternoon', icon: 'partly-sunny', tint: 'day' };
  return { text: 'Good evening', icon: 'moon', tint: 'evening' };
}

export default function Home() {
  const { colors } = useTheme();
  const { email } = useAuth();
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [requests, setRequests] = useState<TimeRequest[]>([]);
  const [chores, setChores] = useState<ChoreRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const [ds, rs, cs] = await Promise.all([
      api.listDevices(),
      api.listRequests('pending'),
      api.listChores('pending'),
    ]);
    setDevices(ds);
    setRequests(rs);
    setChores(cs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const id = setInterval(refresh, 5000);
      return () => clearInterval(id);
    }, [refresh]),
  );

  const onPull = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const [confettiKey, setConfettiKey] = useState(0);

  const resolve = async (req: TimeRequest, status: 'approved' | 'denied') => {
    setBusyId(req.id);
    try {
      await api.resolveRequest(req.id, status);
      if (status === 'approved') setConfettiKey((k) => k + 1);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };
  const resolveChore = async (c: ChoreRequest, status: 'approved' | 'denied', minutes?: number) => {
    setBusyId(c.id);
    try {
      await api.resolveChore(c.id, status, minutes);
      if (status === 'approved') setConfettiKey((k) => k + 1);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const nameOf = (deviceId: string) => devices.find((d) => d.id === deviceId)?.name;
  const attention = requests.length + chores.length;
  const onlineCount = devices.filter((d) => d.status !== 'offline').length;
  // First word of the email's local part — drops surnames after dots/underscores
  // (e.g. "linas.kvaraciejus@…" → "linas"). Falls back to "there".
  const name = (() => {
    if (!email) return 'there';
    const local = email.split('@')[0];
    const first = local.split(/[._-]/)[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'there';
  })();

  const meta = greetingMeta();
  const greetingColor = meta.tint === 'morning' ? colors.warning : meta.tint === 'day' ? colors.info : colors.primary;

  return (
    <>
    <Confetti trigger={confettiKey} />
    <Screen refreshing={refreshing} onRefresh={onPull}>
      {/* Greeting */}
      <View style={{ marginBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={[styles.greetIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name={meta.icon} size={22} color={greetingColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{meta.text},</Text>
          <Text style={[typography.display, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        <Card style={{ flex: 1 } as any}>
          <View style={styles.summaryHead}>
            <Ionicons name="desktop-outline" size={16} color={colors.textMuted} />
            <Text style={[typography.tiny, { color: colors.textFaint }]}>DEVICES</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <AnimatedNumber
              value={onlineCount}
              format={(n) => Math.round(n).toString()}
              style={[typography.stat, { color: colors.text, fontSize: 28 }]}
            />
            <Text style={[typography.bodyStrong, { color: colors.textMuted }]}>
              / {devices.length || 0}
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>online</Text>
        </Card>
        <BounceIn trigger={attention} style={{ flex: 1 }}>
          <Card style={{ flex: 1 } as any} accent={attention ? colors.warning : undefined}>
            <View style={styles.summaryHead}>
              <RingingBell
                size={16}
                color={attention ? colors.warning : colors.textMuted}
                trigger={attention}
              />
              <Text style={[typography.tiny, { color: colors.textFaint }]}>INBOX</Text>
            </View>
            <AnimatedNumber
              value={attention}
              format={(n) => Math.round(n).toString()}
              style={[
                typography.stat,
                { color: attention ? colors.warning : colors.text, fontSize: 28 },
              ]}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>need your reply</Text>
          </Card>
        </BounceIn>
      </View>

      {/* Needs attention */}
      {attention > 0 && (
        <>
          <SectionHeader>Needs your attention</SectionHeader>
          {chores.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 60).springify().damping(14)}>
              <ChoreCard
                chore={c}
                deviceName={nameOf(c.deviceId)}
                busy={busyId === c.id}
                onApprove={(m) => resolveChore(c, 'approved', m)}
                onDeny={() => resolveChore(c, 'denied')}
              />
            </Animated.View>
          ))}
          {requests.map((r, i) => (
            <Animated.View key={r.id} entering={FadeInDown.delay((chores.length + i) * 60).springify().damping(14)}>
              <RequestCard
                request={r}
                deviceName={nameOf(r.deviceId)}
                busy={busyId === r.id}
                onApprove={() => resolve(r, 'approved')}
                onDeny={() => resolve(r, 'denied')}
              />
            </Animated.View>
          ))}
        </>
      )}

      {/* Family-wide weekly recap (self-hides until there is real data). */}
      <FamilyRecap devices={devices} />

      {/* Devices */}
      <SectionHeader>Devices</SectionHeader>
      {devices.length === 0 ? (
        <Pressable onPress={() => router.push('/pair')}>
          <Card raised accent={colors.primary} style={{ alignItems: 'center', paddingVertical: spacing.xl } as any}>
            <WaveIcon size={120} />
            <Text style={[typography.h2, { color: colors.text, marginTop: spacing.sm }]}>
              No devices showing yet
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 2 }]}>
              If your kid&apos;s PC is paired, it&apos;ll appear here automatically the next time the agent
              connects — server restarts can briefly clear this list, the agent re-registers itself.
              {'\n\n'}New family? Tap below to pair your first device.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.bodyStrong, { color: colors.primary }]}>Pair a device →</Text>
            </View>
          </Card>
        </Pressable>
      ) : (
        <>
          {devices.map((d, i) => (
            <Animated.View key={d.id} entering={FadeInDown.delay(i * 70).springify().damping(14)}>
              <DeviceCard device={d} />
            </Animated.View>
          ))}
          {/* Always-visible CTA so adding another PC isn't buried in Settings. */}
          <Pressable onPress={() => router.push('/pair')}>
            <View style={[styles.addRow, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={[typography.bodyStrong, { color: colors.primary }]}>
                Pair another device
              </Text>
            </View>
          </Pressable>
        </>
      )}
    </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  greetIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  bigIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
