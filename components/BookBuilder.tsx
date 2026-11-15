'use client';

import { useEffect, useId, useState } from 'react';
import { LEVELS, LEVEL_NAMES, CLUES, Level } from '../lib/sudoku';
import { PAGE_SIZES, buildBook, levelColor, totalPuzzles } from '../lib/book';
import { THEME_KEYS, getTheme, themeLabel, type Mode } from '../lib/themes';
import { css, readableOn } from '../lib/palette';

const MAX_TOTAL = 500;

function Step({ n, title, hint, children, id }: { n: number; title: string; hint: string; children: React.ReactNode; id: string }) {
    return (
        <section className="panel step" aria-labelledby={id}>
            <div className="step-head"><span className="step-no" aria-hidden="true">{n}</span><div><h2 id={id}>{title}</h2><p>{hint}</p></div></div>
            {children}
        </section>
    );
}

export default function BookBuilder({ gameTheme, gameMode }: { gameTheme: string; gameMode: Mode }) {
    const uid = useId();
    const [counts, setCounts] = useState<Record<Level, number>>(
        () => Object.fromEntries(LEVELS.map((l) => [l, 2])) as Record<Level, number>,
    );
    const [size, setSize] = useState('A5');
    const [custom, setCustom] = useState({ w: 148, h: 210 });
    const [perPage, setPerPage] = useState<1 | 2>(1);
    const [title, setTitle] = useState('Sudoku Puzzle Book');
    const [theme, setTheme] = useState(gameTheme);
    const [paper, setPaper] = useState<Mode>(gameMode);
    const [progress, setProgress] = useState({ text: '', pct: 0, error: false });
    const [busy, setBusy] = useState(false);

    // The book follows the game's theme and light/dark mode, and can still be changed in step 3.
    useEffect(() => setTheme(gameTheme), [gameTheme]);
    useEffect(() => setPaper(gameMode), [gameMode]);

    const total = totalPuzzles(counts);
    const [w, h] = size === 'Custom' ? [custom.w, custom.h] : PAGE_SIZES[size];
    const validSize = w >= 60 && h >= 60 && w <= 600 && h <= 600;
    const canBuild = total > 0 && total <= MAX_TOTAL && validSize && !busy;
    const pages = total ? 3 + Math.ceil(total / perPage) + Math.ceil(total / 4) : 0;

    const setCount = (l: Level, v: number) => setCounts((c) => ({ ...c, [l]: Math.max(0, Math.min(MAX_TOTAL, Math.floor(v) || 0)) }));
    const preset = (n: number) => setCounts(Object.fromEntries(LEVELS.map((l) => [l, n])) as Record<Level, number>);

    const build = async () => {
        setBusy(true);
        setProgress({ text: 'Starting…', pct: 0, error: false });
        try {
            const pdf = await buildBook(
                { counts, pageWidth: w, pageHeight: h, puzzlesPerPage: perPage, title, theme, mode: paper },
                (done, all, phase) => setProgress({ text: `${phase}… ${done} of ${all}`, pct: all ? (done / all) * 100 : 0, error: false }),
            );
            pdf.save('sudoku-book.pdf');
            setProgress({ text: `Done. Your ${pdf.getNumberOfPages()}-page book has been downloaded.`, pct: 100, error: false });
        } catch (e) {
            setProgress({ text: 'The book could not be created: ' + (e as Error).message, pct: 0, error: true });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="book">
            <Step n={1} id={`${uid}-s1`} title="Choose your puzzles" hint="How many puzzles of each level should the book contain?">
                <div className="presets">
                    <button type="button" onClick={() => preset(2)}>2 of each</button>
                    <button type="button" onClick={() => preset(5)}>5 of each</button>
                    <button type="button" onClick={() => preset(0)}>Clear all</button>
                </div>
                <div className="levels">
                    {LEVELS.map((l) => (
                        <div key={l} className={`level-row${counts[l] ? ' active' : ''}`} style={{ ['--lc' as string]: css(levelColor(l)) }}>
                            <span className="dot" aria-hidden="true" />
                            <span className="lname"><b>Level {l}</b><em>{LEVEL_NAMES[l]} · {CLUES[l]} clues</em></span>
                            <span className="stepper" role="group" aria-label={`Level ${l} puzzles`}>
                                <button type="button" aria-label={`Fewer level ${l} puzzles`} onClick={() => setCount(l, counts[l] - 1)}>−</button>
                                <input type="number" inputMode="numeric" min={0} max={MAX_TOTAL} value={counts[l]} onChange={(e) => setCount(l, Number(e.target.value))} aria-label={`Number of level ${l} puzzles`} />
                                <button type="button" aria-label={`More level ${l} puzzles`} onClick={() => setCount(l, counts[l] + 1)}>+</button>
                            </span>
                        </div>
                    ))}
                </div>
                <p className={`status ${total > MAX_TOTAL ? 'err' : ''}`} role="status">
                    {total} puzzle{total === 1 ? '' : 's'} selected{total > MAX_TOTAL ? `. The maximum is ${MAX_TOTAL}.` : ''}
                </p>
            </Step>

            <Step n={2} id={`${uid}-s2`} title="Page setup" hint="Solutions always go at the back, four to a page.">
                <fieldset className="plain">
                    <legend className="field-label">Page size</legend>
                    <div className="chips">
                        {[...Object.keys(PAGE_SIZES), 'Custom'].map((k) => (
                            <label key={k} className="chip">
                                <input type="radio" className="sr-only" name={`${uid}-size`} checked={size === k} onChange={() => setSize(k)} />
                                <span>{k}{k === 'A5' ? ' (default)' : ''}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                {size === 'Custom' && (
                    <div className="custom-size">
                        <label className="field">Width (mm)
                            <input type="number" min={60} max={600} value={custom.w} onChange={(e) => setCustom({ ...custom, w: Number(e.target.value) })} aria-invalid={!validSize} aria-describedby={validSize ? undefined : `${uid}-size-err`} />
                        </label>
                        <label className="field">Height (mm)
                            <input type="number" min={60} max={600} value={custom.h} onChange={(e) => setCustom({ ...custom, h: Number(e.target.value) })} aria-invalid={!validSize} aria-describedby={validSize ? undefined : `${uid}-size-err`} />
                        </label>
                    </div>
                )}
                {!validSize && <p id={`${uid}-size-err`} className="status err" role="alert">Width and height must be between 60 and 600 mm.</p>}
                <fieldset className="plain" style={{ marginTop: 14 }}>
                    <legend className="field-label">Puzzles per page</legend>
                    <div className="chips">
                        <label className="chip"><input type="radio" className="sr-only" name={`${uid}-per`} checked={perPage === 1} onChange={() => setPerPage(1)} /><span>1, larger boards</span></label>
                        <label className="chip"><input type="radio" className="sr-only" name={`${uid}-per`} checked={perPage === 2} onChange={() => setPerPage(2)} /><span>2, compact</span></label>
                    </div>
                </fieldset>
                <p className="hint">{w} × {h} mm</p>
            </Step>

            <Step n={3} id={`${uid}-s3`} title="Style your book" hint="Pick a title, a theme and light or dark paper.">
                <label className="field">Book title
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sudoku Puzzle Book" />
                </label>
                <fieldset className="plain">
                    <legend className="field-label">Paper</legend>
                    <div className="chips">
                        {(['light', 'dark'] as Mode[]).map((m) => (
                            <label key={m} className="chip"><input type="radio" className="sr-only" name={`${uid}-paper`} checked={paper === m} onChange={() => setPaper(m)} /><span>{m === 'light' ? 'Light paper' : 'Dark paper'}</span></label>
                        ))}
                    </div>
                    {paper === 'dark' && <p className="hint">Dark pages look striking on screen but use a lot of ink when printed.</p>}
                </fieldset>
                <fieldset className="plain" style={{ marginTop: 14 }}>
                    <legend className="field-label">Theme</legend>
                    <div className="themes">
                        {THEME_KEYS.map((k) => {
                            const v = getTheme(k, paper);
                            return (
                                <label key={k} className="theme">
                                    <input type="radio" className="sr-only" name={`${uid}-theme`} checked={theme === k} onChange={() => setTheme(k)} />
                                    <span className="theme-prev" style={{ background: css(v.page), borderColor: css(v.primary) }} aria-hidden="true">
                                        <i style={{ background: css(v.ink) }} /><i style={{ background: css(v.primary), width: '40%' }} />
                                        <b style={{ borderColor: css(v.ink) }} />
                                    </span>
                                    <span className="theme-name">{themeLabel(k)}</span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>
            </Step>

            <section className="panel step create" aria-labelledby={`${uid}-s4`}>
                <div className="step-head"><span className="step-no" aria-hidden="true">4</span><div><h2 id={`${uid}-s4`}>Create your book</h2>
                    <p>{total ? `${total} puzzles · about ${pages} pages · ${w} × ${h} mm · ${themeLabel(theme)}, ${paper} paper` : 'Add at least one puzzle in step 1.'}</p></div></div>
                <button type="button" className="cta" disabled={!canBuild} onClick={build}>{busy ? 'Building…' : 'Generate book PDF'}</button>
                {(busy || progress.text) && (
                    <>
                        {busy && <progress className="bar" max={100} value={progress.pct} aria-label="Book progress" />}
                        <p className={`status ${progress.error ? 'err' : ''}`} role={progress.error ? 'alert' : 'status'}>{progress.text}</p>
                    </>
                )}
                <p className="hint">The PDF has a title, language and a bookmark outline for navigation, and all text is real, selectable text.</p>
            </section>
        </div>
    );
}
