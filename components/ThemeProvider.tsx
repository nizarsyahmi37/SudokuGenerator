'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, THEME_KEYS, type Mode, type ModePref } from '../lib/themes';
import { fxColors } from '../lib/uiTheme';

interface Ctx {
    theme: string;
    setTheme: (k: string) => void;
    modePref: ModePref;
    setModePref: (m: ModePref) => void;
    /** The mode actually in effect (system preference resolved). */
    mode: Mode;
    effects: boolean;
    setEffects: (on: boolean) => void;
    fx: ReturnType<typeof fxColors>;
}

const ThemeCtx = createContext<Ctx>({
    theme: DEFAULT_THEME, setTheme: () => {}, modePref: 'system', setModePref: () => {}, mode: 'dark',
    effects: true, setEffects: () => {}, fx: fxColors(DEFAULT_THEME, 'dark'),
});
export const useTheme = () => useContext(ThemeCtx);

const K = { theme: 'sudoku-theme', mode: 'sudoku-mode', effects: 'sudoku-effects' };
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage may be unavailable */ } };

export default function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState(DEFAULT_THEME);
    const [modePref, setModePrefState] = useState<ModePref>('system');
    const [systemDark, setSystemDark] = useState(true);
    const [effects, setEffectsState] = useState(true);

    // Restore saved choices after hydration. The inline boot script already applied them to <html>.
    useEffect(() => {
        const t = read(K.theme); if (t && THEME_KEYS.includes(t)) setThemeState(t);
        const m = read(K.mode); if (m === 'light' || m === 'dark' || m === 'system') setModePrefState(m);
        const e = read(K.effects);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setEffectsState(e ? e === 'on' : !reduce);
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        setSystemDark(mq.matches);
        const on = (ev: MediaQueryListEvent) => setSystemDark(ev.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);

    const mode: Mode = modePref === 'system' ? (systemDark ? 'dark' : 'light') : modePref;

    useEffect(() => {
        const d = document.documentElement;
        d.dataset.theme = theme;
        d.dataset.mode = mode;
        d.dataset.effects = effects ? 'on' : 'off';
    }, [theme, mode, effects]);

    const setTheme = useCallback((k: string) => { setThemeState(k); write(K.theme, k); }, []);
    const setModePref = useCallback((m: ModePref) => { setModePrefState(m); write(K.mode, m); }, []);
    const setEffects = useCallback((on: boolean) => { setEffectsState(on); write(K.effects, on ? 'on' : 'off'); }, []);
    const fx = useMemo(() => fxColors(theme, mode), [theme, mode]);

    return <ThemeCtx.Provider value={{ theme, setTheme, modePref, setModePref, mode, effects, setEffects, fx }}>{children}</ThemeCtx.Provider>;
}
