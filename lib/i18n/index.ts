import { en, type MsgKey, type Translation } from './en';
import { ms } from './ms';
import { es } from './es';
import { ar } from './ar';

export type Locale = 'en' | 'ms' | 'es' | 'ar';
export type { MsgKey };

export const LOCALES: Array<{ id: Locale; name: string; dir: 'ltr' | 'rtl' }> = [
    { id: 'en', name: 'English', dir: 'ltr' },
    { id: 'ms', name: 'Bahasa Melayu', dir: 'ltr' },
    { id: 'es', name: 'Español', dir: 'ltr' },
    { id: 'ar', name: 'العربية', dir: 'rtl' },
];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_KEY = 'sudoku-locale';

const MESSAGES: Record<Locale, Translation> = { en: en as unknown as Translation, ms, es, ar };

export const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.id === v);
export const dirOf = (l: Locale) => LOCALES.find((x) => x.id === l)?.dir ?? 'ltr';

/** The best supported language for a list of browser languages such as ["ms-MY", "en"]. */
export function pickLocale(languages: readonly string[]): Locale {
    for (const tag of languages) {
        const base = tag.toLowerCase().split('-')[0];
        if (base === 'id' || base === 'ms') return 'ms'; // Indonesian readers can follow Malay far better than English
        const hit = LOCALES.find((l) => l.id === base);
        if (hit) return hit.id;
    }
    return DEFAULT_LOCALE;
}

export type Vars = Record<string, string | number>;

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text);

/** Looks a message up in a language, falling back to English so nothing is ever blank. */
export function translate(locale: Locale, key: MsgKey, vars?: Vars): string {
    return fill(MESSAGES[locale][key] ?? (en as Record<string, string>)[key] ?? key, vars);
}

/** Picks the plural form of `key` (`key.one`, `key.other`...) that this language uses for `n`. `{n}` is filled in. */
export function translatePlural(locale: Locale, key: string, n: number, vars?: Vars): string {
    const cat = new Intl.PluralRules(locale).select(n);
    const table = MESSAGES[locale];
    const text = table[`${key}.${cat}`] ?? table[`${key}.other`] ?? (en as Record<string, string>)[`${key}.${cat}`] ?? (en as Record<string, string>)[`${key}.other`] ?? key;
    return fill(text, { n, ...vars });
}

export const ALL_MESSAGES = MESSAGES;
