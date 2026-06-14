// Design tokens + light/dark palettes for the "timeoff" parent app.
// Mode-independent tokens (spacing/radius/typography/shadow) live here too.

export type ThemeMode = 'light' | 'dark';

export interface Palette {
  mode: ThemeMode;
  // Backgrounds & surfaces (low -> high elevation)
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  // Lines
  border: string;
  borderStrong: string;
  // Text
  text: string;
  textMuted: string;
  textFaint: string;
  // Brand
  primary: string;
  primaryPressed: string;
  primaryText: string;
  primarySoft: string;
  // Semantic
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  // Chrome
  tabBar: string;
  overlay: string;
  shadow: string;
  track: string;
}

export const dark: Palette = {
  mode: 'dark',
  bg: '#0A0E1A',
  bgElevated: '#0F1525',
  surface: '#141B2E',
  surfaceAlt: '#1C2540',
  surfaceHover: '#222C4A',
  border: '#243049',
  borderStrong: '#33405E',
  text: '#F3F6FC',
  textMuted: '#9BA8C4',
  textFaint: '#6B7896',
  primary: '#7C8CFF',
  primaryPressed: '#6675F0',
  primaryText: '#0A0E1A',
  primarySoft: 'rgba(124,140,255,0.14)',
  success: '#3FD896',
  successSoft: 'rgba(63,216,150,0.14)',
  danger: '#FF6B81',
  dangerSoft: 'rgba(255,107,129,0.14)',
  warning: '#FFB454',
  warningSoft: 'rgba(255,180,84,0.15)',
  info: '#5BB8FF',
  infoSoft: 'rgba(91,184,255,0.14)',
  tabBar: 'rgba(15,21,37,0.92)',
  overlay: 'rgba(5,8,16,0.6)',
  shadow: '#000000',
  track: '#1C2540',
};

export const light: Palette = {
  mode: 'light',
  bg: '#F4F6FB',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F8',
  surfaceHover: '#E6EAF4',
  border: '#E2E7F1',
  borderStrong: '#CDD5E6',
  text: '#161B2B',
  textMuted: '#5C6781',
  textFaint: '#8A93AC',
  primary: '#5A6BF0',
  primaryPressed: '#4856D8',
  primaryText: '#FFFFFF',
  primarySoft: 'rgba(90,107,240,0.10)',
  success: '#18A565',
  successSoft: 'rgba(24,165,101,0.10)',
  danger: '#E5455F',
  dangerSoft: 'rgba(229,69,95,0.10)',
  warning: '#D98014',
  warningSoft: 'rgba(217,128,20,0.12)',
  info: '#2E86DE',
  infoSoft: 'rgba(46,134,222,0.10)',
  tabBar: 'rgba(255,255,255,0.94)',
  overlay: 'rgba(20,27,43,0.35)',
  shadow: '#1B2440',
  track: '#E6EAF4',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const typography = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.6 },
  stat: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1.2 },
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
  h2: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 12.5, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.4 },
};

export const elevation = (p: Palette, level: 1 | 2 | 3 = 1) => ({
  shadowColor: p.shadow,
  shadowOpacity: p.mode === 'dark' ? 0.4 : 0.12,
  shadowRadius: level === 1 ? 10 : level === 2 ? 18 : 28,
  shadowOffset: { width: 0, height: level === 1 ? 4 : level === 2 ? 8 : 14 },
  elevation: level * 3,
});

// Backwards-compat default export (dark palette) so any not-yet-migrated file
// that imports `{ colors }` still compiles during the migration.
export const colors = dark;
