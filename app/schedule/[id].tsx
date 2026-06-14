import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { formatMinutes } from '../../lib/format';
import { mockDevices } from '../../lib/mock';
import { useTheme } from '../../lib/ThemeContext';
import { radius, spacing, typography } from '../../lib/theme';
import type { DayOfWeek, Schedule, ScheduleAction } from '../../lib/types';

const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const ACTION_LABELS: Record<ScheduleAction, string> = {
  lock: 'Lock screen',
  block_internet: 'Block internet',
  block_apps: 'Kill blocked apps',
};
const ALL_ACTIONS: ScheduleAction[] = ['lock', 'block_internet', 'block_apps'];

const blank = (): Schedule => ({
  id: `s${Date.now()}`,
  deviceId: mockDevices[0]?.id ?? '',
  name: 'Bedtime',
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  startMinute: 21 * 60,
  endMinute: 7 * 60,
  enabled: true,
  actions: ['lock'],
});

export default function ScheduleEditor() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id === 'new') setS(blank());
    else api.getSchedule(id).then((r) => setS(r ?? blank()));
  }, [id]);

  if (!s)
    return (
      <Screen>
        <Text style={{ color: colors.textMuted }}>Loading…</Text>
      </Screen>
    );

  const toggleDay = (d: DayOfWeek) =>
    setS({ ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d] });
  const setDays = (days: DayOfWeek[]) => setS({ ...s, days });
  const toggleAction = (a: ScheduleAction) => {
    const has = s.actions.includes(a);
    const next = has ? s.actions.filter((x) => x !== a) : [...s.actions, a];
    setS({ ...s, actions: next.length ? next : ['lock'] });
  };
  const bumpMinute = (key: 'startMinute' | 'endMinute', delta: number) =>
    setS({ ...s, [key]: (((s[key] + delta) % (24 * 60)) + 24 * 60) % (24 * 60) });

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

  const Chipy = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: on ? colors.primary : colors.surfaceAlt },
      ]}
    >
      <Text style={[typography.caption, { color: on ? colors.primaryText : colors.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen topInset={false}>
      <SectionHeader>Name</SectionHeader>
      <Card>
        <TextInput
          value={s.name}
          onChangeText={(t) => setS({ ...s, name: t })}
          placeholder="e.g. Bedtime"
          placeholderTextColor={colors.textFaint}
          style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
        />
      </Card>

      {mockDevices.length > 1 && (
        <>
          <SectionHeader>Device</SectionHeader>
          <Card>
            <View style={styles.chipRow}>
              {mockDevices.map((d) => (
                <Chipy key={d.id} on={s.deviceId === d.id} label={d.name} onPress={() => setS({ ...s, deviceId: d.id })} />
              ))}
            </View>
          </Card>
        </>
      )}

      <SectionHeader>Days</SectionHeader>
      <Card>
        <View style={styles.chipRow}>
          {ALL_DAYS.map((d) => (
            <Chipy key={d} on={s.days.includes(d)} label={d.toUpperCase()} onPress={() => toggleDay(d)} />
          ))}
        </View>
        <View style={[styles.chipRow, { marginTop: spacing.xs }]}>
          <Pressable onPress={() => setDays(['mon', 'tue', 'wed', 'thu', 'fri'])}>
            <Text style={[typography.caption, { color: colors.primary }]}>Weekdays</Text>
          </Pressable>
          <Pressable onPress={() => setDays(['sat', 'sun'])}>
            <Text style={[typography.caption, { color: colors.primary }]}>Weekend</Text>
          </Pressable>
          <Pressable onPress={() => setDays(ALL_DAYS)}>
            <Text style={[typography.caption, { color: colors.primary }]}>Every day</Text>
          </Pressable>
        </View>
      </Card>

      <SectionHeader>Locked window</SectionHeader>
      <Card>
        <View style={styles.timeRow}>
          <Text style={[typography.body, { color: colors.textMuted, flex: 1 }]}>
            Locked from → to
          </Text>
          <Text style={[typography.h2, { color: colors.text }]}>
            {formatMinutes(s.startMinute)}–{formatMinutes(s.endMinute)}
          </Text>
        </View>
        <View style={styles.stepperRow}>
          <Text style={{ color: colors.textMuted, flex: 1 }}>Start</Text>
          <Button label="−15" size="sm" variant="secondary" onPress={() => bumpMinute('startMinute', -15)} />
          <Button label="+15" size="sm" variant="secondary" onPress={() => bumpMinute('startMinute', 15)} />
        </View>
        <View style={styles.stepperRow}>
          <Text style={{ color: colors.textMuted, flex: 1 }}>End</Text>
          <Button label="−15" size="sm" variant="secondary" onPress={() => bumpMinute('endMinute', -15)} />
          <Button label="+15" size="sm" variant="secondary" onPress={() => bumpMinute('endMinute', 15)} />
        </View>
      </Card>

      <SectionHeader>Actions during this window</SectionHeader>
      <Card>
        <View style={styles.chipRow}>
          {ALL_ACTIONS.map((a) => (
            <Chipy key={a} on={s.actions.includes(a)} label={ACTION_LABELS[a]} onPress={() => toggleAction(a)} />
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.timeRow}>
          <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Enabled</Text>
          <Switch
            value={s.enabled}
            onValueChange={(v) => setS({ ...s, enabled: v })}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            thumbColor="#fff"
          />
        </View>
      </Card>

      <Button label="Save schedule" icon="checkmark" onPress={save} loading={busy} />
      {id !== 'new' && <Button label="Delete" variant="danger" icon="trash-outline" onPress={remove} loading={busy} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
});
