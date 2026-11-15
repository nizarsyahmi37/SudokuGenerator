import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildBook, coverTheme } from '../lib/pdf/book';
import { contrast } from '../lib/palette';
import { getTheme } from '../lib/themes';
import { DEFAULT_COVER, planPages } from '../lib/bookConfig';
import { loadFonts, makePng, pageTexts, smallBook } from './helpers';

const fonts = loadFonts();

describe('book generator', () => {
    it('lays out the planned number of pages', async () => {
        const cfg = smallBook();
        const r = await buildBook(cfg, fonts);
        expect(r.pages).toBe(planPages(cfg).pages);
        expect(r.cover).toBeUndefined();
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
});
