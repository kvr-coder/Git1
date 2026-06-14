import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { spacing, typography } from '../lib/theme';
import type { Insight, Tip } from '../lib/wisdom';
import { Card } from './Card';

export function TipCard({ tip }: { tip: Tip }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Card accent={colors.primary}>
      <View style={styles.row}>
        <Ionicons name="bulb-outline" size={18} color={colors.primary} />
        <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>{tip.title}</Text>
      </View>
      <Text style={[typography.body, { color: colors.text }]}>{tip.body}</Text>
      <Pressable onPress={() => setOpen(!open)}>
        <Text style={[typography.caption, { color: colors.primary }]}>
          {open ? '▾ Source' : '▸ Source'}
        </Text>
      </Pressable>
      {open && (
        <Text style={[typography.caption, { color: colors.textMuted, fontStyle: 'italic' }]}>
          {tip.source}
          {tip.url ? '\n' + tip.url : ''}
        </Text>
      )}
    </Card>
  );
}

export function InsightCard({ insight }: { insight: Insight }) {
  const { colors } = useTheme();
  const tone =
    insight.severity === 'success'
      ? { fg: colors.success, soft: colors.successSoft, accent: colors.success }
      : insight.severity === 'warning'
        ? { fg: colors.warning, soft: colors.warningSoft, accent: colors.warning }
        : { fg: colors.info, soft: colors.infoSoft, accent: colors.info };
  return (
    <Card accent={tone.accent}>
      <View style={styles.row}>
        <View style={[styles.bubble, { backgroundColor: tone.soft }]}>
          <Ionicons name={insight.icon as any} size={18} color={tone.fg} />
        </View>
        <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>{insight.title}</Text>
      </View>
      <Text style={[typography.body, { color: colors.text }]}>{insight.body}</Text>
      {insight.source ? (
        <Text style={[typography.caption, { color: colors.textMuted, fontStyle: 'italic' }]}>
          {insight.source}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
