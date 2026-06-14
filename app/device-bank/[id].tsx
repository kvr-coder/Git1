import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useTheme } from '../../lib/ThemeContext';
import { spacing, typography } from '../../lib/theme';
import type { BankLedgerEntry } from '../../lib/types';

const labelFor = (reason: string) => {
  if (reason.startsWith('chore:')) return reason;
  if (reason === 'kid_spent') return 'Kid spent from bank';
  if (reason === 'parent_adjust') return 'Parent adjustment';
  if (reason === 'parent_set') return 'Parent set balance';
  return reason;
};

export default function BankHistory() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entries, setEntries] = useState<BankLedgerEntry[]>([]);

  useEffect(() => {
    api.listBankLedger(id).then(setEntries);
  }, [id]);

  return (
    <Screen topInset={false}>
      <Text style={[typography.h1, { color: colors.text }]}>Bank history</Text>
      {entries.length === 0 && (
        <Text style={{ color: colors.textMuted }}>Nothing yet.</Text>
      )}
      {entries.map((e) => {
        const positive = e.delta > 0;
        return (
          <Card key={e.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.text }]}>
                  {labelFor(e.reason)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {formatRelative(new Date(e.createdAt).toISOString())} · balance now {e.balanceAfter}m
                </Text>
              </View>
              <Text
                style={[
                  typography.h2,
                  { color: positive ? colors.success : colors.danger },
                ]}
              >
                {positive ? '+' : ''}
                {e.delta}m
              </Text>
            </View>
          </Card>
        );
      })}
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
