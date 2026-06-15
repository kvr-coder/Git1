// Onboarding flow for new parents. One-time intro that frames the app's
// philosophy (transparency + conversation > surveillance, per Kerr & Stattin 2000)
// and points them at pairing + bedtime presets. Sets KEYS.onboarded so we don't
// show it again. Routed from _layout after first sign-in.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { KEYS, storage } from '../lib/storage';
import { useTheme } from '../lib/ThemeContext';
import { spacing, typography } from '../lib/theme';

const STEPS = [
  {
    icon: 'heart-outline',
    title: 'Welcome to timeoff',
    body:
      "This app helps you set healthy limits with your kid — together. Research (Kerr & Stattin, 2000) is clear: kids who know what's tracked and why share more, push back less, and stay safer than kids under hidden surveillance.",
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Transparency, not surveillance',
    body:
      "Your kid sees their time bank, today's used minutes, and the schedule. They can request more time or earn it by doing chores. You approve or deny — calmly, on your phone.",
  },
  {
    icon: 'phone-portrait-outline',
    title: 'Pair the PC, then set a bedtime',
    body:
      "Next: install the timeoff agent on the kid's PC (Settings → Pair a new device). Then add one schedule — most families start with bedtime (e.g., lock at 21:00). You can add more later.",
  },
];

export default function Onboarding() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = async () => {
    await storage.set(KEYS.onboarded, '1');
    router.replace('/');
  };

  return (
    <Screen>
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === step ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>
      <Card>
        <View style={styles.iconWrap}>
          <Ionicons name={s.icon as any} size={56} color={colors.primary} />
        </View>
        <Text style={[typography.display, { color: colors.text, textAlign: 'center' }]}>
          {s.title}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
          {s.body}
        </Text>
      </Card>
      <View style={{ marginTop: spacing.lg }}>
        {last ? (
          <Button label="Get started" icon="arrow-forward" onPress={finish} />
        ) : (
          <Button label="Next" icon="arrow-forward" onPress={() => setStep(step + 1)} />
        )}
        {!last && (
          <Button label="Skip" variant="ghost" onPress={finish} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconWrap: { alignItems: 'center', marginVertical: spacing.md },
});
