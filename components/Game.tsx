'use client';

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { LEVELS, LEVEL_NAMES, findConflicts, type Level } from '../lib/sudoku';
import { MISTAKE_LIMITS, dailyInfo, newGame, noteDigits, parseShare, reducer, restore, serialize, shareLink, type Action, type Game as GameState } from '../lib/game';
import { TECHNIQUE_NAMES, cellName, explainNext, type Hint } from '../lib/logic';
import { randomSeed } from '../lib/rng';
import { emptyStats, formatTime, loadStats, recordStart, recordWin, saveStats, streaks, totals, type Stats } from '../lib/stats';
import { backupFileName, makeBackup, mergeStats, parseBackup } from '../lib/backup';
import { downloadBlob } from '../lib/download';
import { levelColor } from '../lib/bookConfig';
import { readableOn, css } from '../lib/palette';
import { ExportFormat, ExportKind, exportBoard } from '../lib/export';
import AdSlot from './AdSlot';
import dynamic from 'next/dynamic';
import FxLayer, { FxHandle } from './FxLayer';
import SettingsPanel from './SettingsPanel';
import { useTheme } from './ThemeProvider';
import { useI18n } from './I18nProvider';
import type { MsgKey, Vars } from '../lib/i18n';

// The book maker (PDF toolkit, preview, worker client) is only downloaded when someone opens it.
const BookBuilder = dynamic(() => import('./BookBuilder'), { ssr: false });

type Tab = 'play' | 'book';
const TABS: Array<{ id: Tab; key: 'tab.play' | 'tab.book' }> = [
    { id: 'play', key: 'tab.play' },
    { id: 'book', key: 'tab.book' },
];
const SAVE_KEY = 'sudoku-game-v1';
const LIMIT_KEY = 'sudoku-mistake-limit';
const SHORTCUTS: Array<[MsgKey, MsgKey]> = [
    ['key.arrows', 'key.arrows.d'], ['key.homeEnd', 'key.homeEnd.d'], ['key.pages', 'key.pages.d'], ['key.digits', 'key.digits.d'],
    ['key.erase', 'key.erase.d'], ['key.n', 'key.n.d'], ['key.f', 'key.f.d'], ['key.h', 'key.h.d'], ['key.p', 'key.p.d'],
    ['key.undo', 'key.undo.d'], ['key.q', 'key.q.d'],
];/** A status message is kept as a key and its values, so it is translated when shown and follows a change of language. */
type Msg = { key: MsgKey | ''; vars?: Vars; kind: 'ok' | 'err' | '' };
const NONE: Msg = { key: '', kind: '' };
const say = (key: MsgKey, vars?: Vars, kind: Msg['kind'] = ''): Msg => ({ key, vars, kind });

export default function Game() {
    const uid = useId();
    const { t, tp } = useI18n();
    const [tab, setTab] = useState<Tab>('play');
    const [bookOpened, setBookOpened] = useState(false);
    const [game, dispatch] = useReducer(reducer, null);
    const [selected, setSelected] = useState<number | null>(null);
    const [notesMode, setNotesMode] = useState(false);
    const [autoClear, setAutoClear] = useState(true);
    const [hint, setHint] = useState<Hint | null>(null);
    const [wrongCell, setWrongCell] = useState<number | null>(null);
    const [message, setMessage] = useState<Msg>(NONE);
    const [stats, setStats] = useState<Stats>(emptyStats);
    const [format, setFormat] = useState<ExportFormat>('pdf');
    const [exporting, setExporting] = useState(false);
    const [plainExport, setPlainExport] = useState(false);
    const [limit, setLimit] = useState<number>(0);
    const [helpOpen, setHelpOpen] = useState(false);

    const { fx: fxc, mode, theme, effects } = useTheme();
    const fxcRef = useRef(fxc);
    useEffect(() => { fxcRef.current = fxc; }, [fxc]);
    const fx = useRef<FxHandle>(null);
    const cellRefs = useRef<Array<HTMLDivElement | null>>([]);
    const startedIds = useRef(new Set<string>());
    const booted = useRef(false);

    const gameId = game ? `${game.kind}:${game.seed}:${game.level}` : '';
    const today = dailyInfo();

    // ---- start-up: a shared link wins, then a saved game, then a fresh puzzle ----
    useEffect(() => {
        if (booted.current) return; // React strict mode runs effects twice in development; start-up must only happen once
        booted.current = true;
        setStats(loadStats());
        let lim = 0;
        try { lim = Number(localStorage.getItem(LIMIT_KEY)) || 0; } catch { /* storage unavailable */ }
        if (!(MISTAKE_LIMITS as readonly number[]).includes(lim)) lim = 0;
        setLimit(lim);
        const shared = parseShare(window.location.search);
        if (shared) {
            dispatch({ type: 'load', game: newGame(shared.seed, shared.level, 'shared', lim) });
            setMessage(say('msg.shared', { level: shared.level }));
            window.history.replaceState(null, '', window.location.pathname);
            return;
        }
        let saved = null;
        try { saved = restore(localStorage.getItem(SAVE_KEY)); } catch { /* storage unavailable */ }
        if (saved) {
            dispatch({ type: 'load', game: saved });
            setMessage(say(saved.won ? 'msg.welcomeSolved' : 'msg.welcomeRestored'));
        } else {
            dispatch({ type: 'load', game: newGame(randomSeed(), 5, 'random', lim) });
        }
    }, []);

    // ---- keep the clock running and the save up to date ----
    useEffect(() => {
        if (!game?.started || game.paused || game.won || game.revealed) return;
        const id = setInterval(() => dispatch({ type: 'tick' }), 1000);
        return () => clearInterval(id);
    }, [game?.started, game?.paused, game?.won, game?.revealed, gameId]);

    // A hidden tab is paused for the player, because browsers slow timers down in the background and the time would be wrong.
    useEffect(() => {
        const onHide = () => { if (document.visibilityState === 'hidden') dispatch({ type: 'pause' }); };
        document.addEventListener('visibilitychange', onHide);
        return () => document.removeEventListener('visibilitychange', onHide);
    }, []);

    useEffect(() => {
        if (!game) return;
        try { localStorage.setItem(SAVE_KEY, serialize(game)); } catch { /* storage unavailable */ }
    }, [game]);

    const resumeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (game?.paused && document.visibilityState === 'visible') resumeRef.current?.focus(); }, [game?.paused]);

    const fxAt = useCallback((cells: number[], color: number, count: number) => {
        for (const i of cells) {
            const el = cellRefs.current[i];
            if (!el) continue;
            const r = el.getBoundingClientRect();
            fx.current?.burst(r.left + r.width / 2, r.top + r.height / 2, color, count);
        }
    }, []);

    /** Runs an action and handles what follows from it: fireworks and statistics when it wins, stale hints when the board changes. */
    const act = useCallback((a: Action) => {
        if (!game) return;
        const next = reducer(game, a) as GameState;
        dispatch(a);
        if (a.type !== 'tick' && a.type !== 'start' && a.type !== 'hint') { setHint(null); setWrongCell(null); }
        if (next.won && !game.won) {
            fx.current?.fireworks(fxcRef.current.fx);
            const s = recordWin(stats, next.grade, next.seconds, next.kind === 'daily' ? dailyInfo().key : undefined);
            setStats(s); saveStats(s);
        }
    }, [game, stats]);

    const begin = useCallback((g: GameState) => {
        dispatch({ type: 'load', game: g });
        setSelected(null); setHint(null); setWrongCell(null); setNotesMode(false);
        setMessage(say('msg.newReady', { level: g.level }));
    }, []);

    const touch = useCallback(() => {
        if (!game || game.started) return;
        dispatch({ type: 'start' });
        if (!startedIds.current.has(gameId)) {
            startedIds.current.add(gameId);
            const s = recordStart(stats, game.grade);
            setStats(s); saveStats(s);
        }
    }, [game, gameId, stats]);

    const focusCell = useCallback((i: number) => { touch(); setSelected(i); cellRefs.current[i]?.focus(); }, [touch]);

    const conflicts = useMemo(() => findConflicts(game?.board ?? []), [game?.board]);
    const remaining = useMemo(() => {
        const counts = new Array(10).fill(0);
        game?.board.forEach((v, i) => { if (v && !conflicts.has(i)) counts[v]++; });
        return counts.map((c) => Math.max(0, 9 - c));
    }, [game?.board, conflicts]);
    const filledCount = game ? game.board.filter(Boolean).length : 0;
    const full = !!game && !game.revealed && game.board.every(Boolean);
    const autoMessage: Msg | null = game?.lost ? say('msg.gameOver', { n: game.mistakes }, 'err') : full ? (game.won ? say('msg.solved', undefined, 'ok') : say('msg.fullWrong', undefined, 'err')) : null;
    const shown = autoMessage ?? message;

    const place = (digit: number) => {
        if (!game || selected === null) { setMessage(say('msg.selectCell')); return; }
        if (game.puzzle[selected]) { setMessage(say('msg.clue')); return; }
        if (!notesMode && digit && remaining[digit] === 0 && game.board[selected] !== digit) return;
        const wrong = !notesMode && digit !== game.solution[selected];
        act({ type: 'input', cell: selected, digit, notes: notesMode, autoClear });
        setMessage(NONE);
        if (!notesMode) fxAt([selected], wrong ? 0xf43f5e : fxcRef.current.accents[0], wrong ? 10 : 14);
    };
    const erase = () => { if (game && selected !== null) act({ type: 'erase', cell: selected }); };

    const onGridKey = (e: React.KeyboardEvent) => {
        const cur = selected ?? 0;
        const r = Math.floor(cur / 9), c = cur % 9;
        const go = (nr: number, nc: number) => { e.preventDefault(); focusCell(Math.max(0, Math.min(8, nr)) * 9 + Math.max(0, Math.min(8, nc))); };
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const k = e.key.toLowerCase();
            if (k === 'z') { e.preventDefault(); act({ type: e.shiftKey ? 'redo' : 'undo' }); }
            else if (k === 'y') { e.preventDefault(); act({ type: 'redo' }); }
            return;
        }
        if (e.altKey) return;
        switch (e.key) {
            case 'ArrowUp': return go(r - 1, c);
            case 'ArrowDown': return go(r + 1, c);
            case 'ArrowLeft': return go(r, c - 1);
            case 'ArrowRight': return go(r, c + 1);
            case 'Home': return go(r, 0);
            case 'End': return go(r, 8);
            case 'PageUp': return go(0, c);
            case 'PageDown': return go(8, c);
        }
        if (/^[1-9]$/.test(e.key)) { e.preventDefault(); place(Number(e.key)); }
        else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { e.preventDefault(); erase(); }
        else if (e.key.toLowerCase() === 'n') { e.preventDefault(); setNotesMode((v) => !v); }
        else if (e.key.toLowerCase() === 'p') { e.preventDefault(); act({ type: 'pause' }); }
        else if (e.key.toLowerCase() === 'f') { e.preventDefault(); fillNotes(); }
        else if (e.key.toLowerCase() === 'h') { e.preventDefault(); askHint(); }
        else if (e.key === '?') { e.preventDefault(); setHelpOpen((v) => !v); }
    };
    const resume = () => { act({ type: 'resume' }); requestAnimationFrame(() => cellRefs.current[selected ?? 0]?.focus()); };
    const canPause = !!game && game.started && !game.won && !game.lost && !game.revealed;

    const check = () => {
        if (!game) return;
        if (conflicts.size) return setMessage(say('msg.conflicts', undefined, 'err'));
        if (game.won) return setMessage(say('msg.solved', undefined, 'ok'));
        const wrong = game.board.some((v, i) => v && v !== game.solution[i]);
        setMessage(wrong ? say('msg.someWrong', undefined, 'err') : say('msg.soFar', undefined, 'ok'));
    };

    const askHint = () => {
        if (!game || game.won || game.lost || game.revealed) return;
        touch();
        act({ type: 'hint' });
        const h = explainNext(game.board, game.solution);
        if ('wrong' in h) {
            setHint(null); setWrongCell(h.wrong); setSelected(h.wrong);
            setMessage(say('msg.checkCell', { cell: cellName(h.wrong) }, 'err'));
        } else {
            setWrongCell(null); setHint(h); setSelected(h.place.cell);
            setMessage(say('msg.hint', { text: h.text }));
        }
    };
    const applyHint = () => {
        if (!hint || !game) return;
        act({ type: 'input', cell: hint.place.cell, digit: hint.place.digit, notes: false, autoClear });
        fxAt([hint.place.cell], fxcRef.current.accents[1], 16);
        setMessage(say('msg.placed', { digit: hint.place.digit, cell: cellName(hint.place.cell) }));
    };

    const solve = () => {
        if (!game) return;
        act({ type: 'solve' });
        setMessage(say('msg.solution'));
    };

    const newRandom = (level: Level) => begin(newGame(randomSeed(), level, 'random', limit));
    const chooseLimit = (n: number) => { setLimit(n); try { localStorage.setItem(LIMIT_KEY, String(n)); } catch { /* storage unavailable */ } };
    const fillNotes = () => { if (game && !game.won && !game.lost && !game.revealed) { act({ type: 'fillNotes' }); setNotesMode(true); setMessage(say('msg.notesFilled')); } };
    const playDaily = () => {
        if (game && game.kind === 'daily' && game.seed === today.seed) { setMessage(say('msg.alreadyDaily')); return; }
        begin(newGame(today.seed, today.level, 'daily', limit));
        setMessage(say('msg.daily', { level: today.level }));
    };
    const share = async () => {
        if (!game) return;
        const url = shareLink(window.location.origin, game);
        try {
            if (navigator.share) await navigator.share({ title: t('msg.shareTitle'), url });
            else { await navigator.clipboard.writeText(url); setMessage(say('msg.linkCopied', undefined, 'ok')); }
        } catch {
            setMessage(say('msg.copyLink', { url }));
        }
    };
    const exportProgress = () => {
        downloadBlob(new Blob([JSON.stringify(makeBackup(game, stats), null, 2)], { type: 'application/json' }), backupFileName());
        setMessage(say('msg.progressSaved', undefined, 'ok'));
    };
    const importProgress = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const parsed = parseBackup(file.size > 512 * 1024 ? 'x'.repeat(512 * 1024 + 1) : await file.text());
        if ('error' in parsed) { setMessage(say('msg.importFailed', { error: parsed.error }, 'err')); return; }
        const replacing = parsed.game && game?.started && !game.won && !game.revealed;
        if (replacing && !window.confirm(t('confirm.import'))) return;
        const merged = mergeStats(stats, parsed.stats);
        setStats(merged); saveStats(merged);
        if (parsed.game) { dispatch({ type: 'load', game: parsed.game }); setSelected(null); setHint(null); setWrongCell(null); }
        setMessage(say(parsed.game ? 'msg.imported' : 'msg.importedStats', undefined, 'ok'));
    };
    const resetStats = () => { if (window.confirm(t('confirm.resetStats'))) { const s = emptyStats(); setStats(s); saveStats(s); } };

    const doExport = async (kind: ExportKind) => {
        if (!game) return;
        setExporting(true);
        try {
            await exportBoard({ puzzle: game.puzzle, solution: game.solution, level: game.level, levelName: LEVEL_NAMES[game.level] }, kind, format, { theme, mode, plain: plainExport });
            setMessage(say('msg.exported', { kind: t(`export.kind.${kind}` as MsgKey), format: format.toUpperCase() }, 'ok'));
        } catch (e) {
            setMessage(say('msg.exportFailed', { error: (e as Error).message }, 'err'));
        } finally {
            setExporting(false);
        }
    };

    const onTabKey = (e: React.KeyboardEvent) => {
        const i = TABS.findIndex((t) => t.id === tab);
        const to = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
        if (to < 0) return;
        e.preventDefault();
        setTab(TABS[to].id);
        if (TABS[to].id === 'book') setBookOpened(true);
        document.getElementById(`${uid}-tab-${TABS[to].id}`)?.focus();
    };

    const board = game?.board ?? [];
    const selectedValue = selected !== null ? board[selected] : 0;
    const focusIdx = selected ?? 0;
    const hintCells = new Set(hint?.cells ?? []);
    const lcStyle = (l: Level) => { const c = levelColor(l); return { ['--lc' as string]: css(c), ['--lc-text' as string]: css(readableOn(c)) }; };
    const streak = streaks(stats, today.key);
    const tot = totals(stats);
    const dailyDone = stats.daily[today.key] !== undefined;
    const levelName = (l: number) => t(`level.${l}.name` as MsgKey);
    const levelTech = (l: number) => t(`level.${l}.tech` as MsgKey);
    // The level a puzzle really graded as, which can be a notch below the one asked for.
    const shownLevel = (game ? Math.max(1, Math.min(10, game.grade)) : 5) as Level;
    const clock = formatTime(game?.seconds ?? 0);

    return (
        <div className="app">
            {/* The particle layer only exists while effects are on, so "off" really means no animation and no extra code. */}
            {effects && <FxLayer ref={fx} />}
            <header className="hero panel">
                <h1>SUDOKU</h1>
                <div role="tablist" aria-label={t('tabs.label')} className="tabs" onKeyDown={onTabKey}>
                    {TABS.map((tb) => (
                        <button key={tb.id} id={`${uid}-tab-${tb.id}`} role="tab" type="button" aria-selected={tab === tb.id} aria-controls={`${uid}-panel-${tb.id}`}
                            tabIndex={tab === tb.id ? 0 : -1} className={tab === tb.id ? 'on' : ''} onClick={() => { setTab(tb.id); if (tb.id === 'book') setBookOpened(true); }}>{t(tb.key)}</button>
                    ))}
                </div>
                <details className="settings-wrap">
                    <summary>{t('settings.summary')}</summary>
                    <SettingsPanel />
                </details>
            </header>

            <main id="main" tabIndex={-1}>
                <div id={`${uid}-panel-play`} role="tabpanel" aria-labelledby={`${uid}-tab-play`} hidden={tab !== 'play'} className="play">
                    <section className="panel board-panel" aria-labelledby={`${uid}-h-board`}>
                        <h2 id={`${uid}-h-board`} className="sr-only">{t('board.heading')}</h2>
                        <div className="statbar">
                            <span className="lvl-pill" style={lcStyle(shownLevel)}>{t('board.pill', { level: shownLevel, name: levelName(shownLevel) })}</span>
                            <span className="stat" role="timer" aria-label={t(game?.paused ? 'board.timePaused' : 'board.time', { time: clock })}>{clock}</span>
                            <button type="button" className="pause-btn" aria-pressed={!!game?.paused} disabled={!canPause && !game?.paused} onClick={() => act({ type: game?.paused ? 'resume' : 'pause' })}>{t(game?.paused ? 'board.resume' : 'board.pause')}</button>
                            <span className="stat">{filledCount}/81</span>
                        </div>
                        <progress className="progress" max={81} value={filledCount} aria-label={t('board.progress')}>{t('board.progressText', { n: filledCount })}</progress>
                        {!game && <p className="code" aria-hidden="true">&nbsp;</p>}
                        {game && <p className="code">{t(game.kind === 'daily' ? 'board.kind.daily' : game.kind === 'shared' ? 'board.kind.shared' : 'board.kind.random')} <b dir="ltr">{game.seed}</b> · {game.limit ? t('board.mistakesOf', { n: game.mistakes, limit: game.limit }) : tp('board.mistakes', game.mistakes)} · {tp('board.hints', game.hintsUsed)}</p>}

                        <div className="grid-wrap">
                        <div className={`grid${game?.won ? ' won' : ''}${game?.paused ? ' paused' : ''}`} inert={!!game?.paused} role="grid" dir="ltr" aria-label={t('board.label')} onKeyDown={onGridKey}>
                            {Array.from({ length: 9 }, (_, r) => (
                                <div className="row" role="row" key={r}>
                                    {Array.from({ length: 9 }, (_, c) => {
                                        const i = r * 9 + c;
                                        const v = board[i] || 0;
                                        const given = !!game?.puzzle[i];
                                        const notes = game?.notes[i] ?? 0;
                                        const sameRegion = selected !== null && (
                                            r === Math.floor(selected / 9) || c === selected % 9 ||
                                            (Math.floor(r / 3) === Math.floor(selected / 27) && Math.floor(c / 3) === Math.floor((selected % 9) / 3))
                                        );
                                        const bad = conflicts.has(i);
                                        const cls = ['cell', given && 'given', sameRegion && 'peer', selectedValue && v === selectedValue && 'same',
                                            c % 3 === 2 && c < 8 && 'box-r', r % 3 === 2 && r < 8 && 'box-b', bad && 'conflict',
                                            hintCells.has(i) && 'hint', hint?.place.cell === i && 'hint-target', wrongCell === i && 'wrong'].filter(Boolean).join(' ');
                                        const label = `${t('cell.rc', { r: r + 1, c: c + 1, value: v ? v : t('cell.empty') })}${given ? t('cell.clue') : ''}${!v && notes ? t('cell.notes', { list: noteDigits(notes).join(' ') }) : ''}${bad ? t('cell.conflict') : ''}${hintCells.has(i) ? t('cell.hintPart') : ''}${wrongCell === i ? t('cell.wrong') : ''}`;
                                        return (
                                            <div key={i} ref={(el) => { cellRefs.current[i] = el; }} role="gridcell" tabIndex={focusIdx === i ? 0 : -1}
                                                aria-selected={selected === i} className={cls} aria-label={label}
                                                onClick={() => focusCell(i)} onFocus={() => { touch(); setSelected(i); }}>
                                                {v ? <span key={v} className={given ? undefined : 'pop'}>{v}</span>
                                                    : notes ? <span className="notes" aria-hidden="true">{Array.from({ length: 9 }, (_, k) => <i key={k}>{notes & (1 << (k + 1)) ? k + 1 : ''}</i>)}</span> : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        {game?.paused && (
                            <div className="pause-cover" role="region" aria-label={t('pause.region')}>
                                <p><strong>{t('pause.title')}</strong></p>
                                <p>{t('pause.text')}</p>
                                <button ref={resumeRef} type="button" className="primary" onClick={resume}>{t('board.resume')}</button>
                            </div>
                        )}
                        </div>
                        <div className={`status ${shown.kind}`} role="status" aria-live="polite">
                            {shown.kind === 'ok' && <span aria-hidden="true">✓ </span>}{shown.kind === 'err' && <span aria-hidden="true">✕ </span>}{shown.key ? t(shown.key, shown.vars) : ''}
                        </div>
                        {hint && (
                            <section className="hint-card" aria-labelledby={`${uid}-hint`}>
                                <h3 id={`${uid}-hint`}>{hint.technique ? t('hint.titleTech', { technique: TECHNIQUE_NAMES[hint.technique] }) : t('hint.title')}</h3>
                                <p>{hint.text}</p>
                                <div className="tools two">
                                    <button type="button" onClick={applyHint}>{t('hint.place', { digit: hint.place.digit, cell: cellName(hint.place.cell) })}</button>
                                    <button type="button" onClick={() => setHint(null)}>{t('hint.dismiss')}</button>
                                </div>
                            </section>
                        )}
                    </section>

                    <aside className="side" aria-label={t('controls.label')}>
                        <section className="panel" aria-labelledby={`${uid}-h-ctl`}>
                            <h2 id={`${uid}-h-ctl`} className="panel-title">{t('new.title')}</h2>
                            <div role="group" aria-label={t('new.levelGroup')} className="level-chips">
                                {LEVELS.map((l) => (
                                    <button key={l} type="button" className={l === game?.level ? 'lchip on' : 'lchip'} style={lcStyle(l)} aria-pressed={l === game?.level}
                                        aria-label={t('new.levelChip', { level: l, name: levelName(l), tech: levelTech(l) })} onClick={() => newRandom(l)}>{l}</button>
                                ))}
                            </div>
                            <p className="hint">{game ? `${t('new.needs', { level: game.level, tech: levelTech(game.level) })}${game.grade !== game.level ? t('new.graded', { level: game.level, grade: game.grade }) : ''}` : ''}</p>
                            <div className="toolbar">
                                <button type="button" className="primary" onClick={() => newRandom((game?.level ?? 5) as Level)}>{t('new.button')}</button>
                            </div>
                            <div className="field-row">
                                <label htmlFor={`${uid}-limit`}>{t('new.limit')}</label>
                                <select id={`${uid}-limit`} value={limit} onChange={(e) => chooseLimit(Number(e.target.value))}>
                                    {MISTAKE_LIMITS.map((n) => <option key={n} value={n}>{n ? t('new.limitN', { n }) : t('new.limitNone')}</option>)}
                                </select>
                            </div>
                            <p className="hint">{limit ? t('new.limitHintOn', { n: limit }) : t('new.limitHintOff')}</p>
                            <div className="tools two">
                                <button type="button" onClick={playDaily}>{t('new.daily')}{dailyDone ? ' ✓' : ''}</button>
                                <button type="button" onClick={share}>{t('new.share')}</button>
                            </div>
                            <p className="hint">{t('new.todayLevel', { level: today.level })}{dailyDone ? t('new.solvedIn', { time: formatTime(stats.daily[today.key]) }) : ''}</p>

                            <h3 className="panel-title">{t('pad.title')}</h3>
                            <div className="pad" dir="ltr" role="group" aria-label={t(notesMode ? 'pad.groupNotes' : 'pad.group')}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                    <button key={n} type="button" aria-disabled={!notesMode && remaining[n] === 0} className={!notesMode && remaining[n] === 0 ? 'is-disabled' : ''} data-left={remaining[n]}
                                        aria-label={!notesMode && remaining[n] === 0 ? t('pad.allPlaced', { n }) : t('pad.left', { n, left: remaining[n] })} onClick={() => place(n)}>
                                        {n}
                                    </button>
                                ))}
                                <button type="button" aria-label={t('pad.erase')} onClick={erase}>⌫</button>
                            </div>
                            <div className="tools four">
                                <button type="button" onClick={() => act({ type: 'undo' })} disabled={!game?.past.length}>{t('tool.undo')}</button>
                                <button type="button" onClick={() => act({ type: 'redo' })} disabled={!game?.future.length}>{t('tool.redo')}</button>
                                <button type="button" aria-pressed={notesMode} className={notesMode ? 'on' : ''} onClick={() => setNotesMode((v) => !v)}>{t(notesMode ? 'tool.notesOn' : 'tool.notesOff')}</button>
                                <button type="button" onClick={erase}>{t('tool.erase')}</button>
                            </div>
                            <div className="tools">
                                <button type="button" onClick={check}>{t('tool.check')}</button>
                                <button type="button" onClick={askHint}>{t('tool.hint')}</button>
                                <button type="button" onClick={fillNotes}>{t('tool.fill')}</button>
                            </div>
                            <div className="tools two">
                                <button type="button" onClick={solve}>{t('tool.solve')}</button>
                                <button type="button" aria-expanded={helpOpen} aria-controls={`${uid}-keys`} onClick={() => setHelpOpen((v) => !v)}>{t('tool.keys')}</button>
                            </div>
                            {helpOpen && (
                                <div id={`${uid}-keys`} className="shortcuts">
                                    <table>
                                        <caption className="sr-only">{t('tool.keys')}</caption>
                                        <tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><th scope="row"><kbd dir="ltr">{t(k)}</kbd></th><td>{t(d)}</td></tr>)}</tbody>
                                    </table>
                                </div>
                            )}
                            <label className="check" style={{ marginTop: 12 }}>
                                <input type="checkbox" checked={autoClear} onChange={(e) => setAutoClear(e.target.checked)} />
                                <span>{t('tool.autoClear')}</span>
                            </label>
                            <p className="hint">{t('tool.help')}</p>
                        </section>

                        <section className="panel" aria-labelledby={`${uid}-h-stats`}>
                            <details>
                                <summary id={`${uid}-h-stats`} className="panel-title">{t('stats.title')}</summary>
                                <p className="hint">Saved only in this browser. {t('stats.summary', { won: tot.won, played: tot.played, current: streak.current, days: tp('stats.day', streak.current, { n: streak.current }), best: streak.best })}</p>
                                <table className="stats">
                                    <caption className="sr-only">{t('stats.caption')}</caption>
                                    <thead><tr><th scope="col">{t('stats.level')}</th><th scope="col">{t('stats.solved')}</th><th scope="col">{t('stats.best')}</th><th scope="col">{t('stats.average')}</th></tr></thead>
                                    <tbody>
                                        {LEVELS.map((l) => (
                                            <tr key={l}>
                                                <th scope="row">{l}</th>
                                                <td>{stats.won[l] ?? 0}/{stats.played[l] ?? 0}</td>
                                                <td>{stats.best[l] !== undefined ? formatTime(stats.best[l]) : '–'}</td>
                                                <td>{stats.won[l] ? formatTime(Math.round((stats.total[l] ?? 0) / stats.won[l])) : '–'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button type="button" className="link-button" onClick={resetStats}>{t('stats.reset')}</button>
                            </details>
                        </section>

                        <section className="panel" aria-labelledby={`${uid}-h-bak`}>
                            <h2 id={`${uid}-h-bak`} className="panel-title">{t('backup.title')}</h2>
                            <p className="hint">{t('backup.text')}</p>
                            <div className="tools two">
                                <button type="button" onClick={exportProgress}>{t('backup.save')}</button>
                                <label className="file-btn">
                                    <span>{t('backup.open')}</span>
                                    <input type="file" accept="application/json,.json" className="sr-only" onChange={importProgress} />
                                </label>
                            </div>
                            <p className="hint">{t('backup.note')}</p>
                        </section>

                        <section className="panel" aria-labelledby={`${uid}-h-exp`}>
                            <h2 id={`${uid}-h-exp`} className="panel-title">{t('export.title')}</h2>
                            <fieldset className="plain">
                                <legend className="sr-only">{t('export.format')}</legend>
                                <div className="chips">
                                    {(['pdf', 'png', 'jpg'] as ExportFormat[]).map((f) => (
                                        <label key={f} className="chip">
                                            <input type="radio" className="sr-only" name={`${uid}-fmt`} checked={format === f} onChange={() => setFormat(f)} />
                                            <span>{f.toUpperCase()}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <label className="check" style={{ marginTop: 12 }}>
                                <input type="checkbox" checked={plainExport} onChange={(e) => setPlainExport(e.target.checked)} />
                                <span>{t('export.plain')}</span>
                            </label>
                            <div className="tools">
                                <button type="button" disabled={exporting} onClick={() => doExport('blank')}>{t('export.blank')}</button>
                                <button type="button" disabled={exporting} onClick={() => doExport('solved')}>{t('export.solved')}</button>
                                <button type="button" disabled={exporting} onClick={() => doExport('both')}>{t('export.both')}</button>
                            </div>
                        </section>
                        <AdSlot placement="play" />
                    </aside>
                </div>

                <div id={`${uid}-panel-book`} role="tabpanel" aria-labelledby={`${uid}-tab-book`} hidden={tab !== 'book'}>
                    {bookOpened && <BookBuilder gameTheme={theme} gameMode={mode} />}
                    <AdSlot placement="book" />
                </div>
            </main>
        </div>
    );
}
