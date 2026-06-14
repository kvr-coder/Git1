import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { IconBadge } from '../../components/ui';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useTheme } from '../../lib/ThemeContext';
import { spacing, typography } from '../../lib/theme';
import type { ActivityEvent, ActivityKind } from '../../lib/types';

const iconFor: Record<ActivityKind, keyof typeof Ionicons.glyphMap> = {
  lock: 'lock-closed',
  unlock: 'lock-open',
  limit_reached: 'alarm',
  app_blocked: 'ban',
  login: 'log-in',
  vpn_detected: 'shield-half',
  clock_tamper: 'time',
  request_minutes: 'hand-left',
  borrow: 'swap-horizontal',
  chore_request: 'sparkles',
  bank_spent: 'wallet',
};

export default function Activity() {
  const { colors } = useTheme();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api.listActivity().then(setEvents), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onPull = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  // Colour-code by sentiment.
  const toneFor = (k: ActivityKind) => {
    if (k === 'lock' || k === 'limit_reached' || k === 'app_blocked' || k === 'clock_tamper' || k === 'vpn_detected')
      return { c: colors.danger, s: colors.dangerSoft };
    if (k === 'unlock' || k === 'chore_request') return { c: colors.success, s: colors.successSoft };
    if (k === 'request_minutes' || k === 'borrow' || k === 'bank_spent')
      return { c: colors.warning, s: colors.warningSoft };
    return { c: colors.info, s: colors.infoSoft };
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onPull}>
      <Text style={[typography.display, { color: colors.text }]}>Activity</Text>
      {events.length === 0 && (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl } as any}>
          <Ionicons name="pulse-outline" size={38} color={colors.textFaint} />
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            Nothing yet — activity will appear here.
          </Text>
        </Card>
      )}
      {events.map((e) => {
        const t = toneFor(e.kind);
        return (
          <Card key={e.id} padded={false} style={{ padding: spacing.sm + 2 } as any}>
            <View style={styles.row}>
              <IconBadge name={iconFor[e.kind]} color={t.c} soft={t.s} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.text }]}>{e.message}</Text>
                <Text style={[typography.caption, { color: colors.textFaint }]}>
                  {formatRelative(e.timestamp)}
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
