import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import type { DeviceStatus } from '../lib/types';

const palette: Record<DeviceStatus, { bg: string; fg: string; label: string }> = {
  online: { bg: '#1E3A2A', fg: colors.success, label: 'Online' },
  offline: { bg: '#2A2F3D', fg: colors.textMuted, label: 'Offline' },
  locked: { bg: '#3A1E1E', fg: colors.danger, label: 'Locked' },
};

export function StatusBadge({ status }: { status: DeviceStatus }) {
  const p = palette[status];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <Text style={[styles.text, { color: p.fg }]}>{p.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
