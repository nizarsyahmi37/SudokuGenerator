'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LOCALE_KEY, dirOf, isLocale, pickLocale, translate, translatePlural, type Locale, type MsgKey, type Vars } from '../lib/i18n';

interface Ctx {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: (key: MsgKey, vars?: Vars) => string;
    /** A message with plural forms, such as "{n} mistakes". */
    tp: (key: string, n: number, vars?: Vars) => string;
}

const I18nCtx = createContext<Ctx>({
    locale: DEFAULT_LOCALE, setLocale: () => {},
    t: (k, v) => translate(DEFAULT_LOCALE, k, v), tp: (k, n, v) => translatePlural(DEFAULT_LOCALE, k, n, v),
});
export const useI18n = () => useContext(I18nCtx);

/** The language of the interface. Remembered in this browser; the first visit follows the browser's own language. */
export default function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

    useEffect(() => {
        let saved: string | null = null;
        try { saved = localStorage.getItem(LOCALE_KEY); } catch { /* storage may be unavailable */ }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the language is only known on the client, after hydration
        setLocaleState(isLocale(saved) ? saved : pickLocale(navigator.languages?.length ? navigator.languages : [navigator.language ?? 'en']));
    }, []);

    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = dirOf(locale);
    }, [locale]);

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l);
        try { localStorage.setItem(LOCALE_KEY, l); } catch { /* storage may be unavailable */ }
    }, []);

    const value = useMemo<Ctx>(() => ({
        locale, setLocale,
        t: (k, v) => translate(locale, k, v),
        tp: (k, n, v) => translatePlural(locale, k, n, v),
    }), [locale, setLocale]);

    return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}
