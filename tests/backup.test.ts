import { describe, expect, it } from 'vitest';
import { backupFileName, cleanStats, makeBackup, mergeStats, parseBackup } from '../lib/backup';
import { newGame, reducer, type Game } from '../lib/game';
import { emptyStats, recordStart, recordWin } from '../lib/stats';

const played = (): Game => {
    let g = newGame('BACKUP-1', 3, 'random');
    const cell = g.board.findIndex((v) => !v);
    g = reducer(g, { type: 'start' }) as Game;
    return reducer(g, { type: 'input', cell, digit: g.solution[cell], notes: false, autoClear: true }) as Game;
};

describe('progress backup', () => {
    it('round-trips a game and its statistics', () => {
        const g = played();
        const stats = recordWin(recordStart(emptyStats(), 3), 3, 120, '2026-11-01');
        const parsed = parseBackup(JSON.stringify(makeBackup(g, stats)));
        expect(parsed.ok).toBe(true);
        if ('error' in parsed) return;
        expect(parsed.game?.board).toEqual(g.board);
        expect(parsed.game?.seed).toBe('BACKUP-1');
        expect(parsed.stats).toEqual(stats);
    });

    it('accepts a backup with no game in it', () => {
        const parsed = parseBackup(JSON.stringify(makeBackup(null, emptyStats())));
        expect(parsed).toMatchObject({ ok: true, game: null });
    });

    it('rejects files that are not backups, are damaged or are tampered with', () => {
        expect(parseBackup('not json').ok).toBe(false);
        expect(parseBackup('{"app":"other","v":1}').ok).toBe(false);
        expect(parseBackup('x'.repeat(600 * 1024)).ok).toBe(false);
        const good = makeBackup(played(), emptyStats());
        expect(parseBackup(JSON.stringify({ ...good, game: '{"v":1}' })).ok).toBe(false);
        expect(parseBackup(JSON.stringify({ ...good, stats: { ...emptyStats(), won: { 3: -5 } } })).ok).toBe(false);
        expect(parseBackup(JSON.stringify({ ...good, stats: { ...emptyStats(), daily: { today: 3 } } })).ok).toBe(false);
        expect(cleanStats({ v: 1, played: { 99: 1 }, won: {}, best: {}, total: {}, daily: {} })).toBeNull();
    });

    it('merges statistics from two devices', () => {
        const a = recordWin(recordStart(emptyStats(), 4), 4, 300, '2026-11-01');
        const b = recordWin(recordStart(recordWin(recordStart(emptyStats(), 4), 4, 200, '2026-11-01'), 4), 4, 500, '2026-11-02');
        const m = mergeStats(a, b);
        expect(m.played[4]).toBe(3);
        expect(m.won[4]).toBe(3);
        expect(m.best[4]).toBe(200);
        expect(m.total[4]).toBe(1000);
        expect(m.daily).toEqual({ '2026-11-01': 200, '2026-11-02': 500 });
    });

    it('names the file by date', () => {
        expect(backupFileName(new Date('2026-11-17T10:00:00Z'))).toBe('sudoku-progress-2026-11-17.json');
    });
});
