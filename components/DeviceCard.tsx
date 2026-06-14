import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { formatDuration, formatRelative } from '../lib/format';
import { radius, spacing, typography } from '../lib/theme';
import type { Device } from '../lib/types';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';
import { TimeBar } from './ui';

export function DeviceCard({ device }: { device: Device }) {
  const { colors } = useTheme();
  const limit = Math.max(1, device.dailyLimitMinutes);
  const pct = Math.min(1, device.usedTodayMinutes / limit);
  const left = Math.max(0, device.dailyLimitMinutes - device.usedTodayMinutes);
  const leftColor = pct >= 1 ? colors.danger : pct >= 0.8 ? colors.warning : colors.success;
  const accent =
    device.status === 'locked' ? colors.danger : device.status === 'offline' ? colors.border : colors.primary;

  return (
    <Link href={`/device/${device.id}`} asChild>
      <Pressable>
        <Card raised accent={accent}>
          <View style={styles.top}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h2, { color: colors.text }]} numberOfLines={1}>
                {device.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {device.ownerName} · seen {formatRelative(device.lastSeen)}
              </Text>
            </View>
            <StatusBadge status={device.status} />
          </View>
          {/* Affordance: make it obvious the whole card is tappable. */}
          <View style={styles.tapHint}>
            <Text style={[typography.tiny, { color: colors.textFaint }]}>TAP TO MANAGE</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </View>

          <View style={styles.metrics}>
            <View>
              <Text style={[typography.h1, { color: leftColor, fontSize: 30 }]}>
                {device.dailyLimitMinutes === 0 ? '∞' : formatDuration(left)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {device.dailyLimitMinutes === 0 ? 'no limit today' : 'left today'}
              </Text>
            </View>
            <View style={styles.rightMeta}>
              {device.internetBlocked ? (
                <View style={[styles.tag, { backgroundColor: colors.warningSoft }]}>
                  <Ionicons name="globe-outline" size={13} color={colors.warning} />
                  <Text style={[typography.tiny, { color: colors.warning }]}>NET OFF</Text>
                </View>
              ) : null}
              {device.bankedMinutes > 0 ? (
                <View style={[styles.tag, { backgroundColor: colors.successSoft }]}>
                  <Ionicons name="wallet-outline" size={13} color={colors.success} />
                  <Text style={[typography.tiny, { color: colors.success }]}>
                    {device.bankedMinutes}m BANK
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <TimeBar pct={pct} />
          <Text style={[typography.caption, { color: colors.textFaint }]}>
            {formatDuration(device.usedTodayMinutes)} of{' '}
            {device.dailyLimitMinutes === 0 ? '∞' : formatDuration(device.dailyLimitMinutes)} used
          </Text>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metrics: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  rightMeta: { alignItems: 'flex-end', gap: spacing.xs },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginTop: 2,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
