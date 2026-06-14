import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { radius, spacing } from '../lib/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
type Size = 'md' | 'sm';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  full?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  style,
  full,
}: Props) {
  const { colors } = useTheme();

  const map: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryText },
    secondary: { bg: colors.surfaceAlt, fg: colors.text },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    success: { bg: colors.successSoft, fg: colors.success },
    ghost: { bg: 'transparent', fg: colors.textMuted, border: colors.border },
  };
  const c = map[variant];
  const pv = size === 'sm' ? spacing.sm : spacing.md - 1;
  const ph = size === 'sm' ? spacing.md : spacing.lg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: c.bg,
          paddingVertical: pv,
          paddingHorizontal: ph,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
          borderWidth: c.border ? StyleSheet.hairlineWidth : 0,
          borderColor: c.border,
          flex: full ? 1 : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 17} color={c.fg} /> : null}
          <Text style={[styles.label, { color: c.fg, fontSize: size === 'sm' ? 13.5 : 15 }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  label: { fontWeight: '700' },
});
