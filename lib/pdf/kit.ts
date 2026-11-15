import PDFDocument from 'pdfkit';
import type { RGB } from '../palette';
import { EXTRA_SCRIPTS, splitRuns, type Script } from './scripts';

export type FontKey = 'sans' | 'sansBold' | 'serif' | 'serifBold' | 'serifItalic' | 'serifBoldItalic';

/** Font files (WOFF/TTF bytes). Passed in so the same code runs in a web worker and in Node tests. */
export type FontSet = Record<FontKey, Uint8Array> & {
    /** Optional fonts for other alphabets, keyed like "serifBold:cyrillic". Only the ones a book needs are loaded. */
    extra?: Record<string, Uint8Array>;
};

export const FONT_FILES: Record<FontKey, string> = {
    sans: 'inter-latin-400-normal.woff',
    sansBold: 'inter-latin-700-normal.woff',
    serif: 'source-serif-4-latin-400-normal.woff',
    serifBold: 'source-serif-4-latin-700-normal.woff',
    serifItalic: 'source-serif-4-latin-400-italic.woff',
    serifBoldItalic: 'source-serif-4-latin-700-italic.woff',
};

const BASE_KEYS = Object.keys(FONT_FILES) as FontKey[];

/** File name of a font for another alphabet, e.g. "inter-cyrillic-400-normal.woff". */
export const extraFile = (key: FontKey, script: Exclude<Script, 'latin'>) => FONT_FILES[key].replace('-latin-', `-${script}-`);

/** Loads the font files over HTTP (browser or worker). `scripts` adds fonts for other alphabets. */
export async function fetchFonts(baseUrl = '/fonts/', scripts: Script[] = []): Promise<FontSet> {
    const get = async (file: string) => {
        const res = await fetch(baseUrl + file);
        if (!res.ok) throw new Error(`Could not load font ${file}`);
        return new Uint8Array(await res.arrayBuffer());
    };
    const out = {} as FontSet;
    const extra: Record<string, Uint8Array> = {};
    const wanted = EXTRA_SCRIPTS.filter((s) => scripts.includes(s));
    await Promise.all([
        ...BASE_KEYS.map(async (k) => { out[k] = await get(FONT_FILES[k]); }),
        ...wanted.flatMap((s) => BASE_KEYS.map(async (k) => { extra[`${k}:${s}`] = await get(extraFile(k, s)); })),
    ]);
    if (wanted.length) out.extra = extra;
    return out;
}

type Doc = InstanceType<typeof PDFDocument>;

export interface DocInfo {
    title: string;
    author?: string;
    subject?: string;
    keywords?: string;
    lang?: string;
    /** Print the whole document in the black ink alone (no RGB). Colours are turned into shades of black. */
    pureBlack?: boolean;
}

export interface TextOpts {
    font?: FontKey;
    size?: number; // pt
    color?: RGB;
    align?: 'left' | 'center' | 'right';
    track?: number; // letter spacing in mm
    baseline?: 'alphabetic' | 'middle' | 'top';
    opacity?: number;
}

export const MM = 72 / 25.4;

/**
 * A small mm-based drawing layer over PDFKit that produces a tagged PDF.
 * Rules it enforces so the result can meet PDF/UA:
 *   - every visible thing is either real content inside a structure element (`tag`) or an Artifact,
 *   - all fonts are embedded, the title shows in the viewer and the language is set,
 *   - decorative artwork is never nested inside structure content.
 */
export class Kit {
    readonly doc: Doc;
    private root: ReturnType<Doc['struct']>;
    private chunks: Uint8Array[] = [];
    private finished: Promise<Uint8Array>;
    pageCount = 0;
    private extraNames = new Set<string>();
    private pureBlack: boolean;

    constructor(info: DocInfo, fonts: FontSet) {
        this.pureBlack = !!info.pureBlack;
        this.doc = new PDFDocument({
            autoFirstPage: false,
            font: '', // no default font: only the embedded ones are used (the browser build has no standard fonts)
            margin: 0,
            pdfVersion: '1.7',
            subset: 'PDF/UA' as never, // supported by PDFKit, missing from its type definitions
            tagged: true,
            displayTitle: true,
            lang: info.lang ?? 'en-US',
            info: Object.fromEntries(Object.entries({ Title: info.title, Author: info.author, Subject: info.subject, Keywords: info.keywords, Creator: 'Sudoku generator' }).filter(([, v]) => v)),
        });
        BASE_KEYS.forEach((k) => this.doc.registerFont(k, fonts[k] as unknown as Buffer));
        for (const [name, bytes] of Object.entries(fonts.extra ?? {})) { this.doc.registerFont(name, bytes as unknown as Buffer); this.extraNames.add(name); }
        this.finished = new Promise((resolve, reject) => {
            this.doc.on('data', (c: Uint8Array) => this.chunks.push(c));
            this.doc.on('end', () => {
                const total = this.chunks.reduce((n, c) => n + c.length, 0);
                const out = new Uint8Array(total);
                let o = 0;
                for (const c of this.chunks) { out.set(c, o); o += c.length; }
                resolve(out);
            });
            this.doc.on('error', reject);
        });
        this.root = this.doc.struct('Document');
        this.doc.addStructure(this.root);
    }

    /** Starts a page. `ox`/`oy` (mm) is where the trim box origin sits inside the media box. */
    newPage(widthMm: number, heightMm: number, ox = 0, oy = 0, boxes?: { trim: [number, number, number, number]; bleed: [number, number, number, number] }) {
        this.doc.addPage({ size: [widthMm * MM, heightMm * MM], margin: 0 });
        this.pageCount++;
        if (boxes) {
            const data = (this.doc.page as unknown as { dictionary: { data: Record<string, unknown> } }).dictionary.data;
            const pt = (b: number[]) => b.map((v) => v * MM);
            data.TrimBox = pt(boxes.trim);
            data.BleedBox = pt(boxes.bleed);
        }
        this.doc.translate(ox * MM, oy * MM);
    }

    /** The registered font to use for one run: the alphabet-specific one when it is loaded, else the base font. */
    private fontFor(key: FontKey, script: Script): string {
        const name = `${key}:${script}`;
        return script !== 'latin' && this.extraNames.has(name) ? name : key;
    }

    /** Width of a string in mm, summed over runs so mixed alphabets measure correctly. */
    width(str: string, o: TextOpts = {}): number {
        const track = (o.track ?? 0) * MM;
        let w = 0;
        for (const r of splitRuns(str)) {
            this.doc.font(this.fontFor(o.font ?? 'sans', r.script)).fontSize(o.size ?? 10);
            w += this.doc.widthOfString(r.text, { characterSpacing: track }) + (track ? 0 : 0);
        }
        return (w - (str.length ? track : 0)) / MM;
    }

    /** Splits text into lines no wider than `maxW` mm. */
    wrap(str: string, maxW: number, o: TextOpts = {}): string[] {
        const words = str.split(/\s+/);
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
            const next = cur ? `${cur} ${w}` : w;
            if (cur && this.width(next, o) > maxW) { lines.push(cur); cur = w; } else cur = next;
        }
        if (cur) lines.push(cur);
        return lines;
    }

    // ----- structure -----
    /** Real content: everything drawn inside `draw` belongs to one structure element (H1, P, Figure...). */
    tag(type: string, draw: () => void, opts: { alt?: string; actual?: string; lang?: string } = {}) {
        this.root.add(this.doc.struct(type, opts, draw));
    }

    /** Decorative content that assistive technology should skip. */
    artifact(draw: () => void, type: 'Layout' | 'Pagination' | 'Page' = 'Layout') {
        this.doc.markContent('Artifact', { type });
        draw();
        this.doc.endMarkedContent();
    }

    /**
     * The colour as PDFKit wants it. Normally RGB. With pure black, a grey becomes the K (black) channel of CMYK alone,
     * so a printer lays down black ink only instead of mixing it from several inks.
     */
    private col(c: RGB): RGB | [number, number, number, number] {
        if (!this.pureBlack) return c;
        const luma = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        return [0, 0, 0, Math.round((1 - luma / 255) * 100)];
    }

    // ----- drawing (all coordinates in mm, relative to the trim origin) -----
    private paint(fill: RGB | null, stroke: RGB | null, lw: number, opacity: number, path: () => void) {
        const d = this.doc;
        d.save();
        d.fillOpacity(opacity).strokeOpacity(opacity);
        path();
        if (fill && stroke) d.lineWidth(lw * MM).fillAndStroke(this.col(fill), this.col(stroke));
        else if (fill) d.fill(this.col(fill));
        else if (stroke) d.lineWidth(lw * MM).stroke(this.col(stroke));
        else d.undash();
        d.restore();
    }
    rect(x: number, y: number, w: number, h: number, o: { fill?: RGB; stroke?: RGB; lw?: number; opacity?: number; radius?: number } = {}) {
        this.paint(o.fill ?? null, o.stroke ?? null, o.lw ?? 0.2, o.opacity ?? 1, () => {
            if (o.radius) this.doc.roundedRect(x * MM, y * MM, w * MM, h * MM, o.radius * MM);
            else this.doc.rect(x * MM, y * MM, w * MM, h * MM);
        });
    }
    circle(x: number, y: number, r: number, o: { fill?: RGB; stroke?: RGB; lw?: number; opacity?: number } = {}) {
        this.paint(o.fill ?? null, o.stroke ?? null, o.lw ?? 0.2, o.opacity ?? 1, () => { this.doc.circle(x * MM, y * MM, r * MM); });
    }
    line(x1: number, y1: number, x2: number, y2: number, color: RGB, lw = 0.2, opacity = 1) {
        this.paint(null, color, lw, opacity, () => { this.doc.moveTo(x1 * MM, y1 * MM).lineTo(x2 * MM, y2 * MM); });
    }

    /** Draws one line of text. `y` is the baseline unless `baseline` says otherwise. Returns its width in mm. */
    text(str: string, x: number, y: number, o: TextOpts = {}): number {
        const size = o.size ?? 10;
        const w = this.width(str, o);
        const left = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
        const d = this.doc;
        d.save();
        if (o.opacity !== undefined) d.fillOpacity(o.opacity);
        d.fillColor(this.col(o.color ?? [0, 0, 0]));
        let cx = left * MM;
        for (const r of splitRuns(str)) {
            d.font(this.fontFor(o.font ?? 'sans', r.script)).fontSize(size);
            d.text(r.text, cx, y * MM, { lineBreak: false, baseline: o.baseline ?? 'alphabetic', characterSpacing: (o.track ?? 0) * MM });
            cx += d.widthOfString(r.text, { characterSpacing: (o.track ?? 0) * MM });
        }
        d.restore();
        return w;
    }

    /** Text rotated by `deg` degrees about (x, y). */
    rotatedText(str: string, x: number, y: number, deg: number, o: TextOpts = {}) {
        this.doc.save();
        this.doc.rotate(deg, { origin: [x * MM, y * MM] });
        this.text(str, x, y, o);
        this.doc.restore();
    }

    /** Draws a PNG or JPEG scaled to fill the rectangle, cropped to fit. */
    image(bytes: Uint8Array, x: number, y: number, w: number, h: number) {
        const d = this.doc;
        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        d.save();
        d.rect(x * MM, y * MM, w * MM, h * MM).clip();
        d.image(buf, x * MM, y * MM, { cover: [w * MM, h * MM], align: 'center', valign: 'center' });
        d.restore();
    }

    /** Restricts `draw` to a rectangle (used for artwork that must not spill over a spine). */
    clip(x: number, y: number, w: number, h: number, draw: () => void) {
        this.doc.save();
        this.doc.rect(x * MM, y * MM, w * MM, h * MM).clip();
        draw();
        this.doc.restore();
    }

    outline(title: string) { return this.doc.outline.addItem(title); }

    async finish(): Promise<Uint8Array> {
        this.root.end();
        this.doc.end();
        return this.finished;
    }
}
