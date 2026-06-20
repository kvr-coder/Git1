// Bug report / feedback form. Posts to /feedback on the server (auth required)
// along with version + platform metadata, and offers a mailto: fallback.
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { realApi } from '../lib/api.real';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/ThemeContext';
import { radius, spacing, typography } from '../lib/theme';

export default function Feedback() {
  const { colors } = useTheme();
  const { email } = useAuth();
  const router = useRouter();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const version =
    (Application as any)?.nativeApplicationVersion ?? '1.x';
  const appName = 'timeoff';

  const submit = async () => {
    if (!text.trim()) {
      setError('Please describe what happened.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await realApi.sendFeedback({
        body: text.trim(),
        email: email ?? undefined,
        app: appName,
        version: String(version),
        platform: Platform.OS,
      });
      setSent(true);
      setText('');
    } catch (e: any) {
      setError(e?.message ?? 'Could not send. Try the email fallback.');
    } finally {
      setSending(false);
    }
  };

  const mailto = () => {
    const subject = encodeURIComponent(`[timeoff bug] ${appName} ${version} ${Platform.OS}`);
    const bodyTxt = encodeURIComponent(
      `${text}\n\n— meta —\napp=${appName}\nversion=${version}\nplatform=${Platform.OS}\nemail=${email ?? ''}`,
    );
    Linking.openURL(`mailto:bugs@timeoff.app?subject=${subject}&body=${bodyTxt}`).catch(() => {});
  };

  return (
    <Screen topInset={false}>
      <Text style={[typography.h1, { color: colors.text }]}>Report a bug</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Tell us what happened — the more detail the better. Steps to reproduce, what you expected, what
        actually happened. We send your email + app version + platform so we can reach back.
      </Text>

      <Card>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          placeholder="What broke? Steps, expected, actual."
          placeholderTextColor={colors.textFaint}
          style={[
            styles.input,
            { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border },
          ]}
        />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Sending as <Text style={{ color: colors.text }}>{email ?? 'anonymous'}</Text> · {appName} {String(version)} · {Platform.OS}
        </Text>
      </Card>

      {error && <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text>}
      {sent && (
        <Text style={[typography.caption, { color: colors.success }]}>
          Sent ✓ Thanks — we read every report.
        </Text>
      )}

      <Button label="Send" icon="paper-plane-outline" onPress={submit} loading={sending} />
      <Button label="Or email instead" variant="ghost" icon="mail-outline" onPress={mailto} />
      <Button label="Close" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 160,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
