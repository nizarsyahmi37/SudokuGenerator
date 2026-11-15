import { restore, serialize, type Game } from './game';
import { emptyStats, type Stats } from './stats';
import { LEVELS } from './sudoku';

/** A file that carries a player's progress from one browser to another. */
export interface Backup {
    app: 'sudoku';
    v: 1;
    exportedAt: string;
    /** The game in progress in the same form it is saved in, or null. */
    game: string | null;
    stats: Stats;
}

export const MAX_BACKUP_BYTES = 512 * 1024;

export function makeBackup(game: Game | null, stats: Stats, now = new Date()): Backup {
    return { app: 'sudoku', v: 1, exportedAt: now.toISOString(), game: game ? serialize(game) : null, stats };
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9;
const levelRecord = (r: unknown): Record<number, number> | null => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(r)) {
        if (!LEVELS.includes(Number(k) as never) || !isCount(v)) return null;
        out[Number(k)] = Math.floor(v);
    }
    return out;
};

/** Checks statistics from outside and returns a clean copy, or null when anything is off. */
export function cleanStats(raw: unknown): Stats | null {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Partial<Stats>;
    const played = levelRecord(s.played), won = levelRecord(s.won), best = levelRecord(s.best), total = levelRecord(s.total);
    if (s.v !== 1 || !played || !won || !best || !total || !s.daily || typeof s.daily !== 'object' || Array.isArray(s.daily)) return null;
    const daily: Record<string, number> = {};
    for (const [k, v] of Object.entries(s.daily)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isCount(v)) return null;
        daily[k] = Math.floor(v);
    }
    return { v: 1, played, won, best, total, daily };
}

export type ParsedBackup = { ok: true; game: Game | null; stats: Stats } | { ok: false; error: string };

/** Reads a backup file's text. Nothing in it is trusted: the game is rebuilt from its seed and the statistics are re-checked. */
export function parseBackup(text: string): ParsedBackup {
    if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'That file is too large to be a backup.' };
    let data: Partial<Backup>;
    try { data = JSON.parse(text); } catch { return { ok: false, error: 'That file is not a valid backup (it is not JSON).' }; }
    if (!data || data.app !== 'sudoku' || data.v !== 1) return { ok: false, error: 'That file is not a backup from this app.' };
    const stats = cleanStats(data.stats);
    if (!stats) return { ok: false, error: 'The statistics in that backup are damaged.' };
    let game: Game | null = null;
    if (data.game !== null && data.game !== undefined) {
        game = typeof data.game === 'string' ? restore(data.game) : null;
        if (!game) return { ok: false, error: 'The saved game in that backup is damaged.' };
    }
    return { ok: true, game, stats };
}

/** Combines two sets of statistics: counts add up, best times keep the lower one, and each daily puzzle keeps the faster solve. */
export function mergeStats(a: Stats, b: Stats): Stats {
    const out = emptyStats();
    for (const l of LEVELS) {
        const p = (a.played[l] ?? 0) + (b.played[l] ?? 0), w = (a.won[l] ?? 0) + (b.won[l] ?? 0), t = (a.total[l] ?? 0) + (b.total[l] ?? 0);
        if (p) out.played[l] = p;
        if (w) out.won[l] = w;
        if (t) out.total[l] = t;
        const bests = [a.best[l], b.best[l]].filter((v): v is number => v !== undefined);
        if (bests.length) out.best[l] = Math.min(...bests);
    }
    for (const src of [a.daily, b.daily]) for (const [k, v] of Object.entries(src)) out.daily[k] = out.daily[k] === undefined ? v : Math.min(out.daily[k], v);
    return out;
}

export const backupFileName = (now = new Date()) => `sudoku-progress-${now.toISOString().slice(0, 10)}.json`;
