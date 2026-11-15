/** ISBN checking and EAN-13 barcode patterns. Everything here is plain arithmetic, so it runs anywhere. */

export type IsbnResult = { ok: true; isbn13: string } | { ok: false; error: string };

const sum13 = (d: string) => d.slice(0, 12).split('').reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0);
export const ean13Check = (first12: string) => (10 - (sum13(first12) % 10)) % 10;

/** Reads an ISBN typed any common way (hyphens, spaces, "ISBN" in front, ISBN-10 or ISBN-13) and returns the checked ISBN-13. */
export function parseIsbn(input: string): IsbnResult {
    const text = input.trim().replace(/^isbn(-1[03])?:?\s*/i, '').replace(/[\s-]/g, '').toUpperCase();
    if (!text) return { ok: false, error: 'Enter an ISBN.' };
    if (/^\d{9}[\dX]$/.test(text)) {
        const sum = text.split('').reduce((n, c, i) => n + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
        if (sum % 11 !== 0) return { ok: false, error: 'That ISBN-10 has a wrong check digit. Please check each digit.' };
        const first12 = `978${text.slice(0, 9)}`;
        return { ok: true, isbn13: `${first12}${ean13Check(first12)}` };
    }
    if (!/^\d{13}$/.test(text)) return { ok: false, error: 'An ISBN has 13 digits (or 10 for an older ISBN-10).' };
    if (!/^97[89]/.test(text)) return { ok: false, error: 'An ISBN-13 starts with 978 or 979.' };
    if (ean13Check(text) !== Number(text[12])) return { ok: false, error: 'That ISBN has a wrong check digit. Please check each digit.' };
    return { ok: true, isbn13: text };
}

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** The 95 modules (1 = bar, 0 = space) of an EAN-13 barcode for 13 digits. */
export function ean13Modules(digits: string): number[] {
    if (!/^\d{13}$/.test(digits)) throw new Error('EAN-13 needs 13 digits');
    const parity = PARITY[Number(digits[0])];
    let bits = '101';
    for (let i = 0; i < 6; i++) bits += (parity[i] === 'L' ? L : G)[Number(digits[i + 1])];
    bits += '01010';
    for (let i = 0; i < 6; i++) bits += R[Number(digits[i + 7])];
    bits += '101';
    return bits.split('').map(Number);
}

/** Display form such as "978-0-306-40615-7" is not possible without the registration-group tables, so the digits are shown plainly. */
export const isbnText = (isbn13: string) => `ISBN ${isbn13}`;
