import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { formatMinutes } from '../../lib/format';
import { colors, spacing, typography } from '../../lib/theme';
import type { Schedule } from '../../lib/types';

const dayLabel = (d: string) => d[0].toUpperCase() + d.slice(1);

export default function Schedules() {
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
        <Text style={[typography.h1, { color: colors.text, flex: 1 }]}>Schedules</Text>
        <Button label="New" onPress={() => router.push('/schedule/new')} />
      </View>
      {items.map((s) => (
        <Pressable key={s.id} onPress={() => router.push(`/schedule/${s.id}`)}>
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h2, { color: colors.text }]}>{s.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {s.days.map(dayLabel).join(' ')} · {formatMinutes(s.startMinute)}–
                  {formatMinutes(s.endMinute)}
                </Text>
              </View>
              <Switch
                value={s.enabled}
                onValueChange={() => toggle(s)}
                trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
              />
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
