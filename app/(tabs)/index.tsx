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
  const name = email ? email.split('@')[0] : 'there';

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
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl } as any}>
            <Ionicons name="add-circle-outline" size={40} color={colors.primary} />
            <Text style={[typography.h3, { color: colors.text, marginTop: spacing.sm }]}>
              Pair your first device
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              Install the agent on your kid's PC, then tap here to enter the code.
            </Text>
          </Card>
        </Pressable>
      ) : (
        devices.map((d) => <DeviceCard key={d.id} device={d} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
});
