import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { categoryMeta, tipOfTheDay, tips } from '../../lib/tips';

export default function Tips() {
  const featured = useMemo(() => tipOfTheDay(), []);

  return (
    <Screen>
      <Text style={[typography.h1, { color: colors.text }]}>Tips</Text>

      <Card style={styles.featured}>
        <View style={styles.row}>
          <Ionicons name="bulb" size={20} color={colors.warning} />
          <Text style={[typography.caption, { color: colors.warning }]}>TIP OF THE DAY</Text>
        </View>
        <Text style={[typography.h2, { color: colors.text }]}>{featured.title}</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>{featured.body}</Text>
      </Card>

      <Text style={[typography.h2, { color: colors.text, marginTop: spacing.sm }]}>
        All tips
      </Text>

      {tips.map((tip) => {
        const meta = categoryMeta[tip.category];
        return (
          <Card key={tip.id}>
            <View style={styles.row}>
              <Ionicons name={meta.icon} size={18} color={colors.primary} />
              <View style={styles.badge}>
                <Text style={[typography.caption, { color: colors.primary }]}>{meta.label}</Text>
              </View>
            </View>
            <Text style={[typography.h2, { color: colors.text }]}>{tip.title}</Text>
            <Text style={[typography.body, { color: colors.textMuted }]}>{tip.body}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  featured: {
    borderColor: colors.warning,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
