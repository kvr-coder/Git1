import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, Palette } from './theme';
import { KEYS, storage } from './storage';

export type ThemePref = 'light' | 'dark' | 'system';

interface ThemeCtx {
  colors: Palette;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  ready: boolean;
}

const Ctx = createContext<ThemeCtx>({
  colors: dark,
  pref: 'system',
  setPref: () => {},
  ready: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = (await storage.get(KEYS.themePref)) as ThemePref | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') setPrefState(saved);
      setReady(true);
    })();
  }, []);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    storage.set(KEYS.themePref, p);
  };

  const colors = useMemo<Palette>(() => {
    const effective = pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref;
    return effective === 'light' ? light : dark;
  }, [pref, system]);

  const value = useMemo(() => ({ colors, pref, setPref, ready }), [colors, pref, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}
