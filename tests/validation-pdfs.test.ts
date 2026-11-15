import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { buildBook } from '../lib/pdf/book';
import { buildBoardPdf } from '../lib/pdf/board';
import { DEFAULT_COVER } from '../lib/bookConfig';
import { generatePuzzle } from '../lib/sudoku';
import { puzzleRng } from '../lib/rng';
import { getTheme } from '../lib/themes';
import { loadFonts, loadFontsWithScripts, makePng, smallBook } from './helpers';

/**
 * Writes sample PDFs to artifacts/pdfs so a PDF/UA validator can check them by hand: open the folder in the
 * veraPDF desktop app (profile PDF/UA-1) or in PAC. See docs/manual-testing.md.
 * Skipped unless WRITE_SAMPLE_PDFS=1, so the normal test run stays quick and writes nothing.
 */
describe.runIf(process.env.WRITE_SAMPLE_PDFS === '1')('sample PDFs for validation', () => {
    const dir = join(process.cwd(), 'artifacts', 'pdfs');
    mkdirSync(dir, { recursive: true });
    const fonts = loadFonts();
    const print = { bleedMm: 3.175, bleedEdges: 'outer' as const, cropMarks: false, paper: 'white' as const };
    const png = { bytes: makePng(), mime: 'image/png' as const, alt: 'A test picture' };

    const books: Array<[string, Parameters<typeof smallBook>[0]]> = [
        ['book-digital', {}],
        ['book-dark', { theme: 'cosmos', mode: 'dark' }],
        ['book-large-print', { largePrint: true }],
        ['book-two-per-page', { puzzlesPerPage: 2 }],
        ['book-cover-picture', { cover: { ...DEFAULT_COVER, image: png, subtitle: 'With a picture' } }],
        ['book-print', { print, pageWidth: 152.4, pageHeight: 228.6 }],
        ['book-ink-saver', { print, inkSaver: true }],
    ];
    for (const [name, over] of books) {
        it(name, async () => {
            const r = await buildBook(smallBook(over), fonts);
            writeFileSync(join(dir, `${name}.pdf`), r.interior);
            if (r.cover) writeFileSync(join(dir, `${name}-cover.pdf`), r.cover);
        }, 60_000);
    }

    it('book-cyrillic-greek', async () => {
        const r = await buildBook(smallBook({ title: 'Судоку Σούντοκου Việt Łódź', author: 'Žofia' }), loadFontsWithScripts());
        writeFileSync(join(dir, 'book-cyrillic-greek.pdf'), r.interior);
    });

    it('single boards', async () => {
        const p = generatePuzzle(4, puzzleRng('VALIDATE', 4, 0));
        const input = { puzzle: p.puzzle, solution: p.solution, level: 4, levelName: 'Casual' };
        for (const kind of ['blank', 'solved', 'both'] as const) writeFileSync(join(dir, `board-${kind}.pdf`), await buildBoardPdf(input, kind, getTheme('classic', 'light'), fonts));
    });
});
