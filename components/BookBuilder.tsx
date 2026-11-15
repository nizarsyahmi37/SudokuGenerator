'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LEVELS, LEVEL_NAMES, LEVEL_TECHNIQUES, type Level } from '../lib/sudoku';
import { DEFAULT_BLEED_MM, DEFAULT_COVER, MAX_NOTES_PAGES, PAGE_SIZES, POD_TRIMS, planPages, spineWidthMm, totalPuzzles, levelColor, type BookConfig, type BookResult, type CoverImage, type NotesStyle, type Paper } from '../lib/bookConfig';
import { buildBookInWorker, type BookJob } from '../lib/bookClient';
import { downloadBlob, pdfBlob } from '../lib/download';
import { cleanSeed, decodeBookCode, encodeBookCode } from '../lib/bookCode';
import { randomSeed } from '../lib/rng';
import { THEME_KEYS, getTheme, themeLabel, type Mode } from '../lib/themes';
import { css } from '../lib/palette';
import { unsupportedIn } from '../lib/pdf/scripts';
import BookPreview from './BookPreview';

const MAX_TOTAL = 500;

function Step({ n, title, hint, children, id }: { n: number; title: string; hint: string; children: React.ReactNode; id: string }) {
    return (
        <section className="panel step" aria-labelledby={id}>
            <div className="step-head"><span className="step-no" aria-hidden="true">{n}</span><div><h2 id={id}>{title}</h2><p>{hint}</p></div></div>
            {children}
        </section>
    );
}

function Radio({ name, checked, onChange, children, disabled }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode; disabled?: boolean }) {
    return (
        <label className={`chip${disabled ? ' is-off' : ''}`}>
            <input type="radio" className="sr-only" name={name} checked={checked} onChange={onChange} disabled={disabled} />
            <span>{children}</span>
        </label>
    );
}

export default function BookBuilder({ gameTheme, gameMode }: { gameTheme: string; gameMode: Mode }) {
    const uid = useId();
    const [counts, setCounts] = useState<Record<Level, number>>(() => Object.fromEntries(LEVELS.map((l) => [l, 2])) as Record<Level, number>);
    const [seed, setSeed] = useState('');
    const [output, setOutput] = useState<'digital' | 'print'>('digital');
    const [size, setSize] = useState('A5');
    const [podSize, setPodSize] = useState('6 × 9 in');
    const [custom, setCustom] = useState({ w: 148, h: 210 });
    const [perPage, setPerPage] = useState<1 | 2>(1);
    const [largePrint, setLargePrint] = useState(false);
    const [bleedMm, setBleedMm] = useState(Number(DEFAULT_BLEED_MM.toFixed(3)));
    const [bleedEdges, setBleedEdges] = useState<'outer' | 'all'>('outer');
    const [cropMarks, setCropMarks] = useState(false);
    const [puzzleTitles, setPuzzleTitles] = useState(false);
    const [notesPages, setNotesPages] = useState(0);
    const [notesStyle, setNotesStyle] = useState<NotesStyle>('lined');
    const [inkSaver, setInkSaver] = useState(false);
    const [barcodeArea, setBarcodeArea] = useState(true);
    const [paperStock, setPaperStock] = useState<Paper>('white');
    const [title, setTitle] = useState('Sudoku Puzzle Book');
    const [author, setAuthor] = useState('');
    const [theme, setTheme] = useState(gameTheme);
    const [paper, setPaper] = useState<Mode>(gameMode);
    const [copyrightOn, setCopyrightOn] = useState(true);
    const [holder, setHolder] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [isbn, setIsbn] = useState('');
    const [backCover, setBackCover] = useState('');
    const [coverSubtitle, setCoverSubtitle] = useState('');
    const [customColours, setCustomColours] = useState(false);
    const [coverBg, setCoverBg] = useState('#14213d');
    const [coverAccent, setCoverAccent] = useState('#fca311');
    const [showGrid, setShowGrid] = useState(true);
    const [coverImage, setCoverImage] = useState<CoverImage | null>(null);
    const [imageUrl, setImageUrl] = useState('');
    const [imageError, setImageError] = useState('');
    const [progress, setProgress] = useState({ text: '', pct: 0, error: false });
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [built, setBuilt] = useState<{ result: BookResult; key: string } | null>(null);
    const [which, setWhich] = useState<'interior' | 'cover'>('interior');
    const [copied, setCopied] = useState(false);
    const jobRef = useRef<BookJob | null>(null);

    // Seeds are random, so they are created on the client only (server and client would disagree and break hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-side initialisation
    useEffect(() => { setSeed(randomSeed()); }, []);
    useEffect(() => () => jobRef.current?.cancel(), []);

    // The book follows the game's theme and light/dark mode, and can still be changed in step 3.
    const [seenGame, setSeenGame] = useState(`${gameTheme}:${gameMode}`);
    if (seenGame !== `${gameTheme}:${gameMode}`) {
        setSeenGame(`${gameTheme}:${gameMode}`);
        setTheme(gameTheme);
        setPaper(gameMode);
    }

    const printing = output === 'print';
    const unsupported = unsupportedIn(title, author, coverSubtitle, holder, backCover);

    /** Reads a picture for the cover. PNG and JPEG only, up to 5 MB, and it stays on this device. */
    const pickImage = async (file: File | undefined) => {
        setImageError('');
        if (!file) return;
        if (file.type !== 'image/png' && file.type !== 'image/jpeg') { setImageError('Please choose a PNG or JPEG picture.'); return; }
        if (file.size > 5 * 1024 * 1024) { setImageError('That picture is larger than 5 MB. Please choose a smaller one.'); return; }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        setImageUrl(URL.createObjectURL(file));
        setCoverImage({ bytes, mime: file.type, alt: coverImage?.alt ?? '' });
    };
    const removeImage = () => { if (imageUrl) URL.revokeObjectURL(imageUrl); setImageUrl(''); setCoverImage(null); };
    const [w, h] = printing
        ? (podSize === 'Custom' ? [custom.w, custom.h] : POD_TRIMS[podSize])
        : (size === 'Custom' ? [custom.w, custom.h] : PAGE_SIZES[size]);
    const total = totalPuzzles(counts);
    const validSize = w >= 60 && h >= 60 && w <= 600 && h <= 600;
    const validBleed = bleedMm >= 0 && bleedMm <= 10;
    const seedNorm = cleanSeed(seed);
    const bookCode = encodeBookCode(seedNorm || 'SEED', counts);
    const [codeInput, setCodeInput] = useState('');
    const [codeMsg, setCodeMsg] = useState<{ text: string; error: boolean }>({ text: '', error: false });
    const [codeCopied, setCodeCopied] = useState(false);
    const applyCode = () => {
        const d = decodeBookCode(codeInput);
        if ('error' in d) { setCodeMsg({ text: d.error, error: true }); return; }
        setSeed(d.seed); setCounts(d.counts); setCodeInput('');
        setCodeMsg({ text: 'Code applied: the seed and puzzle counts were restored.', error: false });
    };
    const copyCode = async () => {
        try { await navigator.clipboard.writeText(bookCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); } catch { /* clipboard unavailable */ }
    };

    const cfg: BookConfig = useMemo(() => ({
        counts, pageWidth: w, pageHeight: h, puzzlesPerPage: largePrint ? 1 : perPage, title, author, theme, mode: paper, seed: seedNorm, largePrint,
        print: printing ? { bleedMm, bleedEdges, cropMarks, paper: paperStock } : null,
        copyright: { enabled: copyrightOn, holder, year, isbn },
        inkSaver, barcodeArea,
        cover: { ...DEFAULT_COVER, subtitle: coverSubtitle, bgColor: customColours ? coverBg : '', accentColor: customColours ? coverAccent : '', showGrid, image: coverImage },
        backCover, extras: { puzzleTitles, notesPages, notesStyle },
    }), [puzzleTitles, notesPages, notesStyle, counts, w, h, perPage, title, author, theme, paper, seedNorm, largePrint, printing, bleedMm, bleedEdges, cropMarks, paperStock, inkSaver, barcodeArea, copyrightOn, holder, year, isbn, backCover, coverSubtitle, customColours, coverBg, coverAccent, showGrid, coverImage]);
    // The picture is left out of the key (it could be megabytes); its size and description stand in for it.
    const key = JSON.stringify({ ...cfg, cover: { ...cfg.cover, image: coverImage ? { n: coverImage.bytes.length, alt: coverImage.alt } : null } });
    const plan = planPages(cfg);
    const spine = printing ? spineWidthMm(plan.pages, paperStock) : 0;
    const canBuild = total > 0 && total <= MAX_TOTAL && validSize && validBleed && !!seedNorm && !busy;
    const stale = !!built && built.key !== key;

    const setCount = (l: Level, v: number) => setCounts((c) => ({ ...c, [l]: Math.max(0, Math.min(MAX_TOTAL, Math.floor(v) || 0)) }));
    const preset = (n: number) => setCounts(Object.fromEntries(LEVELS.map((l) => [l, n])) as Record<Level, number>);

    const build = async () => {
        setBusy(true);
        setBuilt(null);
        setProgress({ text: 'Starting…', pct: 0, error: false });
        const job = buildBookInWorker(cfg, (done, all, phase) => setProgress({ text: `${phase}… ${done} of ${all}`, pct: all ? (done / all) * 100 : 0, error: false }));
        if (job.mode === 'main') setNotice('This browser cannot run background workers, so the book is built on this page. It may pause briefly while it works.');
        else setNotice('');
        jobRef.current = job;
        try {
            const result = await job.promise;
            setBuilt({ result, key });
            setWhich('interior');
            setProgress({ text: `Done. ${result.pages} pages are ready to preview and download.`, pct: 100, error: false });
        } catch (e) {
            const cancelled = (e as Error).message === 'Cancelled';
            setProgress({ text: cancelled ? 'Cancelled.' : `The book could not be created: ${(e as Error).message}`, pct: 0, error: !cancelled });
        } finally {
            jobRef.current = null;
            setBusy(false);
        }
    };

    const fileBase = (title.trim() || 'sudoku-book').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sudoku-book';
    const copySeed = async () => {
        try { await navigator.clipboard.writeText(seedNorm); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
    };
    const shown = built && (which === 'cover' && built.result.cover ? built.result.cover : built.result.interior);

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
                            <span className="lname"><b>Level {l}</b><em>{LEVEL_NAMES[l]} · {LEVEL_TECHNIQUES[l]}</em></span>
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
                <div className="seed">
                    <label className="field">Seed
                        <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} autoCapitalize="characters" aria-describedby={`${uid}-seed-help`} />
                    </label>
                    <button type="button" onClick={() => setSeed(randomSeed())}>New seed</button>
                    <button type="button" onClick={copySeed}>{copied ? 'Copied' : 'Copy seed'}</button>
                </div>
                <div className="seed">
                    <label className="field">Book code (seed and puzzle counts)
                        <input type="text" readOnly value={bookCode} onFocus={(e) => e.currentTarget.select()} spellCheck={false} />
                    </label>
                    <button type="button" onClick={copyCode}>{codeCopied ? 'Copied' : 'Copy code'}</button>
                </div>
                <div className="seed">
                    <label className="field">Have a code? Paste it here
                        <input type="text" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} spellCheck={false} placeholder="B1.…" aria-describedby={`${uid}-code-msg`} />
                    </label>
                    <button type="button" onClick={applyCode} disabled={!codeInput.trim()}>Apply code</button>
                </div>
                <p id={`${uid}-code-msg`} className={`status ${codeMsg.error ? 'err' : ''}`} role={codeMsg.error ? 'alert' : 'status'}>{codeMsg.text}</p>
                <p id={`${uid}-seed-help`} className="hint">The same seed, puzzle counts and settings always give the same book. The seed is printed on the copyright page.</p>
            </Step>

            <Step n={2} id={`${uid}-s2`} title="Format and pages" hint="Choose a digital book or a print-ready one.">
                <fieldset className="plain">
                    <legend className="field-label">Output</legend>
                    <div className="chips">
                        <Radio name={`${uid}-out`} checked={!printing} onChange={() => setOutput('digital')}>Digital (screen)</Radio>
                        <Radio name={`${uid}-out`} checked={printing} onChange={() => setOutput('print')}>Print-ready</Radio>
                    </div>
                </fieldset>

                <fieldset className="plain" style={{ marginTop: 14 }}>
                    <legend className="field-label">{printing ? 'Trim size' : 'Page size'}</legend>
                    <div className="chips">
                        {printing
                            ? [...Object.keys(POD_TRIMS), 'Custom'].map((k) => <Radio key={k} name={`${uid}-pod`} checked={podSize === k} onChange={() => setPodSize(k)}>{k}</Radio>)
                            : [...Object.keys(PAGE_SIZES), 'Custom'].map((k) => <Radio key={k} name={`${uid}-size`} checked={size === k} onChange={() => setSize(k)}>{k}{k === 'A5' ? ' (default)' : ''}</Radio>)}
                    </div>
                </fieldset>
                {(printing ? podSize : size) === 'Custom' && (
                    <div className="custom-size">
                        <label className="field">Width (mm)
                            <input type="number" min={60} max={600} value={custom.w} onChange={(e) => setCustom({ ...custom, w: Number(e.target.value) })} aria-invalid={!validSize} />
                        </label>
                        <label className="field">Height (mm)
                            <input type="number" min={60} max={600} value={custom.h} onChange={(e) => setCustom({ ...custom, h: Number(e.target.value) })} aria-invalid={!validSize} />
                        </label>
                    </div>
                )}
                {!validSize && <p className="status err" role="alert">Width and height must be between 60 and 600 mm.</p>}
                <p className="hint">{w.toFixed(1)} × {h.toFixed(1)} mm</p>

                {printing && (
                    <div className="print-opts">
                        <fieldset className="plain">
                            <legend className="field-label">Paper stock</legend>
                            <div className="chips">
                                <Radio name={`${uid}-stock`} checked={paperStock === 'white'} onChange={() => setPaperStock('white')}>White</Radio>
                                <Radio name={`${uid}-stock`} checked={paperStock === 'cream'} onChange={() => setPaperStock('cream')}>Cream</Radio>
                            </div>
                        </fieldset>
                        <fieldset className="plain">
                            <legend className="field-label">Bleed</legend>
                            <div className="chips">
                                <Radio name={`${uid}-bleed`} checked={bleedEdges === 'outer'} onChange={() => setBleedEdges('outer')}>Outer edges (Amazon KDP)</Radio>
                                <Radio name={`${uid}-bleed`} checked={bleedEdges === 'all'} onChange={() => setBleedEdges('all')}>All sides (IngramSpark, Lulu)</Radio>
                            </div>
                        </fieldset>
                        <label className="field">Bleed size (mm)
                            <input type="number" min={0} max={10} step={0.025} value={bleedMm} onChange={(e) => setBleedMm(Number(e.target.value))} aria-invalid={!validBleed} />
                        </label>
                        <label className="check">
                            <input type="checkbox" checked={inkSaver} onChange={(e) => setInkSaver(e.target.checked)} />
                            <span>Ink saver: black and white only, printed in pure black ink, with no coloured pages, fills or cover picture</span>
                        </label>
                        <label className="check">
                            <input type="checkbox" checked={barcodeArea} onChange={(e) => setBarcodeArea(e.target.checked)} />
                            <span>Leave a white area for the ISBN barcode on the back cover</span>
                        </label>
                        <p className="hint">Optional. The book does not generate barcodes: add the one you bought, or leave the area blank and let your printer place theirs (Amazon KDP does this when you do not have an ISBN).</p>
                        <label className="check">
                            <input type="checkbox" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} />
                            <span>Add crop marks (most print-on-demand services do not want them)</span>
                        </label>
                        <p className="hint">The interior and a separate cover wrap (back, spine and front) are created. The spine width is worked out from the page count and paper stock.</p>
                    </div>
                )}

                <label className="check" style={{ marginTop: 14 }}>
                    <input type="checkbox" checked={largePrint} onChange={(e) => setLargePrint(e.target.checked)} />
                    <span>Large print: bigger type, one puzzle per page, two solutions per page</span>
                </label>
                <fieldset className="plain" style={{ marginTop: 14 }} disabled={largePrint}>
                    <legend className="field-label">Puzzles per page</legend>
                    <div className="chips">
                        <Radio name={`${uid}-per`} checked={(largePrint ? 1 : perPage) === 1} onChange={() => setPerPage(1)} disabled={largePrint}>1, larger boards</Radio>
                        <Radio name={`${uid}-per`} checked={!largePrint && perPage === 2} onChange={() => setPerPage(2)} disabled={largePrint}>2, compact</Radio>
                    </div>
                </fieldset>
                <fieldset className="plain" style={{ marginTop: 14 }}>
                    <legend className="field-label">Extra pages</legend>
                    <label className="check">
                        <input type="checkbox" checked={puzzleTitles} onChange={(e) => setPuzzleTitles(e.target.checked)} />
                        <span>Give every puzzle a name, such as “The Amber Fox”</span>
                    </label>
                    <label className="field" style={{ marginTop: 10 }}>Notes pages at the back (0 to {MAX_NOTES_PAGES})
                        <input type="number" min={0} max={MAX_NOTES_PAGES} value={notesPages} onChange={(e) => setNotesPages(Math.max(0, Math.min(MAX_NOTES_PAGES, Math.floor(Number(e.target.value)) || 0)))} />
                    </label>
                    {notesPages > 0 && (
                        <div className="chips" role="group" aria-label="Notes page style" style={{ marginTop: 10 }}>
                            <Radio name={`${uid}-notes`} checked={notesStyle === 'lined'} onChange={() => setNotesStyle('lined')}>Lined</Radio>
                            <Radio name={`${uid}-notes`} checked={notesStyle === 'dotted'} onChange={() => setNotesStyle('dotted')}>Dotted</Radio>
                            <Radio name={`${uid}-notes`} checked={notesStyle === 'blank'} onChange={() => setNotesStyle('blank')}>Blank</Radio>
                        </div>
                    )}
                    <p className="hint">Notes pages come after the solutions and are listed in the contents. Names are the same every time you rebuild with the same seed.</p>
                </fieldset>
            </Step>

            <Step n={3} id={`${uid}-s3`} title="Style and details" hint="Title, author, theme, light or dark paper, and copyright.">
                <div className="two-col">
                    <label className="field">Book title
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sudoku Puzzle Book" />
                    </label>
                    <label className="field">Author or publisher
                        <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} autoComplete="off" />
                    </label>
                </div>
                {unsupported.length > 0 && (
                    <p className="status err" role="status">
                        The PDF fonts do not cover {unsupported.join(', ')} yet, so those characters will print as “?”. Latin, Latin Extended, Vietnamese, Cyrillic and Greek are supported.
                    </p>
                )}
                <fieldset className="plain">
                    <legend className="field-label">Paper</legend>
                    <div className="chips">
                        <Radio name={`${uid}-paper`} checked={paper === 'light'} onChange={() => setPaper('light')}>Light paper</Radio>
                        <Radio name={`${uid}-paper`} checked={paper === 'dark'} onChange={() => setPaper('dark')}>Dark paper</Radio>
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
                <label className="check" style={{ marginTop: 14 }}>
                    <input type="checkbox" checked={copyrightOn} onChange={(e) => setCopyrightOn(e.target.checked)} />
                    <span>Include a copyright page</span>
                </label>
                {copyrightOn && (
                    <div className="two-col" style={{ marginTop: 10 }}>
                        <label className="field">Copyright holder
                            <input type="text" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder={author || 'Your name'} autoComplete="off" />
                        </label>
                        <label className="field">Year
                            <input type="number" min={1900} max={2200} value={year} onChange={(e) => setYear(Number(e.target.value))} />
                        </label>
                        <label className="field">ISBN (optional)
                            <input type="text" value={isbn} onChange={(e) => setIsbn(e.target.value)} inputMode="numeric" autoComplete="off" />
                        </label>
                    </div>
                )}
                <fieldset className="plain cover-opts" style={{ marginTop: 14 }}>
                    <legend className="field-label">Cover</legend>
                    <label className="field">Subtitle (optional)
                        <input type="text" value={coverSubtitle} onChange={(e) => setCoverSubtitle(e.target.value)} placeholder="Replaces the line under the title" />
                    </label>
                    <label className="check">
                        <input type="checkbox" checked={customColours} onChange={(e) => setCustomColours(e.target.checked)} />
                        <span>Use my own cover colours</span>
                    </label>
                    {customColours && (
                        <div className="two-col" style={{ marginTop: 10 }}>
                            <label className="field">Background
                                <input type="color" value={coverBg} onChange={(e) => setCoverBg(e.target.value)} />
                            </label>
                            <label className="field">Accent
                                <input type="color" value={coverAccent} onChange={(e) => setCoverAccent(e.target.value)} />
                            </label>
                            <p className="hint">Text colours adjust automatically so the cover stays readable.</p>
                        </div>
                    )}
                    <label className="check" style={{ marginTop: 10 }}>
                        <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} disabled={!!coverImage} />
                        <span>Large background grid{coverImage ? ' (hidden while a picture is used)' : ''}</span>
                    </label>
                    <label className="field" style={{ marginTop: 10 }}>Cover picture (optional, PNG or JPEG, up to 5 MB)
                        <input type="file" accept="image/png,image/jpeg" onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ''; }} aria-describedby={imageError ? `${uid}-img-err` : undefined} />
                    </label>
                    {imageError && <p id={`${uid}-img-err`} className="status err" role="alert">{imageError}</p>}
                    {coverImage && (
                        <div className="cover-image">
                            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a site asset */}
                            <img src={imageUrl} alt={coverImage.alt || 'Cover picture preview'} />
                            <div>
                                <label className="field">Describe the picture for screen readers
                                    <input type="text" value={coverImage.alt} onChange={(e) => setCoverImage({ ...coverImage, alt: e.target.value })} placeholder="Leave empty if it is only decoration" />
                                </label>
                                <button type="button" className="link-button" onClick={removeImage}>Remove picture</button>
                            </div>
                        </div>
                    )}
                </fieldset>
                {printing && (
                    <label className="field" style={{ marginTop: 10 }}>Back cover text (optional)
                        <textarea rows={3} value={backCover} onChange={(e) => setBackCover(e.target.value)} />
                    </label>
                )}
            </Step>

            <section className="panel step create" aria-labelledby={`${uid}-s4`}>
                <div className="step-head"><span className="step-no" aria-hidden="true">4</span><div><h2 id={`${uid}-s4`}>Build, preview and download</h2>
                    <p>{total ? `${total} puzzles · ${plan.pages} pages · ${w.toFixed(0)} × ${h.toFixed(0)} mm${printing ? ` · spine about ${spine.toFixed(1)} mm` : ''} · ${themeLabel(theme)}, ${paper} paper` : 'Add at least one puzzle in step 1.'}</p></div></div>
                <div className="build-row">
                    <button type="button" className="cta" disabled={!canBuild} onClick={build}>{busy ? 'Building…' : built ? 'Build again' : 'Build book'}</button>
                    {busy && <button type="button" className="cancel" onClick={() => jobRef.current?.cancel()}>Cancel</button>}
                </div>
                {notice && <p className="hint" role="status">{notice}</p>}
                {(busy || progress.text) && (
                    <>
                        {busy && <progress className="bar" max={100} value={progress.pct} aria-label="Book progress" />}
                        <p className={`status ${progress.error ? 'err' : ''}`} role={progress.error ? 'alert' : 'status'}>{progress.text}</p>
                    </>
                )}
                {built && built.result.offGrade.length > 0 && !busy && (
                    <p className="hint" role="note">
                        {built.result.offGrade.length === 1 ? '1 puzzle graded' : `${built.result.offGrade.length} puzzles graded`} a little easier than its section: {built.result.offGrade.slice(0, 6).map((o) => `no. ${o.number} is level ${o.grade}, in the level ${o.level} section`).join('; ')}{built.result.offGrade.length > 6 ? '; and more' : ''}. Build again with another seed to change them.
                    </p>
                )}
                {stale && <p className="status err" role="status">Your settings have changed since this book was built. Build again to update the preview and downloads.</p>}

                {built && shown && (
                    <div className="result">
                        <div className="tools">
                            <button type="button" onClick={() => downloadBlob(pdfBlob(built.result.interior), printing ? `${fileBase}-interior.pdf` : `${fileBase}.pdf`)}>Download {printing ? 'interior' : 'book'} PDF</button>
                            {built.result.cover && <button type="button" onClick={() => downloadBlob(pdfBlob(built.result.cover as Uint8Array), `${fileBase}-cover.pdf`)}>Download cover PDF</button>}
                        </div>
                        {built.result.cover && (
                            <fieldset className="plain" style={{ marginTop: 12 }}>
                                <legend className="field-label">Preview</legend>
                                <div className="chips">
                                    <Radio name={`${uid}-which`} checked={which === 'interior'} onChange={() => setWhich('interior')}>Interior</Radio>
                                    <Radio name={`${uid}-which`} checked={which === 'cover'} onChange={() => setWhich('cover')}>Cover wrap</Radio>
                                </div>
                            </fieldset>
                        )}
                        <BookPreview bytes={shown} pageLabel={(n) => `${which === 'cover' ? 'Cover wrap' : 'Page'} ${n} preview`} />
                        <p className="hint">Tagged PDF with a title, language, bookmarks, text alternatives for every board and embedded fonts. Seed: {seedNorm}.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
