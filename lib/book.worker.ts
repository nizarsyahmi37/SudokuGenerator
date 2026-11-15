/// <reference lib="webworker" />
import { buildBook } from './pdf/book';
import { fetchFonts } from './pdf/kit';
import type { BookConfig, BookResult } from './bookConfig';

export interface WorkerRequest { id: number; cfg: BookConfig; fontsBase: string }
export type WorkerMessage =
    | { id: number; type: 'progress'; done: number; total: number; phase: string }
    | { id: number; type: 'done'; result: BookResult }
    | { id: number; type: 'error'; message: string };

/** Builds the whole book off the main thread so the page stays responsive, however big it is. */
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const { id, cfg, fontsBase } = e.data;
    const post = (m: WorkerMessage, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);
    try {
        const fonts = await fetchFonts(fontsBase);
        const result = await buildBook(cfg, fonts, (done, total, phase) => post({ id, type: 'progress', done, total, phase }));
        post({ id, type: 'done', result }, [result.interior.buffer, ...(result.cover ? [result.cover.buffer] : [])]);
    } catch (err) {
        post({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
};
