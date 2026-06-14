import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { formatRelative } from '../lib/format';
import { spacing, typography } from '../lib/theme';
import type { TimeRequest } from '../lib/types';
import { Button } from './Button';
import { Card } from './Card';
import { IconBadge } from './ui';

interface Props {
  request: TimeRequest;
  deviceName?: string;
  busy?: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

export function RequestCard({ request, deviceName, busy, onApprove, onDeny }: Props) {
  const { colors } = useTheme();
  return (
    <Card raised accent={colors.warning}>
      <View style={styles.head}>
        <IconBadge name="hand-left" color={colors.warning} soft={colors.warningSoft} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.h3, { color: colors.text }]}>
            {deviceName ?? request.deviceId} wants{' '}
            <Text style={{ color: colors.warning }}>+{request.minutes} min</Text>
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatRelative(new Date(request.createdAt).toISOString())}
          </Text>
        </View>
      </View>
      {request.reason ? (
        <Text style={[typography.body, { color: colors.text }]}>“{request.reason}”</Text>
      ) : null}
      <View style={styles.actions}>
        <Button label="Deny" variant="danger" full onPress={onDeny} loading={busy} />
        <Button label="Approve" variant="primary" full icon="checkmark" onPress={onApprove} loading={busy} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
