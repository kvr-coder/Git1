import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../lib/auth';
import { colors, spacing, typography } from '../../lib/theme';

export default function Settings() {
  const { email, signOut } = useAuth();
  return (
    <Screen>
      <Text style={[typography.h1, { color: colors.text }]}>Settings</Text>
      <Card>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Signed in as</Text>
        <Text style={[typography.body, { color: colors.text }]}>{email ?? '—'}</Text>
      </Card>
      <Card>
        <Text style={[typography.h2, { color: colors.text }]}>Pair a new device</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Install the Git1 agent on your child's PC and enter the 6-digit code shown there.
        </Text>
        <Button label="Enter pairing code" onPress={() => {}} />
      </Card>
      <View style={{ marginTop: spacing.lg }}>
        <Button label="Sign out" variant="danger" onPress={signOut} />
      </View>
    </Screen>
  );
}
