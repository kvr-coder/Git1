import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { elevation, radius, spacing } from '../lib/theme';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  accent?: string;
  raised?: boolean;
  padded?: boolean;
}

export function Card({ children, style, accent, raised, padded = true }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: padded ? spacing.md : 0,
        },
        accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null,
        raised ? elevation(colors, 1) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    overflow: 'hidden',
  },
});
