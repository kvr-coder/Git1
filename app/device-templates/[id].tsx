import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { useTheme } from '../../lib/ThemeContext';
import { radius, spacing, typography } from '../../lib/theme';
import type { ChoreTemplate } from '../../lib/types';

const QUICK_MINUTES = [5, 10, 15, 30, 60];

export default function ChoreTemplates() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<ChoreTemplate[]>([]);
  const [desc, setDesc] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [busy, setBusy] = useState(false);

  const refresh = () => api.listChoreTemplates(id).then(setItems);
  useEffect(() => {
    refresh();
  }, [id]);

  const add = async () => {
    if (!desc.trim()) return;
    setBusy(true);
    try {
      await api.createChoreTemplate(id, desc.trim(), minutes);
      setDesc('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const remove = async (templateId: string) => {
    setBusy(true);
    try {
      await api.deleteChoreTemplate(id, templateId);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen topInset={false}>
      <Text style={[typography.h1, { color: colors.text }]}>Chore templates</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Re-usable chores the kid can claim from their dashboard. They still submit each one and you
        approve it.
      </Text>

      <Card>
        <Text style={[typography.h3, { color: colors.text }]}>New chore</Text>
        <TextInput
          value={desc}
          onChangeText={setDesc}
          placeholder="e.g. Make your bed"
          placeholderTextColor={colors.textFaint}
          style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
        />
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          Reward
        </Text>
        <View style={styles.chipRow}>
          {QUICK_MINUTES.map((m) => {
            const on = minutes === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMinutes(m)}
                style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surfaceAlt }]}
              >
                <Text style={[typography.bodyStrong, { color: on ? colors.primaryText : colors.text }]}>
                  {m}m
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button label="Add chore" icon="add" onPress={add} loading={busy} />
      </Card>

      {items.length === 0 ? (
        <Text style={{ color: colors.textFaint }}>No chores yet.</Text>
      ) : (
        items.map((t) => (
          <Card key={t.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h3, { color: colors.text }]}>{t.description}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Reward: {t.minutes} min
                </Text>
              </View>
              <Button label="" icon="trash-outline" variant="danger" size="sm" onPress={() => remove(t.id)} loading={busy} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 1, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
