import { LEVELS, type Level } from './sudoku';
import type { Mode } from './themes';
import type { RGB } from './palette';

/** Digital page sizes in mm (width x height). */
export const PAGE_SIZES: Record<string, [number, number]> = {
    A4: [210, 297],
    A5: [148, 210],
    A6: [105, 148],
    B5: [176, 250],
    Letter: [215.9, 279.4],
};

const IN = 25.4;
/** Trim sizes offered by common print-on-demand services (Amazon KDP, IngramSpark, Lulu). */
export const POD_TRIMS: Record<string, [number, number]> = {
    '5 × 8 in': [5 * IN, 8 * IN],
    '5.25 × 8 in': [5.25 * IN, 8 * IN],
    '5.5 × 8.5 in': [5.5 * IN, 8.5 * IN],
    '6 × 9 in': [6 * IN, 9 * IN],
    '7 × 10 in': [7 * IN, 10 * IN],
    '8 × 10 in': [8 * IN, 10 * IN],
    '8.5 × 11 in': [8.5 * IN, 11 * IN],
    'A5 (148 × 210 mm)': [148, 210],
    'A4 (210 × 297 mm)': [210, 297],
};

export const DEFAULT_BLEED_MM = 0.125 * IN; // 3.175 mm
/** Paper thickness per page in inches, used to size the spine. */
export const PAPER_THICKNESS_IN = { white: 0.002252, cream: 0.0025 } as const;

export type Paper = keyof typeof PAPER_THICKNESS_IN;

export interface PrintOptions {
    bleedMm: number;
    /** KDP wants bleed on the outer edges only; IngramSpark and Lulu want it on all sides. */
    bleedEdges: 'outer' | 'all';
    cropMarks: boolean;
    paper: Paper;
}

export interface Copyright {
    enabled: boolean;
    holder: string;
    year: number;
    isbn: string;
}

export interface CoverImage {
    bytes: Uint8Array;
    mime: 'image/png' | 'image/jpeg';
    /** Text description for screen readers; the picture is treated as decoration when this is empty. */
    alt: string;
}

export interface CoverOptions {
    /** Replaces the default tagline under the title. */
    subtitle: string;
    /** Custom cover colours as #rrggbb; empty means use the theme. Text colours adjust to stay readable. */
    bgColor: string;
    accentColor: string;
    /** The large background grid; ignored when a picture is used. */
    showGrid: boolean;
    image: CoverImage | null;
}

export const DEFAULT_COVER: CoverOptions = { subtitle: '', bgColor: '', accentColor: '', showGrid: true, image: null };

export type NotesStyle = 'lined' | 'dotted' | 'blank';

/** Extra pages and touches that do not change the puzzles themselves. */
export interface Extras {
    /** Give every puzzle a name such as "The Amber Fox" next to its number. */
    puzzleTitles: boolean;
    /** Notes pages added after the solutions (0 to MAX_NOTES_PAGES). */
    notesPages: number;
    notesStyle: NotesStyle;
}

export const MAX_NOTES_PAGES = 20;
export const MAX_FONT_BYTES = 20 * 1024 * 1024;

/** True when the bytes start like a TrueType, OpenType or WOFF font (collections and WOFF2 are not accepted). */
export function looksLikeFont(b: Uint8Array): boolean {
    if (b.length < 12) return false;
    const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
    return tag === 'OTTO' || tag === 'wOFF' || tag === 'true' || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0);
}
export const DEFAULT_EXTRAS: Extras = { puzzleTitles: false, notesPages: 0, notesStyle: 'lined' };

export interface BookConfig {
    counts: Record<Level, number>; // number of puzzles per level
    /** Trim size in mm. */
    pageWidth: number;
    pageHeight: number;
    puzzlesPerPage: 1 | 2;
    title: string;
    author: string;
    theme: string;
    mode: Mode; // paper: light or dark
    /** The same seed, counts and settings always produce the same puzzles. */
    seed: string;
    /** Larger type, one puzzle per page and two solutions per page. */
    largePrint: boolean;
    /** null = digital book; otherwise print-ready interior (+ cover wrap). */
    print: PrintOptions | null;
    copyright: Copyright;
    cover: CoverOptions;
    /** Print only: black and white, no coloured pages, fills or pictures, to save ink. */
    inkSaver: boolean;
    /** Print only: keep a white box on the back cover for an ISBN barcode (yours, or the one the printer adds). */
    barcodeArea: boolean;
    /** Short text for the back cover (print) */
    backCover: string;
    extras: Extras;
    /** The author's own font for alphabets the bundled fonts do not cover (Chinese, Japanese, Korean...). Embedded only if used. */
    customFont?: { name: string; bytes: Uint8Array } | null;
}

export interface BookResult {
    interior: Uint8Array;
    /** Print-ready cover wrap (back, spine, front); only when print options are set. */
    cover?: Uint8Array;
    pages: number;
    spineMm?: number;
    /** Puzzles that grade easier than the level of their section, as they really graded. Empty when every puzzle matched. */
    offGrade: Array<{ number: number; level: Level; grade: number }>;
}

export type Progress = (done: number, total: number, phase: string) => void;

export function totalPuzzles(counts: Record<Level, number>) {
    return LEVELS.reduce((sum, l) => sum + (counts[l] || 0), 0);
}

/** Minimum inside (gutter) margin in mm that Amazon KDP asks for, by interior page count. */
export function kdpGutterMm(pages: number) {
    const inches = pages <= 150 ? 0.375 : pages <= 300 ? 0.5 : pages <= 500 ? 0.625 : pages <= 700 ? 0.75 : 0.875;
    return inches * IN;
}

export const spineWidthMm = (pages: number, paper: Paper) => pages * PAPER_THICKNESS_IN[paper] * IN;

/** Page count of the interior for a configuration (front matter + puzzles + solutions + notes, padded to even when printing). */
export function planPages(cfg: Pick<BookConfig, 'counts' | 'puzzlesPerPage' | 'largePrint' | 'copyright' | 'print' | 'extras'>) {
    const total = totalPuzzles(cfg.counts);
    const per = cfg.largePrint ? 1 : cfg.puzzlesPerPage;
    const solPer = cfg.largePrint ? 2 : 4;
    const front = 3 + (cfg.copyright.enabled ? 1 : 0); // cover/title, [copyright], how to play, contents
    const puzzlePages = Math.ceil(total / per);
    const solutionPages = Math.ceil(total / solPer);
    const notes = Math.max(0, Math.min(MAX_NOTES_PAGES, Math.floor(cfg.extras.notesPages) || 0));
    let pages = front + puzzlePages + solutionPages + notes;
    const blank = cfg.print && pages % 2 ? 1 : 0;
    pages += blank;
    return { total, per, solPer, front, puzzlePages, solutionPages, notes, blank, pages };
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
