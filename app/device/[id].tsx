import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { formatDuration, formatRelative } from '../../lib/format';
import { colors, radius, spacing, typography } from '../../lib/theme';
import type { Device } from '../../lib/types';

export default function DeviceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [device, setDevice] = useState<Device | undefined>();
  const [busy, setBusy] = useState(false);
  const [appInput, setAppInput] = useState('');

  const refresh = () => api.getDevice(id).then(setDevice);
  useEffect(() => {
    refresh();
  }, [id]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const addApp = () => {
    if (!device || !appInput.trim()) return;
    const next = Array.from(new Set([...device.blocklist, appInput.trim().toLowerCase()]));
    setAppInput('');
    run(() => api.setBlocklist(device.id, next));
  };

  const removeApp = (name: string) => {
    if (!device) return;
    const next = device.blocklist.filter((n) => n !== name);
    run(() => api.setBlocklist(device.id, next));
  };

  if (!device) {
    return (
      <Screen>
        <Text style={{ color: colors.textMuted }}>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.h1, { color: colors.text }]}>{device.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {device.ownerName} · {device.platform} · last seen {formatRelative(device.lastSeen)}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <StatusBadge status={device.status} />
        </View>
      </View>

      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Today</Text>
        <Text style={[typography.body, { color: colors.text }]}>
          {formatDuration(device.usedTodayMinutes)} of {formatDuration(device.dailyLimitMinutes)} used
        </Text>
      </Card>

      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Controls</Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Lock now"
            variant="danger"
            loading={busy}
            onPress={() => run(() => api.lockDevice(device.id))}
          />
          <Button
            label="Unlock"
            loading={busy}
            onPress={() => run(() => api.unlockDevice(device.id))}
          />
          <Button
            label="Grant +15 min"
            variant="secondary"
            loading={busy}
            onPress={() => run(() => api.grantBonusMinutes(device.id, 15))}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h2, { color: colors.text }]}>Internet</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Cut all network traffic on this PC.
            </Text>
          </View>
          <Switch
            value={device.internetBlocked}
            onValueChange={(v) => run(() => api.setInternetBlocked(device.id, v))}
            trackColor={{ true: colors.danger, false: colors.surfaceAlt }}
            disabled={busy}
          />
        </View>
      </Card>

      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Blocked apps</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Any process matching these names is killed on sight (case-insensitive). Use the .exe name
          like <Text style={{ color: colors.text }}>steam.exe</Text>.
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            value={appInput}
            onChangeText={setAppInput}
            placeholder="discord.exe"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
            onSubmitEditing={addApp}
          />
          <Button label="Add" onPress={addApp} />
        </View>
        {device.blocklist.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            No apps blocked yet.
          </Text>
        ) : (
          <View style={styles.chipRow}>
            {device.blocklist.map((name) => (
              <Pressable key={name} onPress={() => removeApp(name)} style={styles.chip}>
                <Text style={{ color: colors.text }}>{name}  ×</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
