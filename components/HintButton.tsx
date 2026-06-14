import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { radius, spacing, typography } from '../lib/theme';
import type { Tip } from '../lib/wisdom';

export function HintButton({ tip }: { tip: Tip }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen(!open)}
        style={[styles.btn, { backgroundColor: colors.primarySoft }]}
        hitSlop={8}
      >
        <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
        <Text style={[typography.tiny, { color: colors.primary }]}>WHY</Text>
      </Pressable>
      {open && (
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: 4 }]}>
            {tip.title}
          </Text>
          <Text style={[typography.body, { color: colors.text }]}>{tip.body}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6, fontStyle: 'italic' }]}>
            {tip.source}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  panel: {
    marginTop: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
