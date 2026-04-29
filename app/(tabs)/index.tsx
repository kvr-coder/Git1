import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { DeviceCard } from '../../components/DeviceCard';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { colors, spacing, typography } from '../../lib/theme';
import type { Device } from '../../lib/types';

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    api.listDevices().then(setDevices);
  }, []);

  return (
    <Screen>
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
