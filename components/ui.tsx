// Small shared UI primitives for the timeoff app: TimeBar, Stat, Chip,
// SectionHeader, Segmented, IconBadge. All theme-aware.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { radius, spacing, typography } from '../lib/theme';

/** A rounded usage bar whose colour shifts green -> amber -> red with load. */
export function TimeBar({ pct, height = 10 }: { pct: number; height?: number }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, pct));
  const fill =
    clamped >= 1 ? colors.danger : clamped >= 0.8 ? colors.warning : colors.success;
  return (
    <View style={[barStyles.track, { backgroundColor: colors.track, height, borderRadius: height }]}>
      <View
        style={[
          barStyles.fill,
          { width: `${clamped * 100}%`, backgroundColor: fill, borderRadius: height },
        ]}
      />
    </View>
  );
}
const barStyles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});

/** Big number + small label, used for hero metrics. */
export function Stat({
  value,
  label,
  color,
  align = 'flex-start',
}: {
  value: string;
  label?: string;
  color?: string;
  align?: 'flex-start' | 'center' | 'flex-end';
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: align }}>
      <Text style={[typography.stat, { color: color ?? colors.text }]}>{value}</Text>
      {label ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: -2 }]}>{label}</Text>
      ) : null}
    </View>
  );
}

export function SectionHeader({ children, style }: { children: string; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <Text style={[typography.tiny, { color: colors.textFaint, marginLeft: 4, marginTop: spacing.sm }, style as any]}>
      {children.toUpperCase()}
    </Text>
  );
}

export function Chip({
  label,
  onRemove,
  tone = 'neutral',
}: {
  label: string;
  onRemove?: () => void;
  tone?: 'neutral' | 'primary' | 'danger';
}) {
  const { colors } = useTheme();
  const bg =
    tone === 'primary' ? colors.primarySoft : tone === 'danger' ? colors.dangerSoft : colors.surfaceAlt;
  const fg =
    tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : colors.text;
  return (
    <View style={[chipStyles.chip, { backgroundColor: bg }]}>
      <Text style={[typography.caption, { color: fg }]}>{label}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close" size={14} color={fg} />
        </Pressable>
      ) : null}
    </View>
  );
}
const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
});

/** Segmented control. options: array of {key,label}. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[segStyles.wrap, { backgroundColor: colors.track }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              segStyles.seg,
              active && { backgroundColor: colors.surface },
            ]}
          >
            {o.icon ? (
              <Ionicons
                name={o.icon}
                size={15}
                color={active ? colors.primary : colors.textMuted}
              />
            ) : null}
            <Text
              style={[
                typography.h3,
                { color: active ? colors.text : colors.textMuted, fontSize: 13.5 },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const segStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  seg: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.sm + 2,
  },
});

/** Coloured rounded icon container for list rows. */
export function IconBadge({
  name,
  color,
  soft,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  soft: string;
}) {
  return (
    <View style={[iconStyles.box, { backgroundColor: soft }]}>
      <Ionicons name={name} size={18} color={color} />
    </View>
  );
}
const iconStyles = StyleSheet.create({
  box: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
