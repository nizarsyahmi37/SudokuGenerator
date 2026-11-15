import { describe, expect, it } from 'vitest';
import { CLUES, LEVELS, countSolutions, findConflicts, generatePuzzle, solve } from '../lib/sudoku';
import { normalizeSeed, puzzleRng, randomSeed, seeded } from '../lib/rng';

describe('generator', () => {
    for (const level of LEVELS) {
        it(`level ${level}: unique solution, valid grid, at most ${CLUES[level]} clues`, () => {
            const { puzzle, solution } = generatePuzzle(level, puzzleRng('TEST', level, 0));
            expect(countSolutions(puzzle, 2)).toBe(1);
            expect(solve(puzzle)).toEqual(solution);
            expect(findConflicts(solution).size).toBe(0);
            expect(puzzle.filter(Boolean).length).toBeLessThanOrEqual(CLUES[level] + 2);
            puzzle.forEach((v, i) => { if (v) expect(v).toBe(solution[i]); });
        });
    }
});

describe('seeding', () => {
    it('same seed gives the same puzzle, a different seed a different one', () => {
        const a = generatePuzzle(6, puzzleRng('ABCD-1234', 6, 3));
        const b = generatePuzzle(6, puzzleRng('abcd 1234', 6, 3)); // normalised to the same seed
        const c = generatePuzzle(6, puzzleRng('ABCD-1235', 6, 3));
        expect(b).toEqual(a);
        expect(c.puzzle).not.toEqual(a.puzzle);
    });

    it('each puzzle has its own stream, so counts can change without reshuffling others', () => {
        expect(generatePuzzle(3, puzzleRng('S', 3, 0))).toEqual(generatePuzzle(3, puzzleRng('S', 3, 0)));
        expect(generatePuzzle(3, puzzleRng('S', 3, 0)).puzzle).not.toEqual(generatePuzzle(3, puzzleRng('S', 3, 1)).puzzle);
    });

    it('normalises and generates readable seeds', () => {
        expect(normalizeSeed('  abcd _ 12 ')).toBe('ABCD-12');
        expect(randomSeed()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
        const r = seeded('x');
        const v = r();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
    });
});
