import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { formatRelative } from '../lib/format';
import { radius, spacing, typography } from '../lib/theme';
import type { ChoreRequest } from '../lib/types';
import { Button } from './Button';
import { Card } from './Card';
import { IconBadge } from './ui';

interface Props {
  chore: ChoreRequest;
  deviceName?: string;
  busy?: boolean;
  onApprove: (minutes: number) => void;
  onDeny: () => void;
}

const QUICK_MINUTES = [5, 15, 30, 60];

export function ChoreCard({ chore, deviceName, busy, onApprove, onDeny }: Props) {
  const { colors } = useTheme();
  const [adjusted, setAdjusted] = useState<number>(chore.minutes);
  return (
    <Card raised accent={colors.success}>
      <View style={styles.head}>
        <IconBadge name="sparkles" color={colors.success} soft={colors.successSoft} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.h3, { color: colors.text }]}>
            {deviceName ?? chore.deviceId} did a chore
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatRelative(new Date(chore.createdAt).toISOString())} · asked for {chore.minutes}m
          </Text>
        </View>
      </View>
      <Text style={[typography.body, { color: colors.text }]}>“{chore.description}”</Text>

      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
        Reward to bank
      </Text>
      <View style={styles.chipRow}>
        {QUICK_MINUTES.map((m) => {
          const active = adjusted === m;
          return (
            <Pressable
              key={m}
              onPress={() => setAdjusted(m)}
              style={[
                styles.chip,
                { backgroundColor: active ? colors.primary : colors.surfaceAlt },
              ]}
            >
              <Text style={[typography.bodyStrong, { color: active ? colors.primaryText : colors.text }]}>
                {m}m
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button label="Deny" variant="danger" full onPress={onDeny} loading={busy} />
        <Button
          label={`Approve ${adjusted}m`}
          variant="primary"
          icon="checkmark"
          full
          onPress={() => onApprove(adjusted)}
          loading={busy}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  chip: {
    minWidth: 52,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.pill,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
