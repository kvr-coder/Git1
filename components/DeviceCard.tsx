import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { formatDuration, formatRelative } from '../lib/format';
import { radius, spacing, typography } from '../lib/theme';
import type { Device } from '../lib/types';
import { AnimatedBar, AnimatedNumber } from './animated';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

export function DeviceCard({ device }: { device: Device }) {
  const { colors } = useTheme();
  const limit = Math.max(1, device.dailyLimitMinutes);
  const pct = Math.min(1, device.usedTodayMinutes / limit);
  const left = Math.max(0, device.dailyLimitMinutes - device.usedTodayMinutes);
  const leftColor = pct >= 1 ? colors.danger : pct >= 0.8 ? colors.warning : colors.success;
  const accent =
    device.status === 'locked' ? colors.danger : device.status === 'offline' ? colors.border : colors.primary;
  const platformIcon: keyof typeof Ionicons.glyphMap =
    device.platform === 'macos' ? 'logo-apple' : device.platform === 'linux' ? 'logo-tux' : 'logo-windows';

  return (
    <Link href={`/device/${device.id}`} asChild>
      <Pressable>
        <Card raised accent={accent}>
          <View style={styles.top}>
            <View style={styles.titleRow}>
              <Ionicons name={platformIcon} size={18} color={colors.textMuted} />
              <Text style={[typography.h2, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                {device.name}
              </Text>
            </View>
            <StatusBadge status={device.status} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {device.ownerName} · seen {formatRelative(device.lastSeen)}
          </Text>

          <View style={styles.metrics}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Ionicons name="time-outline" size={20} color={leftColor} />
              {device.dailyLimitMinutes === 0 ? (
                <Text style={[typography.h1, { color: leftColor, fontSize: 30 }]}>∞</Text>
              ) : (
                <AnimatedNumber
                  value={left}
                  format={(n) => formatDuration(Math.max(0, Math.round(n)))}
                  style={[typography.h1, { color: leftColor, fontSize: 30 }]}
                />
              )}
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {device.dailyLimitMinutes === 0 ? 'no limit' : 'left'}
              </Text>
            </View>
            <View style={styles.rightMeta}>
              {device.internetBlocked ? (
                <View style={[styles.tag, { backgroundColor: colors.warningSoft }]}>
                  <Ionicons name="cloud-offline-outline" size={13} color={colors.warning} />
                  <Text style={[typography.tiny, { color: colors.warning }]}>NET OFF</Text>
                </View>
              ) : null}
              {device.bankedMinutes > 0 ? (
                <View style={[styles.tag, { backgroundColor: colors.successSoft }]}>
                  <Ionicons name="wallet" size={13} color={colors.success} />
                  <Text style={[typography.tiny, { color: colors.success }]}>
                    {device.bankedMinutes}m BANK
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <AnimatedBar
            pct={pct}
            track={colors.track}
            green={colors.success}
            amber={colors.warning}
            red={colors.danger}
          />

          <View style={styles.bottomRow}>
            <Text style={[typography.caption, { color: colors.textFaint }]}>
              {formatDuration(device.usedTodayMinutes)} of{' '}
              {device.dailyLimitMinutes === 0 ? '∞' : formatDuration(device.dailyLimitMinutes)} used
            </Text>
            <View style={styles.tapHint}>
              <Text style={[typography.tiny, { color: colors.primary }]}>MANAGE</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  metrics: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  rightMeta: { alignItems: 'flex-end', gap: spacing.xs },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
