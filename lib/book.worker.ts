/// <reference lib="webworker" />
import { buildBook, buildCoverPreview } from './pdf/book';
import { fetchFonts } from './pdf/kit';
import { scriptsIn } from './pdf/scripts';
import type { BookConfig, BookResult } from './bookConfig';

export interface WorkerRequest {
    id: number; cfg: BookConfig; fontsBase: string;
    /** `cover` makes only the cover, for the live preview. The result's `interior` is then that cover. */
    kind?: 'book' | 'cover';
}
export type WorkerMessage =
    | { id: number; type: 'progress'; done: number; total: number; phase: string }
    | { id: number; type: 'done'; result: BookResult }
    | { id: number; type: 'error'; message: string };

/** Builds the whole book off the main thread so the page stays responsive, however big it is. */
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const { id, cfg, fontsBase, kind } = e.data;
    const post = (m: WorkerMessage, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);
    try {
        // Only fetch the fonts for other alphabets when the book's own text uses them.
        const fonts = await fetchFonts(fontsBase, scriptsIn(cfg.title, cfg.author, cfg.cover.subtitle, cfg.copyright.holder, cfg.backCover));
        if (kind === 'cover') {
            const bytes = await buildCoverPreview(cfg, fonts);
            post({ id, type: 'done', result: { interior: bytes, pages: 1, offGrade: [] } }, [bytes.buffer]);
            return;
        }
        const result = await buildBook(cfg, fonts, (done, total, phase) => post({ id, type: 'progress', done, total, phase }));
        post({ id, type: 'done', result }, [result.interior.buffer, ...(result.cover ? [result.cover.buffer] : [])]);
    } catch (err) {
        post({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
};
