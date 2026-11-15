import { LEVELS, LEVEL_NAMES, LEVEL_TECHNIQUES, generatePuzzle, type Level, type Puzzle } from '../sudoku';
import { puzzleRng, normalizeSeed, seeded } from '../rng';
import { contrast, ensure, isDark, mix, readableOn, type RGB } from '../palette';
import { INK_SAVER, getTheme, type Theme } from '../themes';
import { kdpGutterMm, planPages, spineWidthMm, totalPuzzles, type BookConfig, type BookResult, type Progress } from '../bookConfig';
import { Kit, type FontSet } from './kit';

interface Entry extends Puzzle { number: number; level: Level }

const M = 16; // outer margin (mm)
const GUT = 4; // extra binding margin
const TOP = 18;
const BOT = 20;

const spotOf = (t: Theme): RGB => (t.motif === 'classic' ? t.accent : t.primary);

const rowsText = (b: number[]) => Array.from({ length: 9 }, (_, r) => `Row ${r + 1}: ${b.slice(r * 9, r * 9 + 9).map((v) => v || 'blank').join(', ')}`).join('. ');

/** Draws one sudoku board: artwork as artifacts, digits as the content of a Figure with a full text alternative. */
function drawBoard(k: Kit, t: Theme, x: number, y: number, size: number, puzzle: number[], solution: number[] | null, alt: string) {
    const cell = size / 9, spot = spotOf(t);
    const thin = ensure(mix(t.page, t.ink, 0.38), t.page, 3.1);
    k.artifact(() => {
        for (let i = 1; i < 9; i++) {
            if (i % 3 === 0) continue;
            k.line(x + i * cell, y, x + i * cell, y + size, thin, 0.12);
            k.line(x, y + i * cell, x + size, y + i * cell, thin, 0.12);
        }
        for (let i = 3; i < 9; i += 3) {
            k.line(x + i * cell, y, x + i * cell, y + size, t.ink, Math.max(0.35, size / 220));
            k.line(x, y + i * cell, x + size, y + i * cell, t.ink, Math.max(0.35, size / 220));
        }
        k.rect(x, y, size, size, { stroke: t.ink, lw: Math.max(0.7, size / 100) });
    });
    k.tag('Figure', () => {
        const pt = cell * 2.83465 * 0.62;
        for (let i = 0; i < 81; i++) {
            const given = puzzle[i] !== 0;
            const v = given ? puzzle[i] : solution ? solution[i] : 0;
            if (!v) continue;
            k.text(String(v), x + (i % 9) * cell + cell / 2, y + Math.floor(i / 9) * cell + cell / 2, {
                font: given ? 'sansBold' : 'sans', size: pt, color: given ? t.ink : spot, align: 'center', baseline: 'middle',
            });
        }
    }, { alt });
}

const hexRgb = (h: string): RGB | null => (/^#[0-9a-f]{6}$/i.test(h) ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : null);

/** Colours for the cover only. Custom colours are nudged so the text on them always meets 4.5:1. */
export function coverTheme(t: Theme, o: BookConfig['cover']): Theme {
    const bg = hexRgb(o.bgColor), ac = hexRgb(o.accentColor);
    if (!bg && !ac) return t;
    const page = bg ?? t.page;
    const tinted = ensure(bg ? (isDark(page) ? mix(page, [255, 255, 255], 0.94) : mix(page, [0, 0, 0], 0.92)) : t.ink, page, 12);
    // On mid-tone backgrounds no tint can reach a high ratio, so fall back to whichever of black or white reads best.
    const ink: RGB = contrast(tinted, page) >= 7 ? tinted : contrast([255, 255, 255], page) > contrast([0, 0, 0], page) ? [255, 255, 255] : [0, 0, 0];
    const spot = ensure(ac ?? spotOf(t), page, 4.5);
    return { ...t, page, card: page, ink, muted: ensure(mix(ink, page, 0.4), page, 4.6), primary: spot, accent: spot, filled: spot, given: ink, motif: 'cosmos' };
}

interface FrontCoverArgs { x: number; y: number; w: number; h: number; bleedTop: number; bleedRight: number; total: number; seed: string; sc: number }

/** The front cover: type at the bottom left, and either a picture or an oversized grid bleeding off the top right. */
function drawFrontCover(k: Kit, t: Theme, cfg: BookConfig, o: FrontCoverArgs) {
    const spot = spotOf(t);
    const title = cfg.title.trim() || 'Sudoku';
    const author = cfg.author.trim();
    const img = cfg.print && cfg.inkSaver ? null : cfg.cover.image; // pictures use ink, so ink-saver covers skip them
    const { x, y, w, h } = o;
    if (img) {
        const draw = () => k.image(img.bytes, x, y - o.bleedTop, w + o.bleedRight, h * 0.5 + o.bleedTop);
        if (img.alt.trim()) k.tag('Figure', draw, { alt: img.alt.trim() });
        else k.artifact(draw);
    } else if (cfg.cover.showGrid) {
        const rand = seeded(`${o.seed}|cover`);
        k.artifact(() => k.clip(x, y - o.bleedTop, w + o.bleedRight, h + 2 * o.bleedTop, () => {
            const size = w * 0.92, x0 = x + w * 0.3, y0 = y - w * 0.12, cell = size / 9;
            k.rect(x0 + 3 * cell, y0 + 3 * cell, 3 * cell, 3 * cell, { fill: spot, opacity: 0.13 });
            for (let i = 0; i <= 9; i++) {
                const lw = i % 3 === 0 ? 0.9 : 0.2;
                k.line(x0 + i * cell, y0, x0 + i * cell, y0 + size, spot, lw, 0.45);
                k.line(x0, y0 + i * cell, x0 + size, y0 + i * cell, spot, lw, 0.45);
            }
            const used = new Set<number>();
            for (let n = 0; n < 16; n++) {
                const idx = Math.floor(rand() * 81);
                if (used.has(idx)) continue;
                used.add(idx);
                k.text(String(1 + Math.floor(rand() * 9)), x0 + (idx % 9) * cell + cell / 2, y0 + Math.floor(idx / 9) * cell + cell / 2, { font: 'sansBold', size: cell * 2.83465 * 0.7, color: spot, align: 'center', baseline: 'middle', opacity: 0.55 });
            }
        }));
    }
    const px = x + M + GUT, maxW = w - M - GUT - M;
    let fs = Math.min(40, w / 3.4);
    let lines: string[] = [];
    for (; fs > 16; fs -= 1) {
        lines = k.wrap(title, maxW, { font: 'serifBold', size: fs });
        if (lines.length <= 3) break;
    }
    const lh = fs * 0.37;
    const blockTop = y + h * 0.62;
    k.tag('P', () => k.text('SUDOKU', px, blockTop - 8, { font: 'sansBold', size: 8, color: spot, track: 1.6 }));
    k.tag('H1', () => lines.forEach((ln, i) => k.text(ln, px, blockTop + fs * 0.3 + i * lh * 1.05, { font: 'serifBold', size: fs, color: t.ink })), { actual: title });
    const ty = blockTop + fs * 0.3 + (lines.length - 1) * lh * 1.05 + 9;
    k.artifact(() => k.rect(px, ty - 3, 18, 0.8, { fill: spot }));
    const sub = cfg.cover.subtitle.trim() || `${o.total} puzzle${o.total === 1 ? '' : 's'} in ten levels, from gentle to fiendish.`;
    const subLines = k.wrap(sub, maxW, { font: 'serifItalic', size: 11 * Math.max(o.sc, 0.8) });
    k.tag('P', () => {
        subLines.forEach((ln, i) => k.text(ln, px, ty + 5 + i * 5, { font: 'serifItalic', size: 11 * Math.max(o.sc, 0.8), color: t.muted }));
        if (author) k.text(author, px, ty + 5 + subLines.length * 5 + 2, { font: 'serif', size: 12 * Math.max(o.sc, 0.8), color: t.ink });
    });
}

export async function buildBook(cfg: BookConfig, fonts: FontSet, onProgress?: Progress): Promise<BookResult> {
    const ink = !!cfg.print && cfg.inkSaver;
    const t = ink ? INK_SAVER : getTheme(cfg.theme, cfg.mode);
    const spot = spotOf(t);
    const seed = normalizeSeed(cfg.seed);
    const plan = planPages(cfg);
    const { total, per, solPer } = plan;
    const lp = cfg.largePrint;
    const K = lp ? 1.45 : 1; // type scale for large print
    const TW = cfg.pageWidth, TH = cfg.pageHeight;
    const sc = Math.max(Math.min(TW / 148, TH / 210), 0.7);
    const title = cfg.title.trim() || 'Sudoku';
    const author = cfg.author.trim();
    const faint = ensure(mix(t.page, t.ink, 0.4), t.page, 3.1);
    const muted: RGB = lp ? t.ink : t.muted; // large print: no low-contrast secondary text
    const ct = ink ? t : coverTheme(t, cfg.cover);
    const print = cfg.print;

    // ---- 1. Generate puzzles (each one from its own seeded stream, so the book is repeatable) ----
    const entries: Entry[] = [];
    for (const level of LEVELS) {
        for (let n = 0; n < (cfg.counts[level] || 0); n++) {
            entries.push({ ...generatePuzzle(level, puzzleRng(seed, level, n)), level, number: entries.length + 1 });
            onProgress?.(entries.length, total, 'Generating puzzles');
        }
    }

    // ---- 2. Page geometry ----
    const bleed = print ? print.bleedMm : 0;
    const slug = print?.cropMarks ? 9 : 0;
    const inner = Math.max(M + GUT, print ? kdpGutterMm(plan.pages) : 0);
    const k = new Kit({
        title,
        author: author || undefined,
        subject: `${total} sudoku puzzles in ten levels, with solutions`,
        keywords: `sudoku, puzzles, seed ${seed}`,
    }, fonts);

    interface Geo { recto: boolean; bl: number; br: number; mediaW: number; mediaH: number; ox: number; oy: number }
    const geo = (pageNo: number): Geo => {
        const recto = pageNo % 2 === 1;
        const bl = print ? (print.bleedEdges === 'all' ? bleed : recto ? 0 : bleed) : 0;
        const br = print ? (print.bleedEdges === 'all' ? bleed : recto ? bleed : 0) : 0;
        return { recto, bl, br, mediaW: TW + bl + br + 2 * slug, mediaH: TH + 2 * bleed + 2 * slug, ox: slug + bl, oy: slug + bleed };
    };

    let pageNo = 0;
    const box = () => {
        const recto = pageNo % 2 === 1;
        const x0 = recto ? inner : M;
        const w = TW - M - inner;
        return { x0, w, x1: x0 + w, cx: x0 + w / 2, recto };
    };

    /** Starts a page: media box, background (into the bleed), crop marks. */
    const newPage = () => {
        pageNo++;
        const g = geo(pageNo);
        k.newPage(g.mediaW, g.mediaH, g.ox, g.oy, print ? {
            trim: [g.ox, slug + bleed, g.ox + TW, slug + bleed + TH],
            bleed: [slug, slug, g.mediaW - slug, g.mediaH - slug],
        } : undefined);
        k.artifact(() => {
            k.rect(-g.bl, -bleed, TW + g.bl + g.br, TH + 2 * bleed, { fill: t.page });
            if (print?.cropMarks) {
                const off = bleed + 1.5, len = 5;
                const black: RGB = [0, 0, 0];
                for (const cx of [0, TW]) for (const cy of [0, TH]) {
                    const sx = cx === 0 ? -1 : 1, sy = cy === 0 ? -1 : 1;
                    k.line(cx + sx * off, cy, cx + sx * (off + len), cy, black, 0.1);
                    k.line(cx, cy + sy * off, cx, cy + sy * (off + len), black, 0.1);
                }
            }
        }, 'Page');
    };

    const label = (str: string, x: number, y: number, size: number, color: RGB, track = 0.5, align: 'left' | 'right' = 'left') =>
        k.text(str.toUpperCase(), x, y, { font: 'sansBold', size, color, track, align });
    const folio = () => {
        const b = box(), y = TH - 11;
        k.artifact(() => {
            k.text(String(pageNo), b.recto ? b.x1 : b.x0, y, { font: 'serif', size: 9 * Math.max(K * 0.85, 1), color: muted, align: b.recto ? 'right' : 'left' });
            const head = title.length > 40 ? `${title.slice(0, 39)}…` : title;
            label(head, b.recto ? b.x0 : b.x1, y, 6.5, muted, 0.7, b.recto ? 'left' : 'right');
        }, 'Pagination');
    };
    const rule = (x1: number, y: number, x2: number, w = 0.35) => k.artifact(() => k.line(x1, y, x2, y, t.ink, w));
    const hairline = (x1: number, y: number, x2: number) => k.artifact(() => k.line(x1, y, x2, y, faint, 0.12));

    const FIRST = plan.front + 1;
    const solStart = FIRST + plan.puzzlePages;
    const pageOf = (n: number) => FIRST + Math.floor((n - 1) / per);
    const solPageOf = (n: number) => solStart + Math.floor((n - 1) / solPer);

    // ---- 3. Front matter ----
    const bookmarks: Array<[string, number]> = [];
    const mark = (name: string, page: number) => bookmarks.push([name, page]);

    if (!print) {
        newPage();
        if (ct !== t) k.artifact(() => k.rect(0, 0, TW, TH, { fill: ct.page }));
        drawFrontCover(k, ct, cfg, { x: 0, y: 0, w: TW, h: TH, bleedTop: 0, bleedRight: 0, total, seed, sc });
        mark('Cover', pageNo);
    } else {
        newPage(); // title page
        mark('Title page', pageNo);
        const b = box();
        let fs = Math.min(34, TW / 4.2);
        let lines: string[] = [];
        for (; fs > 16; fs -= 1) { lines = k.wrap(title, b.w, { font: 'serifBold', size: fs }); if (lines.length <= 3) break; }
        const y0 = TH * 0.3;
        k.tag('H1', () => lines.forEach((ln, i) => k.text(ln, b.cx, y0 + i * fs * 0.4, { font: 'serifBold', size: fs, color: t.ink, align: 'center' })), { actual: title });
        const yy = y0 + lines.length * fs * 0.4 + 4;
        k.artifact(() => k.rect(b.cx - 9, yy, 18, 0.8, { fill: spot }));
        k.tag('P', () => {
            k.text(`${total} sudoku puzzle${total === 1 ? '' : 's'} in ten levels`, b.cx, yy + 10, { font: 'serifItalic', size: 12 * Math.max(sc, 0.8), color: muted, align: 'center' });
            if (author) k.text(author, b.cx, TH * 0.78, { font: 'serif', size: 14 * Math.max(sc, 0.8), color: t.ink, align: 'center' });
        });
    }

    if (cfg.copyright.enabled) {
        newPage();
        mark('Copyright', pageNo);
        const b = box();
        const holder = cfg.copyright.holder.trim() || author || title;
        const paras: Array<{ text: string; italic?: boolean }> = [
            { text: `© ${cfg.copyright.year} ${holder}. All rights reserved.` },
            { text: 'No part of this book may be reproduced or transmitted in any form without written permission, except for personal use and brief quotations in reviews.' },
            ...(cfg.copyright.isbn.trim() ? [{ text: `ISBN ${cfg.copyright.isbn.trim()}` }] : []),
            { text: `${total} puzzle${total === 1 ? '' : 's'}, generated by algorithm. Every puzzle has exactly one solution.` },
            { text: `To regenerate this book exactly, use seed ${seed} with the same puzzle counts and settings.`, italic: true },
            { text: 'Set in Inter and Source Serif 4, both used under the SIL Open Font License.', italic: true },
        ];
        const fs = 8.5 * Math.max(K * 0.9, 1);
        const wrapped = paras.map((p) => ({ ...p, lines: k.wrap(p.text, Math.min(b.w, 95), { font: p.italic ? 'serifItalic' : 'serif', size: fs }) }));
        const blockH = wrapped.reduce((n, p) => n + p.lines.length * fs * 0.45 + 3.5, 0);
        let y = TH - 34 - blockH; // the block ends above the folio
        k.tag('H2', () => label('Copyright', b.x0, y - 8, 7, spot, 1.2));
        for (const p of wrapped) {
            k.tag('P', () => p.lines.forEach((ln, i) => k.text(ln, b.x0, y + i * fs * 0.45, { font: p.italic ? 'serifItalic' : 'serif', size: fs, color: p.italic ? muted : t.ink })));
            y += p.lines.length * fs * 0.45 + 3.5;
        }
        folio();
    }

    // How to play
    newPage();
    mark('How to play', pageNo);
    {
        const b = box();
        let y = TOP + 8;
        k.tag('P', () => label('Before you start', b.x0, TOP, 7 * Math.max(K * 0.9, 1), spot, 1.2));
        k.tag('H1', () => k.text('How to play', b.x0, y + 6 * K, { font: 'serifBold', size: 26 * Math.max(sc, 0.8) * (lp ? 1.1 : 1), color: t.ink }));
        y += 16 * Math.max(sc, 0.8) * (lp ? 1.25 : 1);
        const fs = Math.min(lp ? 17 : 11, (lp ? 14 : 9.5) * Math.max(sc, 0.85));
        const para = 'Fill the grid so that every row, every column and every 3 × 3 box contains the digits 1 to 9, each exactly once. Every puzzle in this book has one solution, and logic alone will find it. If you catch yourself guessing, look again for a row, column or box that is nearly complete.';
        const lines = k.wrap(para, b.w, { font: 'serif', size: fs });
        const lh = fs * 0.36 * 1.45;
        k.tag('P', () => lines.forEach((ln, i) => k.text(ln, b.x0, y + i * lh, { font: 'serif', size: fs, color: t.ink })));
        y += lines.length * lh + 4;

        // diagram: one row, one column and one box around the centre cell
        const ds = Math.min(b.w * 0.42, 46 * sc), dc = ds / 9;
        const dy = y;
        k.tag('Figure', () => {
            for (let i = 0; i < 9; i++) {
                k.rect(b.x0 + i * dc, dy + 4 * dc, dc, dc, { fill: spot, opacity: 0.18 });
                k.rect(b.x0 + 4 * dc, dy + i * dc, dc, dc, { fill: spot, opacity: 0.18 });
            }
            k.rect(b.x0 + 3 * dc, dy + 3 * dc, 3 * dc, 3 * dc, { fill: spot, opacity: 0.3 });
            k.rect(b.x0 + 4 * dc, dy + 4 * dc, dc, dc, { fill: spot });
            for (let i = 1; i < 9; i++) if (i % 3) { k.line(b.x0 + i * dc, dy, b.x0 + i * dc, dy + ds, faint, 0.1); k.line(b.x0, dy + i * dc, b.x0 + ds, dy + i * dc, faint, 0.1); }
            for (let i = 3; i < 9; i += 3) { k.line(b.x0 + i * dc, dy, b.x0 + i * dc, dy + ds, t.ink, 0.35); k.line(b.x0, dy + i * dc, b.x0 + ds, dy + i * dc, t.ink, 0.35); }
            k.rect(b.x0, dy, ds, ds, { stroke: t.ink, lw: 0.7 });
        }, { alt: 'Diagram of a sudoku grid. The row, the column and the 3 by 3 box that pass through one central dark cell are shaded.' });
        const capFs = 8.5 * Math.max(sc, 0.85) * (lp ? 1.5 : 1);
        const capLines = k.wrap('The shaded row, column and box through the dark cell each need all nine digits.', b.w - ds - 6, { font: 'serifItalic', size: capFs });
        k.tag('P', () => capLines.forEach((ln, i) => k.text(ln, b.x0 + ds + 6, dy + 6 + i * capFs * 0.42, { font: 'serifItalic', size: capFs, color: muted })));
        y += ds + 10;

        // the ten levels
        const room = TH - BOT - y - 6;
        const rowH = Math.min(6.2 * (lp ? 1.3 : 1), room / 11);
        if (rowH >= 3.4) {
            k.tag('P', () => label('The ten levels', b.x0, y, 7 * Math.max(K * 0.9, 1), spot, 1.2));
            y += 3;
            rule(b.x0, y, b.x1);
            LEVELS.forEach((l, i) => {
                const ry = y + (i + 1) * rowH;
                const f = Math.min(lp ? 15 : 10, rowH * 1.7);
                k.tag('P', () => {
                    k.text(String(l), b.x0 + 1, ry - rowH * 0.28, { font: 'serifBold', size: f, color: t.ink });
                    k.text(LEVEL_NAMES[l], b.x0 + 9, ry - rowH * 0.28, { font: 'serif', size: f, color: t.ink });
                    k.text(LEVEL_TECHNIQUES[l], b.x1, ry - rowH * 0.28, { font: 'serifItalic', size: Math.min(lp ? 13 : 9, rowH * 1.5), color: muted, align: 'right' });
                });
                hairline(b.x0, ry, b.x1);
            });
        }
        folio();
    }

    // Contents
    newPage();
    mark('Contents', pageNo);
    {
        const b = box();
        k.tag('P', () => label('In this book', b.x0, TOP, 7 * Math.max(K * 0.9, 1), spot, 1.2));
        k.tag('H1', () => k.text('Contents', b.x0, TOP + 14, { font: 'serifBold', size: 26 * Math.max(sc, 0.8) * (lp ? 1.1 : 1), color: t.ink }));
        let y = TOP + 24 * Math.max(sc, 0.8) * (lp ? 1.2 : 1);
        const rows = LEVELS.filter((l) => cfg.counts[l] > 0);
        const rowH = Math.min(11 * sc * (lp ? 1.4 : 1), (TH - BOT - y - 10) / (rows.length + 1));
        rule(b.x0, y, b.x1);
        let n = 1;
        const row = (name: string, sub: string, pg: string) => {
            const ry = y + rowH;
            const f = Math.min(lp ? 17 : 12, rowH * 1.15);
            k.tag('P', () => {
                k.text(name, b.x0, ry - rowH * 0.42, { font: 'serifBold', size: f, color: t.ink });
                k.text(sub, b.x0, ry - rowH * 0.12, { font: 'serifItalic', size: Math.min(lp ? 12.5 : 8.5, rowH * 0.8), color: muted });
                k.text(pg, b.x1, ry - rowH * 0.3, { font: 'serif', size: f, color: t.ink, align: 'right' });
            });
            hairline(b.x0, ry, b.x1);
            y = ry;
        };
        for (const l of rows) {
            const a = n, z = n + cfg.counts[l] - 1; n = z + 1;
            const pa = pageOf(a), pz = pageOf(z);
            bookmarks.push([`Level ${l} · ${LEVEL_NAMES[l]}`, pa]);
            row(`Level ${l}  ·  ${LEVEL_NAMES[l]}`, `Puzzles ${a}${z > a ? `–${z}` : ''}`, pa === pz ? `${pa}` : `${pa}–${pz}`);
        }
        bookmarks.push(['Solutions', solStart]);
        row('Solutions', `All ${total} puzzles, ${solPer === 4 ? 'four' : 'two'} to a page`, `${solStart}`);
        folio();
    }

    // ---- 4. Puzzle pages ----
    const slotH = (TH - TOP - BOT) / per;
    const HEAD = (per === 1 ? 18 : 13) * (lp ? 1.2 : 1);
    const NOTE = 8 * (lp ? 1.4 : 1);
    for (let i = 0; i < entries.length; i += per) {
        newPage();
        const b = box();
        entries.slice(i, i + per).forEach((e, s) => {
            const board = Math.max(20, Math.min(b.w, slotH - HEAD - NOTE - 6));
            const blockH = HEAD + board + NOTE;
            const top = TOP + s * slotH + Math.max(0, (slotH - blockH) / 2 - (per === 1 ? 4 : 0));
            const x = b.cx - board / 2;
            const nf = (per === 1 ? 34 : 22) * (lp ? 1.2 : 1);
            const numW = k.width(String(e.number), { font: 'serifBold', size: nf });
            k.tag('H2', () => k.text(String(e.number), x, top + HEAD - 5, { font: 'serifBold', size: nf, color: t.ink }), { actual: `Puzzle ${e.number}` });
            const nx = x + numW + 4;
            k.tag('P', () => {
                label(`Level ${e.level}`, nx, top + HEAD - 12 * (lp ? 1.1 : 1), 7 * Math.max(K * 0.9, 1), spot, 1);
                k.text(LEVEL_NAMES[e.level], nx, top + HEAD - 6.5, { font: 'serifItalic', size: 11 * Math.max(K * 0.9, 1), color: muted });
            });
            k.artifact(() => {
                const sq = Math.min(1.6, board / 40) * (lp ? 1.3 : 1);
                for (let m = 0; m < 10; m++) {
                    const mx = x + board - (10 - m) * (sq + 0.55) + 0.55;
                    if (m < e.level) k.rect(mx, top + HEAD - 10, sq, sq, { fill: t.ink });
                    else k.rect(mx, top + HEAD - 10, sq, sq, { stroke: faint, lw: 0.15 });
                }
            });
            drawBoard(k, t, x, top + HEAD, board, e.puzzle, null,
                `Sudoku puzzle ${e.number}, level ${e.level}, ${LEVEL_NAMES[e.level]}, with ${e.puzzle.filter(Boolean).length} given digits. ${rowsText(e.puzzle)}.`);
            k.tag('P', () => k.text(`Solution on page ${solPageOf(e.number)}`, x, top + HEAD + board + 5 * (lp ? 1.4 : 1), { font: 'serifItalic', size: 7.5 * Math.max(K * 0.9, 1), color: muted }));
        });
        folio();
        onProgress?.(Math.min(i + per, entries.length), entries.length, 'Laying out puzzles');
    }

    // ---- 5. Solutions ----
    const gap = 9;
    const stacked = solPer === 2;
    for (let i = 0; i < entries.length; i += solPer) {
        newPage();
        if (i === 0) mark('Solutions', pageNo);
        const b = box();
        k.tag(i === 0 ? 'H1' : 'P', () => label('Solutions', b.x0, TOP, 7 * Math.max(K * 0.9, 1), spot, 1.2));
        rule(b.x0, TOP + 3, b.x1);
        const area = TH - TOP - BOT - 8;
        const colW = stacked ? b.w : (b.w - gap) / 2;
        const LAB = 7 * (lp ? 1.3 : 1);
        const cols = stacked ? 1 : 2;
        const board = Math.min(colW, (area - 2 * LAB - gap) / 2);
        const rowsH = 2 * (LAB + board) + gap;
        const y0 = TOP + 8 + Math.max(0, (area - rowsH) / 2);
        entries.slice(i, i + solPer).forEach((e, s) => {
            const col = s % cols, row = Math.floor(s / cols);
            const x = stacked ? b.cx - board / 2 : b.x0 + col * (colW + gap) + (colW - board) / 2;
            const y = y0 + row * (LAB + board + gap);
            k.tag('P', () => {
                const nw = k.text(String(e.number), x, y + 5.2 * (lp ? 1.2 : 1), { font: 'serifBold', size: 15 * Math.max(K * 0.9, 1), color: t.ink });
                label(`Level ${e.level}`, x + nw + 2.5, y + 5.2 * (lp ? 1.2 : 1), 6.5 * Math.max(K * 0.9, 1), muted, 0.8);
            }, { actual: `Solution to puzzle ${e.number}, level ${e.level}` });
            drawBoard(k, t, x, y + LAB, board, e.puzzle, e.solution, `Solution to sudoku puzzle ${e.number}, level ${e.level}. ${rowsText(e.solution)}.`);
        });
        folio();
    }

    // Print interiors need an even page count.
    if (plan.blank) { newPage(); }
    onProgress?.(total, total, 'Finishing PDF');

    // Bookmarks: one flat list in reading order.
    const seen = new Set<string>();
    bookmarks.sort((a, b) => a[1] - b[1]);
    for (const [name] of bookmarks) { if (!seen.has(name)) { seen.add(name); k.outline(name); } }
    const interior = await k.finish();
    const pages = k.pageCount;

    // ---- 6. Cover wrap for print ----
    let cover: Uint8Array | undefined;
    let spineMm: number | undefined;
    if (print) {
        spineMm = spineWidthMm(pages, print.paper);
        cover = await buildCover({ cfg, t: ct, fonts, pages, spineMm, bleed, slug, total, seed });
    }
    return { interior, cover, pages, spineMm };
}

// ---------------------------------------------------------------------------------------------

interface CoverArgs { cfg: BookConfig; t: Theme; fonts: FontSet; pages: number; spineMm: number; bleed: number; slug: number; total: number; seed: string }

/** Back cover + spine + front cover as one flat sheet, with bleed and optional crop marks. */
async function buildCover({ cfg, t, fonts, pages, spineMm, bleed, slug, total, seed }: CoverArgs): Promise<Uint8Array> {
    const TW = cfg.pageWidth, TH = cfg.pageHeight;
    const spot = spotOf(t);
    const inkSaver = cfg.inkSaver;
    const title = cfg.title.trim() || 'Sudoku';
    const author = cfg.author.trim();
    const sc = Math.max(Math.min(TW / 148, TH / 210), 0.7);
    const W = 2 * TW + spineMm, H = TH;
    const k = new Kit({ title: `${title} (cover)`, author: author || undefined, subject: 'Print cover wrap: back cover, spine and front cover' }, fonts);
    const mediaW = W + 2 * bleed + 2 * slug, mediaH = H + 2 * bleed + 2 * slug;
    k.newPage(mediaW, mediaH, slug + bleed, slug + bleed, {
        trim: [slug + bleed, slug + bleed, slug + bleed + W, slug + bleed + H],
        bleed: [slug, slug, mediaW - slug, mediaH - slug],
    });
    k.artifact(() => {
        k.rect(-bleed, -bleed, W + 2 * bleed, H + 2 * bleed, { fill: t.page });
        if (cfg.print?.cropMarks) {
            const off = bleed + 1.5, len = 5;
            for (const cx of [0, W]) for (const cy of [0, H]) {
                const sx = cx === 0 ? -1 : 1, sy = cy === 0 ? -1 : 1;
                k.line(cx + sx * off, cy, cx + sx * (off + len), cy, [0, 0, 0], 0.1);
                k.line(cx, cy + sy * off, cx, cy + sy * (off + len), [0, 0, 0], 0.1);
            }
        }
    }, 'Page');

    // front cover (right panel)
    const fx = TW + spineMm;
    drawFrontCover(k, t, cfg, { x: fx, y: 0, w: TW, h: TH, bleedTop: bleed, bleedRight: bleed, total, seed, sc });

    // back cover (left panel): short text and a clear area for the ISBN barcode
    const blurb = cfg.backCover.trim() || `${total} sudoku puzzles in ten levels of difficulty, every one with a single solution, plus a full answer key at the back.`;
    const bLines = k.wrap(blurb, TW - 2 * M - GUT * 2, { font: 'serif', size: 11 * Math.max(sc, 0.85) });
    k.tag('P', () => bLines.forEach((ln, i) => k.text(ln, M + GUT, H * 0.22 + i * 5.4, { font: 'serif', size: 11 * Math.max(sc, 0.85), color: t.ink })));
    if (cfg.barcodeArea) k.artifact(() => k.rect(TW - 6.35 - 50.8, H - 6.35 - 30.5, 50.8, 30.5, { fill: [255, 255, 255] })); // 2 x 1.2 in, 0.25 in from the trim

    // spine (needs 79+ pages for text, as most print-on-demand services require)
    k.artifact(() => {
        if (inkSaver) { k.line(TW, 0, TW, H, spot, 0.3); k.line(TW + spineMm, 0, TW + spineMm, H, spot, 0.3); }
        else k.rect(TW, -bleed, spineMm, H + 2 * bleed, { fill: spot });
    });
    if (pages >= 79 && spineMm >= 6) {
        const onSpot = inkSaver ? t.ink : readableOn(spot);
        if (inkSaver || contrast(onSpot, spot) >= 4.5) {
            const size = Math.min(14, spineMm * 1.6);
            const full = author ? `${title}  ·  ${author}` : title;
            k.tag('P', () => k.rotatedText(full, TW + spineMm / 2 + size * 0.17, 14, 90, { font: 'serifBold', size, color: onSpot }));
        }
    }
    return k.finish();
}

export { totalPuzzles };
