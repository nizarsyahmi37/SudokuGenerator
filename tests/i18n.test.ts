import { describe, expect, it } from 'vitest';
import { en } from '../lib/i18n/en';
import { ALL_MESSAGES, LOCALES, dirOf, pickLocale, translate, translatePlural, type Locale } from '../lib/i18n';

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const others = LOCALES.map((l) => l.id).filter((l) => l !== 'en');

describe('interface languages', () => {
    it('every language has every message, with the same placeholders as English', () => {
        for (const id of others) {
            for (const [key, text] of Object.entries(en)) {
                const t = ALL_MESSAGES[id][key];
                expect(t, `${id} is missing ${key}`).toBeTruthy();
                // A plural form for exactly one (or two) may say the number in words instead of using {n}.
                if (/\.(zero|one|two|few|many|other)$/.test(key)) expect(vars(text)).toEqual(expect.arrayContaining(vars(t)));
                else expect(vars(t), `${id} ${key} placeholders`).toEqual(vars(text));
            }
        }
    });

    it('has no leftover English in the translations of short labels', () => {
        for (const id of others) {
            expect(ALL_MESSAGES[id]['tab.play']).not.toBe(en['tab.play']);
            expect(ALL_MESSAGES[id]['tool.undo']).not.toBe(en['tool.undo']);
        }
    });

    it('fills in values and falls back to English for an unknown key', () => {
        expect(translate('en', 'board.pill', { level: 4, name: 'Casual' })).toBe('Level 4 · Casual');
        expect(translate('es', 'board.pill', { level: 4, name: 'Informal' })).toBe('Nivel 4 · Informal');
        expect(translate('ms', 'msg.placed', { digit: 7, cell: 'r2c3' })).toBe('Meletakkan 7 di r2c3.');
        expect(translate('en', 'nope' as never)).toBe('nope');
    });

    it('chooses the right plural form, including Arabic with six forms', () => {
        expect(translatePlural('en', 'board.mistakes', 1)).toBe('1 mistake');
        expect(translatePlural('en', 'board.mistakes', 3)).toBe('3 mistakes');
        expect(translatePlural('es', 'board.mistakes', 0)).toBe('0 errores');
        const ar = (n: number) => translatePlural('ar', 'board.mistakes', n);
        expect(new Set([0, 1, 2, 3, 11, 100].map(ar)).size).toBe(6);
        expect(ar(2)).toBe('خطآن');
    });

    it('picks a language from the browser settings, and knows which read right to left', () => {
        expect(pickLocale(['fr-FR', 'es-MX', 'en'])).toBe('es');
        expect(pickLocale(['ms-MY'])).toBe('ms');
        expect(pickLocale(['id-ID'])).toBe('ms');
        expect(pickLocale(['ar-EG'])).toBe('ar');
        expect(pickLocale(['ja-JP'])).toBe('en');
        expect(pickLocale([])).toBe('en');
        expect((['en', 'ms', 'es', 'ar'] as Locale[]).map(dirOf)).toEqual(['ltr', 'ltr', 'ltr', 'rtl']);
    });
});
