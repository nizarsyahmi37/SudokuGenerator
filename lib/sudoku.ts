/** Source of randomness in [0, 1). Pass a seeded generator to make output repeatable. */
export type Rand = () => number;

import { LEVEL_BOUNDS, gradePuzzle } from './logic';

export type Board = number[]; // 81 cells, row-major, 0 = empty
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const LEVELS: Level[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * What a player needs to solve each level. Levels are graded by the hardest technique a human
 * solver must use, not by how many clues are given.
 */
export const LEVEL_TECHNIQUES: Record<Level, string> = {
    1: 'Naked singles only',
    2: 'A few hidden singles',
    3: 'Many hidden singles',
    4: 'Locked candidates',
    5: 'Naked and hidden pairs',
    6: 'Hidden pairs, triples, X-Wing',
    7: 'XY-Wing, XYZ-Wing, Swordfish',
    8: 'A little trial and error',
    9: 'More trial and error',
    10: 'Heavy trial and error',
};

export const LEVEL_NAMES: Record<Level, string> = {
    1: 'Beginner', 2: 'Very easy', 3: 'Easy', 4: 'Casual', 5: 'Medium',
    6: 'Tricky', 7: 'Hard', 8: 'Very hard', 9: 'Expert', 10: 'Master',
};

/** Fewest clues allowed per level, so the easy levels also feel easy (they are not just sparse). */
const MIN_CLUES: Record<Level, number> = { 1: 36, 2: 32, 3: 29, 4: 27, 5: 25, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };


const ROW = (i: number) => Math.floor(i / 9);
const COL = (i: number) => i % 9;
const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

function shuffle<T>(arr: T[], rand: Rand): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Backtracking search using bitmasks and the "most constrained cell" heuristic.
 * Calls onSolution for each solution found; stops once it returns true.
 */
function search(board: Board, onSolution: (b: Board) => boolean, rand: Rand | null): boolean {
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
        if (board[i]) {
            const bit = 1 << board[i];
            rows[ROW(i)] |= bit;
            cols[COL(i)] |= bit;
            boxes[BOX(i)] |= bit;
        }
    }

    const solve = (): boolean => {
        let best = -1;
        let bestMask = 0;
        let bestCount = 10;
        for (let i = 0; i < 81; i++) {
            if (board[i]) continue;
            const used = rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)];
            const mask = ~used & 0x3fe;
            let count = 0;
            for (let m = mask; m; m &= m - 1) count++;
            if (count < bestCount) {
                best = i;
                bestMask = mask;
                bestCount = count;
                if (count <= 1) break;
            }
        }
        if (best === -1) return onSolution(board);
        if (bestCount === 0) return false;

        let digits: number[] = [];
        for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
        if (rand) digits = shuffle(digits, rand);

        const r = ROW(best), c = COL(best), b = BOX(best);
        for (const d of digits) {
            const bit = 1 << d;
            board[best] = d;
            rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
            const stop = solve();
            rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
            board[best] = 0;
            if (stop) return true;
        }
        return false;
    };
    return solve();
}

/** Returns a solved copy of the board, or null if unsolvable. */
export function solve(board: Board): Board | null {
    let result: Board | null = null;
    search([...board], (b) => { result = [...b]; return true; }, null);
    return result;
}

/** Counts solutions, stopping early at `limit`. */
export function countSolutions(board: Board, limit = 2): number {
    let n = 0;
    search([...board], () => ++n >= limit, null);
    return n;
}

export function generateSolved(rand: Rand = Math.random): Board {
    let result: Board = new Array(81).fill(0);
    search(result, (b) => { result = [...b]; return true; }, rand);
    return result;
}

export interface Puzzle {
    puzzle: Board;
    solution: Board;
    /** The level this puzzle actually grades as (equals the requested level unless the attempt budget ran out). */
    grade: number;
}

/**
 * Removes clues one at a time while the puzzle keeps a single solution and its logical grade does not
 * overshoot `level`. Returns the final puzzle and its grade.
 */
function carve(solution: Board, level: Level, rand: Rand): { puzzle: Board; grade: number } {
    const puzzle = [...solution];
    let clues = 81, grade = 1;
    for (const idx of shuffle(Array.from({ length: 81 }, (_, i) => i), rand)) {
        if (clues <= MIN_CLUES[level]) break;
        const saved = puzzle[idx];
        puzzle[idx] = 0;
        if (countSolutions(puzzle, 2) !== 1) { puzzle[idx] = saved; continue; }
        clues--;
        if (clues > 44) continue; // far too many clues to matter, skip grading
        const g = gradePuzzle(puzzle, LEVEL_BOUNDS[level]);
        if (g.score >= LEVEL_BOUNDS[level]) { puzzle[idx] = saved; clues++; continue; }
        grade = g.level;
    }
    return { puzzle, grade: clues > 44 ? 1 : grade };
}

/**
 * Generates a puzzle with a unique solution whose logical difficulty matches `level`. Candidates are
 * carved from a solved grid and graded by a human-style solver, which never lets them get harder than
 * the level asked for. With a seeded `rand` the same seed always yields the same puzzle.
 */
export function generatePuzzle(level: Level = 5, rand: Rand = Math.random): Puzzle {
    let best: Puzzle | null = null;
    for (let attempt = 0; attempt < (level >= 6 ? 120 : 40); attempt++) {
        const solution = generateSolved(rand);
        const { puzzle, grade } = carve(solution, level, rand);
        if (!best || grade > best.grade) best = { puzzle, solution, grade };
        if (grade === level) break;
    }
    return best as Puzzle;
}

/** Indices of non-empty cells that clash with another cell in their row, column or box. */
export function findConflicts(board: Board): Set<number> {
    const bad = new Set<number>();
    for (let i = 0; i < 81; i++) {
        if (!board[i]) continue;
        for (let j = i + 1; j < 81; j++) {
            if (board[i] === board[j] && (ROW(i) === ROW(j) || COL(i) === COL(j) || BOX(i) === BOX(j))) {
                bad.add(i);
                bad.add(j);
            }
        }
    }
    return bad;
}
