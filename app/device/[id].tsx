import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { formatDuration, formatRelative } from '../../lib/format';
import { colors, spacing, typography } from '../../lib/theme';
import type { Device } from '../../lib/types';

export default function DeviceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [device, setDevice] = useState<Device | undefined>();
  const [busy, setBusy] = useState(false);

  const refresh = () => api.getDevice(id).then(setDevice);
  useEffect(() => {
    refresh();
  }, [id]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!device) {
    return (
      <Screen>
        <Text style={{ color: colors.textMuted }}>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.h1, { color: colors.text }]}>{device.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {device.ownerName} · {device.platform} · last seen {formatRelative(device.lastSeen)}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <StatusBadge status={device.status} />
        </View>
      </View>

      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Today</Text>
        <Text style={[typography.body, { color: colors.text }]}>
          {formatDuration(device.usedTodayMinutes)} of {formatDuration(device.dailyLimitMinutes)} used
        </Text>
      </Card>

      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Controls</Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Lock now"
            variant="danger"
            loading={busy}
            onPress={() => run(() => api.lockDevice(device.id))}
          />
          <Button
            label="Unlock"
            loading={busy}
            onPress={() => run(() => api.unlockDevice(device.id))}
          />
          <Button
            label="Grant +15 min"
            variant="secondary"
            loading={busy}
            onPress={() => run(() => api.grantBonusMinutes(device.id, 15))}
          />
        </View>
      </Card>
    </Screen>
  );
}
