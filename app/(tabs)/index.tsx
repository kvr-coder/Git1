import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { ChoreCard } from '../../components/ChoreCard';
import { DeviceCard } from '../../components/DeviceCard';
import { RequestCard } from '../../components/RequestCard';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { colors, spacing, typography } from '../../lib/theme';
import type { ChoreRequest, Device, TimeRequest } from '../../lib/types';

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [requests, setRequests] = useState<TimeRequest[]>([]);
  const [chores, setChores] = useState<ChoreRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const resolve = async (req: TimeRequest, status: 'approved' | 'denied') => {
    setBusyId(req.id);
    try {
      await api.resolveRequest(req.id, status);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const resolveChore = async (
    chore: ChoreRequest,
    status: 'approved' | 'denied',
    minutes?: number,
  ) => {
    setBusyId(chore.id);
    try {
      await api.resolveChore(chore.id, status, minutes);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const nameOf = (deviceId: string) => devices.find((d) => d.id === deviceId)?.name;

  return (
    <Screen>
      {chores.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.h2, { color: colors.text }]}>
            Chores ({chores.length})
          </Text>
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
        </View>
      )}
      {requests.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.h2, { color: colors.text }]}>
            Pending requests ({requests.length})
          </Text>
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
        </View>
      )}
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.h1, { color: colors.text }]}>Devices</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Tap a device to lock, unlock, or grant time.
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          timeoff • OTA rev 2 ✓
        </Text>
      </View>
      {devices.map((d) => (
        <DeviceCard key={d.id} device={d} />
      ))}
    </Screen>
  );
}
