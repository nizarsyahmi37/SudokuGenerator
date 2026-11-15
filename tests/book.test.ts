import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildBook, buildCoverPreview, coverTheme, uniquePuzzle } from '../lib/pdf/book';
import { contrast } from '../lib/palette';
import { getTheme } from '../lib/themes';
import { DEFAULT_COVER, DEFAULT_EXTRAS, looksLikeFont, planPages } from '../lib/bookConfig';
import { isRtlText, scriptsIn, splitRuns, unsupportedIn } from '../lib/pdf/scripts';
import { puzzleTitles, TITLE_COUNT } from '../lib/pdf/titles';
import { buildBookInWorker } from '../lib/bookClient';
import { loadFonts, loadFontsWithScripts, makePng, pageTexts, smallBook } from './helpers';

const fonts = loadFonts();

/** Counts colour settings in the page content of a PDF: RGB, CMYK, and CMYK colours that use any ink but black. */
function contentOps(pdf: Uint8Array) {
    const text = Buffer.from(pdf).toString('latin1');
    let all = '';
    for (const m of text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
        try { all += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1') + '\n'; } catch { /* not a compressed stream */ }
    }
    const rgb = [...all.matchAll(/\/DeviceRGB (?:cs|CS)/g)].length;
    const num = '-?\\d*\\.?\\d+';
    const cmyk = [...all.matchAll(new RegExp(`(${num}) (${num}) (${num}) (${num}) (?:scn|SCN)`, 'g'))];
    const cmykMixed = cmyk.filter((m) => Number(m[1]) || Number(m[2]) || Number(m[3])).length;
    return { rgb, k: cmyk.length, cmykMixed };
}

describe('book generator', () => {
    it('lays out the planned number of pages', async () => {
        const cfg = smallBook();
        const r = await buildBook(cfg, fonts);
        expect(r.pages).toBe(planPages(cfg).pages);
        expect(r.cover).toBeUndefined();
    });

    it('reports puzzles that graded below their section, and only those', async () => {
        const r = await buildBook(smallBook({ counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 0, 8: 0, 9: 0, 10: 0 } }), fonts);
        expect(Array.isArray(r.offGrade)).toBe(true);
        for (const o of r.offGrade) { expect(o.level).toBe(6); expect(o.grade).toBeLessThan(6); }
    });

    it('replaces a puzzle that is already in the book, repeatably', () => {
        const seen = new Set<string>();
        const first = uniquePuzzle(3, 'DUP-SEED', 0, seen);
        const again = uniquePuzzle(3, 'DUP-SEED', 0, seen); // the same slot again collides with the first one
        expect(again.puzzle).not.toEqual(first.puzzle);
        expect(seen.size).toBe(2);
        expect(uniquePuzzle(3, 'DUP-SEED', 0, new Set([first.puzzle.join('')])).puzzle).toEqual(again.puzzle);
    });

    it('adds notes pages after the solutions and lists them in the contents', async () => {
        const base = smallBook();
        const cfg = smallBook({ extras: { ...DEFAULT_EXTRAS, notesPages: 3, notesStyle: 'dotted' } });
        expect(planPages(cfg).pages).toBe(planPages(base).pages + 3);
        const r = await buildBook(cfg, fonts);
        expect(r.pages).toBe(planPages(cfg).pages);
        const texts = await pageTexts(r.interior);
        expect(texts.filter((t) => /notes/i.test(t.replace(/\s/g, ''))).length).toBeGreaterThanOrEqual(4); // contents + three notes pages
        const blank = await buildBook(smallBook({ extras: { ...DEFAULT_EXTRAS, notesPages: 2, notesStyle: 'blank' } }), fonts);
        expect(blank.pages).toBe(planPages(base).pages + 2);
    });

    it('keeps print interiors even when notes pages are added', () => {
        const print = { bleedMm: 3.175, bleedEdges: 'outer' as const, cropMarks: false, paper: 'white' as const };
        for (let n = 0; n < 4; n++) expect(planPages(smallBook({ print, extras: { ...DEFAULT_EXTRAS, notesPages: n } })).pages % 2).toBe(0);
    });

    it('names puzzles uniquely and repeatably when asked to', async () => {
        const names = puzzleTitles('NAMES-1', 500);
        expect(new Set(names).size).toBe(500);
        expect(puzzleTitles('NAMES-1', 500)).toEqual(names);
        expect(puzzleTitles('NAMES-2', 5)).not.toEqual(names.slice(0, 5));
        expect(TITLE_COUNT).toBeGreaterThanOrEqual(500);
        const cfg = smallBook({ extras: { ...DEFAULT_EXTRAS, puzzleTitles: true } });
        const squash = (pages: string[]) => pages.join('').replace(/\s/g, '');
        const first = puzzleTitles(cfg.seed, 5)[0].replace(/\s/g, '');
        expect(squash(await pageTexts((await buildBook(cfg, fonts)).interior))).toContain(first);
        expect(squash(await pageTexts((await buildBook(smallBook(), fonts)).interior))).not.toContain(first);
    });

    it('draws a cover preview without building the book', async () => {
        const doc = await pdfjs.getDocument({ data: (await buildCoverPreview(smallBook({ title: 'Preview Me' }), fonts)).slice() }).promise;
        expect(doc.numPages).toBe(1);
        const page = await doc.getPage(1);
        const [x0, y0, x1, y1] = page.view;
        expect(Math.round((x1 - x0) / 72 * 25.4)).toBe(148);
        expect(Math.round((y1 - y0) / 72 * 25.4)).toBe(210);
        expect((await page.getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join('')).toContain('Preview');
    });

    it('draws the whole cover wrap, wider than a page, as the print preview', async () => {
        const print = { bleedMm: 3.175, bleedEdges: 'outer' as const, cropMarks: false, paper: 'white' as const };
        const doc = await pdfjs.getDocument({ data: (await buildCoverPreview(smallBook({ print }), fonts)).slice() }).promise;
        expect(doc.numPages).toBe(1);
        const [x0, , x1] = (await doc.getPage(1)).view;
        expect((x1 - x0) / 72 * 25.4).toBeGreaterThan(2 * 148);
    });

    it('is repeatable: the same seed and settings give the same pages', async () => {
        const a = await pageTexts((await buildBook(smallBook(), fonts)).interior);
        const b = await pageTexts((await buildBook(smallBook(), fonts)).interior);
        const c = await pageTexts((await buildBook(smallBook({ seed: 'OTHER-SEED' }), fonts)).interior);
        expect(b).toEqual(a);
        expect(c).not.toEqual(a);
    });

    it('makes a tagged PDF with title, language, text alternatives and bookmarks', async () => {
        const { interior } = await buildBook(smallBook(), fonts);
        const doc = await pdfjs.getDocument({ data: interior.slice() }).promise;
        const meta = await doc.getMetadata();
        const info = meta.info as Record<string, unknown>;
        expect(info.Title).toBe('Test Book');
        expect(info.Language).toBe('en-US');
        expect(String(meta.metadata?.getRaw?.() ?? '')).toContain('pdfuaid');
        expect((await doc.getOutline())?.length).toBeGreaterThan(3);

        let figures = 0;
        for (let i = 1; i <= doc.numPages; i++) {
            const tree = await (await doc.getPage(i)).getStructTree();
            const walk = (n: { role?: string; alt?: string; children?: unknown[] } | null) => {
                if (!n) return;
                if (n.role === 'Figure') { figures++; expect(n.alt && n.alt.length).toBeGreaterThan(10); }
                (n.children ?? []).forEach((c) => walk(c as never));
            };
            walk(tree as never);
        }
        expect(figures).toBeGreaterThan(4);
    });

    it('large print uses one puzzle and two solutions per page', () => {
        const plan = planPages(smallBook({ largePrint: true, puzzlesPerPage: 2 }));
        expect(plan.per).toBe(1);
        expect(plan.solPer).toBe(2);
    });

    it('print-ready: even page count, cover wrap sized from the spine, bleed and trim boxes', async () => {
        const cfg = smallBook({ print: { bleedMm: 3.175, bleedEdges: 'outer', cropMarks: false, paper: 'white' }, pageWidth: 152.4, pageHeight: 228.6 });
        const r = await buildBook(cfg, fonts);
        expect(r.pages % 2).toBe(0);
        expect(r.cover).toBeDefined();
        expect(r.spineMm).toBeCloseTo(r.pages * 0.002252 * 25.4, 5);
        const doc = await pdfjs.getDocument({ data: (r.interior as Uint8Array).slice() }).promise;
        const recto = (await doc.getPage(1)).getViewport({ scale: 1 });
        const verso = (await doc.getPage(2)).getViewport({ scale: 1 });
        const mm = (pt: number) => (pt / 72) * 25.4;
        expect(mm(recto.width)).toBeCloseTo(152.4 + 3.175, 1); // KDP: bleed on the outer edge only
        expect(mm(verso.width)).toBeCloseTo(152.4 + 3.175, 1);
        expect(mm(recto.height)).toBeCloseTo(228.6 + 2 * 3.175, 1);
        const cover = await pdfjs.getDocument({ data: (r.cover as Uint8Array).slice() }).promise;
        const cv = (await cover.getPage(1)).getViewport({ scale: 1 });
        expect(mm(cv.width)).toBeCloseTo(2 * 152.4 + (r.spineMm as number) + 2 * 3.175, 1);
    });

    it('cover: a custom subtitle, picture and description end up in the PDF', async () => {
        const cover = { ...DEFAULT_COVER, subtitle: 'Weekend brain teasers', image: { bytes: makePng(), mime: 'image/png' as const, alt: 'A blue and green gradient' } };
        const { interior } = await buildBook(smallBook({ cover }), fonts);
        const doc = await pdfjs.getDocument({ data: interior.slice() }).promise;
        const tree = await (await doc.getPage(1)).getStructTree();
        const alts: string[] = [];
        const walk = (n: { role?: string; alt?: string; children?: unknown[] } | null) => { if (!n) return; if (n.alt) alts.push(n.alt); (n.children ?? []).forEach((c) => walk(c as never)); };
        walk(tree as never);
        expect(alts).toContain('A blue and green gradient');
        expect((await pageTexts(interior))[0]).toContain('Weekend brain teasers');
    });

    it('cover colours always give readable text, whatever the user picks', () => {
        const base = getTheme('forest', 'light');
        for (const bg of ['#000000', '#ffffff', '#777777', '#7f7f00', '#ff00ff']) {
            for (const accent of ['#ff0000', '#00ff00', '#888888']) {
                const t = coverTheme(base, { ...DEFAULT_COVER, bgColor: bg, accentColor: accent });
                expect(contrast(t.ink, t.page)).toBeGreaterThanOrEqual(4.5);
                expect(contrast(t.muted, t.page)).toBeGreaterThanOrEqual(4.5);
                expect(contrast(t.primary, t.page)).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    it('ink saver: black and white, same layout, no cover picture needed', async () => {
        const print = { bleedMm: 3.175, bleedEdges: 'outer' as const, cropMarks: false, paper: 'white' as const };
        const color = await buildBook(smallBook({ print }), fonts);
        const mono = await buildBook(smallBook({ print, inkSaver: true, cover: { ...DEFAULT_COVER, image: { bytes: makePng(), mime: 'image/png', alt: '' } } }), fonts);
        expect(mono.pages).toBe(color.pages);
        expect(mono.cover).toBeDefined();
        expect(await pageTexts(mono.interior)).toEqual(await pageTexts(color.interior));
        expect(mono.interior.length).toBeLessThan(color.interior.length * 1.5); // sanity: no pictures embedded
    });

    it('ink saver prints in the black channel only, never in RGB or mixed CMYK', async () => {
        const print = { bleedMm: 3.175, bleedEdges: 'outer' as const, cropMarks: true, paper: 'white' as const };
        const mono = await buildBook(smallBook({ print, inkSaver: true }), fonts);
        const color = await buildBook(smallBook({ print }), fonts);
        for (const bytes of [mono.interior, mono.cover as Uint8Array]) {
            const ops = contentOps(bytes);
            expect(ops.rgb).toBe(0);
            expect(ops.k).toBeGreaterThan(20);
            expect(ops.cmykMixed).toBe(0); // every CMYK colour is 0 0 0 K
        }
        expect(contentOps(color.interior).rgb).toBeGreaterThan(20); // the normal book is RGB, so the check above means something
    });

    it('barcode area is optional on the cover wrap', async () => {
        const print = { bleedMm: 3.175, bleedEdges: 'outer' as const, cropMarks: false, paper: 'white' as const };
        const withBox = await buildBook(smallBook({ print, barcodeArea: true }), fonts);
        const without = await buildBook(smallBook({ print, barcodeArea: false }), fonts);
        expect((withBox.cover as Uint8Array).length).toBeGreaterThan((without.cover as Uint8Array).length - 1);
        expect(without.cover).toBeDefined();
    });

    it('sets text in Cyrillic, Greek, Vietnamese and Latin Extended', async () => {
        const title = 'Судоку · Σούντοκου · Việt Nam · Łódź';
        const { interior } = await buildBook(smallBook({ title, author: 'Žofia Ñandú' }), loadFontsWithScripts());
        // Each alphabet is its own text run, so the extractor may put spaces between runs; compare without them.
        const first = (await pageTexts(interior))[0].replace(/\s+/g, '');
        for (const word of ['Судоку', 'Σούντοκου', 'Việt', 'Łódź', 'Žofia', 'Ñandú']) expect(first).toContain(word);
        expect(scriptsIn(title).sort()).toEqual(['cyrillic', 'greek', 'latin-ext', 'vietnamese']);
        expect(scriptsIn('Plain English')).toEqual([]);
    });

    it('sets Arabic, Hebrew, Devanagari and Thai with their own fonts, and reads right to left where needed', async () => {
        const title = 'سودوكو';
        const r = await buildBook(smallBook({ title, author: 'Dev: सुडोकू · Thai: ซูโดกุ · עברית' }), loadFontsWithScripts());
        const first = (await pageTexts(r.interior))[0].replace(/\s+/g, '');
        expect(first).not.toContain('?');
        for (const ch of ['س', 'و', 'स', 'ซ', 'ע']) expect(first).toContain(ch);
        expect(scriptsIn(title, 'सुडोकू', 'ซูโดกุ', 'עברית').sort()).toEqual(['arabic', 'devanagari', 'hebrew', 'thai']);
        expect(isRtlText('سودوكو Sudoku')).toBe(true);
        expect(isRtlText('Sudoku سودوكو')).toBe(false);
        expect(isRtlText('123 עברית')).toBe(true); // digits and spaces do not decide the direction
        expect(splitRuns('كتاب Sudoku').map((x) => x.script)).toEqual(['arabic', 'latin']);
    });

    it('uses the author\'s own font for alphabets nothing else covers', async () => {
        const bytes = new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts/noto-sans-thai-thai-400-normal.woff')));
        expect(looksLikeFont(bytes)).toBe(true);
        expect(looksLikeFont(new Uint8Array(40))).toBe(false);
        expect(looksLikeFont(Buffer.from('ttcf'.padEnd(40, 'x')))).toBe(false); // collections are not supported
        expect(splitRuns('数独', true).map((r) => r.script)).toEqual(['custom']);
        const r = await buildBook(smallBook({ title: '数独 Sudoku', customFont: { name: 'x.woff', bytes } }), fonts);
        const first = (await pageTexts(r.interior))[0].replace(/\s+/g, '');
        // The stand-in font has no Chinese letters, so only the route is checked: the text is no longer swapped for question marks.
        expect(first).not.toContain('?');
        expect(first).toContain('Sudoku');
        const without = (await pageTexts((await buildBook(smallBook({ title: '数独 Sudoku' }), fonts)).interior))[0];
        expect(without).toContain('??');
    });

    it('never prints empty boxes: uncovered alphabets become a question mark and are reported', () => {
        expect(splitRuns('日本').map((r) => r.text).join('')).toBe('??');
        expect(unsupportedIn('Sudoku 数独', 'Ελληνικά')).toEqual(['Chinese, Japanese or Korean']);
        expect(unsupportedIn('Ünïcödé Ñ')).toEqual([]);
    });

    it('falls back to the main thread without Web Worker support, with the same result', async () => {
        const cfg = smallBook();
        expect(typeof Worker).toBe('undefined'); // plain Node has no Web Workers, like a very old browser
        const steps: string[] = [];
        const job = buildBookInWorker(cfg, (_d, _t, phase) => steps.push(phase), { loadFonts: async () => fonts });
        expect(job.mode).toBe('main');
        const viaMain = await job.promise;
        expect(steps).toContain('Generating puzzles');
        expect(await pageTexts(viaMain.interior)).toEqual(await pageTexts((await buildBook(cfg, fonts)).interior));
    });

    it('the main-thread fallback can be cancelled', async () => {
        const job = buildBookInWorker(smallBook(), () => {}, { loadFonts: async () => fonts, forceMain: true });
        job.cancel();
        await expect(job.promise).rejects.toThrow('Cancelled');
    });
});
