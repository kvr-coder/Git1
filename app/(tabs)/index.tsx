import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { DeviceCard } from '../../components/DeviceCard';
import { RequestCard } from '../../components/RequestCard';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { colors, spacing, typography } from '../../lib/theme';
import type { Device, TimeRequest } from '../../lib/types';

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [requests, setRequests] = useState<TimeRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [ds, rs] = await Promise.all([api.listDevices(), api.listRequests('pending')]);
    setDevices(ds);
    setRequests(rs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
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

  const nameOf = (deviceId: string) => devices.find((d) => d.id === deviceId)?.name;

  return (
    <Screen>
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
      </View>
      {devices.map((d) => (
        <DeviceCard key={d.id} device={d} />
      ))}
    </Screen>
  );
}
