import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { StatusBadge } from '../../components/StatusBadge';
import { Chip, SectionHeader, Segmented, TimeBar } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDuration, formatRelative } from '../../lib/format';
import { useTheme } from '../../lib/ThemeContext';
import { radius, spacing, typography } from '../../lib/theme';
import type { Device } from '../../lib/types';
import { AnimatedBar, AnimatedNumber, BounceIn } from '../../components/animated';
import { HourglassIcon, LoadingDots, PadlockIcon } from '../../components/AnimatedIcons';
import { HintButton } from '../../components/HintButton';
import { InsightCard } from '../../components/TipCard';
import { getDeviceAge, setDeviceAge } from '../../lib/deviceAge';
import { AgeBand, computeInsights, tipsFor } from '../../lib/wisdom';

export default function DeviceDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [device, setDevice] = useState<Device | undefined>();
  const [age, setAge] = useState<AgeBand | undefined>();
  // Load the per-device age band from local storage when the screen mounts.
  useEffect(() => { if (id) getDeviceAge(String(id)).then(setAge); }, [id]);
  const [busy, setBusy] = useState(false);
  const [appInput, setAppInput] = useState('');

  const refresh = () => api.getDevice(id).then(setDevice);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
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
    run(() => api.setBlocklist(device.id, device.blocklist.filter((n) => n !== name)));
  };

  if (!device) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
          <LoadingDots size={70} />
        </View>
      </Screen>
    );
  }

  const limit = Math.max(1, device.dailyLimitMinutes);
  const pct = Math.min(1, device.usedTodayMinutes / limit);
  const left = Math.max(0, device.dailyLimitMinutes - device.usedTodayMinutes);
  const locked = device.status === 'locked';
  const leftColor = pct >= 1 ? colors.danger : pct >= 0.8 ? colors.warning : colors.success;

  return (
    <Screen topInset={false}>
      {/* Header */}
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h1, { color: colors.text }]} numberOfLines={1}>
            {device.name}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {device.ownerName} · seen {formatRelative(device.lastSeen)}
          </Text>
        </View>
        <StatusBadge status={device.status} />
      </View>

      {/* Kid's age band — drives which advice is shown. Stored locally. */}
      <Card>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 6 }]}>
          Tune advice for kid's age
        </Text>
        <Segmented<string>
          value={age ?? ''}
          onChange={(v) => {
            const b = v as AgeBand;
            setAge(b);
            setDeviceAge(String(id), b);
          }}
          options={[
            { key: '6-9', label: '6–9' },
            { key: '10-13', label: '10–13' },
            { key: '14-16', label: '14–16' },
          ]}
        />
      </Card>

      {/* Time hero */}
      <Card raised>
        <View style={styles.heroRow}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs }}>
            <HourglassIcon size={52} />
            {device.dailyLimitMinutes === 0 ? (
              <Text style={[typography.stat, { color: leftColor }]}>∞</Text>
            ) : (
              <AnimatedNumber
                value={left}
                format={(n) => formatDuration(Math.max(0, Math.round(n)))}
                style={[typography.stat, { color: leftColor }]}
              />
            )}
          </View>
          {device.bankedMinutes > 0 && (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="wallet" size={18} color={colors.success} />
                <Text style={[typography.h1, { color: colors.success }]}>{device.bankedMinutes}m</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>in bank</Text>
            </View>
          )}
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: -4 }]}>
          {device.dailyLimitMinutes === 0 ? 'no limit set' : 'left today'}
        </Text>
        <AnimatedBar
          pct={pct}
          height={12}
          track={colors.track}
          green={colors.success}
          amber={colors.warning}
          red={colors.danger}
        />
        <Text style={[typography.caption, { color: colors.textFaint }]}>
          {formatDuration(device.usedTodayMinutes)} of{' '}
          {device.dailyLimitMinutes === 0 ? '∞' : formatDuration(device.dailyLimitMinutes)} used today
        </Text>
      </Card>

      {/* Behaviour-driven insights — generated from this device's data. */}
      {(() => {
        const ins = computeInsights({
          device,
          hasSchedule: undefined, // we don't know without an extra fetch; safe-default skips this card
        });
        if (!ins.length) return null;
        return (
          <>
            <SectionHeader>For your kid right now</SectionHeader>
            {ins.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </>
        );
      })()}

      {/* Primary controls */}
      <SectionHeader>Right now</SectionHeader>
      <Card>
        <View style={{ alignItems: 'center', marginVertical: -spacing.sm }}>
          <PadlockIcon size={56} open={!locked} />
        </View>
        <View style={styles.spread}>
          <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>Screen</Text>
          <BounceIn trigger={locked}>
            <View
              style={[
                styles.statePill,
                { backgroundColor: locked ? colors.dangerSoft : colors.successSoft },
              ]}
            >
              <Ionicons
                name={locked ? 'lock-closed' : 'lock-open'}
                size={14}
                color={locked ? colors.danger : colors.success}
              />
              <Text style={[typography.tiny, { color: locked ? colors.danger : colors.success }]}>
                {locked ? 'LOCKED NOW' : 'UNLOCKED NOW'}
              </Text>
            </View>
          </BounceIn>
        </View>
        <Segmented
          value={locked ? 'locked' : 'open'}
          onChange={(v) =>
            run(() => (v === 'locked' ? api.lockDevice(device.id) : api.unlockDevice(device.id)))
          }
          options={[
            { key: 'open', label: 'Unlocked', icon: 'lock-open-outline' },
            { key: 'locked', label: 'Locked', icon: 'lock-closed' },
          ]}
        />
        <View style={{ height: spacing.xs }} />
        <View style={styles.spread}>
          <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>Internet</Text>
          <BounceIn trigger={device.internetBlocked}>
            <View
              style={[
                styles.statePill,
                {
                  backgroundColor: device.internetBlocked ? colors.warningSoft : colors.successSoft,
                },
              ]}
            >
              <Ionicons
                name={device.internetBlocked ? 'cloud-offline' : 'cloud-done'}
                size={14}
                color={device.internetBlocked ? colors.warning : colors.success}
              />
              <Text
                style={[
                  typography.tiny,
                  { color: device.internetBlocked ? colors.warning : colors.success },
                ]}
              >
                {device.internetBlocked ? 'BLOCKED' : 'ALLOWED'}
              </Text>
            </View>
          </BounceIn>
        </View>
        <Segmented
          value={device.internetBlocked ? 'off' : 'on'}
          onChange={(v) => run(() => api.setInternetBlocked(device.id, v === 'off'))}
          options={[
            { key: 'on', label: 'Allowed', icon: 'globe-outline' },
            { key: 'off', label: 'Blocked', icon: 'ban-outline' },
          ]}
        />
        <View style={{ height: spacing.xs }} />
        <Button
          label="Grant +15 minutes"
          variant="secondary"
          icon="add"
          loading={busy}
          onPress={() => run(() => api.grantBonusMinutes(device.id, 15))}
        />
      </Card>

      {/* Bank */}
      <SectionHeader>Reward bank</SectionHeader>
      <Card>
        <View style={styles.spread}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={[typography.h3, { color: colors.text }]}>Bank balance</Text>
            {tipsFor('bank', age, 1).map((t) => <HintButton key={t.id} tip={t} />)}
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Minutes the kid can spend whenever.
            </Text>
          </View>
          <Text style={[typography.h1, { color: colors.success }]}>{device.bankedMinutes}m</Text>
        </View>
        <View style={styles.btnRow}>
          <Button
            label="−15"
            variant="secondary"
            full
            onPress={() => run(() => api.setBankMinutes(device.id, Math.max(0, device.bankedMinutes - 15)))}
          />
          <Button label="+15" variant="secondary" full onPress={() => run(() => api.addBankMinutes(device.id, 15))} />
        </View>
        <View style={styles.btnRow}>
          <Button label="History" variant="ghost" full icon="receipt-outline" onPress={() => router.push(`/device-bank/${device.id}`)} />
          <Button label="Chores" variant="ghost" full icon="sparkles-outline" onPress={() => router.push(`/device-templates/${device.id}`)} />
        </View>
      </Card>

      {/* Family vacation mode */}
      <SectionHeader>Vacation mode</SectionHeader>
      <Card>
        <View style={styles.spread}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {device.vacationUntil && device.vacationUntil > Date.now()
                ? `On until ${new Date(device.vacationUntil).toLocaleDateString()}`
                : 'Off'}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Suspends all schedules and the blocklist. Limits stay. Great for
              trips and sick days — no surprise lockouts.
            </Text>
          </View>
        </View>
        <View style={styles.btnRow}>
          <Button
            full
            label="+1 day"
            variant="secondary"
            onPress={() => run(() => api.setVacation(device.id, Date.now() + 86400_000))}
          />
          <Button
            full
            label="+3 days"
            variant="secondary"
            onPress={() => run(() => api.setVacation(device.id, Date.now() + 3 * 86400_000))}
          />
          <Button
            full
            label="+7 days"
            variant="secondary"
            onPress={() => run(() => api.setVacation(device.id, Date.now() + 7 * 86400_000))}
          />
        </View>
        {!!device.vacationUntil && device.vacationUntil > Date.now() && (
          <Button label="End vacation now" variant="ghost" onPress={() => run(() => api.setVacation(device.id, 0))} />
        )}
      </Card>

      {/* Self-borrow */}
      <SectionHeader>Allowances</SectionHeader>
      <Card>
        <View style={styles.spread}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: colors.text }]}>Let kid borrow time</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Borrow from tomorrow without asking. Tomorrow shrinks by the same amount.
            </Text>
          </View>
          <Switch
            value={device.selfBorrowEnabled}
            onValueChange={(v) => run(() => api.setBorrowSettings(device.id, v, device.selfBorrowCapMinutes))}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            thumbColor="#fff"
            disabled={busy}
          />
        </View>
        {device.selfBorrowEnabled && (
          <View style={[styles.spread, { marginTop: spacing.sm }]}>
            <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
              Max per request: {device.selfBorrowCapMinutes} min
            </Text>
            <Button
              label="−15"
              size="sm"
              variant="secondary"
              onPress={() =>
                run(() => api.setBorrowSettings(device.id, true, Math.max(0, device.selfBorrowCapMinutes - 15)))
              }
            />
            <Button
              label="+15"
              size="sm"
              variant="secondary"
              onPress={() =>
                run(() => api.setBorrowSettings(device.id, true, Math.min(240, device.selfBorrowCapMinutes + 15)))
              }
            />
          </View>
        )}
      </Card>

      {/* Blocked apps */}
      <SectionHeader>Blocked apps</SectionHeader>
      <Card>
        {tipsFor('blocklist', age, 1).map((t) => <HintButton key={t.id} tip={t} />)}
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Processes killed during lock periods. Use the .exe name, e.g.{' '}
          <Text style={{ color: colors.text }}>steam.exe</Text>.
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            value={appInput}
            onChangeText={setAppInput}
            placeholder="discord.exe"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
            onSubmitEditing={addApp}
          />
          <Button label="Add" icon="add" onPress={addApp} />
        </View>
        {device.blocklist.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textFaint }]}>No apps blocked yet.</Text>
        ) : (
          <View style={styles.chipRow}>
            {device.blocklist.map((name) => (
              <Chip key={name} label={name} onRemove={() => removeApp(name)} tone="danger" />
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  spread: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
