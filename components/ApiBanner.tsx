import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { isMockMode } from '../lib/config';
import { radius, spacing, typography } from '../lib/theme';

export function ApiBanner() {
  const { colors } = useTheme();
  // Only surface a banner when something is wrong (mock mode). When the real
  // server is configured we stay silent — no need to nag the parent.
  if (!isMockMode()) return null;
  return (
    <View style={[styles.bar, { backgroundColor: colors.warningSoft }]}>
      <Text style={[typography.caption, { color: colors.warning, textAlign: 'center' }]}>
        ⚠ Demo mode — Settings → Server URL → enter http://{'<your-PC-IP>'}:8080
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
});
