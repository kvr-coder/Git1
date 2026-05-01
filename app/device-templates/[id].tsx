import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { colors, radius, spacing, typography } from '../../lib/theme';
import type { ChoreTemplate } from '../../lib/types';

const QUICK_MINUTES = [5, 10, 15, 30, 60];

export default function ChoreTemplates() {
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
    <Screen>
      <Text style={[typography.h1, { color: colors.text }]}>Chore templates</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Re-usable chore templates the kid can tap on their dashboard. They still
        have to submit each time and you still approve.
      </Text>

      <Card>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          New template
        </Text>
        <TextInput
          value={desc}
          onChangeText={setDesc}
          placeholder="e.g. Make bed"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
          Reward: {minutes} min
        </Text>
        <View style={styles.chipRow}>
          {QUICK_MINUTES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMinutes(m)}
              style={[styles.chip, minutes === m && styles.chipActive]}
            >
              <Text style={{ color: minutes === m ? colors.primaryText : colors.text }}>
                {m}m
              </Text>
            </Pressable>
          ))}
        </View>
        <Button label="Add template" onPress={add} loading={busy} />
      </Card>

      {items.length === 0 ? (
        <Text style={{ color: colors.textMuted }}>No templates yet.</Text>
      ) : (
        items.map((t) => (
          <Card key={t.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h2, { color: colors.text }]}>{t.description}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Suggested reward: {t.minutes} min
                </Text>
              </View>
              <Button
                label="Delete"
                variant="danger"
                onPress={() => remove(t.id)}
                loading={busy}
              />
            </View>
          </Card>
        ))
      )}
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
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.sm,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
