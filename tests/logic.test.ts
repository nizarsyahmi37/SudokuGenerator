import { describe, expect, it } from 'vitest';
import { explainNext, gradePuzzle } from '../lib/logic';
import { generatePuzzle, solve } from '../lib/sudoku';
import { puzzleRng } from '../lib/rng';

// A well-known gentle puzzle: it falls to singles.
const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'.split('').map(Number);

describe('human-style solver', () => {
    it('grades a gentle puzzle as one that needs only singles', () => {
        const g = gradePuzzle(EASY);
        expect(g.solved).toBe(true);
        expect(g.level).toBeLessThanOrEqual(3);
        expect(['naked-single', 'hidden-single']).toContain(g.hardest);
    });

    it('explains the next move in words and points at cells', () => {
        const solution = solve(EASY) as number[];
        const hint = explainNext(EASY, solution);
        expect('wrong' in hint).toBe(false);
        if (!('wrong' in hint)) {
            expect(hint.text).toMatch(/single/i);
            expect(hint.place.digit).toBe(solution[hint.place.cell]);
            expect(hint.cells).toContain(hint.place.cell);
        }
    });

    it('spots a wrong digit instead of hinting on top of it', () => {
        const solution = solve(EASY) as number[];
        const board = [...EASY];
        const empty = board.findIndex((v) => !v);
        board[empty] = solution[empty] === 9 ? 1 : solution[empty] + 1;
        expect(explainNext(board, solution)).toEqual({ wrong: empty });
    });

    it('can always find a move on generated puzzles, at every level', () => {
        for (const level of [2, 5, 8] as const) {
            const { puzzle, solution } = generatePuzzle(level, puzzleRng('HINT', level, 0));
            const hint = explainNext(puzzle, solution);
            expect('wrong' in hint).toBe(false);
            if (!('wrong' in hint)) expect(hint.place.digit).toBe(solution[hint.place.cell]);
        }
    });
});
