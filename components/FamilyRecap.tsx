// Family-wide weekly recap card for the home tab.
//
// Fetches /devices/:id/stats?days=14 for every paired device in parallel,
// aggregates this-week vs last-week, and renders:
//   - one combined "This week across the family" KPI strip,
//   - a per-kid mini-row showing each kid's WoW delta with a tiny sparkline.
//
// Pure-RN bars (no chart lib). Tap a kid row to deep-link to that device's
// full Stats screen.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { SectionHeader } from './ui';
import { api } from '../lib/api';
import { useTheme } from '../lib/ThemeContext';
import { spacing, typography } from '../lib/theme';
import type { Device } from '../lib/types';

interface Day { date: string; totalMinutes: number; appUsage?: Record<string, number> }
interface PerKid {
  device: Device;
  series: Day[];
  thisWeek: number;
  lastWeek: number;
  delta: number;
  pct: number;
}

const fmt = (m: number) => {
  const a = Math.max(0, m | 0);
  const h = Math.floor(a / 60), mm = a % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
};
const day0Ms = () => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); };

export function FamilyRecap({ devices }: { devices: Device[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [perKid, setPerKid] = useState<PerKid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!devices.length) { setPerKid([]); setLoading(false); return; }
    (async () => {
      const today = day0Ms();
      const within = (d: Day, fromDaysAgo: number, untilDaysAgo: number) => {
        const dd = new Date(d.date + 'T00:00:00').getTime();
        const diff = Math.round((today - dd) / 86400_000);
        return diff >= untilDaysAgo && diff < fromDaysAgo;
      };
      const results = await Promise.all(
        devices.map(async (device) => {
          let series: Day[] = [];
          try {
            const r = await api.getStats?.(device.id, 14);
            series = (r?.daily ?? []).slice().sort((a: Day, b: Day) => a.date.localeCompare(b.date));
          } catch {}
          const wk = series.filter((d) => within(d, 7, 0)).reduce((s, d) => s + d.totalMinutes, 0);
          const pv = series.filter((d) => within(d, 14, 7)).reduce((s, d) => s + d.totalMinutes, 0);
          const delta = wk - pv;
          const pct = pv > 0 ? Math.round((delta / pv) * 100) : 0;
          return { device, series, thisWeek: wk, lastWeek: pv, delta, pct };
        }),
      );
      if (alive) { setPerKid(results); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [devices.map((d) => d.id).join('|')]);

  const totals = useMemo(() => {
    const wk = perKid.reduce((s, k) => s + k.thisWeek, 0);
    const pv = perKid.reduce((s, k) => s + k.lastWeek, 0);
    const delta = wk - pv;
    const pct = pv > 0 ? Math.round((delta / pv) * 100) : 0;
    return { wk, pv, delta, pct };
  }, [perKid]);

  // Hide entirely when there's no signal yet (no devices or empty data).
  if (!devices.length || loading) return null;
  if (totals.wk === 0 && totals.pv === 0) return null;

  return (
    <>
      <SectionHeader>This week across the family</SectionHeader>
      <Card>
        <View style={styles.kpiRow}>
          <Kpi label="This week" value={fmt(totals.wk)} />
          <Kpi label="Last week" value={fmt(totals.pv)} />
          <Kpi
            label="Change"
            value={`${totals.delta >= 0 ? '+' : ''}${fmt(Math.abs(totals.delta))}`}
            tone={totals.delta > 0 ? 'warn' : 'good'}
            sub={totals.pv > 0 ? `${totals.pct >= 0 ? '+' : ''}${totals.pct}%` : ''}
          />
        </View>

        {perKid.length > 1 && (
          <View style={{ marginTop: spacing.md, gap: 6 }}>
            {perKid.map((k) => (
              <Pressable key={k.device.id} onPress={() => router.push(`/device-stats/${k.device.id}`)}>
                <View style={styles.kidRow}>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                    {k.device.name}
                  </Text>
                  <Sparkline series={k.series} limit={k.device.dailyLimitMinutes} />
                  <Text style={[typography.bodyStrong, { color: colors.text, width: 64, textAlign: 'right' }]}>
                    {fmt(k.thisWeek)}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: k.delta > 0 ? colors.danger : k.delta < 0 ? colors.success : colors.textMuted,
                        width: 58, textAlign: 'right',
                      },
                    ]}
                  >
                    {k.lastWeek === 0 ? 'new' : `${k.delta > 0 ? '+' : ''}${fmt(Math.abs(k.delta))}`}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
        {perKid.length === 1 && (
          <Pressable
            onPress={() => router.push(`/device-stats/${perKid[0].device.id}`)}
            style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>See full trends</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}
      </Card>
    </>
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

function Sparkline({ series, limit }: { series: Day[]; limit: number }) {
  const { colors } = useTheme();
  const last14 = series.slice(-14);
  const max = Math.max(60, limit || 0, ...last14.map((d) => d.totalMinutes));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 22, gap: 2, width: 84 }}>
      {last14.map((d) => {
        const over = limit > 0 && d.totalMinutes > limit;
        const h = Math.max(2, Math.round((d.totalMinutes / max) * 22));
        return (
          <View
            key={d.date}
            style={{
              flex: 1,
              height: h,
              backgroundColor: over ? colors.danger : colors.primary,
              opacity: 0.85,
              borderTopLeftRadius: 2, borderTopRightRadius: 2,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: spacing.md },
  kidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
