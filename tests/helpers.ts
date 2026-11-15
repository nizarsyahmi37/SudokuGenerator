import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_FILES, type FontSet } from '../lib/pdf/kit';
import type { BookConfig } from '../lib/bookConfig';

export function loadFonts(): FontSet {
    const fonts = {} as FontSet;
    for (const k of Object.keys(FONT_FILES) as Array<keyof FontSet>) fonts[k] = new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts', FONT_FILES[k])));
    return fonts;
}

export const smallBook = (over: Partial<BookConfig> = {}): BookConfig => ({
    counts: { 1: 2, 2: 0, 3: 1, 4: 0, 5: 1, 6: 0, 7: 0, 8: 0, 9: 0, 10: 1 },
    pageWidth: 148, pageHeight: 210, puzzlesPerPage: 1, title: 'Test Book', author: 'Tester',
    theme: 'forest', mode: 'light', seed: 'TEST-0001', largePrint: false, print: null,
    copyright: { enabled: true, holder: '', year: 2026, isbn: '' }, backCover: '',
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
