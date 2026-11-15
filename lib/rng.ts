import type { Rand } from './sudoku';

/** 32-bit string hash (xmur3). Turns any seed text into a well-mixed starting number. */
function hash(str: string): number {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
}

/** Small, fast, seedable generator (mulberry32). */
export function seeded(seed: string): Rand {
    let a = hash(seed);
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Normalises user-typed seeds so "abcd 12" and "ABCD-12" give the same book. */
export const normalizeSeed = (s: string) => s.trim().toUpperCase().replace(/[\s_]+/g, '-');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1: easy to read out loud

/** A short, readable random seed such as "K7QX-2MPD". */
export function randomSeed(): string {
    const pick = () => {
        const buf = new Uint32Array(1);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
        else buf[0] = Math.floor(Math.random() * 4294967296);
        return ALPHABET[buf[0] % ALPHABET.length];
    };
    return Array.from({ length: 8 }, pick).join('').replace(/^(.{4})/, '$1-');
}

/** One independent stream per puzzle, so changing the counts never reshuffles the other puzzles. */
export const puzzleRng = (seed: string, level: number, index: number): Rand => seeded(`${normalizeSeed(seed)}|L${level}|#${index}`);
