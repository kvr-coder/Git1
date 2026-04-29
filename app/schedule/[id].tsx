import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { formatMinutes } from '../../lib/format';
import { mockDevices } from '../../lib/mock';
import { colors, radius, spacing, typography } from '../../lib/theme';
import type { DayOfWeek, Schedule } from '../../lib/types';

const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const blank = (): Schedule => ({
  id: `s${Date.now()}`,
  deviceId: mockDevices[0]?.id ?? '',
  name: 'New schedule',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startMinute: 16 * 60,
  endMinute: 20 * 60,
  enabled: true,
});

export default function ScheduleEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id === 'new') setS(blank());
    else api.getSchedule(id).then((r) => setS(r ?? blank()));
  }, [id]);

  if (!s) return <Screen><Text style={{ color: colors.textMuted }}>Loading…</Text></Screen>;

  const toggleDay = (d: DayOfWeek) =>
    setS({ ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d] });

  const bumpMinute = (key: 'startMinute' | 'endMinute', delta: number) =>
    setS({ ...s, [key]: ((s[key] + delta) % (24 * 60) + 24 * 60) % (24 * 60) });

  const save = async () => {
    setBusy(true);
    try {
      await api.upsertSchedule(s);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteSchedule(s.id);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Name</Text>
        <TextInput
          value={s.name}
          onChangeText={(t) => setS({ ...s, name: t })}
          style={styles.input}
          placeholderTextColor={colors.textMuted}
        />
      </Card>

      <Card>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Device</Text>
        <View style={styles.chipRow}>
          {mockDevices.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => setS({ ...s, deviceId: d.id })}
              style={[styles.chip, s.deviceId === d.id && styles.chipActive]}
            >
              <Text style={{ color: s.deviceId === d.id ? colors.primaryText : colors.text }}>
                {d.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Days</Text>
        <View style={styles.chipRow}>
          {ALL_DAYS.map((d) => {
            const on = s.days.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => toggleDay(d)}
                style={[styles.chip, on && styles.chipActive]}
              >
                <Text style={{ color: on ? colors.primaryText : colors.text }}>
                  {d.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={styles.timeRow}>
          <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Allowed window</Text>
          <Text style={[typography.body, { color: colors.text }]}>
            {formatMinutes(s.startMinute)}–{formatMinutes(s.endMinute)}
          </Text>
        </View>
        <View style={styles.stepperRow}>
          <Text style={{ color: colors.textMuted, flex: 1 }}>Start</Text>
          <Button label="−15" variant="secondary" onPress={() => bumpMinute('startMinute', -15)} />
          <Button label="+15" variant="secondary" onPress={() => bumpMinute('startMinute', 15)} />
        </View>
        <View style={styles.stepperRow}>
          <Text style={{ color: colors.textMuted, flex: 1 }}>End</Text>
          <Button label="−15" variant="secondary" onPress={() => bumpMinute('endMinute', -15)} />
          <Button label="+15" variant="secondary" onPress={() => bumpMinute('endMinute', 15)} />
        </View>
      </Card>

      <Card>
        <View style={styles.timeRow}>
          <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Enabled</Text>
          <Switch
            value={s.enabled}
            onValueChange={(v) => setS({ ...s, enabled: v })}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
          />
        </View>
      </Card>

      <Button label="Save" onPress={save} loading={busy} />
      {id !== 'new' && <Button label="Delete" variant="danger" onPress={remove} loading={busy} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
