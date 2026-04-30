import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { formatRelative } from '../lib/format';
import { colors, spacing, typography } from '../lib/theme';
import type { TimeRequest } from '../lib/types';

interface Props {
  request: TimeRequest;
  deviceName?: string;
  busy?: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

export function RequestCard({ request, deviceName, busy, onApprove, onDeny }: Props) {
  return (
    <Card>
      <Text style={[typography.h2, { color: colors.text }]}>
        {deviceName ?? request.deviceId} — +{request.minutes} min
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {formatRelative(new Date(request.createdAt).toISOString())}
      </Text>
      {request.reason ? (
        <Text style={[typography.body, { color: colors.text, marginTop: spacing.xs }]}>
          “{request.reason}”
        </Text>
      ) : null}
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button label="Deny" variant="secondary" onPress={onDeny} loading={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Approve" onPress={onApprove} loading={busy} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
