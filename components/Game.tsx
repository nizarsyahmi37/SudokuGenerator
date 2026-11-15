'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Board, LEVELS, LEVEL_NAMES, LEVEL_TECHNIQUES, Level, Puzzle, findConflicts, generatePuzzle } from '../lib/sudoku';
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

export default function Game() {
    const uid = useId();
    const [tab, setTab] = useState<Tab>('play');
    const [difficulty, setDifficulty] = useState<Level>(5);
    const [level, setLevel] = useState<Level>(5);
    const [revealed, setRevealed] = useState(false);
    const [game, setGame] = useState<Puzzle | null>(null);
    const [board, setBoard] = useState<Board>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' | '' }>({ text: '', kind: '' });
    const [seconds, setSeconds] = useState(0);
    // The clock only starts once the player first touches the board, not when a puzzle is loaded.
    const [started, setStarted] = useState(false);
    const [format, setFormat] = useState<ExportFormat>('pdf');
    const [exporting, setExporting] = useState(false);
    const [plainExport, setPlainExport] = useState(false);

    const { fx: fxc, effects, mode, theme } = useTheme();
    const fxcRef = useRef(fxc);
    useEffect(() => { fxcRef.current = fxc; }, [fxc]);
    const fx = useRef<FxHandle>(null);
    const cellRefs = useRef<Array<HTMLDivElement | null>>([]);
    const gridRef = useRef<HTMLDivElement>(null);

    const fxAt = useCallback((cells: number[], color: number, count: number) => {
        for (const i of cells) {
            const el = cellRefs.current[i];
            if (!el) continue;
            const r = el.getBoundingClientRect();
            fx.current?.burst(r.left + r.width / 2, r.top + r.height / 2, color, count);
        }
    }, []);

    const newGame = useCallback((d: Level) => {
        const g = generatePuzzle(d);
        setLevel(d);
        setRevealed(false);
        setGame(g);
        setBoard([...g.puzzle]);
        setSelected(null);
        setSeconds(0);
        setStarted(false);
        setMessage({ text: `New level ${d} puzzle ready.`, kind: '' });
    }, []);

    // Generate on the client only (random output would break SSR hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-side initialisation
    useEffect(() => { newGame(5); }, [newGame]);

    const conflicts = useMemo(() => findConflicts(board), [board]);
    const remaining = useMemo(() => {
        const counts = new Array(10).fill(0);
        board.forEach((v, i) => { if (v && !conflicts.has(i)) counts[v]++; });
        return counts.map((c) => Math.max(0, 9 - c));
    }, [board, conflicts]);
    const filledCount = board.filter(Boolean).length;
    const solved = !!game && !revealed && board.length === 81 && board.every((v, i) => v === game.solution[i]);

    useEffect(() => {
        if (!game || !started || solved || revealed) return;
        const id = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [game, started, solved, revealed]);
    const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

    // Auto-check as soon as every cell is filled (unless the solution was revealed with Solve).
    const full = !!game && !revealed && board.length === 81 && board.every(Boolean);
    const autoMessage: typeof message | null = full
        ? (solved ? { text: 'Solved! Well done.', kind: 'ok' } : { text: 'The board is full, but something is wrong.', kind: 'err' })
        : null;
    useEffect(() => {
        if (solved) fx.current?.fireworks(fxcRef.current.fx);
    }, [solved]);

    const focusCell = useCallback((i: number) => { setStarted(true); setSelected(i); cellRefs.current[i]?.focus(); }, []);

    const setCell = useCallback((value: number) => {
        if (selected === null || !game || game.puzzle[selected]) return;
        if (value && remaining[value] === 0 && board[selected] !== value) return;
        const next = [...board];
        next[selected] = value;
        setBoard(next);
        setMessage({ text: '', kind: '' });
        if (value) {
            if (value !== game.solution[selected]) { fxAt([selected], 0xf43f5e, 10); return; }
            fxAt([selected], fxcRef.current.accents[0], 14);
            const r = Math.floor(selected / 9), c = selected % 9;
            const units = [
                Array.from({ length: 9 }, (_, k) => r * 9 + k),
                Array.from({ length: 9 }, (_, k) => k * 9 + c),
                Array.from({ length: 9 }, (_, k) => (Math.floor(r / 3) * 3 + Math.floor(k / 3)) * 9 + Math.floor(c / 3) * 3 + (k % 3)),
            ];
            const done = new Set<number>();
            units.forEach((u) => { if (u.every((i) => next[i] === game.solution[i])) u.forEach((i) => done.add(i)); });
            if (done.size) fxAt([...done], 0xfacc15, 8);
        }
    }, [selected, game, remaining, board, fxAt]);

    /** Keyboard model for the board (ARIA grid): arrows move, 1-9 place, Backspace/Delete/0 erase. */
    const onGridKey = (e: React.KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const cur = selected ?? 0;
        const r = Math.floor(cur / 9), c = cur % 9;
        const go = (nr: number, nc: number) => { e.preventDefault(); focusCell(Math.max(0, Math.min(8, nr)) * 9 + Math.max(0, Math.min(8, nc))); };
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
        if (/^[1-9]$/.test(e.key)) { e.preventDefault(); setCell(Number(e.key)); }
        else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { e.preventDefault(); setCell(0); }
    };

    const check = () => {
        if (!game) return;
        if (conflicts.size) return setMessage({ text: 'Some numbers conflict with others in their row, column or box.', kind: 'err' });
        if (board.every((v, i) => v === game.solution[i])) return setMessage({ text: 'Solved! Well done.', kind: 'ok' });
        const wrong = board.some((v, i) => v && v !== game.solution[i]);
        setMessage(wrong ? { text: 'Some numbers are wrong.', kind: 'err' } : { text: 'So far so good. Keep going.', kind: 'ok' });
    };

    const hint = () => {
        if (!game) return;
        const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
        if (!empty.length) return;
        const i = selected !== null && !board[selected] ? selected : empty[Math.floor(Math.random() * empty.length)];
        setBoard((b) => { const n = [...b]; n[i] = game.solution[i]; return n; });
        setSelected(i);
        setMessage({ text: `Hint: row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1} is ${game.solution[i]}.`, kind: '' });
        fxAt([i], fxcRef.current.accents[1], 16);
    };

    const solve = () => {
        if (!game) return;
        setRevealed(true);
        setBoard([...game.solution]);
        setMessage({ text: 'Solution shown.', kind: '' });
    };

    const doExport = async (kind: ExportKind) => {
        if (!game) return;
        setExporting(true);
        try {
            await exportBoard({ puzzle: game.puzzle, solution: game.solution, level, levelName: LEVEL_NAMES[level] }, kind, format, { theme, mode, plain: plainExport });
            setMessage({ text: `Exported the ${kind} board as ${format.toUpperCase()}.`, kind: 'ok' });
        } catch (e) {
            setMessage({ text: 'Export failed: ' + (e as Error).message, kind: 'err' });
        } finally {
            setExporting(false);
        }
    };

    // Tabs follow the ARIA tabs pattern: arrow keys move between tabs, Home/End jump.
    const onTabKey = (e: React.KeyboardEvent) => {
        const i = TABS.findIndex((t) => t.id === tab);
        const to = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
        if (to < 0) return;
        e.preventDefault();
        setTab(TABS[to].id);
        document.getElementById(`${uid}-tab-${TABS[to].id}`)?.focus();
    };

    const selectedValue = selected !== null ? board[selected] : 0;
    const focusIdx = selected ?? 0;
    const lcStyle = (l: Level) => { const c = levelColor(l); return { ['--lc' as string]: css(c), ['--lc-text' as string]: css(readableOn(c)) }; };

    return (
        <div className="app">
            <FxLayer ref={fx} />
            <header className="hero panel">
                <h1>SUDOKU</h1>
                <div role="tablist" aria-label="Sections" className="tabs" onKeyDown={onTabKey}>
                    {TABS.map((t) => (
                        <button key={t.id} id={`${uid}-tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`${uid}-panel-${t.id}`}
                            tabIndex={tab === t.id ? 0 : -1} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
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
                            <span className="lvl-pill" style={lcStyle(level)}>Level {level} · {LEVEL_NAMES[level]}</span>
                            <span className="stat" role="timer" aria-label={`Elapsed time ${clock}`}>{clock}</span>
                            <span className="stat">{filledCount}/81</span>
                        </div>
                        <progress className="progress" max={81} value={filledCount} aria-label="Cells filled">{filledCount} of 81</progress>

                        <div ref={gridRef} className={`grid${solved ? ' won' : ''}`} role="grid" aria-label="Sudoku board. Use arrow keys to move and number keys to fill." onKeyDown={onGridKey}>
                            {Array.from({ length: 9 }, (_, r) => (
                                <div className="row" role="row" key={r}>
                                    {Array.from({ length: 9 }, (_, c) => {
                                        const i = r * 9 + c;
                                        const v = board[i] || 0;
                                        const given = !!game?.puzzle[i];
                                        const sameRegion = selected !== null && (
                                            r === Math.floor(selected / 9) || c === selected % 9 ||
                                            (Math.floor(r / 3) === Math.floor(selected / 27) && Math.floor(c / 3) === Math.floor((selected % 9) / 3))
                                        );
                                        const bad = conflicts.has(i);
                                        const cls = ['cell', given && 'given', sameRegion && 'peer', selectedValue && v === selectedValue && 'same',
                                            c % 3 === 2 && c < 8 && 'box-r', r % 3 === 2 && r < 8 && 'box-b', bad && 'conflict'].filter(Boolean).join(' ');
                                        return (
                                            <div key={i} ref={(el) => { cellRefs.current[i] = el; }} role="gridcell" tabIndex={focusIdx === i ? 0 : -1}
                                                aria-selected={selected === i} className={cls}
                                                style={{ ['--d' as string]: `${(c + r) * 18}ms` }}
                                                aria-label={`Row ${r + 1}, column ${c + 1}, ${v ? v : 'empty'}${given ? ', clue' : ''}${bad ? ', conflicts with another number' : ''}`}
                                                onClick={() => focusCell(i)} onFocus={() => { setStarted(true); setSelected(i); }}>
                                                {v ? <span key={v} className={given ? undefined : 'pop'}>{v}</span> : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        <div className={`status ${(autoMessage ?? message).kind}`} role="status" aria-live="polite">
                            {(autoMessage ?? message).kind === 'ok' && <span aria-hidden="true">✓ </span>}{(autoMessage ?? message).kind === 'err' && <span aria-hidden="true">✕ </span>}{(autoMessage ?? message).text}
                        </div>
                    </section>

                    <aside className="side" aria-label="Game controls">
                        <section className="panel" aria-labelledby={`${uid}-h-ctl`}>
                            <h2 id={`${uid}-h-ctl`} className="panel-title">New game</h2>
                            <div role="group" aria-label="Level. Choosing one starts a new game." className="level-chips">
                                {LEVELS.map((l) => (
                                    <button key={l} type="button" className={l === level ? 'lchip on' : 'lchip'} style={lcStyle(l)} aria-pressed={l === level}
                                        aria-label={`Level ${l}, ${LEVEL_NAMES[l]}, ${LEVEL_TECHNIQUES[l]}. Starts a new game.`} onClick={() => { setDifficulty(l); newGame(l); }}>{l}</button>
                                ))}
                            </div>
                            <div className="toolbar">
                                <button type="button" className="primary" onClick={() => newGame(difficulty)}>New game</button>
                            </div>

                            <h3 className="panel-title">Numbers</h3>
                            <div className="pad" role="group" aria-label="Number pad">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                    <button key={n} type="button" aria-disabled={remaining[n] === 0} className={remaining[n] === 0 ? 'is-disabled' : ''} data-left={remaining[n]}
                                        aria-label={remaining[n] === 0 ? `${n}, all placed` : `${n}, ${remaining[n]} left to place`} onClick={() => setCell(n)}>
                                        {n}
                                    </button>
                                ))}
                                <button type="button" aria-label="Erase" onClick={() => setCell(0)}>⌫</button>
                            </div>
                            <div className="tools">
                                <button type="button" onClick={check}>Check</button>
                                <button type="button" onClick={hint}>Hint</button>
                                <button type="button" onClick={solve}>Solve</button>
                            </div>
                            <p className="hint">Select a cell, then type 1–9. Arrow keys move, Backspace erases. The small number on each key is how many are still to place.</p>
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
            <span className="sr-only" data-effects={effects ? 'on' : 'off'} />
        </div>
    );
}
