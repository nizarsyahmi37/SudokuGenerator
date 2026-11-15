import { describe, expect, it } from 'vitest';
import { cleanSeed, decodeBookCode, encodeBookCode } from '../lib/bookCode';
import type { Level } from '../lib/sudoku';

const counts = { 1: 2, 2: 2, 3: 0, 4: 0, 5: 5, 6: 0, 7: 0, 8: 0, 9: 0, 10: 500 } as Record<Level, number>;

describe('book code', () => {
    it('round-trips the seed and every count', () => {
        const code = encodeBookCode('k7qx 2mpd', counts);
        expect(code).toMatch(/^B1\.K7QX-2MPD\.[0-9A-Z]{20}\.[0-9A-Z]{2}$/);
        expect(decodeBookCode(code)).toEqual({ seed: 'K7QX-2MPD', counts });
    });

    it('forgives case and spaces, and catches typing mistakes', () => {
        const code = encodeBookCode('ABCD-1234', counts);
        expect(decodeBookCode(`  ${code.toLowerCase().replace('.', '. ')} `)).toEqual({ seed: 'ABCD-1234', counts });
        const bad = code.slice(0, 14) + (code[14] === '0' ? '1' : '0') + code.slice(15);
        expect(decodeBookCode(bad)).toHaveProperty('error');
        expect(decodeBookCode('hello')).toHaveProperty('error');
        expect(decodeBookCode('B1.ABC.12.ZZ')).toHaveProperty('error');
    });

    it('keeps seeds to safe characters and caps counts', () => {
        expect(cleanSeed('a b/c!d')).toBe('A-BCD');
        const decoded = decodeBookCode(encodeBookCode('X', { ...counts, 1: 9999 }));
        expect('counts' in decoded && decoded.counts[1]).toBe(500);
    });
});
