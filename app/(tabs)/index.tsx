import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { ChoreCard } from '../../components/ChoreCard';
import { DeviceCard } from '../../components/DeviceCard';
import { RequestCard } from '../../components/RequestCard';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/ui';
import { Card } from '../../components/Card';
import { api } from '../../lib/api';
import { useTheme } from '../../lib/ThemeContext';
import { spacing, typography } from '../../lib/theme';
import type { ChoreRequest, Device, TimeRequest } from '../../lib/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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

  const resolve = async (req: TimeRequest, status: 'approved' | 'denied') => {
    setBusyId(req.id);
    try {
      await api.resolveRequest(req.id, status);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };
  const resolveChore = async (c: ChoreRequest, status: 'approved' | 'denied', minutes?: number) => {
    setBusyId(c.id);
    try {
      await api.resolveChore(c.id, status, minutes);
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

  return (
    <Screen refreshing={refreshing} onRefresh={onPull}>
      {/* Greeting */}
      <View style={{ marginBottom: spacing.xs }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{greeting()},</Text>
        <Text style={[typography.display, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        <Card style={{ flex: 1 } as any}>
          <Text style={[typography.stat, { color: colors.text, fontSize: 28 }]}>
            {onlineCount}/{devices.length || 0}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>devices online</Text>
        </Card>
        <Card style={{ flex: 1 } as any} accent={attention ? colors.warning : undefined}>
          <Text
            style={[
              typography.stat,
              { color: attention ? colors.warning : colors.text, fontSize: 28 },
            ]}
          >
            {attention}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>need your reply</Text>
        </Card>
      </View>

      {/* Needs attention */}
      {attention > 0 && (
        <>
          <SectionHeader>Needs your attention</SectionHeader>
          {chores.map((c) => (
            <ChoreCard
              key={c.id}
              chore={c}
              deviceName={nameOf(c.deviceId)}
              busy={busyId === c.id}
              onApprove={(m) => resolveChore(c, 'approved', m)}
              onDeny={() => resolveChore(c, 'denied')}
            />
          ))}
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              deviceName={nameOf(r.deviceId)}
              busy={busyId === r.id}
              onApprove={() => resolve(r, 'approved')}
              onDeny={() => resolve(r, 'denied')}
            />
          ))}
        </>
      )}

      {/* Devices */}
      <SectionHeader>Devices</SectionHeader>
      {devices.length === 0 ? (
        <Pressable onPress={() => router.push('/pair')}>
          <Card raised accent={colors.primary} style={{ alignItems: 'center', paddingVertical: spacing.xl } as any}>
            <View style={[styles.bigIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="add" size={32} color={colors.primary} />
            </View>
            <Text style={[typography.h2, { color: colors.text, marginTop: spacing.sm }]}>
              Pair your first device
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 2 }]}>
              Install the agent on the kid's PC, then tap here to enter the 6-digit code it shows.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.bodyStrong, { color: colors.primary }]}>Start setup →</Text>
            </View>
          </Card>
        </Pressable>
      ) : (
        <>
          {devices.map((d) => <DeviceCard key={d.id} device={d} />)}
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
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
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
