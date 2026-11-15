'use client';

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { LEVELS, LEVEL_NAMES, LEVEL_TECHNIQUES, findConflicts, type Level } from '../lib/sudoku';
import { dailyInfo, newGame, noteDigits, parseShare, reducer, restore, serialize, shareLink, type Action, type Game as GameState } from '../lib/game';
import { TECHNIQUE_NAMES, cellName, explainNext, type Hint } from '../lib/logic';
import { randomSeed } from '../lib/rng';
import { emptyStats, formatTime, loadStats, recordStart, recordWin, saveStats, streaks, totals, type Stats } from '../lib/stats';
import { levelColor } from '../lib/bookConfig';
import { readableOn, css } from '../lib/palette';
import { ExportFormat, ExportKind, exportBoard } from '../lib/export';
import AdSlot from './AdSlot';
import BookBuilder from './BookBuilder';
import FxLayer, { FxHandle } from './FxLayer';
import SettingsPanel from './SettingsPanel';
import { useTheme } from './ThemeProvider';

type Tab = 'play' | 'book';
const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'play', label: 'Play' },
    { id: 'book', label: 'Make a book' },
];
const SAVE_KEY = 'sudoku-game-v1';
type Msg = { text: string; kind: 'ok' | 'err' | '' };

export default function Game() {
    const uid = useId();
    const [tab, setTab] = useState<Tab>('play');
    const [game, dispatch] = useReducer(reducer, null);
    const [selected, setSelected] = useState<number | null>(null);
    const [notesMode, setNotesMode] = useState(false);
    const [autoClear, setAutoClear] = useState(true);
    const [hint, setHint] = useState<Hint | null>(null);
    const [wrongCell, setWrongCell] = useState<number | null>(null);
    const [message, setMessage] = useState<Msg>({ text: '', kind: '' });
    const [stats, setStats] = useState<Stats>(emptyStats);
    const [format, setFormat] = useState<ExportFormat>('pdf');
    const [exporting, setExporting] = useState(false);
    const [plainExport, setPlainExport] = useState(false);

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
        /* eslint-disable react-hooks/set-state-in-effect -- everything here reads browser storage or the URL, which only exists on the client */
        setStats(loadStats());
        const shared = parseShare(window.location.search);
        if (shared) {
            dispatch({ type: 'load', game: newGame(shared.seed, shared.level, 'shared') });
            setMessage({ text: `Loaded a shared puzzle: level ${shared.level}.`, kind: '' });
            window.history.replaceState(null, '', window.location.pathname);
            return;
        }
        let saved = null;
        try { saved = restore(localStorage.getItem(SAVE_KEY)); } catch { /* storage unavailable */ }
        if (saved) {
            dispatch({ type: 'load', game: saved });
            setMessage({ text: saved.won ? 'Welcome back. That puzzle was solved.' : 'Welcome back. Your game was restored.', kind: '' });
        } else {
            dispatch({ type: 'load', game: newGame(randomSeed(), 5, 'random') });
        }
        /* eslint-enable react-hooks/set-state-in-effect */
    }, []);

    // ---- keep the clock running and the save up to date ----
    useEffect(() => {
        if (!game?.started || game.won || game.revealed) return;
        const id = setInterval(() => dispatch({ type: 'tick' }), 1000);
        return () => clearInterval(id);
    }, [game?.started, game?.won, game?.revealed, gameId]);

    useEffect(() => {
        if (!game) return;
        try { localStorage.setItem(SAVE_KEY, serialize(game)); } catch { /* storage unavailable */ }
    }, [game]);

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
            const s = recordWin(stats, next.level, next.seconds, next.kind === 'daily' ? dailyInfo().key : undefined);
            setStats(s); saveStats(s);
        }
    }, [game, stats]);

    const begin = useCallback((g: GameState) => {
        dispatch({ type: 'load', game: g });
        setSelected(null); setHint(null); setWrongCell(null); setNotesMode(false);
        setMessage({ text: `New level ${g.level} puzzle ready.`, kind: '' });
    }, []);

    const touch = useCallback(() => {
        if (!game || game.started) return;
        dispatch({ type: 'start' });
        if (!startedIds.current.has(gameId)) {
            startedIds.current.add(gameId);
            const s = recordStart(stats, game.level);
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
    const autoMessage: Msg | null = full ? (game.won ? { text: 'Solved! Well done.', kind: 'ok' } : { text: 'The board is full, but something is wrong.', kind: 'err' }) : null;
    const shown = autoMessage ?? message;

    const place = (digit: number) => {
        if (!game || selected === null) { setMessage({ text: 'Select a cell first.', kind: '' }); return; }
        if (game.puzzle[selected]) { setMessage({ text: 'That cell is a clue and cannot be changed.', kind: '' }); return; }
        if (!notesMode && digit && remaining[digit] === 0 && game.board[selected] !== digit) return;
        const wrong = !notesMode && digit !== game.solution[selected];
        act({ type: 'input', cell: selected, digit, notes: notesMode, autoClear });
        setMessage({ text: '', kind: '' });
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
    };

    const check = () => {
        if (!game) return;
        if (conflicts.size) return setMessage({ text: 'Some numbers conflict with others in their row, column or box.', kind: 'err' });
        if (game.won) return setMessage({ text: 'Solved! Well done.', kind: 'ok' });
        const wrong = game.board.some((v, i) => v && v !== game.solution[i]);
        setMessage(wrong ? { text: 'Some numbers are wrong.', kind: 'err' } : { text: 'So far so good. Keep going.', kind: 'ok' });
    };

    const askHint = () => {
        if (!game || game.won || game.revealed) return;
        touch();
        act({ type: 'hint' });
        const h = explainNext(game.board, game.solution);
        if ('wrong' in h) {
            setHint(null); setWrongCell(h.wrong); setSelected(h.wrong);
            setMessage({ text: `Check ${cellName(h.wrong)} first: the digit there is not right. Erase it or undo.`, kind: 'err' });
        } else {
            setWrongCell(null); setHint(h); setSelected(h.place.cell);
            setMessage({ text: `Hint: ${h.text}`, kind: '' });
        }
    };
    const applyHint = () => {
        if (!hint || !game) return;
        act({ type: 'input', cell: hint.place.cell, digit: hint.place.digit, notes: false, autoClear });
        fxAt([hint.place.cell], fxcRef.current.accents[1], 16);
        setMessage({ text: `Placed ${hint.place.digit} in ${cellName(hint.place.cell)}.`, kind: '' });
    };

    const solve = () => {
        if (!game) return;
        act({ type: 'solve' });
        setMessage({ text: 'Solution shown.', kind: '' });
    };

    const newRandom = (level: Level) => begin(newGame(randomSeed(), level, 'random'));
    const playDaily = () => {
        if (game && game.kind === 'daily' && game.seed === today.seed) { setMessage({ text: "You are already on today's puzzle.", kind: '' }); return; }
        begin(newGame(today.seed, today.level, 'daily'));
        setMessage({ text: `Today's puzzle: level ${today.level}. Everyone gets the same one.`, kind: '' });
    };
    const share = async () => {
        if (!game) return;
        const url = shareLink(window.location.origin, game);
        try {
            if (navigator.share) await navigator.share({ title: 'Sudoku puzzle', url });
            else { await navigator.clipboard.writeText(url); setMessage({ text: 'Link copied. Anyone who opens it gets this exact puzzle.', kind: 'ok' }); }
        } catch {
            setMessage({ text: `Copy this link to share the puzzle: ${url}`, kind: '' });
        }
    };
    const resetStats = () => { if (window.confirm('Reset all statistics? This cannot be undone.')) { const s = emptyStats(); setStats(s); saveStats(s); } };

    const doExport = async (kind: ExportKind) => {
        if (!game) return;
        setExporting(true);
        try {
            await exportBoard({ puzzle: game.puzzle, solution: game.solution, level: game.level, levelName: LEVEL_NAMES[game.level] }, kind, format, { theme, mode, plain: plainExport });
            setMessage({ text: `Exported the ${kind} board as ${format.toUpperCase()}.`, kind: 'ok' });
        } catch (e) {
            setMessage({ text: 'Export failed: ' + (e as Error).message, kind: 'err' });
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
        document.getElementById(`${uid}-tab-${TABS[to].id}`)?.focus();
    };

    const board = game?.board ?? [];
    const selectedValue = selected !== null ? board[selected] : 0;
    const focusIdx = selected ?? 0;
    const hintCells = new Set(hint?.cells ?? []);
    const lcStyle = (l: Level) => { const c = levelColor(l); return { ['--lc' as string]: css(c), ['--lc-text' as string]: css(readableOn(c)) }; };
    const streak = streaks(stats, today.key);
    const t = totals(stats);
    const dailyDone = stats.daily[today.key] !== undefined;
    const clock = formatTime(game?.seconds ?? 0);

    return (
        <div className="app">
            {/* The particle layer only exists while effects are on, so "off" really means no animation and no extra code. */}
            {effects && <FxLayer ref={fx} />}
            <header className="hero panel">
                <h1>SUDOKU</h1>
                <div role="tablist" aria-label="Sections" className="tabs" onKeyDown={onTabKey}>
                    {TABS.map((tb) => (
                        <button key={tb.id} id={`${uid}-tab-${tb.id}`} role="tab" type="button" aria-selected={tab === tb.id} aria-controls={`${uid}-panel-${tb.id}`}
                            tabIndex={tab === tb.id ? 0 : -1} className={tab === tb.id ? 'on' : ''} onClick={() => setTab(tb.id)}>{tb.label}</button>
                    ))}
                </div>
                <details className="settings-wrap">
                    <summary>Display settings</summary>
                    <SettingsPanel />
                </details>
            </header>

            <main id="main" tabIndex={-1}>
                <div id={`${uid}-panel-play`} role="tabpanel" aria-labelledby={`${uid}-tab-play`} hidden={tab !== 'play'} className="play">
                    <section className="panel board-panel" aria-labelledby={`${uid}-h-board`}>
                        <h2 id={`${uid}-h-board`} className="sr-only">Puzzle board</h2>
                        <div className="statbar">
                            <span className="lvl-pill" style={lcStyle((game?.level ?? 5) as Level)}>Level {game?.level ?? 5} · {LEVEL_NAMES[(game?.level ?? 5) as Level]}</span>
                            <span className="stat" role="timer" aria-label={`Elapsed time ${clock}`}>{clock}</span>
                            <span className="stat">{filledCount}/81</span>
                        </div>
                        <progress className="progress" max={81} value={filledCount} aria-label="Cells filled">{filledCount} of 81</progress>
                        {game && <p className="code">{game.kind === 'daily' ? 'Daily puzzle' : game.kind === 'shared' ? 'Shared puzzle' : 'Puzzle'} <b>{game.seed}</b> · {game.mistakes} mistake{game.mistakes === 1 ? '' : 's'} · {game.hintsUsed} hint{game.hintsUsed === 1 ? '' : 's'}</p>}

                        <div className={`grid${game?.won ? ' won' : ''}`} role="grid" aria-label="Sudoku board. Use arrow keys to move and number keys to fill. Press N to switch pencil notes." onKeyDown={onGridKey}>
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
                                        const label = `Row ${r + 1}, column ${c + 1}, ${v ? v : 'empty'}${given ? ', clue' : ''}${!v && notes ? `, notes ${noteDigits(notes).join(' ')}` : ''}${bad ? ', conflicts with another number' : ''}${hintCells.has(i) ? ', part of the hint' : ''}${wrongCell === i ? ', this digit is wrong' : ''}`;
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
                        <div className={`status ${shown.kind}`} role="status" aria-live="polite">
                            {shown.kind === 'ok' && <span aria-hidden="true">✓ </span>}{shown.kind === 'err' && <span aria-hidden="true">✕ </span>}{shown.text}
                        </div>
                        {hint && (
                            <section className="hint-card" aria-labelledby={`${uid}-hint`}>
                                <h3 id={`${uid}-hint`}>{hint.technique ? `Hint: ${TECHNIQUE_NAMES[hint.technique]}` : 'Hint'}</h3>
                                <p>{hint.text}</p>
                                <div className="tools two">
                                    <button type="button" onClick={applyHint}>Place {hint.place.digit} in {cellName(hint.place.cell)}</button>
                                    <button type="button" onClick={() => setHint(null)}>Dismiss</button>
                                </div>
                            </section>
                        )}
                    </section>

                    <aside className="side" aria-label="Game controls">
                        <section className="panel" aria-labelledby={`${uid}-h-ctl`}>
                            <h2 id={`${uid}-h-ctl`} className="panel-title">New game</h2>
                            <div role="group" aria-label="Level. Choosing one starts a new game." className="level-chips">
                                {LEVELS.map((l) => (
                                    <button key={l} type="button" className={l === game?.level ? 'lchip on' : 'lchip'} style={lcStyle(l)} aria-pressed={l === game?.level}
                                        aria-label={`Level ${l}, ${LEVEL_NAMES[l]}, ${LEVEL_TECHNIQUES[l]}. Starts a new game.`} onClick={() => newRandom(l)}>{l}</button>
                                ))}
                            </div>
                            <p className="hint">{game ? `Level ${game.level} needs: ${LEVEL_TECHNIQUES[game.level]}.${game.grade !== game.level ? ` This puzzle grades as level ${game.grade}.` : ''}` : ''}</p>
                            <div className="toolbar">
                                <button type="button" className="primary" onClick={() => newRandom((game?.level ?? 5) as Level)}>New game</button>
                            </div>
                            <div className="tools two">
                                <button type="button" onClick={playDaily}>Daily puzzle{dailyDone ? ' ✓' : ''}</button>
                                <button type="button" onClick={share}>Share puzzle</button>
                            </div>
                            <p className="hint">Today&apos;s puzzle is level {today.level}.{dailyDone ? ` You solved it in ${formatTime(stats.daily[today.key])}.` : ''}</p>

                            <h3 className="panel-title">Numbers</h3>
                            <div className="pad" role="group" aria-label={notesMode ? 'Number pad, pencil notes on' : 'Number pad'}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                    <button key={n} type="button" aria-disabled={!notesMode && remaining[n] === 0} className={!notesMode && remaining[n] === 0 ? 'is-disabled' : ''} data-left={remaining[n]}
                                        aria-label={!notesMode && remaining[n] === 0 ? `${n}, all placed` : `${n}, ${remaining[n]} left to place`} onClick={() => place(n)}>
                                        {n}
                                    </button>
                                ))}
                                <button type="button" aria-label="Erase" onClick={erase}>⌫</button>
                            </div>
                            <div className="tools four">
                                <button type="button" onClick={() => act({ type: 'undo' })} disabled={!game?.past.length}>Undo</button>
                                <button type="button" onClick={() => act({ type: 'redo' })} disabled={!game?.future.length}>Redo</button>
                                <button type="button" aria-pressed={notesMode} className={notesMode ? 'on' : ''} onClick={() => setNotesMode((v) => !v)}>Notes {notesMode ? 'on' : 'off'}</button>
                                <button type="button" onClick={erase}>Erase</button>
                            </div>
                            <div className="tools">
                                <button type="button" onClick={check}>Check</button>
                                <button type="button" onClick={askHint}>Hint</button>
                                <button type="button" onClick={solve}>Solve</button>
                            </div>
                            <label className="check" style={{ marginTop: 12 }}>
                                <input type="checkbox" checked={autoClear} onChange={(e) => setAutoClear(e.target.checked)} />
                                <span>Remove notes automatically</span>
                            </label>
                            <p className="hint">Select a cell, then type 1–9. N turns pencil notes on or off, Ctrl+Z undoes and Ctrl+Y redoes. Arrow keys move. The small number on each key is how many are still to place.</p>
                        </section>

                        <section className="panel" aria-labelledby={`${uid}-h-stats`}>
                            <details>
                                <summary id={`${uid}-h-stats`} className="panel-title">Your statistics</summary>
                                <p className="hint">Saved only in this browser. {t.won} of {t.played} started games solved. Daily streak {streak.current} {streak.current === 1 ? 'day' : 'days'} (best {streak.best}).</p>
                                <table className="stats">
                                    <caption className="sr-only">Statistics by level</caption>
                                    <thead><tr><th scope="col">Level</th><th scope="col">Solved</th><th scope="col">Best</th><th scope="col">Average</th></tr></thead>
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
                                <button type="button" className="link-button" onClick={resetStats}>Reset statistics</button>
                            </details>
                        </section>

                        <section className="panel" aria-labelledby={`${uid}-h-exp`}>
                            <h2 id={`${uid}-h-exp`} className="panel-title">Save or print this puzzle</h2>
                            <fieldset className="plain">
                                <legend className="sr-only">File format</legend>
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
                                <span>Plain black and white, for home printers</span>
                            </label>
                            <div className="tools">
                                <button type="button" disabled={exporting} onClick={() => doExport('blank')}>Blank</button>
                                <button type="button" disabled={exporting} onClick={() => doExport('solved')}>Solved</button>
                                <button type="button" disabled={exporting} onClick={() => doExport('both')}>Both</button>
                            </div>
                        </section>
                        <AdSlot placement="play" />
                    </aside>
                </div>

                <div id={`${uid}-panel-book`} role="tabpanel" aria-labelledby={`${uid}-tab-book`} hidden={tab !== 'book'}>
                    <BookBuilder gameTheme={theme} gameMode={mode} />
                    <AdSlot placement="book" />
                </div>
            </main>
        </div>
    );
}
