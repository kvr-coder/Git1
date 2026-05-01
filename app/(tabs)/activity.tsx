import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { colors, spacing, typography } from '../../lib/theme';
import type { ActivityEvent, ActivityKind } from '../../lib/types';

const iconFor: Record<ActivityKind, keyof typeof Ionicons.glyphMap> = {
  lock: 'lock-closed',
  unlock: 'lock-open',
  limit_reached: 'alarm',
  app_blocked: 'ban',
  login: 'log-in',
  vpn_detected: 'shield',
  clock_tamper: 'time',
  request_minutes: 'hand-left',
  borrow: 'swap-horizontal',
  chore_request: 'sparkles',
  bank_spent: 'wallet',
};

export default function Activity() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    api.listActivity().then(setEvents);
  }, []);

  return (
    <Screen>
      <Text style={[typography.h1, { color: colors.text }]}>Activity</Text>
      {events.map((e) => (
        <Card key={e.id}>
          <View style={styles.row}>
            <Ionicons name={iconFor[e.kind]} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.text }]}>{e.message}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {formatRelative(e.timestamp)}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
