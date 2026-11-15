import { ensure, mix, type RGB } from '../palette';
import type { Theme } from '../themes';
import { Kit, type FontSet } from './kit';

export interface BoardInput {
    puzzle: number[];
    solution: number[];
    level: number;
    levelName: string;
}

export type BoardKind = 'blank' | 'solved' | 'both';

const rowsText = (b: number[]) => Array.from({ length: 9 }, (_, r) => `Row ${r + 1}: ${b.slice(r * 9, r * 9 + 9).map((v) => v || 'blank').join(', ')}`).join('. ');

/** Tagged, themed PDF of one puzzle (one page per board). */
export async function buildBoardPdf(input: BoardInput, kind: BoardKind, t: Theme, fonts: FontSet): Promise<Uint8Array> {
    const W = 210, H = 297, M = 22;
    const spot: RGB = t.motif === 'classic' ? t.accent : t.primary;
    const thin = ensure(mix(t.page, t.ink, 0.38), t.page, 3.1);
    const title = `Sudoku, level ${input.level}, ${input.levelName}`;
    const k = new Kit({ title, subject: 'Sudoku puzzle' }, fonts);
    const pages: Array<'blank' | 'solved'> = kind === 'both' ? ['blank', 'solved'] : [kind];

    pages.forEach((p, n) => {
        k.newPage(W, H);
        k.artifact(() => k.rect(0, 0, W, H, { fill: t.page }), 'Page');
        const size = W - 2 * M, y = 78, cell = size / 9;
        k.tag('P', () => k.text('SUDOKU', M, 34, { font: 'sansBold', size: 9, color: spot, track: 1.6 }));
        k.tag(n === 0 ? 'H1' : 'H2', () => {
            k.text(`Level ${input.level}`, M, 52, { font: 'serifBold', size: 34, color: t.ink });
        }, { actual: `${title}${p === 'solved' ? ', solution' : ''}` });
        k.tag('P', () => k.text(`${input.levelName}${p === 'solved' ? '  ·  Solution' : ''}`, M, 63, { font: 'serifItalic', size: 14, color: t.muted }));
        k.artifact(() => {
            for (let i = 1; i < 9; i++) {
                if (i % 3 === 0) continue;
                k.line(M + i * cell, y, M + i * cell, y + size, thin, 0.15);
                k.line(M, y + i * cell, M + size, y + i * cell, thin, 0.15);
            }
            for (let i = 3; i < 9; i += 3) {
                k.line(M + i * cell, y, M + i * cell, y + size, t.ink, 0.5);
                k.line(M, y + i * cell, M + size, y + i * cell, t.ink, 0.5);
            }
            k.rect(M, y, size, size, { stroke: t.ink, lw: 1 });
        });
        k.tag('Figure', () => {
            for (let i = 0; i < 81; i++) {
                const given = input.puzzle[i] !== 0;
                const v = given ? input.puzzle[i] : p === 'solved' ? input.solution[i] : 0;
                if (!v) continue;
                k.text(String(v), M + (i % 9) * cell + cell / 2, y + Math.floor(i / 9) * cell + cell / 2, { font: given ? 'sansBold' : 'sans', size: cell * 2.83465 * 0.62, color: given ? t.ink : spot, align: 'center', baseline: 'middle' });
            }
        }, { alt: `${p === 'solved' ? 'Solution to the sudoku puzzle' : 'Sudoku puzzle'}, level ${input.level}. ${rowsText(p === 'solved' ? input.solution : input.puzzle)}.` });
    });
    return k.finish();
}
