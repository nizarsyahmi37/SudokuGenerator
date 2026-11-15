import { LEVELS, type Level } from './sudoku';
import { hash, normalizeSeed } from './rng';

const MAX_COUNT = 500;

/** Keeps seeds to letters, digits and hyphens so they can be written into a code. */
export const cleanSeed = (s: string) => normalizeSeed(s).replace(/[^A-Z0-9-]/g, '').slice(0, 40);

const check = (payload: string) => (hash(payload) % 1296).toString(36).toUpperCase().padStart(2, '0');

/**
 * A short code that captures what makes a book repeatable: the seed and how many puzzles of each level.
 * Example: B1.K7QX-2MPD.0202000500000000000A.9F
 */
export function encodeBookCode(seed: string, counts: Record<Level, number>): string {
    const digits = LEVELS.map((l) => Math.min(MAX_COUNT, Math.max(0, Math.floor(counts[l] || 0))).toString(36).toUpperCase().padStart(2, '0')).join('');
    const payload = `B1.${cleanSeed(seed)}.${digits}`;
    return `${payload}.${check(payload)}`;
}

export type DecodedBookCode = { seed: string; counts: Record<Level, number> } | { error: string };

export function decodeBookCode(input: string): DecodedBookCode {
    const code = input.trim().toUpperCase().replace(/\s+/g, '');
    const parts = code.split('.');
    if (parts.length !== 4 || parts[0] !== 'B1') return { error: 'That does not look like a book code. It starts with B1.' };
    const [, seed, digits, ck] = parts;
    if (!seed || !/^[A-Z0-9-]{1,40}$/.test(seed)) return { error: 'The seed in that code is not valid.' };
    if (!/^[0-9A-Z]{20}$/.test(digits)) return { error: 'The puzzle counts in that code are not valid.' };
    if (check(`B1.${seed}.${digits}`) !== ck) return { error: 'That code has a typing mistake: its check characters do not match.' };
    const counts = {} as Record<Level, number>;
    for (const l of LEVELS) {
        const n = parseInt(digits.slice((l - 1) * 2, l * 2), 36);
        if (!Number.isFinite(n) || n > MAX_COUNT) return { error: 'A puzzle count in that code is too large.' };
        counts[l] = n;
    }
    return { seed, counts };
}
