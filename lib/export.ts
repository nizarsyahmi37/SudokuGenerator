import type { Board } from './sudoku';

export type ExportFormat = 'pdf' | 'png' | 'jpg';
export type ExportKind = 'blank' | 'solved' | 'both';

interface ExportInput {
    puzzle: Board;
    solution: Board;
    title: string; // e.g. "Level 7 — Hard"
}

const PAGE = 1200; // px width of a single-board image
const MARGIN = 100;
const HEADER = 130;
const BOARD = PAGE - MARGIN * 2;

/** Draws one titled board onto ctx with its top-left corner at (0, top). */
function drawBoard(ctx: CanvasRenderingContext2D, title: string, subtitle: string, puzzle: Board, solution: Board | null, top: number) {
    ctx.fillStyle = '#1f2430';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 48px Helvetica, Arial, sans-serif';
    ctx.fillText(title, MARGIN, top + 62);
    ctx.fillStyle = '#6b7280';
    ctx.font = '28px Helvetica, Arial, sans-serif';
    ctx.fillText(subtitle, MARGIN, top + 104);

    const x0 = MARGIN;
    const y0 = top + HEADER;
    const cell = BOARD / 9;

    ctx.strokeStyle = '#9aa0ad';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 9; i++) {
        if (i % 3 === 0) continue;
        ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + BOARD); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + BOARD, y0 + i * cell); ctx.stroke();
    }
    ctx.strokeStyle = '#1f2430';
    ctx.lineWidth = 6;
    for (let i = 0; i <= 9; i += 3) {
        ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + BOARD); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + BOARD, y0 + i * cell); ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 81; i++) {
        const given = puzzle[i] !== 0;
        const value = given ? puzzle[i] : solution ? solution[i] : 0;
        if (!value) continue;
        ctx.fillStyle = given ? '#1f2430' : '#2457d6';
        ctx.font = `${given ? 'bold ' : ''}${Math.round(cell * 0.6)}px Helvetica, Arial, sans-serif`;
        ctx.fillText(String(value), x0 + (i % 9) * cell + cell / 2, y0 + Math.floor(i / 9) * cell + cell / 2 + 3);
    }
}

const boardHeight = HEADER + BOARD + MARGIN;

function renderCanvas(input: ExportInput, kinds: Array<'blank' | 'solved'>, background: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE;
    canvas.height = boardHeight * kinds.length;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    kinds.forEach((k, n) => {
        drawBoard(ctx, 'Sudoku', k === 'blank' ? `${input.title} — Puzzle` : `${input.title} — Solution`,
            input.puzzle, k === 'solved' ? input.solution : null, n * boardHeight);
    });
    return canvas;
}

function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
    return new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, 0.95));
}

export async function exportBoard(input: ExportInput, kind: ExportKind, format: ExportFormat) {
    const kinds: Array<'blank' | 'solved'> = kind === 'both' ? ['blank', 'solved'] : [kind];
    const name = `sudoku-${kind}`;

    if (format === 'pdf') {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
        pdf.setProperties({ title: `Sudoku — ${input.title}`, subject: 'Sudoku puzzle' });
        (pdf as any).setLanguage?.('en-US');
        const w = pdf.internal.pageSize.getWidth();
        kinds.forEach((k, i) => {
            if (i > 0) pdf.addPage();
            const img = renderCanvas(input, [k], '#ffffff');
            pdf.addImage(img.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 40, w, (w * img.height) / img.width);
        });
        pdf.save(`${name}.pdf`);
        return;
    }

    // PNG / JPG: "both" is stacked into a single image. JPG has no alpha, so it is drawn on white.
    const canvas = renderCanvas(input, kinds, '#ffffff');
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    download(await toBlob(canvas, mime), `${name}.${format}`);
}
