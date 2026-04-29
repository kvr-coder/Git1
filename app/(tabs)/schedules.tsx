import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { formatMinutes } from '../../lib/format';
import { colors, spacing, typography } from '../../lib/theme';
import type { Schedule } from '../../lib/types';

const dayLabel = (d: string) => d[0].toUpperCase() + d.slice(1);

export default function Schedules() {
  const [items, setItems] = useState<Schedule[]>([]);

  useEffect(() => {
    api.listSchedules().then(setItems);
  }, []);

  const toggle = (id: string) =>
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));

  return (
    <Screen>
      <Text style={[typography.h1, { color: colors.text }]}>Schedules</Text>
      {items.map((s) => (
        <Card key={s.id}>
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
              onValueChange={() => toggle(s.id)}
              trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            />
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
    gap: spacing.sm,
  },
});
