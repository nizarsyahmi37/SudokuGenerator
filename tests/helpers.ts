import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { FONT_FILES, type FontSet } from '../lib/pdf/kit';
import { DEFAULT_COVER, type BookConfig } from '../lib/bookConfig';

export function loadFonts(): FontSet {
    const fonts = {} as FontSet;
    for (const k of Object.keys(FONT_FILES) as Array<keyof FontSet>) fonts[k] = new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts', FONT_FILES[k])));
    return fonts;
}

export const smallBook = (over: Partial<BookConfig> = {}): BookConfig => ({
    counts: { 1: 2, 2: 0, 3: 1, 4: 0, 5: 1, 6: 0, 7: 0, 8: 0, 9: 0, 10: 1 },
    pageWidth: 148, pageHeight: 210, puzzlesPerPage: 1, title: 'Test Book', author: 'Tester',
    theme: 'forest', mode: 'light', seed: 'TEST-0001', largePrint: false, print: null,
    copyright: { enabled: true, holder: '', year: 2026, isbn: '' }, cover: DEFAULT_COVER, inkSaver: false, barcodeArea: true, backCover: '',
    ...over,
});

/** Text of every page, for comparing two builds of the same book. */
export async function pageTexts(bytes: Uint8Array): Promise<string[]> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    const out: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const tc = await (await doc.getPage(i)).getTextContent();
        out.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' '));
    }
    return out;
}

/** A small valid RGB PNG (a diagonal gradient), built by hand so the tests need no image library. */
export function makePng(w = 48, h = 32): Uint8Array {
    const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type: string, data: Uint8Array) => {
        const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
        dv.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8);
        dv.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
        return out;
    };
    const raw = new Uint8Array((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = (x * 255) / w; raw[o + 1] = (y * 255) / h; raw[o + 2] = 160; }
    const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
    dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2;
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}
