import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { IconBadge, SectionHeader, Segmented } from '../../components/ui';
import { api } from '../../lib/api';
import { activityBucket, getActivityRetention, Retention, setActivityRetention } from '../../lib/activityPrefs';
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

const BUCKET_ORDER = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Earlier'] as const;

export default function Activity() {
  const { colors } = useTheme();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [retention, setRetention] = useState<Retention>(30);

  const load = useCallback(() => api.listActivity().then(setEvents), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { getActivityRetention().then(setRetention); }, []);

  const onPull = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const onChangeRetention = (r: Retention) => {
    setRetention(r);
    setActivityRetention(r);
  };

  // Filter by retention, group by bucket.
  const groups = useMemo(() => {
    const cutoff = retention === 0 ? -Infinity : Date.now() - retention * 86_400_000;
    const filtered = events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
    const map = new Map<string, ActivityEvent[]>();
    for (const e of filtered) {
      const key = activityBucket(e.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return BUCKET_ORDER.map((b) => ({ bucket: b, items: map.get(b) ?? [] })).filter((g) => g.items.length);
  }, [events, retention]);

  const toneFor = (k: ActivityKind) => {
    if (k === 'lock' || k === 'limit_reached' || k === 'app_blocked' || k === 'clock_tamper' || k === 'vpn_detected')
      return { c: colors.danger, s: colors.dangerSoft };
    if (k === 'unlock' || k === 'chore_request') return { c: colors.success, s: colors.successSoft };
    if (k === 'request_minutes' || k === 'borrow' || k === 'bank_spent')
      return { c: colors.warning, s: colors.warningSoft };
    return { c: colors.info, s: colors.infoSoft };
  };

  const visibleCount = groups.reduce((n, g) => n + g.items.length, 0);
  const hiddenCount = events.length - visibleCount;

  return (
    <Screen refreshing={refreshing} onRefresh={onPull}>
      <View style={styles.headRow}>
        <Text style={[typography.display, { color: colors.text, flex: 1 }]}>Activity</Text>
        <Text style={[typography.caption, { color: colors.textFaint }]}>
          {visibleCount} shown{hiddenCount > 0 ? ` · ${hiddenCount} older hidden` : ''}
        </Text>
      </View>

      {/* Retention control */}
      <Card padded>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
          Show events from the last
        </Text>
        <Segmented<string>
          value={String(retention)}
          onChange={(v) => onChangeRetention(Number(v) as Retention)}
          options={[
            { key: '7', label: '7 days' },
            { key: '30', label: '30 days' },
            { key: '90', label: '90 days' },
            { key: '0', label: 'All' },
          ]}
        />
      </Card>

      {events.length === 0 && (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl } as any}>
          <Ionicons name="pulse-outline" size={38} color={colors.textFaint} />
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            Nothing yet — activity will appear here.
          </Text>
        </Card>
      )}

      {events.length > 0 && visibleCount === 0 && (
        <Card>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            No events in this range. Switch to a longer window above.
          </Text>
        </Card>
      )}

      {groups.map(({ bucket, items }) => (
        <View key={bucket} style={{ gap: spacing.sm }}>
          <SectionHeader>{bucket}</SectionHeader>
          {items.map((e) => {
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
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
