import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Linking, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { realApi } from '../lib/api.real';
import { getApiBase } from '../lib/config';
import { useTheme } from '../lib/ThemeContext';
import { radius, spacing, typography } from '../lib/theme';

// Pair flow: the parent picks one of three delivery paths for the kid PC.
//   * Email — server sends the installer URL (with pairing code embedded) to
//     the parent's account email; they open it on the kid PC.
//   * QR — server renders a QR PNG that the kid PC's camera (or any phone)
//     can scan. URL lands on /installer/go which shows the download button
//     and the pairing code.
//   * Share — native share sheet (AirDrop / Messages / etc.) with the link.
// The 6-digit code field at the bottom is still the catch-all for parents who
// install manually.
export default function Pair() {
  const { colors } = useTheme();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const base = getApiBase();
  const installerUrl = code.length === 6
    ? `${base}/installer/go?code=${code}`
    : `${base}/installer/go`;
  const qrUrl = `${base}/qr.png?text=${encodeURIComponent(installerUrl)}`;

  const submit = async () => {
    setError(null);
    if (code.trim().length !== 6) {
      setError('Pairing code is 6 digits.');
      return;
    }
    setBusy(true);
    try {
      await api.pairDevice(code.trim());
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pairing failed');
    } finally {
      setBusy(false);
    }
  };

  const emailMe = async () => {
    setSendingEmail(true);
    try {
      const r = await realApi.emailInstaller(code.length === 6 ? code : undefined);
      if (r.sent) setEmailedTo('your account email');
      else {
        // Email infra not configured yet — fall back to share sheet.
        await Share.share({ message: r.link });
      }
    } catch (e: any) {
      Alert.alert('Could not email', e?.message ?? 'unknown error');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Screen topInset={false}>
      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Pair a child&apos;s PC</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Get the installer onto the kid&apos;s PC — email, QR, or share. After it
          installs, enter the 6-digit code it shows.
        </Text>
      </Card>

      <Card>
        <Text style={[typography.h3, { color: colors.text }]}>1. Send the installer</Text>
        <View style={styles.btnRow}>
          <Button
            full
            label="Email me"
            icon="mail-outline"
            variant="secondary"
            loading={sendingEmail}
            onPress={emailMe}
          />
          <Button
            full
            label={showQr ? 'Hide QR' : 'Show QR'}
            icon="qr-code-outline"
            variant="secondary"
            onPress={() => setShowQr((v) => !v)}
          />
          <Button
            full
            label="Share"
            icon="share-outline"
            variant="secondary"
            onPress={() => Share.share({ message: installerUrl })}
          />
        </View>
        {emailedTo && (
          <Text style={[typography.caption, { color: colors.success }]}>Sent to {emailedTo} ✓</Text>
        )}
        {showQr && (
          <View style={styles.qrWrap}>
            <Image source={{ uri: qrUrl }} style={styles.qr} />
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              Scan with the kid PC&apos;s camera, or any phone.
            </Text>
          </View>
        )}
        <Button
          label="Open download page"
          variant="ghost"
          icon="open-outline"
          onPress={() => Linking.openURL(installerUrl).catch(() => {})}
        />
      </Card>

      <Card>
        <Text style={[typography.h3, { color: colors.text }]}>2. Enter the 6-digit code</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          The installer shows this on the kid PC at the end. Sharing/QR can
          pre-fill it, but you can also type it here.
        </Text>
        <TextInput
          placeholder="••••••"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
        />
        {error && <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text>}
        <Button label="Pair device" icon="link" onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: 10,
    fontWeight: '700',
  },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  qrWrap: { alignItems: 'center', marginVertical: spacing.md, gap: spacing.xs },
  qr: { width: 220, height: 220, borderRadius: radius.md, backgroundColor: '#fff' },
});
