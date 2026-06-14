import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { Segmented, SectionHeader } from '../../components/ui';
import { TipCard } from '../../components/TipCard';
import { useTheme } from '../../lib/ThemeContext';
import { spacing, typography } from '../../lib/theme';
import { ANTI_PATTERNS, AgeBand, WISDOM } from '../../lib/wisdom';

export default function Wisdom() {
  const { colors } = useTheme();
  const [age, setAge] = useState<AgeBand | 'all'>('all');
  const tips = WISDOM.filter((t) => age === 'all' || t.ages.length === 0 || t.ages.includes(age));

  return (
    <Screen>
      <View>
        <Text style={[typography.display, { color: colors.text }]}>Wisdom</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Advice grounded in peer-reviewed research — tap any tip to see the source.
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
      </Card>

      <SectionHeader>Evidence-based tips</SectionHeader>
      {tips.map((t) => (
        <TipCard key={t.id} tip={t} />
      ))}

      <SectionHeader>What backfires</SectionHeader>
      {ANTI_PATTERNS.map((a, i) => (
        <Card key={i}>
          <View style={styles.row}>
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>{a.title}</Text>
          </View>
          <Text style={[typography.body, { color: colors.text }]}>{a.body}</Text>
        </Card>
      ))}

      <Card>
        <View style={styles.row}>
          <Ionicons name="library-outline" size={20} color={colors.info} />
          <Text style={[typography.h3, { color: colors.text }]}>Where this comes from</Text>
        </View>
        <Text style={[typography.body, { color: colors.text }]}>
          Sources include AAP 2016/2024 policies, WHO 2019 guidelines, RCPCH 2019, Orben &amp; Przybylski 2019 (Nature Human Behaviour), Carter et al. 2016 (JAMA Pediatrics), Steinberg, Baumrind, Mindell, Deci/Ryan, Greene, Kerr &amp; Stattin, Cochrane 2023 review on blue-light filters, and the WHO ICD-11 Gaming Disorder criteria. Where evidence is weak or contested, the tip says so.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
});
