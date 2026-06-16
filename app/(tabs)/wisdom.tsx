import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SectionHeader, Segmented } from '../../components/ui';
import { TipCard } from '../../components/TipCard';
import { api } from '../../lib/api';
import { useTheme } from '../../lib/ThemeContext';
import { spacing, typography } from '../../lib/theme';
import { ANTI_PATTERNS, AgeBand, READING, SCRIPTS, WISDOM } from '../../lib/wisdom';

type Section = 'tips' | 'scripts' | 'sex' | 'reading' | 'backfires';

export default function Wisdom() {
  const { colors } = useTheme();
  const [age, setAge] = useState<AgeBand | 'all'>('all');
  const [section, setSection] = useState<Section>('tips');
  // Auto-detect ND focus: if any paired device has ND mode on, default to ND
  // filter. Parent can toggle the chip to override.
  const [ndFocus, setNdFocus] = useState(false);
  const [ndAvailable, setNdAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    api.listDevices?.().then((ds: any[]) => {
      if (!alive) return;
      const anyNd = (ds || []).some((d) => !!d.ndMode);
      setNdAvailable(anyNd);
      setNdFocus(anyNd);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Filter to the chosen age, then SORT age-specific tips first so switching
  // the band visibly changes the TOP of the list (otherwise the all-ages tips
  // dominate and it looks like nothing happened).
  // Age filter, then optional ND focus: when on, surface tips tagged for
  // ADHD or autism plus general parenting tips (so the list isn't only 2-3
  // cards). When off, everything passes through.
  const ageMatches = WISDOM.filter((t) => age === 'all' || t.ages.length === 0 || t.ages.includes(age));
  const matches = ndFocus
    ? ageMatches.filter((t) => t.tags.some((tag) => tag === 'adhd' || tag === 'autism' || tag === 'general'))
    : ageMatches;
  const tipsForAge =
    age === 'all'
      ? matches
      // Tips tagged for fewer age bands are more specific → surface them first
      // so picking an age visibly reorders the list.
      : [...matches].sort((a, b) => a.ages.length - b.ages.length);
  const sexTips = tipsForAge.filter((t) => t.tags.includes('sex-diff') || t.tags.includes('social'));
  const scripts = SCRIPTS.filter((s) => age === 'all' || s.ages.includes(age as AgeBand));

  const SECTIONS: { key: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'tips', label: 'Tips', icon: 'bulb-outline' },
    { key: 'scripts', label: 'How to talk', icon: 'chatbubble-ellipses-outline' },
    { key: 'sex', label: 'Boys vs girls', icon: 'people-outline' },
    { key: 'backfires', label: 'What backfires', icon: 'warning-outline' },
    { key: 'reading', label: 'Read more', icon: 'library-outline' },
  ];

  const open = (url?: string) => url && Linking.openURL(url).catch(() => {});

  return (
    <Screen>
      <View>
        <Text style={[typography.display, { color: colors.text }]}>Wisdom</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Advice grounded in peer-reviewed research. Tap any source to open the paper.
        </Text>
      </View>

      <Card>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 6 }]}>
          Show tips most relevant for
        </Text>
        <Segmented<string>
          value={age}
          onChange={(v) => setAge(v as any)}
          options={[
            { key: 'all', label: 'All ages' },
            { key: '6-9', label: '6–9' },
            { key: '10-13', label: '10–13' },
            { key: '14-16', label: '14–16' },
          ]}
        />
        {ndAvailable && (
          <Pressable
            onPress={() => setNdFocus((v) => !v)}
            style={[
              styles.ndChip,
              {
                backgroundColor: ndFocus ? colors.primarySoft : colors.surfaceAlt,
                borderColor: ndFocus ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="flash-outline" size={14} color={ndFocus ? colors.primary : colors.textMuted} />
            <Text style={[typography.caption, { color: ndFocus ? colors.primary : colors.textMuted, fontWeight: '600' }]}>
              {ndFocus ? 'ADHD/ASD focus on' : 'ADHD/ASD focus'}
            </Text>
          </Pressable>
        )}
      </Card>

      {/* Horizontally scrollable tab bar — fits 5 tabs without cramming. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}
        style={{ marginBottom: spacing.xs }}
      >
        {SECTIONS.map((s) => {
          const active = s.key === section;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSection(s.key)}
              style={[
                styles.pill,
                { backgroundColor: active ? colors.primary : colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name={s.icon} size={15} color={active ? '#fff' : colors.textMuted} />
              <Text
                numberOfLines={1}
                style={[typography.caption, { color: active ? '#fff' : colors.text, fontWeight: '600' }]}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {section === 'tips' && (
        <>
          <SectionHeader>
            {`Evidence-based tips${age !== 'all' ? ` · ${tipsForAge.length} for ${age}` : ''}`}
          </SectionHeader>
          {tipsForAge.map((t) => (
            <TipCard key={t.id} tip={t} />
          ))}
        </>
      )}

      {section === 'scripts' && (
        <>
          <SectionHeader>How to talk to your kid</SectionHeader>
          {scripts.length === 0 ? (
            <Card>
              <Text style={[typography.caption, { color: colors.textMuted }]}>No scripts for this age band.</Text>
            </Card>
          ) : (
            scripts.map((s) => (
              <Card key={s.id} accent={colors.info}>
                <View style={styles.row}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.info} />
                  <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>{s.scenario}</Text>
                </View>
                <Text style={[typography.caption, { color: colors.info }]}>{s.approach}</Text>
                {s.say.map((line, i) => (
                  <Text key={i} style={[typography.body, { color: colors.text, marginTop: 4 }]}>
                    {line}
                  </Text>
                ))}
                <Pressable onPress={() => open(s.url)}>
                  <Text style={[typography.caption, { color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.xs }]}>
                    {s.source}
                    {s.url ? '  · tap for source' : ''}
                  </Text>
                </Pressable>
              </Card>
            ))
          )}
        </>
      )}

      {section === 'sex' && (
        <>
          <SectionHeader>Boys vs girls — what the data says</SectionHeader>
          <Card>
            <Text style={[typography.body, { color: colors.text }]}>
              On a home PC the patterns split: <Text style={{ fontWeight: '700' }}>boys skew to
              competitive gaming time-loss; girls skew to social/messaging</Text> (Discord, group chats)
              even on the desktop. The risks — and the right limits — differ. Pick the age band above to
              filter.
            </Text>
          </Card>
          {sexTips.map((t) => (
            <TipCard key={t.id} tip={t} />
          ))}
        </>
      )}

      {section === 'backfires' && (
        <>
          <SectionHeader>Common mistakes that backfire</SectionHeader>
          {ANTI_PATTERNS.map((a, i) => (
            <Card key={i} accent={colors.danger}>
              <View style={styles.row}>
                <Ionicons name="warning-outline" size={18} color={colors.danger} />
                <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>{a.title}</Text>
              </View>
              <Text style={[typography.body, { color: colors.text }]}>{a.body}</Text>
            </Card>
          ))}
        </>
      )}

      {section === 'reading' && (
        <>
          <SectionHeader>Reading list</SectionHeader>
          <Card>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Open papers, policy statements, and benchmarks. All links public.
            </Text>
          </Card>
          {READING.map((r) => (
            <Pressable key={r.id} onPress={() => open(r.url)}>
              <Card>
                <View style={styles.row}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                  <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>{r.title}</Text>
                  <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                </View>
                <Text style={[typography.caption, { color: colors.info }]}>{r.citation}</Text>
                <Text style={[typography.body, { color: colors.text }]}>{r.blurb}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                  {r.url}
                </Text>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ndChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
  },
});
