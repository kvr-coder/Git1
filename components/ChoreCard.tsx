import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { formatRelative } from '../lib/format';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { ChoreRequest } from '../lib/types';

interface Props {
  chore: ChoreRequest;
  deviceName?: string;
  busy?: boolean;
  onApprove: (minutes: number) => void;
  onDeny: () => void;
}

const QUICK_MINUTES = [5, 15, 30, 60];

export function ChoreCard({ chore, deviceName, busy, onApprove, onDeny }: Props) {
  const [adjusted, setAdjusted] = useState<number>(chore.minutes);
  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={[typography.caption, { color: colors.primary }]}>CHORE</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {formatRelative(new Date(chore.createdAt).toISOString())}
        </Text>
      </View>
      <Text style={[typography.h2, { color: colors.text }]}>
        {deviceName ?? chore.deviceId}
      </Text>
      <Text style={[typography.body, { color: colors.text, marginTop: spacing.xs }]}>
        “{chore.description}”
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
        Asks for {chore.minutes} min reward
      </Text>

      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
        Reward (goes to bank): {adjusted} min
      </Text>
      <View style={styles.chipRow}>
        {QUICK_MINUTES.map((m) => (
          <Pressable
            key={m}
            onPress={() => setAdjusted(m)}
            style={[styles.chip, adjusted === m && styles.chipActive]}
          >
            <Text style={{ color: adjusted === m ? colors.primaryText : colors.text }}>
              {m}m
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button label="Deny" variant="secondary" onPress={onDeny} loading={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={`Approve ${adjusted}m`} onPress={() => onApprove(adjusted)} loading={busy} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
