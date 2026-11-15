import { CLUES, generatePuzzle, LEVELS, LEVEL_NAMES, type Level, type Puzzle } from './sudoku';
import { fill, mix, opacity, rng, stroke, textc, type PDF, type RGB, type Theme } from './bookThemes';
import { ensure } from './palette';
import { getTheme, type Mode } from './themes';

export const PAGE_SIZES: Record<string, [number, number]> = {
    A4: [210, 297],
    A5: [148, 210],
    A6: [105, 148],
    B5: [176, 250],
    Letter: [215.9, 279.4],
};

export interface BookConfig {
    counts: Record<Level, number>; // number of puzzles per level
    pageWidth: number; // mm
    pageHeight: number; // mm
    puzzlesPerPage: 1 | 2;
    title: string;
    theme: string;
    mode: Mode; // paper: light or dark
}

interface BookEntry extends Puzzle {
    number: number;
    level: Level;
}

const M = 16; // outer margin
const GUT = 4; // extra margin on the binding side
const TOP = 18;
const BOT = 20; // space reserved at the bottom for the folio

export function totalPuzzles(counts: Record<Level, number>) {
    return LEVELS.reduce((sum, l) => sum + (counts[l] || 0), 0);
}

/** Level colour ramp used by the app UI (the printed book itself uses a single spot colour). */
export function levelColor(level: Level): RGB {
    const hue = ((140 - ((level - 1) * 210) / 9) + 360) % 360;
    const s = 0.62, l = 0.44;
    const k = (n: number) => (n + hue / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** The one accent colour of a theme. */
const spotOf = (t: Theme): RGB => (t.motif === 'classic' ? t.accent : t.primary);

// ---------- typography helpers ----------

const SERIF = 'times';
const SANS = 'helvetica';

/** Tracked upper-case label, left aligned. Returns its approximate width in mm. */
function label(pdf: PDF, text: string, x: number, y: number, size: number, color: RGB, track = 0.5, align: 'left' | 'right' = 'left') {
    const up = text.toUpperCase();
    pdf.setFont(SANS, 'bold'); pdf.setFontSize(size); textc(pdf, color);
    const w = pdf.getTextWidth(up) + (up.length - 1) * track;
    pdf.text(up, align === 'right' ? x - w : x, y, { baseline: 'alphabetic', charSpace: track });
    return w;
}

function serif(pdf: PDF, text: string | string[], x: number, y: number, size: number, style: 'normal' | 'bold' | 'italic' | 'bolditalic', color: RGB, opts: Record<string, unknown> = {}) {
    pdf.setFont(SERIF, style); pdf.setFontSize(size); textc(pdf, color);
    pdf.text(text, x, y, { baseline: 'alphabetic', ...opts });
}

function hairline(pdf: PDF, x1: number, y: number, x2: number, color: RGB, w = 0.15) {
    stroke(pdf, color); pdf.setLineWidth(w); pdf.line(x1, y, x2, y);
}

/** Row of 10 small squares, `level` of them solid. */
function levelMarks(pdf: PDF, xRight: number, y: number, level: Level, ink: RGB, faint: RGB, s = 1.5) {
    for (let i = 0; i < 10; i++) {
        const x = xRight - (10 - i) * (s + 0.55) + 0.55;
        if (i < level) { fill(pdf, ink); pdf.rect(x, y, s, s, 'F'); }
        else { stroke(pdf, faint); pdf.setLineWidth(0.15); pdf.rect(x, y, s, s, 'S'); }
    }
}

function drawBoard(pdf: PDF, t: Theme, x: number, y: number, size: number, puzzle: number[], solution: number[] | null) {
    const cell = size / 9, spot = spotOf(t);
    stroke(pdf, ensure(mix(t.page, t.ink, 0.38), t.page, 3.1)); pdf.setLineWidth(0.12);
    for (let i = 1; i < 9; i++) {
        if (i % 3 === 0) continue;
        pdf.line(x + i * cell, y, x + i * cell, y + size);
        pdf.line(x, y + i * cell, x + size, y + i * cell);
    }
    stroke(pdf, t.ink); pdf.setLineWidth(Math.max(0.35, size / 220));
    for (let i = 3; i < 9; i += 3) {
        pdf.line(x + i * cell, y, x + i * cell, y + size);
        pdf.line(x, y + i * cell, x + size, y + i * cell);
    }
    pdf.setLineWidth(Math.max(0.7, size / 100));
    pdf.rect(x, y, size, size, 'S');
    pdf.setFontSize(cell * 2.0);
    for (let i = 0; i < 81; i++) {
        const given = puzzle[i] !== 0;
        const v = given ? puzzle[i] : solution ? solution[i] : 0;
        if (!v) continue;
        pdf.setFont(SANS, given ? 'bold' : 'normal');
        textc(pdf, given ? t.ink : spot);
        pdf.text(String(v), x + (i % 9) * cell + cell / 2, y + Math.floor(i / 9) * cell + cell / 2, { align: 'center', baseline: 'middle' });
    }
}

// ---------- the book ----------

export async function buildBook(config: BookConfig, onProgress?: (done: number, total: number, phase: string) => void): Promise<PDF> {
    const { pageWidth: W, pageHeight: H, puzzlesPerPage: per } = config;
    const t = getTheme(config.theme, config.mode);
    const spot = spotOf(t);
    const faint = ensure(mix(t.page, t.ink, 0.4), t.page, 3.1); // functional lines: 3:1 against the paper
    const total = totalPuzzles(config.counts);
    const sc = Math.max(Math.min(W / 148, H / 210), 0.7); // designed on A5, scaled for other sizes
    const title = (config.title || 'Sudoku').trim();

    // 1. Generate puzzles, easiest level first. Yield to the browser so the UI stays responsive.
    const entries: BookEntry[] = [];
    for (const level of LEVELS) {
        for (let n = 0; n < (config.counts[level] || 0); n++) {
            entries.push({ ...generatePuzzle(level), level, number: entries.length + 1 });
            onProgress?.(entries.length, total, 'Generating puzzles');
            if (entries.length % 3 === 0) await new Promise((r) => setTimeout(r, 0));
        }
    }

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'landscape' : 'portrait' });
    // Document-level accessibility: title, language, and a navigable outline (bookmarks).
    const docTitle = title || 'Sudoku';
    pdf.setProperties({ title: docTitle, subject: `${total} sudoku puzzles in ten levels, with solutions`, creator: 'Sudoku generator' });
    (pdf as any).setLanguage?.('en-US');
    (pdf as any).viewerPreferences?.({ DisplayDocTitle: true });
    const outline = (pdf as any).outline;
    const mark = (name: string, page: number) => outline?.add(null, name, { pageNumber: page });
    let pageNo = 0;

    /** Content box of the current page; the binding side gets a little extra margin. */
    const box = () => {
        const recto = pageNo % 2 === 1;
        const x0 = recto ? M + GUT : M;
        const w = W - 2 * M - GUT;
        return { x0, w, x1: x0 + w, cx: x0 + w / 2, recto };
    };
    const newPage = (first = false) => {
        if (!first) pdf.addPage([W, H]);
        pageNo++;
        fill(pdf, t.page); pdf.rect(0, 0, W, H, 'F');
    };
    /** Page number at the outer bottom corner, book title (tracked small caps) at the other. */
    const folio = () => {
        const b = box(), y = H - 11;
        serif(pdf, String(pageNo), b.recto ? b.x1 : b.x0, y, 9, 'normal', t.muted, { align: b.recto ? 'right' : 'left' });
        const head = title.length > 40 ? title.slice(0, 39) + '…' : title;
        label(pdf, head, b.recto ? b.x0 : b.x1, y, 6.5, t.muted, 0.7, b.recto ? 'left' : 'right');
    };

    const puzzlePages = Math.ceil(total / per);
    const FIRST = 4;
    const solStart = FIRST + puzzlePages;
    const pageOf = (n: number) => FIRST + Math.floor((n - 1) / per);
    const solPageOf = (n: number) => solStart + Math.floor((n - 1) / 4);

    mark('Cover', 1); mark('How to play', 2); mark('Contents', 3);
    // ===== Cover: type on the left, an oversized grid bleeding off the top-right =====
    newPage(true);
    {
        const size = W * 0.92, x0 = W * 0.3, y0 = -W * 0.12, cell = size / 9, rand = rng(7);
        fill(pdf, spot); opacity(pdf, 0.13);
        pdf.rect(x0 + 3 * cell, y0 + 3 * cell, 3 * cell, 3 * cell, 'F');
        stroke(pdf, spot);
        opacity(pdf, 0.45);
        for (let i = 0; i <= 9; i++) {
            pdf.setLineWidth(i % 3 === 0 ? 0.9 : 0.2);
            pdf.line(x0 + i * cell, y0, x0 + i * cell, y0 + size);
            pdf.line(x0, y0 + i * cell, x0 + size, y0 + i * cell);
        }
        opacity(pdf, 0.55);
        pdf.setFont(SANS, 'bold'); pdf.setFontSize(cell * 1.9); textc(pdf, spot);
        const used = new Set<number>();
        for (let k = 0; k < 16; k++) {
            const idx = Math.floor(rand() * 81);
            if (used.has(idx)) continue;
            used.add(idx);
            pdf.text(String(1 + Math.floor(rand() * 9)), x0 + (idx % 9) * cell + cell / 2, y0 + Math.floor(idx / 9) * cell + cell / 2, { align: 'center', baseline: 'middle' });
        }
        opacity(pdf, 1);
    }
    {
        const x = M + GUT, maxW = W - x - M;
        let fs = Math.min(40, W / 3.4);
        let lines: string[] = [];
        for (; fs > 16; fs -= 1) {
            pdf.setFont(SERIF, 'bold'); pdf.setFontSize(fs);
            lines = pdf.splitTextToSize(title, maxW) as string[];
            if (lines.length <= 3) break;
        }
        const lh = fs * 0.42;
        const blockTop = H * 0.62;
        label(pdf, 'Sudoku', x, blockTop - 8, 8, spot, 1.6);
        serif(pdf, lines, x, blockTop + fs * 0.3, fs, 'bold', t.ink, { lineHeightFactor: 1.05 });
        const ty = blockTop + fs * 0.3 + (lines.length - 1) * lh * 1.05 + 9;
        fill(pdf, spot); pdf.rect(x, ty - 3, 18, 0.8, 'F');
        serif(pdf, `${total} puzzle${total === 1 ? '' : 's'} in ten levels, from gentle to fiendish.`, x, ty + 5, 11 * Math.max(sc, 0.8), 'italic', t.muted, { maxWidth: maxW });
    }

    // ===== How to play =====
    newPage();
    {
        const b = box();
        let y = TOP + 8;
        label(pdf, 'Before you start', b.x0, TOP, 7, spot, 1.2);
        serif(pdf, 'How to play', b.x0, y + 6, 26 * Math.max(sc, 0.8), 'bold', t.ink);
        y += 16 * Math.max(sc, 0.8);
        const fs = Math.min(11, 9.5 * Math.max(sc, 0.85));
        const para = 'Fill the grid so that every row, every column and every 3 × 3 box contains the digits 1 to 9, each exactly once. Every puzzle in this book has one solution, and logic alone will find it. If you catch yourself guessing, look again for a row, column or box that is nearly complete.';
        pdf.setFont(SERIF, 'normal'); pdf.setFontSize(fs);
        const lines = pdf.splitTextToSize(para, b.w) as string[];
        serif(pdf, lines, b.x0, y, fs, 'normal', t.ink, { lineHeightFactor: 1.45 });
        y += lines.length * fs * 0.4 * 1.45 + 6;

        // small worked diagram: one row, one column and one box
        const ds = Math.min(b.w * 0.42, 46 * sc), dc = ds / 9;
        fill(pdf, spot); opacity(pdf, 0.16);
        for (let i = 0; i < 9; i++) { pdf.rect(b.x0 + i * dc, y + 4 * dc, dc, dc, 'F'); pdf.rect(b.x0 + 4 * dc, y + i * dc, dc, dc, 'F'); }
        opacity(pdf, 0.3); pdf.rect(b.x0 + 3 * dc, y + 3 * dc, 3 * dc, 3 * dc, 'F'); opacity(pdf, 1);
        fill(pdf, spot); pdf.rect(b.x0 + 4 * dc, y + 4 * dc, dc, dc, 'F');
        stroke(pdf, faint); pdf.setLineWidth(0.1);
        for (let i = 1; i < 9; i++) if (i % 3) { pdf.line(b.x0 + i * dc, y, b.x0 + i * dc, y + ds); pdf.line(b.x0, y + i * dc, b.x0 + ds, y + i * dc); }
        stroke(pdf, t.ink); pdf.setLineWidth(0.35);
        for (let i = 3; i < 9; i += 3) { pdf.line(b.x0 + i * dc, y, b.x0 + i * dc, y + ds); pdf.line(b.x0, y + i * dc, b.x0 + ds, y + i * dc); }
        pdf.setLineWidth(0.7); pdf.rect(b.x0, y, ds, ds, 'S');
        serif(pdf, 'The shaded row, column and box through the dark cell each need all nine digits.', b.x0 + ds + 6, y + 6, 8.5 * Math.max(sc, 0.85), 'italic', t.muted, { maxWidth: b.w - ds - 6 });
        y += ds + 10;

        // level table
        const room = H - BOT - y - 6;
        const rowH = Math.min(6.2, room / 11);
        if (rowH >= 3.4) {
            label(pdf, 'The ten levels', b.x0, y, 7, spot, 1.2);
            y += 3;
            hairline(pdf, b.x0, y, b.x1, t.ink, 0.35);
            LEVELS.forEach((l, i) => {
                const ry = y + (i + 1) * rowH;
                serif(pdf, String(l), b.x0 + 1, ry - rowH * 0.28, Math.min(10, rowH * 1.7), 'bold', t.ink);
                serif(pdf, LEVEL_NAMES[l], b.x0 + 9, ry - rowH * 0.28, Math.min(10, rowH * 1.7), 'normal', t.ink);
                serif(pdf, `${CLUES[l]} clues`, b.x1, ry - rowH * 0.28, Math.min(9, rowH * 1.5), 'italic', t.muted, { align: 'right' });
                hairline(pdf, b.x0, ry, b.x1, faint, 0.1);
            });
        }
        folio();
    }

    // ===== Contents =====
    newPage();
    {
        const b = box();
        label(pdf, 'In this book', b.x0, TOP, 7, spot, 1.2);
        serif(pdf, 'Contents', b.x0, TOP + 14, 26 * Math.max(sc, 0.8), 'bold', t.ink);
        let y = TOP + 24 * Math.max(sc, 0.8);
        const rows = LEVELS.filter((l) => config.counts[l] > 0);
        const rowH = Math.min(11 * sc, (H - BOT - y - 10) / (rows.length + 1));
        hairline(pdf, b.x0, y, b.x1, t.ink, 0.35);
        let n = 1;
        const row = (name: string, sub: string, pg: string) => {
            const ry = y + rowH;
            serif(pdf, name, b.x0, ry - rowH * 0.42, Math.min(12, rowH * 1.15), 'bold', t.ink);
            serif(pdf, sub, b.x0, ry - rowH * 0.12, Math.min(8.5, rowH * 0.8), 'italic', t.muted);
            serif(pdf, pg, b.x1, ry - rowH * 0.3, Math.min(12, rowH * 1.15), 'normal', t.ink, { align: 'right' });
            hairline(pdf, b.x0, ry, b.x1, faint, 0.1);
            y = ry;
        };
        rows.forEach((l) => {
            const a = n, z = n + config.counts[l] - 1; n = z + 1;
            const pa = pageOf(a), pz = pageOf(z);
            mark(`Level ${l} · ${LEVEL_NAMES[l]}`, pa);
            row(`Level ${l}  ·  ${LEVEL_NAMES[l]}`, `Puzzles ${a}${z > a ? `–${z}` : ''}`, pa === pz ? `${pa}` : `${pa}–${pz}`);
        });
        mark('Solutions', solStart);
        row('Solutions', `All ${total} puzzles, four to a page`, `${solStart}`);
        folio();
    }

    // ===== Puzzle pages =====
    const slotH = (H - TOP - BOT) / per;
    const HEAD = per === 1 ? 18 : 13;
    const NOTE = 8;
    for (let i = 0; i < entries.length; i += per) {
        newPage();
        const b = box();
        entries.slice(i, i + per).forEach((e, s) => {
            const board = Math.max(20, Math.min(b.w, slotH - HEAD - NOTE - 6));
            const blockH = HEAD + board + NOTE;
            const top = TOP + s * slotH + Math.max(0, (slotH - blockH) / 2 - (per === 1 ? 4 : 0));
            const x = b.cx - board / 2;
            const nf = per === 1 ? 34 : 22;
            serif(pdf, String(e.number), x, top + HEAD - 5, nf, 'bold', t.ink);
            const nx = x + pdf.getTextWidth(String(e.number)) + 4;
            label(pdf, `Level ${e.level}`, nx, top + HEAD - 12, 7, spot, 1);
            serif(pdf, LEVEL_NAMES[e.level], nx, top + HEAD - 6.5, 11, 'italic', t.muted);
            levelMarks(pdf, x + board, top + HEAD - 10, e.level, t.ink, faint, Math.min(1.6, board / 40));
            drawBoard(pdf, t, x, top + HEAD, board, e.puzzle, null);
            serif(pdf, `Solution on page ${solPageOf(e.number)}`, x, top + HEAD + board + 5, 7.5, 'italic', t.muted);
        });
        folio();
        onProgress?.(Math.min(i + per, entries.length), entries.length, 'Laying out puzzles');
    }

    // ===== Solutions: four to a page =====
    const gap = 9;
    for (let i = 0; i < entries.length; i += 4) {
        newPage();
        const b = box();
        label(pdf, 'Solutions', b.x0, TOP, 7, spot, 1.2);
        hairline(pdf, b.x0, TOP + 3, b.x1, t.ink, 0.35);
        const area = H - TOP - BOT - 8;
        const colW = (b.w - gap) / 2;
        const LAB = 7;
        const board = Math.min(colW, (area - 2 * LAB - gap) / 2);
        const rowsH = 2 * (LAB + board) + gap;
        const y0 = TOP + 8 + Math.max(0, (area - rowsH) / 2);
        entries.slice(i, i + 4).forEach((e, s) => {
            const col = s % 2, row = Math.floor(s / 2);
            const x = b.x0 + col * (colW + gap) + (colW - board) / 2;
            const y = y0 + row * (LAB + board + gap);
            serif(pdf, String(e.number), x, y + 5.2, 15, 'bold', t.ink);
            const nx = x + pdf.getTextWidth(String(e.number)) + 2.5;
            label(pdf, `Level ${e.level}`, nx, y + 5.2, 6.5, t.muted, 0.8);
            drawBoard(pdf, t, x, y + LAB, board, e.puzzle, e.solution);
        });
        folio();
    }
    onProgress?.(total, total, 'Done');
    return pdf;
}
