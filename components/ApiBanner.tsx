import { StyleSheet, Text, View } from 'react-native';
import { API_BASE, USE_MOCK } from '../lib/config';
import { colors, radius, spacing } from '../lib/theme';

export function ApiBanner() {
  if (USE_MOCK) {
    return (
      <View style={[styles.bar, { backgroundColor: colors.danger }]}>
        <Text style={styles.text}>
          ⚠️ MOCK MODE — pairing won't reach your real server.{'\n'}
          Create C:\Users\…\Git1\.env with EXPO_PUBLIC_API_BASE=http://&lt;your-IP&gt;:8080
          {'\n'}
          then restart Expo with `npx expo start --lan --clear`.
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.bar, { backgroundColor: '#1E3A2A' }]}>
      <Text style={[styles.text, { color: colors.success }]}>
        ✓ Real server: {API_BASE}
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
