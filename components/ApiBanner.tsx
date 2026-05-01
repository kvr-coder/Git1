import { StyleSheet, Text, View } from 'react-native';
import { getApiBase, isMockMode } from '../lib/config';
import { colors, radius, spacing } from '../lib/theme';

export function ApiBanner() {
  if (isMockMode()) {
    return (
      <View style={[styles.bar, { backgroundColor: colors.danger }]}>
        <Text style={styles.text}>
          ⚠️ MOCK MODE — pairing won't reach your server.{'\n'}
          Settings → Server URL → enter http://&lt;your-PC-IP&gt;:8080
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.bar, { backgroundColor: '#1E3A2A' }]}>
      <Text style={[styles.text, { color: colors.success }]}>
        ✓ Server: {getApiBase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  text: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
});
