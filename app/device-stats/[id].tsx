// 28-day usage stats screen for one device.
//
// Pure-RN chart (no chart lib) — 28 vertical bars, height proportional to
// total minutes that day; a soft horizontal line at the device's daily limit.
// Above the chart: this-week vs last-week summary + delta. Below: top apps
// this week with week-over-week change, streaks, and a 14-day history list.
//
// Backend is /devices/:id/stats?days=28 (already shipped). All math is
// client-side so the screen works against the mock too.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { useTheme } from '../../lib/ThemeContext';
import { radius, spacing, typography } from '../../lib/theme';
import type { Device } from '../../lib/types';

interface Day {
  date: string;
  totalMinutes: number;
  appUsage: Record<string, number>;
}

const fmt = (m: number) => {
  const mins = Math.max(0, Math.round(m));
  const h = Math.floor(mins / 60), mm = mins % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
};
const day0 = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

export default function Stats() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [device, setDevice] = useState<Device | undefined>();
  const [days, setDays] = useState<Day[]>([]);

  useEffect(() => {
    if (!id) return;
    api.getDevice(String(id)).then(setDevice).catch(() => {});
    api.getStats(String(id), 28).then((r) => setDays(r.daily ?? [])).catch(() => {});
  }, [id]);

  // Newest-first from the server — flip to oldest-first for the bar chart.
  const series = useMemo(() => [...days].sort((a, b) => a.date.localeCompare(b.date)), [days]);
  const limit = device?.dailyLimitMinutes ?? 0;

  const summary = useMemo(() => {
    const today = day0();
    const inLast = (d: Day, fromDaysAgo: number, untilDaysAgo: number) => {
      const dd = new Date(d.date + 'T00:00:00');
      const diff = Math.round((today.getTime() - dd.getTime()) / 86400_000);
      return diff >= untilDaysAgo && diff < fromDaysAgo;
    };
    const week = series.filter((d) => inLast(d, 7, 0));
    const prev = series.filter((d) => inLast(d, 14, 7));
    const sum = (xs: Day[]) => xs.reduce((s, d) => s + d.totalMinutes, 0);
    const wk = sum(week);
    const pv = sum(prev);
    const delta = wk - pv;
    const pct = pv > 0 ? Math.round((delta / pv) * 100) : 0;
    const avgWk = week.length ? Math.round(wk / week.length) : 0;
    const avgPv = prev.length ? Math.round(pv / prev.length) : 0;
    const overDays = limit > 0 ? week.filter((d) => d.totalMinutes > limit).length : 0;
    const underDays = limit > 0 ? week.filter((d) => d.totalMinutes <= limit).length : 0;
    let streak = 0;
    if (limit > 0) {
      for (let i = series.length - 1; i >= 0; i--) {
        if (series[i].totalMinutes <= limit) streak++;
        else break;
      }
    }
    return { wk, pv, delta, pct, avgWk, avgPv, overDays, underDays, streak };
  }, [series, limit]);

  // Top apps this week + week-over-week change.
  const apps = useMemo(() => {
    const today = day0();
    const within = (d: Day, fromDaysAgo: number, untilDaysAgo: number) => {
      const dd = new Date(d.date + 'T00:00:00');
      const diff = Math.round((today.getTime() - dd.getTime()) / 86400_000);
      return diff >= untilDaysAgo && diff < fromDaysAgo;
    };
    const acc: Record<string, { now: number; prev: number }> = {};
    for (const d of series) {
      const w = within(d, 7, 0), p = within(d, 14, 7);
      if (!w && !p) continue;
      for (const [name, m] of Object.entries(d.appUsage || {})) {
        acc[name] ??= { now: 0, prev: 0 };
        if (w) acc[name].now += m;
        if (p) acc[name].prev += m;
      }
    }
    return Object.entries(acc)
      .map(([name, v]) => ({ name, now: v.now, prev: v.prev, delta: v.now - v.prev }))
      .sort((a, b) => b.now - a.now)
      .slice(0, 6);
  }, [series]);

  const maxBar = Math.max(60, ...series.map((d) => d.totalMinutes), limit);
  const chartH = 140;

  return (
    <Screen>
      <Text style={[typography.display, { color: colors.text }]}>{device?.name ?? 'Device'}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Past 28 days. Pulled from agent heartbeats.
      </Text>

      {/* Week-over-week strip */}
      <SectionHeader>This week vs last week</SectionHeader>
      <Card>
        <View style={styles.kpiRow}>
          <Kpi label="This week" value={fmt(summary.wk)} />
          <Kpi label="Last week" value={fmt(summary.pv)} />
          <Kpi
            label="Change"
            value={`${summary.delta >= 0 ? '+' : ''}${fmt(Math.abs(summary.delta))}`}
            tone={summary.delta > 0 ? 'warn' : 'good'}
            sub={summary.pv > 0 ? `${summary.pct >= 0 ? '+' : ''}${summary.pct}%` : ''}
          />
        </View>
        <View style={[styles.kpiRow, { marginTop: spacing.sm }]}>
          <Kpi label="Daily avg" value={fmt(summary.avgWk)} sub={`prev ${fmt(summary.avgPv)}`} />
          {limit > 0 && (
            <>
              <Kpi label="Days under limit" value={`${summary.underDays}/7`} tone="good" />
              <Kpi label="Days over" value={`${summary.overDays}/7`} tone={summary.overDays ? 'warn' : 'good'} />
            </>
          )}
        </View>
        {limit > 0 && summary.streak > 0 && (
          <View style={[styles.streak, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="flame-outline" size={18} color={colors.success} />
            <Text style={[typography.bodyStrong, { color: colors.success }]}>
              {summary.streak}-day under-limit streak
            </Text>
          </View>
        )}
      </Card>

      {/* Daily-usage bar chart */}
      <SectionHeader>Daily usage (last 28 days)</SectionHeader>
      <Card>
        <View style={{ height: chartH + 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH, gap: 2 }}>
            {series.map((d) => {
              const over = limit > 0 && d.totalMinutes > limit;
              const h = Math.max(2, Math.round((d.totalMinutes / maxBar) * chartH));
              const dt = new Date(d.date + 'T00:00:00');
              const weekend = dt.getDay() === 0 || dt.getDay() === 6;
              return (
                <View
                  key={d.date}
                  style={{
                    flex: 1,
                    height: h,
                    backgroundColor: over ? colors.danger : weekend ? colors.info : colors.primary,
                    opacity: over ? 1 : 0.85,
                    borderTopLeftRadius: 3, borderTopRightRadius: 3,
                  }}
                />
              );
            })}
          </View>
          {limit > 0 && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0, right: 0,
                bottom: 26 + Math.round((limit / maxBar) * chartH),
                borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' as any,
              }}
            >
              <Text style={[typography.tiny, { color: colors.textMuted, textAlign: 'right' }]}>
                limit {fmt(limit)}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', marginTop: 6, justifyContent: 'space-between' }}>
            <Text style={[typography.tiny, { color: colors.textFaint }]}>
              {series[0]?.date.slice(5) ?? ''}
            </Text>
            <Text style={[typography.tiny, { color: colors.textFaint }]}>today</Text>
          </View>
        </View>
        <View style={[styles.legendRow, { marginTop: 4 }]}>
          <Legend color={colors.primary} text="weekday" />
          <Legend color={colors.info} text="weekend" />
          {limit > 0 && <Legend color={colors.danger} text="over limit" />}
        </View>
      </Card>

      {/* Top apps with WoW delta */}
      <SectionHeader>Top apps this week</SectionHeader>
      <Card>
        {apps.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            No per-app data yet. Comes in automatically as the agent reports.
          </Text>
        ) : (
          apps.map((a, i) => (
            <View key={a.name} style={styles.appRow}>
              <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                {i + 1}. {a.name.replace(/\.exe$/i, '')}
              </Text>
              <Text style={[typography.bodyStrong, { color: colors.text, width: 70, textAlign: 'right' }]}>
                {fmt(a.now)}
              </Text>
              <Text
                style={[
                  typography.caption,
                  {
                    color: a.delta > 0 ? colors.danger : a.delta < 0 ? colors.success : colors.textMuted,
                    width: 60, textAlign: 'right',
                  },
                ]}
              >
                {a.delta === 0 ? '—' : `${a.delta > 0 ? '+' : ''}${fmt(Math.abs(a.delta))}`}
              </Text>
            </View>
          ))
        )}
      </Card>

      {/* Recent day-by-day */}
      <SectionHeader>Day by day</SectionHeader>
      <Card>
        {[...series].reverse().slice(0, 14).map((d) => {
          const over = limit > 0 && d.totalMinutes > limit;
          return (
            <View key={d.date} style={styles.dayRow}>
              <Text style={[typography.body, { color: colors.text, width: 92 }]}>{d.date.slice(5)}</Text>
              <View style={{ flex: 1, height: 8, backgroundColor: colors.track, borderRadius: 999, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.min(100, Math.round((d.totalMinutes / maxBar) * 100))}%`,
                    height: 8,
                    backgroundColor: over ? colors.danger : colors.primary,
                  }}
                />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, width: 70, textAlign: 'right' }]}>
                {fmt(d.totalMinutes)}
              </Text>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const { colors } = useTheme();
  const color = tone === 'good' ? colors.success : tone === 'warn' ? colors.warning : colors.text;
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.tiny, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{label}</Text>
      <Text style={[typography.h2, { color, marginTop: 2 }]}>{value}</Text>
      {sub ? <Text style={[typography.caption, { color: colors.textMuted }]}>{sub}</Text> : null}
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={[typography.tiny, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: spacing.md },
  streak: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    padding: spacing.sm, marginTop: spacing.sm,
    borderRadius: radius.md,
  },
  legendRow: { flexDirection: 'row', gap: 14 },
  appRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 10 },
});
