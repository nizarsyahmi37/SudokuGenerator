import type { Board } from './sudoku';

/** Solving techniques a person would use, from easiest to hardest. */
export type Technique =
    | 'naked-single' | 'hidden-single' | 'locked-candidates'
    | 'naked-pair' | 'hidden-pair' | 'naked-triple' | 'hidden-triple'
    | 'x-wing' | 'xy-wing' | 'swordfish' | 'xyz-wing';

export const TECHNIQUE_NAMES: Record<Technique, string> = {
    'naked-single': 'Naked single', 'hidden-single': 'Hidden single', 'locked-candidates': 'Locked candidates',
    'naked-pair': 'Naked pair', 'hidden-pair': 'Hidden pair', 'naked-triple': 'Naked triple', 'hidden-triple': 'Hidden triple',
    'x-wing': 'X-Wing', 'xy-wing': 'XY-Wing', 'swordfish': 'Swordfish', 'xyz-wing': 'XYZ-Wing',
};

/** How hard each technique is; a puzzle's level comes from the hardest one it needs. */
const TIER: Record<Technique, number> = {
    'naked-single': 1, 'hidden-single': 2, 'locked-candidates': 3, 'naked-pair': 4, 'hidden-pair': 4,
    'naked-triple': 5, 'hidden-triple': 5, 'x-wing': 6, 'xy-wing': 7, 'swordfish': 7, 'xyz-wing': 8,
};

/** How much each technique adds to a puzzle's difficulty score. */
const WEIGHT: Record<Technique, number> = {
    'naked-single': 1, 'hidden-single': 1.5, 'locked-candidates': 2.6, 'naked-pair': 3.2, 'hidden-pair': 3.6,
    'naked-triple': 4.2, 'hidden-triple': 4.6, 'x-wing': 5, 'xy-wing': 5.4, 'swordfish': 5.8, 'xyz-wing': 6,
};

const ORDER: Technique[] = ['naked-single', 'hidden-single', 'locked-candidates', 'naked-pair', 'hidden-pair', 'naked-triple', 'hidden-triple', 'x-wing', 'xy-wing', 'swordfish', 'xyz-wing'];

export interface Step {
    tech: Technique;
    place?: { cell: number; digit: number };
    elim: Array<{ cell: number; digits: number[] }>;
    /** Cells that make the technique work (for highlighting). */
    cells: number[];
    text: string;
}

const ROW = (i: number) => Math.floor(i / 9);
const COL = (i: number) => i % 9;
const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

const UNITS: number[][] = [];
for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) UNITS.push(Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)));
const unitName = (u: number) => (u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`);
const cellName = (i: number) => `r${ROW(i) + 1}c${COL(i) + 1}`;
const cellList = (cells: number[]) => cells.map(cellName).join(', ');

const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
    const s = new Set<number>();
    for (const u of [ROW(i), 9 + COL(i), 18 + BOX(i)]) UNITS[u].forEach((c) => { if (c !== i) s.add(c); });
    return [...s];
});
const sees = (a: number, b: number) => a !== b && (ROW(a) === ROW(b) || COL(a) === COL(b) || BOX(a) === BOX(b));

const bit = (d: number) => 1 << d;
const pop = (m: number) => { let n = 0; for (; m; m &= m - 1) n++; return n; };
const digitsOf = (m: number) => { const out: number[] = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d); return out; };
const join = (ds: number[]) => ds.length > 2 ? `${ds.slice(0, -1).join(', ')} and ${ds[ds.length - 1]}` : ds.join(' and ');

interface State { board: Board; cand: number[] }

function init(board: Board): State {
    const b = [...board];
    const cand = new Array(81).fill(0);
    for (let i = 0; i < 81; i++) {
        if (b[i]) continue;
        let m = 0x3fe;
        for (const p of PEERS[i]) if (b[p]) m &= ~bit(b[p]);
        cand[i] = m;
    }
    return { board: b, cand };
}

function place(st: State, cell: number, d: number) {
    st.board[cell] = d;
    st.cand[cell] = 0;
    for (const p of PEERS[cell]) st.cand[p] &= ~bit(d);
}

function applyStep(st: State, s: Step) {
    if (s.place) place(st, s.place.cell, s.place.digit);
    for (const e of s.elim) for (const d of e.digits) st.cand[e.cell] &= ~bit(d);
}

/** Collects the eliminations a technique would make; null when it would change nothing. */
function eliminations(st: State, cells: number[], digits: number[]) {
    const out: Array<{ cell: number; digits: number[] }> = [];
    for (const c of cells) {
        const ds = digits.filter((d) => st.cand[c] & bit(d));
        if (ds.length) out.push({ cell: c, digits: ds });
    }
    return out.length ? out : null;
}

// ---------------- the techniques ----------------

function nakedSingle(st: State): Step | null {
    for (let i = 0; i < 81; i++) {
        if (!st.board[i] && pop(st.cand[i]) === 1) {
            const d = digitsOf(st.cand[i])[0];
            return { tech: 'naked-single', place: { cell: i, digit: d }, elim: [], cells: [i],
                text: `Naked single: ${cellName(i)} can only be ${d}. Every other digit already appears in its row, column or box.` };
        }
    }
    return null;
}

function hiddenSingle(st: State): Step | null {
    for (let u = 0; u < 27; u++) {
        for (let d = 1; d <= 9; d++) {
            const where = UNITS[u].filter((c) => !st.board[c] && st.cand[c] & bit(d));
            if (where.length === 1 && !UNITS[u].some((c) => st.board[c] === d)) {
                return { tech: 'hidden-single', place: { cell: where[0], digit: d }, elim: [], cells: [where[0], ...UNITS[u].filter((c) => c !== where[0] && !st.board[c])].slice(0, 1),
                    text: `Hidden single: in ${unitName(u)}, the digit ${d} fits in only one cell, ${cellName(where[0])}.` };
            }
        }
    }
    return null;
}

function lockedCandidates(st: State): Step | null {
    for (let b = 0; b < 9; b++) {
        for (let d = 1; d <= 9; d++) {
            const cells = UNITS[18 + b].filter((c) => !st.board[c] && st.cand[c] & bit(d));
            if (cells.length < 2) continue;
            for (const line of [0, 1]) {
                const same = cells.every((c) => (line === 0 ? ROW(c) === ROW(cells[0]) : COL(c) === COL(cells[0])));
                if (!same) continue;
                const u = line === 0 ? ROW(cells[0]) : 9 + COL(cells[0]);
                const el = eliminations(st, UNITS[u].filter((c) => BOX(c) !== b), [d]);
                if (el) return { tech: 'locked-candidates', elim: el, cells,
                    text: `Locked candidates: in box ${b + 1}, the digit ${d} can only go in ${unitName(u)}. So ${d} can be removed from the rest of that ${u < 9 ? 'row' : 'column'}.` };
            }
        }
    }
    for (let u = 0; u < 18; u++) {
        for (let d = 1; d <= 9; d++) {
            const cells = UNITS[u].filter((c) => !st.board[c] && st.cand[c] & bit(d));
            if (cells.length < 2 || !cells.every((c) => BOX(c) === BOX(cells[0]))) continue;
            const b = BOX(cells[0]);
            const el = eliminations(st, UNITS[18 + b].filter((c) => !UNITS[u].includes(c)), [d]);
            if (el) return { tech: 'locked-candidates', elim: el, cells,
                text: `Locked candidates: in ${unitName(u)}, the digit ${d} can only go in box ${b + 1}. So ${d} can be removed from the rest of that box.` };
        }
    }
    return null;
}

function combos<T>(items: T[], k: number): T[][] {
    const out: T[][] = [];
    const rec = (start: number, cur: T[]) => {
        if (cur.length === k) { out.push([...cur]); return; }
        for (let i = start; i < items.length; i++) { cur.push(items[i]); rec(i + 1, cur); cur.pop(); }
    };
    rec(0, []);
    return out;
}

function nakedSubset(st: State, k: 2 | 3): Step | null {
    for (let u = 0; u < 27; u++) {
        const open = UNITS[u].filter((c) => !st.board[c] && pop(st.cand[c]) >= 2 && pop(st.cand[c]) <= k);
        for (const group of combos(open, k)) {
            const union = group.reduce((m, c) => m | st.cand[c], 0);
            if (pop(union) !== k) continue;
            const ds = digitsOf(union);
            const el = eliminations(st, UNITS[u].filter((c) => !group.includes(c) && !st.board[c]), ds);
            if (el) return { tech: k === 2 ? 'naked-pair' : 'naked-triple', elim: el, cells: group,
                text: `Naked ${k === 2 ? 'pair' : 'triple'}: ${cellList(group)} can only hold ${join(ds)}. So those digits can be removed from the other cells in ${unitName(u)}.` };
        }
    }
    return null;
}

function hiddenSubset(st: State, k: 2 | 3): Step | null {
    for (let u = 0; u < 27; u++) {
        const digits = [];
        for (let d = 1; d <= 9; d++) {
            const n = UNITS[u].filter((c) => !st.board[c] && st.cand[c] & bit(d)).length;
            if (n >= 2 && n <= k) digits.push(d);
        }
        for (const group of combos(digits, k)) {
            const cells = UNITS[u].filter((c) => !st.board[c] && group.some((d) => st.cand[c] & bit(d)));
            if (cells.length !== k) continue;
            const others = Array.from({ length: 9 }, (_, i) => i + 1).filter((d) => !group.includes(d));
            const el = eliminations(st, cells, others);
            if (el) return { tech: k === 2 ? 'hidden-pair' : 'hidden-triple', elim: el, cells,
                text: `Hidden ${k === 2 ? 'pair' : 'triple'}: in ${unitName(u)}, the digits ${join(group)} only fit in ${cellList(cells)}. So every other candidate can be removed from those cells.` };
        }
    }
    return null;
}

/** X-Wing (size 2) and Swordfish (size 3): a digit confined to the same columns in several rows. */
function fish(st: State, size: 2 | 3): Step | null {
    for (let d = 1; d <= 9; d++) {
        for (const byRow of [true, false]) {
            const lines: Array<{ line: number; spots: number[] }> = [];
            for (let l = 0; l < 9; l++) {
                const spots = UNITS[byRow ? l : 9 + l].filter((c) => !st.board[c] && st.cand[c] & bit(d)).map((c) => (byRow ? COL(c) : ROW(c)));
                if (spots.length >= 2 && spots.length <= size) lines.push({ line: l, spots });
            }
            for (const group of combos(lines, size)) {
                const cross = new Set(group.flatMap((g) => g.spots));
                if (cross.size !== size) continue;
                const used = group.map((g) => g.line);
                const targets: number[] = [];
                for (const x of cross) for (let l = 0; l < 9; l++) if (!used.includes(l)) targets.push(byRow ? l * 9 + x : x * 9 + l);
                const el = eliminations(st, targets, [d]);
                if (el) {
                    const cells = group.flatMap((g) => g.spots.map((x) => (byRow ? g.line * 9 + x : x * 9 + g.line)));
                    const a = byRow ? 'rows' : 'columns', b = byRow ? 'columns' : 'rows';
                    const lineNames = join(used.map((l) => l + 1)), crossNames = join([...cross].map((x) => x + 1).sort((p, q) => p - q));
                    return { tech: size === 2 ? 'x-wing' : 'swordfish', elim: el, cells,
                        text: `${size === 2 ? 'X-Wing' : 'Swordfish'} on ${d}: in ${a} ${lineNames}, the digit ${d} only fits in ${b} ${crossNames}. So ${d} can be removed from the rest of those ${b}.` };
                }
            }
        }
    }
    return null;
}

function xyWing(st: State): Step | null {
    for (let p = 0; p < 81; p++) {
        if (st.board[p] || pop(st.cand[p]) !== 2) continue;
        const [a, b] = digitsOf(st.cand[p]);
        const pals = PEERS[p].filter((c) => !st.board[c] && pop(st.cand[c]) === 2);
        for (const p1 of pals) {
            if (!(st.cand[p1] & bit(a)) || st.cand[p1] & bit(b)) continue;
            const c = digitsOf(st.cand[p1]).find((d) => d !== a)!;
            for (const p2 of pals) {
                if (p2 === p1 || st.cand[p2] !== (bit(b) | bit(c))) continue;
                const targets = PEERS[p1].filter((t) => sees(t, p2) && t !== p && !st.board[t]);
                const el = eliminations(st, targets, [c]);
                if (el) return { tech: 'xy-wing', elim: el, cells: [p, p1, p2],
                    text: `XY-Wing: ${cellName(p)} holds ${a} or ${b}. If it is ${a}, ${cellName(p1)} must be ${c}; if it is ${b}, ${cellName(p2)} must be ${c}. Either way ${c} is taken, so remove ${c} from cells that see both ${cellName(p1)} and ${cellName(p2)}.` };
            }
        }
    }
    return null;
}

function xyzWing(st: State): Step | null {
    for (let p = 0; p < 81; p++) {
        if (st.board[p] || pop(st.cand[p]) !== 3) continue;
        const ds = digitsOf(st.cand[p]);
        const pals = PEERS[p].filter((c) => !st.board[c] && pop(st.cand[c]) === 2 && (st.cand[c] & ~st.cand[p]) === 0);
        for (const z of ds) {
            const xs = ds.filter((d) => d !== z);
            const p1 = pals.find((c) => st.cand[c] === (bit(xs[0]) | bit(z)));
            const p2 = pals.find((c) => st.cand[c] === (bit(xs[1]) | bit(z)));
            if (p1 === undefined || p2 === undefined) continue;
            const targets = PEERS[p].filter((t) => sees(t, p1) && sees(t, p2) && !st.board[t]);
            const el = eliminations(st, targets, [z]);
            if (el) return { tech: 'xyz-wing', elim: el, cells: [p, p1, p2],
                text: `XYZ-Wing: ${cellName(p)} holds ${join(ds)}, with ${cellName(p1)} (${xs[0]} or ${z}) and ${cellName(p2)} (${xs[1]} or ${z}). One of the three must be ${z}, so remove ${z} from cells that see all three.` };
        }
    }
    return null;
}

const FINDERS: Record<Technique, (st: State) => Step | null> = {
    'naked-single': nakedSingle, 'hidden-single': hiddenSingle, 'locked-candidates': lockedCandidates,
    'naked-pair': (s) => nakedSubset(s, 2), 'hidden-pair': (s) => hiddenSubset(s, 2),
    'naked-triple': (s) => nakedSubset(s, 3), 'hidden-triple': (s) => hiddenSubset(s, 3),
    'x-wing': (s) => fish(s, 2), 'xy-wing': xyWing, 'swordfish': (s) => fish(s, 3), 'xyz-wing': xyzWing,
};

/** The easiest technique that makes progress, or null when none of the known ones do. */
function nextStep(st: State): Step | null {
    for (const t of ORDER) { const s = FINDERS[t](st); if (s) return s; }
    return null;
}

// ---------------- forcing (trying a digit and seeing it fail) ----------------

type Outcome = 'solved' | 'unknown' | 'bad';
const clone = (st: State): State => ({ board: [...st.board], cand: [...st.cand] });

/** True when the position can no longer be completed: an empty cell with no candidates, or a digit with no home. */
function broken(st: State): boolean {
    for (let i = 0; i < 81; i++) if (!st.board[i] && st.cand[i] === 0) return true;
    for (let u = 0; u < 27; u++) {
        let seen = 0;
        for (const c of UNITS[u]) seen |= st.board[c] ? bit(st.board[c]) : st.cand[c];
        if (seen !== 0x3fe) return true;
    }
    return false;
}

/** Singles and locked candidates only: quick enough to run inside many trial branches. */
function propagate(st: State): Outcome {
    for (let guard = 0; guard < 200; guard++) {
        if (broken(st)) return 'bad';
        if (st.board.every(Boolean)) return 'solved';
        const step = nakedSingle(st) ?? hiddenSingle(st) ?? lockedCandidates(st);
        if (!step) return 'unknown';
        applyStep(st, step);
    }
    return 'unknown';
}

/** Repeatedly tries digits that would lead to a contradiction within `depth` levels and removes them. */
function reduce(st: State, depth: number, stat?: { trials: number }): Outcome {
    for (let round = 0; round < 80; round++) {
        const r = propagate(st);
        if (r !== 'unknown' || depth === 0) return r;
        const cells = [];
        for (let i = 0; i < 81; i++) if (!st.board[i] && (depth > 1 ? pop(st.cand[i]) === 2 : pop(st.cand[i]) <= 3)) cells.push(i);
        cells.sort((a, b) => pop(st.cand[a]) - pop(st.cand[b]));
        let progress = false;
        for (const c of cells.slice(0, 40)) {
            for (const d of digitsOf(st.cand[c])) {
                const trial = clone(st);
                place(trial, c, d);
                if (reduce(trial, depth - 1) === 'bad') { st.cand[c] &= ~bit(d); progress = true; if (stat) stat.trials++; }
            }
            if (progress) break;
        }
        if (!progress) return 'unknown';
    }
    return 'unknown';
}

export interface Grade {
    /** Continuous difficulty: the hardest technique, plus a little for every extra advanced step. */
    score: number;
    /** Level 1 to 10. Level 10 means the puzzle needs more than the techniques above (chains or guessing). */
    level: number;
    /** False when grading stopped early because the cap was reached or no technique applied. */
    solved: boolean;
    hardest: Technique | null;
    counts: Partial<Record<Technique | 'trial', number>>;
}

/** Score value that means "needs more than the techniques above". */
const UNSOLVED = 99;

/** Solves like a person would and reports a difficulty score and the hardest technique needed. */
export function gradePuzzle(puzzle: Board, capScore = Infinity): Grade {
    const st = init(puzzle);
    const counts: Partial<Record<Technique | 'trial', number>> = {};
    let hardestW = 0, hardest: Technique | null = null, steps = 0, advanced = 0;
    const score = () => hardestW + 0.1 * advanced + 0.03 * (counts['hidden-single'] ?? 0) + 0.01 * steps;
    for (let guard = 0; guard < 400; guard++) {
        if (st.board.every(Boolean)) break;
        const s = nextStep(st);
        if (!s) {
            if (capScore < 7) return { score: UNSOLVED, level: 10, solved: false, hardest, counts };
            const stat = { trials: 0 };
            if (reduce(clone(st), 1, stat) === 'solved') {
                counts.trial = stat.trials;
                const sc = 7 + 0.35 * stat.trials + 0.1 * advanced;
                return { score: sc, level: levelOf(sc), solved: true, hardest, counts };
            }
            return { score: UNSOLVED, level: 10, solved: false, hardest, counts };
        }
        applyStep(st, s);
        counts[s.tech] = (counts[s.tech] ?? 0) + 1;
        steps++;
        if (WEIGHT[s.tech] >= 2.5) advanced++;
        if (WEIGHT[s.tech] > hardestW) { hardestW = WEIGHT[s.tech]; hardest = s.tech; }
        if (score() >= capScore) return { score: score(), level: levelOf(score()), solved: false, hardest, counts };
    }
    return { score: score(), level: levelOf(score()), solved: true, hardest, counts };
}

/** Lower score bound of each level 1..10 (level n covers LEVEL_BOUNDS[n-1] up to LEVEL_BOUNDS[n]). */
export const LEVEL_BOUNDS = [0, 1.8, 2.4, 3.1, 4.0, 5.0, 6.3, 7.4, 8.2, 9.2, Infinity];
export const levelOf = (score: number) => { let l = 1; while (l < 10 && score >= LEVEL_BOUNDS[l]) l++; return l; };

export interface Hint {
    /** Every step explained, ending with a placement. */
    steps: Step[];
    place: { cell: number; digit: number };
    text: string;
    cells: number[];
    technique: Technique | null;
}

/**
 * Finds the next move from the current board and explains why. If the board holds a digit that is
 * wrong, it points at that instead.
 */
export function explainNext(board: Board, solution: Board): Hint | { wrong: number } {
    for (let i = 0; i < 81; i++) if (board[i] && board[i] !== solution[i]) return { wrong: i };
    const st = init(board);
    const steps: Step[] = [];
    for (let guard = 0; guard < 60; guard++) {
        const s = nextStep(st);
        if (!s) break;
        steps.push(s);
        if (s.place) {
            const hardest = steps.reduce((a, b) => (TIER[b.tech] > TIER[a.tech] ? b : a));
            const cells = [...new Set(steps.flatMap((x) => x.cells).concat(s.place.cell))];
            return { steps, place: s.place, text: steps.map((x) => x.text).join(' Then '), cells, technique: hardest.tech };
        }
        applyStep(st, s);
    }
    // No known technique applies: fall back to the stored solution and say so honestly.
    const empty = board.findIndex((v) => !v);
    const cell = empty < 0 ? 0 : empty;
    return {
        steps: [], place: { cell, digit: solution[cell] }, cells: [cell], technique: null,
        text: `No simple technique applies here. Looking ahead shows ${cellName(cell)} must be ${solution[cell]}.`,
    };
}

export { cellName };
