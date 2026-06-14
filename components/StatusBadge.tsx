import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { radius, spacing, typography } from '../lib/theme';
import type { DeviceStatus } from '../lib/types';

export function StatusBadge({ status }: { status: DeviceStatus }) {
  const { colors } = useTheme();
  const map: Record<DeviceStatus, { bg: string; fg: string; label: string }> = {
    online: { bg: colors.successSoft, fg: colors.success, label: 'Online' },
    offline: { bg: colors.surfaceAlt, fg: colors.textMuted, label: 'Offline' },
    locked: { bg: colors.dangerSoft, fg: colors.danger, label: 'Locked' },
  };
  const p = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <View style={[styles.dot, { backgroundColor: p.fg }]} />
      <Text style={[typography.tiny, { color: p.fg }]}>{p.label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
