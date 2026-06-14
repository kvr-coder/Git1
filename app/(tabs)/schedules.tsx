import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { Chip } from '../../components/ui';
import { api } from '../../lib/api';
import { formatMinutes } from '../../lib/format';
import { useTheme } from '../../lib/ThemeContext';
import { spacing, typography } from '../../lib/theme';
import type { Schedule } from '../../lib/types';

const dayLabel = (d: string) => d[0].toUpperCase() + d.slice(1);
const ACTION_SHORT: Record<string, string> = {
  lock: 'Lock',
  block_internet: 'No internet',
  block_apps: 'Block apps',
};

export default function Schedules() {
  const { colors } = useTheme();
  const [items, setItems] = useState<Schedule[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      api.listSchedules().then(setItems);
    }, []),
  );

  const toggle = async (s: Schedule) => {
    const next = { ...s, enabled: !s.enabled };
    setItems((prev) => prev.map((x) => (x.id === s.id ? next : x)));
    await api.upsertSchedule(next);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[typography.display, { color: colors.text, flex: 1 }]}>Schedules</Text>
        <Pressable
          onPress={() => router.push('/schedule/new')}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={22} color={colors.primaryText} />
        </Pressable>
      </View>

      {items.length === 0 && (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl } as any}>
          <Ionicons name="time-outline" size={38} color={colors.textFaint} />
          <Text style={[typography.h3, { color: colors.text, marginTop: spacing.sm }]}>
            No schedules yet
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            Add bedtime or school-hours rules. Tap + to create one.
          </Text>
        </Card>
      )}

      {items.map((s) => (
        <Pressable key={s.id} onPress={() => router.push(`/schedule/${s.id}`)}>
          <Card accent={s.enabled ? colors.primary : colors.border}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h3, { color: colors.text }]}>{s.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {s.days.map(dayLabel).join(' · ')}
                </Text>
              </View>
              <Switch
                value={s.enabled}
                onValueChange={() => toggle(s)}
                trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.meta}>
              <View style={styles.timePill}>
                <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.text }]}>
                  {formatMinutes(s.startMinute)}–{formatMinutes(s.endMinute)}
                </Text>
              </View>
              {(s.actions && s.actions.length ? s.actions : ['lock']).map((a) => (
                <Chip key={a} label={ACTION_SHORT[a] ?? a} tone="primary" />
              ))}
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs + 2 },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
