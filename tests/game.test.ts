import { describe, expect, it } from 'vitest';
import { dailyInfo, newGame, parseShare, reducer, restore, serialize, shareLink, type Game } from '../lib/game';
import { emptyStats, recordStart, recordWin, streaks } from '../lib/stats';

const fresh = () => newGame('TEST-GAME', 3, 'random');
const empty = (g: Game) => g.board.findIndex((v, i) => !v && !g.puzzle[i]);
const run = (g: Game, ...actions: Parameters<typeof reducer>[1][]) => actions.reduce<Game>((acc, a) => reducer(acc, a) as Game, g);

describe('game state', () => {
    it('places digits, counts mistakes and wins when the board matches the solution', () => {
        let g = fresh();
        const cell = empty(g);
        const wrong = g.solution[cell] === 9 ? 1 : g.solution[cell] + 1;
        g = run(g, { type: 'input', cell, digit: wrong, notes: false, autoClear: true });
        expect(g.mistakes).toBe(1);
        expect(g.won).toBe(false);
        for (let i = 0; i < 81; i++) if (!g.puzzle[i]) g = run(g, { type: 'input', cell: i, digit: g.solution[i], notes: false, autoClear: true });
        expect(g.won).toBe(true);
    });

    it('undoes and redoes, including pencil notes', () => {
        let g = fresh();
        const cell = empty(g);
        g = run(g, { type: 'input', cell, digit: 4, notes: true, autoClear: true }, { type: 'input', cell, digit: 7, notes: true, autoClear: true });
        expect(g.notes[cell]).toBe((1 << 4) | (1 << 7));
        g = run(g, { type: 'undo' });
        expect(g.notes[cell]).toBe(1 << 4);
        g = run(g, { type: 'redo' });
        expect(g.notes[cell]).toBe((1 << 4) | (1 << 7));
        g = run(g, { type: 'input', cell, digit: g.solution[cell], notes: false, autoClear: true });
        expect(g.notes[cell]).toBe(0);
        g = run(g, { type: 'undo' });
        expect(g.board[cell]).toBe(0);
        expect(g.notes[cell]).toBe((1 << 4) | (1 << 7));
    });

    it('clears a digit from the notes of its neighbours when auto-clear is on', () => {
        let g = fresh();
        const cell = empty(g);
        const mate = g.puzzle.findIndex((v, i) => !v && i !== cell && Math.floor(i / 9) === Math.floor(cell / 9));
        const d = g.solution[cell];
        g = run(g, { type: 'input', cell: mate, digit: d, notes: true, autoClear: true }, { type: 'input', cell, digit: d, notes: false, autoClear: true });
        expect(g.notes[mate] & (1 << d)).toBe(0);
    });

    it('never changes a clue and only runs the clock after the first touch', () => {
        let g = fresh();
        const clue = g.puzzle.findIndex(Boolean);
        expect(run(g, { type: 'input', cell: clue, digit: 1, notes: false, autoClear: true })).toBe(g);
        g = run(g, { type: 'tick' });
        expect(g.seconds).toBe(0);
        g = run(g, { type: 'start' }, { type: 'tick' }, { type: 'tick' });
        expect(g.seconds).toBe(2);
    });

    it('saves and resumes exactly, and rejects tampered data', () => {
        let g = fresh();
        const cell = empty(g);
        g = run(g, { type: 'start' }, { type: 'tick' }, { type: 'input', cell, digit: g.solution[cell], notes: false, autoClear: true });
        const back = restore(serialize(g)) as Game;
        expect(back.board).toEqual(g.board);
        expect(back.puzzle).toEqual(g.puzzle);
        expect(back.seconds).toBe(1);
        expect(restore('not json')).toBeNull();
        const bad = JSON.parse(serialize(g));
        bad.board[g.puzzle.findIndex(Boolean)] = 0; // a clue removed
        expect(restore(JSON.stringify(bad))).toBeNull();
    });
});

describe('sharing and daily puzzle', () => {
    it('round-trips a share link and refuses junk', () => {
        const g = fresh();
        const url = shareLink('https://example.test', g);
        expect(parseShare(new URL(url).search)).toEqual({ seed: g.seed, level: 3 });
        expect(newGame('TEST-GAME', 3, 'shared').puzzle).toEqual(g.puzzle);
        expect(parseShare('?seed=<script>&level=3')).toBeNull();
        expect(parseShare('?seed=ABC&level=11')).toBeNull();
        expect(parseShare('')).toBeNull();
    });

    it('gives everyone the same puzzle on the same day', () => {
        const a = dailyInfo(new Date(2026, 10, 15)), b = dailyInfo(new Date(2026, 10, 15, 23, 59));
        expect(a).toEqual(b);
        expect(a.key).toBe('2026-11-15');
        expect(newGame(a.seed, a.level, 'daily').puzzle).toEqual(newGame(b.seed, b.level, 'daily').puzzle);
        expect(dailyInfo(new Date(2026, 10, 16)).seed).not.toBe(a.seed);
    });
});

describe('statistics', () => {
    it('tracks wins, best times and daily streaks', () => {
        let s = emptyStats();
        s = recordStart(s, 4);
        s = recordWin(s, 4, 300);
        s = recordWin(s, 4, 250);
        expect(s.won[4]).toBe(2);
        expect(s.best[4]).toBe(250);
        s = recordWin(s, 3, 100, '2026-11-13');
        s = recordWin(s, 3, 100, '2026-11-14');
        s = recordWin(s, 3, 100, '2026-11-15');
        expect(streaks(s, '2026-11-15')).toEqual({ current: 3, best: 3 });
        expect(streaks(s, '2026-11-16').current).toBe(3); // still alive until the day after
        expect(streaks(s, '2026-11-17').current).toBe(0);
        s = recordWin(s, 3, 100, '2026-11-20');
        expect(streaks(s, '2026-11-20')).toEqual({ current: 1, best: 3 });
    });
});

describe('pausing', () => {
    it('stops the clock and ignores moves until resumed', () => {
        let g = run(fresh(), { type: 'start' }, { type: 'tick' }, { type: 'tick' });
        expect(g.seconds).toBe(2);
        g = run(g, { type: 'pause' }, { type: 'tick' });
        expect(g.paused).toBe(true);
        expect(g.seconds).toBe(2);
        const cell = empty(g);
        expect(run(g, { type: 'input', cell, digit: 5, notes: false, autoClear: true }).board[cell]).toBe(0);
        expect(run(g, { type: 'hint' }).hintsUsed).toBe(0);
        g = run(g, { type: 'resume' }, { type: 'tick' });
        expect(g.paused).toBe(false);
        expect(g.seconds).toBe(3);
    });

    it('cannot pause a game that has not started and does not save the paused state', () => {
        expect(run(fresh(), { type: 'pause' }).paused).toBe(false);
        const g = run(fresh(), { type: 'start' }, { type: 'pause' });
        expect(restore(serialize(g))?.paused).toBe(false);
    });
});
