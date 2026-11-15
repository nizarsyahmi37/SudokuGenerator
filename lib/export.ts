import { css, ensure, mix, type RGB } from './palette';
import { getTheme, type Mode, type Theme } from './themes';
import type { BoardKind } from './pdf/board';
import { downloadBlob, pdfBlob } from './download';

export type ExportFormat = 'pdf' | 'png' | 'jpg';
export type ExportKind = BoardKind;

export interface ExportInput {
    puzzle: number[];
    solution: number[];
    level: number;
    levelName: string;
}

export interface ExportStyle {
    theme: string;
    mode: Mode;
    /** Pure black on white, for printing on a home printer. */
    plain: boolean;
}

const PLAIN: Theme = {
    ...getTheme('classic', 'light'),
    page: [255, 255, 255], card: [255, 255, 255], ink: [0, 0, 0], muted: [70, 70, 70], primary: [0, 0, 0], accent: [0, 0, 0], filled: [0, 0, 0], given: [0, 0, 0],
};

export const styleTheme = (s: ExportStyle): Theme => (s.plain ? PLAIN : getTheme(s.theme, s.mode));

const PAGE = 1200;
const MARGIN = 100;
const BLOCK_H = 1480;

let fontsReady: Promise<void> | null = null;
/** Loads the same Inter and Source Serif files the PDFs embed, so images and PDFs look alike. */
function loadFonts(): Promise<void> {
    fontsReady ??= (async () => {
        const defs: Array<[string, string, FontFaceDescriptors]> = [
            ['ExportSans', 'inter-latin-400-normal.woff', { weight: '400' }],
            ['ExportSans', 'inter-latin-700-normal.woff', { weight: '700' }],
            ['ExportSerif', 'source-serif-4-latin-700-normal.woff', { weight: '700' }],
            ['ExportSerif', 'source-serif-4-latin-400-italic.woff', { weight: '400', style: 'italic' }],
        ];
        await Promise.all(defs.map(async ([family, file, d]) => {
            const face = new FontFace(family, `url(/fonts/${file})`, d);
            await face.load();
            document.fonts.add(face);
        }));
    })().catch(() => { fontsReady = null; });
    return fontsReady;
}

function drawBlock(ctx: CanvasRenderingContext2D, t: Theme, input: ExportInput, solved: boolean, top: number) {
    const spot: RGB = t.motif === 'classic' ? t.accent : t.primary;
    const thin = ensure(mix(t.page, t.ink, 0.38), t.page, 3.1);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = css(spot);
    ctx.font = '700 26px ExportSans, Helvetica, Arial, sans-serif';
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '5px';
    ctx.fillText('SUDOKU', MARGIN, top + 120);
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    ctx.fillStyle = css(t.ink);
    ctx.font = '700 96px ExportSerif, Georgia, serif';
    ctx.fillText(`Level ${input.level}`, MARGIN, top + 215);
    ctx.fillStyle = css(t.muted);
    ctx.font = 'italic 400 40px ExportSerif, Georgia, serif';
    ctx.fillText(`${input.levelName}${solved ? '  ·  Solution' : ''}`, MARGIN, top + 275);

    const size = PAGE - 2 * MARGIN, x0 = MARGIN, y0 = top + 330, cell = size / 9;
    ctx.strokeStyle = css(thin);
    ctx.lineWidth = 2;
    for (let i = 1; i < 9; i++) {
        if (i % 3 === 0) continue;
        ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + size, y0 + i * cell); ctx.stroke();
    }
    ctx.strokeStyle = css(t.ink);
    ctx.lineWidth = 6;
    for (let i = 3; i < 9; i += 3) {
        ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + size, y0 + i * cell); ctx.stroke();
    }
    ctx.lineWidth = 10;
    ctx.strokeRect(x0, y0, size, size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 81; i++) {
        const given = input.puzzle[i] !== 0;
        const v = given ? input.puzzle[i] : solved ? input.solution[i] : 0;
        if (!v) continue;
        ctx.fillStyle = css(given ? t.ink : spot);
        ctx.font = `${given ? 700 : 400} ${Math.round(cell * 0.62)}px ExportSans, Helvetica, Arial, sans-serif`;
        ctx.fillText(String(v), x0 + (i % 9) * cell + cell / 2, y0 + Math.floor(i / 9) * cell + cell / 2 + 3);
    }
}

async function renderCanvas(input: ExportInput, kinds: Array<'blank' | 'solved'>, t: Theme): Promise<HTMLCanvasElement> {
    await loadFonts();
    const canvas = document.createElement('canvas');
    canvas.width = PAGE;
    canvas.height = BLOCK_H * kinds.length;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = css(t.page); // JPG has no transparency, so the paper colour is painted in
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    kinds.forEach((k, n) => drawBlock(ctx, t, input, k === 'solved', n * BLOCK_H));
    return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string) => new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, 0.95));

export async function exportBoard(input: ExportInput, kind: ExportKind, format: ExportFormat, style: ExportStyle) {
    const t = styleTheme(style);
    const name = `sudoku-level-${input.level}-${kind}${style.plain ? '-plain' : ''}`;
    if (format === 'pdf') {
        const [{ buildBoardPdf }, { fetchFonts }] = await Promise.all([import('./pdf/board'), import('./pdf/kit')]);
        const bytes = await buildBoardPdf(input, kind, t, await fetchFonts());
        downloadBlob(pdfBlob(bytes), `${name}.pdf`);
        return;
    }
    const kinds: Array<'blank' | 'solved'> = kind === 'both' ? ['blank', 'solved'] : [kind];
    const canvas = await renderCanvas(input, kinds, t);
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    downloadBlob(await toBlob(canvas, mime), `${name}.${format}`);
}
