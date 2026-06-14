import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import { spacing } from '../lib/theme';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  topInset?: boolean;
}

export function Screen({ children, scroll = true, refreshing, onRefresh, topInset = true }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: topInset ? insets.top + spacing.sm : spacing.md,
    paddingBottom: insets.bottom + spacing.xxl,
  };

  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <View style={[styles.content, pad]}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.content, pad]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
});
