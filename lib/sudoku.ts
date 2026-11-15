export type Board = number[]; // 81 cells, row-major, 0 = empty
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const LEVELS: Level[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Target number of given clues per level: fewer clues = harder. */
export const CLUES: Record<Level, number> = {
    1: 46, 2: 42, 3: 38, 4: 35, 5: 32, 6: 30, 7: 28, 8: 26, 9: 24, 10: 22,
};

export const LEVEL_NAMES: Record<Level, string> = {
    1: 'Beginner', 2: 'Very easy', 3: 'Easy', 4: 'Casual', 5: 'Medium',
    6: 'Tricky', 7: 'Hard', 8: 'Very hard', 9: 'Expert', 10: 'Master',
};

const ROW = (i: number) => Math.floor(i / 9);
const COL = (i: number) => i % 9;
const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Backtracking search using bitmasks and the "most constrained cell" heuristic.
 * Calls onSolution for each solution found; stops once it returns true.
 */
function search(board: Board, onSolution: (b: Board) => boolean, randomize: boolean): boolean {
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
        if (randomize) digits = shuffle(digits);

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
    search([...board], (b) => { result = [...b]; return true; }, false);
    return result;
}

/** Counts solutions, stopping early at `limit`. */
export function countSolutions(board: Board, limit = 2): number {
    let n = 0;
    search([...board], () => ++n >= limit, false);
    return n;
}

export function generateSolved(): Board {
    let result: Board = new Array(81).fill(0);
    search(result, (b) => { result = [...b]; return true; }, true);
    return result;
}

export interface Puzzle {
    puzzle: Board;
    solution: Board;
}

function carve(solution: Board, target: number): Board {
    const puzzle = [...solution];
    let clues = 81;
    for (const idx of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
        if (clues <= target) break;
        const saved = puzzle[idx];
        puzzle[idx] = 0;
        if (countSolutions(puzzle, 2) !== 1) puzzle[idx] = saved;
        else clues--;
    }
    return puzzle;
}

/**
 * Generates a puzzle with a unique solution. Cells are removed while uniqueness holds;
 * for the hardest levels the random order sometimes stalls above the target, so a few
 * attempts are made and the sparsest puzzle is kept.
 */
export function generatePuzzle(level: Level = 5): Puzzle {
    const target = CLUES[level];
    let best: Puzzle | null = null;
    let bestClues = 82;
    for (let attempt = 0; attempt < 30 && bestClues > target; attempt++) {
        const solution = generateSolved();
        const puzzle = carve(solution, target);
        const clues = puzzle.filter(Boolean).length;
        if (clues < bestClues) { best = { puzzle, solution }; bestClues = clues; }
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
