import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';
import { formatDuration, formatRelative } from '../lib/format';
import type { Device } from '../lib/types';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

export function DeviceCard({ device }: { device: Device }) {
  const pct = Math.min(1, device.usedTodayMinutes / Math.max(1, device.dailyLimitMinutes));
  return (
    <Link href={`/device/${device.id}`} asChild>
      <Pressable>
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h2, { color: colors.text }]}>{device.name}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {device.ownerName} · {device.platform} · {formatRelative(device.lastSeen)}
              </Text>
            </View>
            <StatusBadge status={device.status} />
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${pct * 100}%`,
                  backgroundColor: pct >= 1 ? colors.danger : colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatDuration(device.usedTodayMinutes)} of {formatDuration(device.dailyLimitMinutes)} used
            today
          </Text>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  barTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
});
