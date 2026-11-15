import type { BookConfig, BookResult, Progress } from './bookConfig';
import type { WorkerMessage, WorkerRequest } from './book.worker';

export interface BookJob {
    promise: Promise<BookResult>;
    /** Stops the job and frees the worker. */
    cancel: () => void;
}

let nextId = 1;

/** Runs buildBook in a Web Worker. The page never blocks, and the job can be cancelled. */
export function buildBookInWorker(cfg: BookConfig, onProgress: Progress): BookJob {
    const worker = new Worker(new URL('./book.worker.ts', import.meta.url), { type: 'module' });
    const id = nextId++;
    let reject!: (e: Error) => void;
    const promise = new Promise<BookResult>((res, rej) => {
        reject = rej;
        worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
            const m = e.data;
            if (m.id !== id) return;
            if (m.type === 'progress') onProgress(m.done, m.total, m.phase);
            else if (m.type === 'done') { res(m.result); worker.terminate(); }
            else { rej(new Error(m.message)); worker.terminate(); }
        };
        worker.onerror = (ev) => { rej(new Error(ev.message || 'The book worker failed')); worker.terminate(); };
        const req: WorkerRequest = { id, cfg, fontsBase: `${location.origin}/fonts/` };
        worker.postMessage(req);
    });
    return { promise, cancel: () => { worker.terminate(); reject(new Error('Cancelled')); } };
}
