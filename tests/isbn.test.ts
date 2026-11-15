import { describe, expect, it } from 'vitest';
import { ean13Check, ean13Modules, parseIsbn } from '../lib/isbn';

describe('ISBN and EAN-13', () => {
    it('accepts ISBN-13 in common spellings and rejects bad check digits', () => {
        for (const s of ['978-0-306-40615-7', '9780306406157', 'ISBN 978 0 306 40615 7', 'isbn-13: 978-0-306-40615-7']) expect(parseIsbn(s)).toEqual({ ok: true, isbn13: '9780306406157' });
        expect(parseIsbn('9780306406158')).toMatchObject({ ok: false });
        expect(parseIsbn('9770306406157')).toMatchObject({ ok: false });
        expect(parseIsbn('12345')).toMatchObject({ ok: false });
        expect(parseIsbn('')).toMatchObject({ ok: false });
    });

    it('converts a valid ISBN-10, including one ending in X', () => {
        expect(parseIsbn('0-306-40615-2')).toEqual({ ok: true, isbn13: '9780306406157' });
        expect(parseIsbn('080442957X')).toMatchObject({ ok: true });
        expect(parseIsbn('0306406153')).toMatchObject({ ok: false });
    });

    it('computes the check digit', () => {
        expect(ean13Check('978030640615')).toBe(7);
        expect(ean13Check('400638133393')).toBe(1); // 4006381333931, a well known EAN-13
    });

    it('builds the 95 modules of a real EAN-13, with guard patterns', () => {
        const m = ean13Modules('9780306406157');
        expect(m).toHaveLength(95);
        expect(m.slice(0, 3)).toEqual([1, 0, 1]);
        expect(m.slice(45, 50)).toEqual([0, 1, 0, 1, 0]);
        expect(m.slice(92)).toEqual([1, 0, 1]);
        // 4006381333931: the first digit 4 picks parity LGLLGG, then each digit uses its own L or G pattern (worked out by hand).
        expect(ean13Modules('4006381333931').join('').slice(0, 3 + 42)).toBe('101' + '0001101' + '0100111' + '0101111' + '0111101' + '0001001' + '0110011');
        expect(() => ean13Modules('123')).toThrow();
    });
});
