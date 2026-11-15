import { LEVELS } from './sudoku';

export interface Stats {
    v: 1;
    played: Record<number, number>;
    won: Record<number, number>;
    best: Record<number, number>;
    total: Record<number, number>;
    /** Daily puzzles solved: date (YYYY-MM-DD) to seconds taken. */
    daily: Record<string, number>;
}

export const emptyStats = (): Stats => ({ v: 1, played: {}, won: {}, best: {}, total: {}, daily: {} });

const KEY = 'sudoku-stats-v1';

export function loadStats(): Stats {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return emptyStats();
        const s = JSON.parse(raw) as Partial<Stats>;
        return s.v === 1 && s.played && s.won && s.best && s.total && s.daily ? (s as Stats) : emptyStats();
    } catch {
        return emptyStats();
    }
}

export function saveStats(s: Stats) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

const bump = (r: Record<number, number>, k: number, by = 1) => ({ ...r, [k]: (r[k] ?? 0) + by });

export const recordStart = (s: Stats, level: number): Stats => ({ ...s, played: bump(s.played, level) });

export function recordWin(s: Stats, level: number, seconds: number, dailyKey?: string): Stats {
    const best = s.best[level] === undefined ? seconds : Math.min(s.best[level], seconds);
    return {
        ...s, won: bump(s.won, level), total: bump(s.total, level, seconds), best: { ...s.best, [level]: best },
        daily: dailyKey && s.daily[dailyKey] === undefined ? { ...s.daily, [dailyKey]: seconds } : s.daily,
    };
}

const dayNumber = (key: string) => Math.round(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000);

/** Consecutive days with a daily puzzle solved. The current streak survives until the end of the day after your last win. */
export function streaks(s: Stats, todayKey: string) {
    const days = Object.keys(s.daily).map(dayNumber).sort((a, b) => a - b);
    let best = 0, run = 0;
    days.forEach((d, i) => { run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
    const today = dayNumber(todayKey);
    let current = 0;
    const set = new Set(days);
    for (let d = set.has(today) ? today : today - 1; set.has(d); d--) current++;
    return { current, best };
}

export const totals = (s: Stats) => ({
    played: LEVELS.reduce((n, l) => n + (s.played[l] ?? 0), 0),
    won: LEVELS.reduce((n, l) => n + (s.won[l] ?? 0), 0),
});

export const formatTime = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
