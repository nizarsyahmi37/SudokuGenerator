import { LEVELS, generatePuzzle, type Board, type Level } from './sudoku';
import { normalizeSeed, puzzleRng } from './rng';

export type Notes = number[]; // one bitmask of candidate digits per cell (bit n = digit n)
export interface Snapshot { board: Board; notes: Notes }
export type Kind = 'random' | 'daily' | 'shared';

export interface Game {
    level: Level;
    seed: string;
    kind: Kind;
    puzzle: Board;
    solution: Board;
    /** The level the puzzle really grades as. */
    grade: number;
    board: Board;
    notes: Notes;
    past: Snapshot[];
    future: Snapshot[];
    seconds: number;
    started: boolean;
    /** The clock is stopped and the board is hidden. Not saved: a restored game always continues. */
    paused: boolean;
    revealed: boolean;
    hintsUsed: number;
    mistakes: number;
    won: boolean;
}

const HISTORY_LIMIT = 300;
const SAVE_HISTORY = 30;
export const bit = (d: number) => 1 << d;
export const noteDigits = (mask: number) => Array.from({ length: 9 }, (_, i) => i + 1).filter((d) => mask & bit(d));

const peers = (i: number) => {
    const r = Math.floor(i / 9), c = i % 9, out: number[] = [];
    for (let k = 0; k < 81; k++) {
        if (k === i) continue;
        const kr = Math.floor(k / 9), kc = k % 9;
        if (kr === r || kc === c || (Math.floor(kr / 3) === Math.floor(r / 3) && Math.floor(kc / 3) === Math.floor(c / 3))) out.push(k);
    }
    return out;
};
const PEERS = Array.from({ length: 81 }, (_, i) => peers(i));

/** Starts a game. The same seed and level always give the same puzzle, which is what makes sharing work. */
export function newGame(seed: string, level: Level, kind: Kind): Game {
    const s = normalizeSeed(seed);
    const p = generatePuzzle(level, puzzleRng(s, level, 0));
    return {
        level, seed: s, kind, puzzle: p.puzzle, solution: p.solution, grade: p.grade, board: [...p.puzzle], notes: new Array(81).fill(0),
        past: [], future: [], seconds: 0, started: false, paused: false, revealed: false, hintsUsed: 0, mistakes: 0, won: false,
    };
}

export type Action =
    | { type: 'load'; game: Game }
    | { type: 'input'; cell: number; digit: number; notes: boolean; autoClear: boolean }
    | { type: 'erase'; cell: number }
    | { type: 'undo' }
    | { type: 'redo' }
    | { type: 'start' }
    | { type: 'pause' }
    | { type: 'resume' }
    | { type: 'tick' }
    | { type: 'hint' }
    | { type: 'solve' };

const snap = (g: Game): Snapshot => ({ board: [...g.board], notes: [...g.notes] });
const isSolved = (g: Game) => g.board.every((v, i) => v === g.solution[i]);

function commit(g: Game, board: Board, notes: Notes, extra: Partial<Game> = {}): Game {
    const next: Game = { ...g, ...extra, board, notes, past: [...g.past.slice(-(HISTORY_LIMIT - 1)), snap(g)], future: [] };
    next.won = !next.revealed && isSolved(next);
    return next;
}

export function reducer(g: Game | null, a: Action): Game | null {
    if (a.type === 'load') return a.game;
    if (!g) return g;
    switch (a.type) {
        case 'start': return g.started ? g : { ...g, started: true };
        case 'pause': return g.started && !g.paused && !g.won && !g.revealed ? { ...g, paused: true } : g;
        case 'resume': return g.paused ? { ...g, paused: false } : g;
        case 'tick': return g.started && !g.paused && !g.won && !g.revealed ? { ...g, seconds: g.seconds + 1 } : g;
        case 'hint': return g.paused ? g : { ...g, hintsUsed: g.hintsUsed + 1 };
        case 'solve': return g.revealed || g.paused ? g : commit(g, [...g.solution], new Array(81).fill(0), { revealed: true });
        case 'undo': {
            if (g.paused) return g;
            const prev = g.past[g.past.length - 1];
            if (!prev) return g;
            return { ...g, board: [...prev.board], notes: [...prev.notes], past: g.past.slice(0, -1), future: [snap(g), ...g.future], won: false };
        }
        case 'redo': {
            if (g.paused) return g;
            const next = g.future[0];
            if (!next) return g;
            const out = { ...g, board: [...next.board], notes: [...next.notes], past: [...g.past, snap(g)], future: g.future.slice(1) };
            out.won = !out.revealed && isSolved(out);
            return out;
        }
        case 'erase': {
            if (g.paused || g.puzzle[a.cell] || (!g.board[a.cell] && !g.notes[a.cell])) return g;
            const board = [...g.board], notes = [...g.notes];
            board[a.cell] = 0; notes[a.cell] = 0;
            return commit(g, board, notes);
        }
        case 'input': {
            if (g.paused || g.puzzle[a.cell] || g.won || g.revealed) return g;
            const board = [...g.board], notes = [...g.notes];
            if (a.notes) {
                if (board[a.cell]) return g; // pencil marks only go in empty cells
                notes[a.cell] ^= bit(a.digit);
                return commit(g, board, notes);
            }
            if (board[a.cell] === a.digit) return g;
            board[a.cell] = a.digit;
            notes[a.cell] = 0;
            if (a.autoClear) for (const p of PEERS[a.cell]) notes[p] &= ~bit(a.digit);
            const wrong = a.digit !== g.solution[a.cell];
            return commit(g, board, notes, { mistakes: g.mistakes + (wrong ? 1 : 0) });
        }
    }
}

// ---------------- saving and resuming ----------------

interface Saved {
    v: 1; level: Level; seed: string; kind: Kind; board: Board; notes: Notes; past: Snapshot[];
    seconds: number; started: boolean; revealed: boolean; hintsUsed: number; mistakes: number; won: boolean;
}

export function serialize(g: Game): string {
    const s: Saved = {
        v: 1, level: g.level, seed: g.seed, kind: g.kind, board: g.board, notes: g.notes, past: g.past.slice(-SAVE_HISTORY),
        seconds: g.seconds, started: g.started, revealed: g.revealed, hintsUsed: g.hintsUsed, mistakes: g.mistakes, won: g.won,
    };
    return JSON.stringify(s);
}

const okCells = (a: unknown, max: number): a is number[] => Array.isArray(a) && a.length === 81 && a.every((v) => Number.isInteger(v) && v >= 0 && v <= max);

/** Rebuilds a game from saved data. The puzzle itself is regenerated from the seed, never trusted from storage. */
export function restore(raw: string | null): Game | null {
    if (!raw) return null;
    try {
        const s = JSON.parse(raw) as Partial<Saved>;
        if (s.v !== 1 || !LEVELS.includes(s.level as Level) || typeof s.seed !== 'string' || !s.seed || s.seed.length > 60) return null;
        if (!okCells(s.board, 9) || !okCells(s.notes, 1022)) return null;
        const g = newGame(s.seed, s.level as Level, s.kind === 'daily' || s.kind === 'shared' ? s.kind : 'random');
        if (!s.board.every((v, i) => !g.puzzle[i] || v === g.puzzle[i])) return null; // clues must match the puzzle
        const past = Array.isArray(s.past) ? s.past.filter((p) => okCells(p?.board, 9) && okCells(p?.notes, 1022)) : [];
        return { ...g, board: s.board, notes: s.notes, past, seconds: Math.max(0, Math.floor(Number(s.seconds) || 0)), started: !!s.started, revealed: !!s.revealed, hintsUsed: Math.max(0, Number(s.hintsUsed) || 0), mistakes: Math.max(0, Number(s.mistakes) || 0), won: !!s.won };
    } catch {
        return null;
    }
}

// ---------------- daily puzzle ----------------

/** One puzzle per calendar day (in the player's local time). The weekday sets the level: gentle on Monday, tougher by Sunday. */
const DAILY_LEVEL_BY_WEEKDAY: Level[] = [8, 2, 3, 4, 5, 6, 7]; // Sunday first

export function dailyInfo(date = new Date()) {
    const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
    return { key: `${y}-${m}-${d}`, seed: `DAILY-${y}-${m}-${d}`, level: DAILY_LEVEL_BY_WEEKDAY[date.getDay()] };
}

// ---------------- sharing ----------------

export function shareLink(origin: string, g: Pick<Game, 'seed' | 'level'>): string {
    const u = new URL('/', origin);
    u.searchParams.set('seed', g.seed);
    u.searchParams.set('level', String(g.level));
    return u.toString();
}

/** Reads ?seed=…&level=… from a URL query. Returns null for anything that is not a valid puzzle link. */
export function parseShare(search: string): { seed: string; level: Level } | null {
    const q = new URLSearchParams(search);
    const seed = normalizeSeed(q.get('seed') ?? '');
    const level = Number(q.get('level'));
    if (!seed || seed.length > 40 || !/^[A-Z0-9-]+$/.test(seed) || !LEVELS.includes(level as Level)) return null;
    return { seed, level: level as Level };
}
