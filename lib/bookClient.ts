import type { BookConfig, BookResult, Progress } from './bookConfig';
import type { WorkerMessage, WorkerRequest } from './book.worker';
import type { FontSet } from './pdf/kit';
import { scriptsIn } from './pdf/scripts';

export interface BookJob {
    promise: Promise<BookResult>;
    /** Where the book is being built: in a background worker, or on the page itself as a fallback. */
    mode: 'worker' | 'main';
    /** Stops the job and frees the worker. */
    cancel: () => void;
}

export interface JobOptions {
    /** Where the font files live; defaults to this site's /fonts/. */
    fontsBase?: string;
    /** Supplies the fonts directly (used by tests and by the main-thread fallback). */
    loadFonts?: (cfg: BookConfig) => Promise<FontSet>;
    /** Forces the main-thread path, for testing. */
    forceMain?: boolean;
}

let nextId = 1;

const ownTextScripts = (cfg: BookConfig) => scriptsIn(cfg.title, cfg.author, cfg.cover.subtitle, cfg.copyright.holder, cfg.backCover);

/**
 * Same build, but on the page itself, for browsers without module Web Workers. It yields to the browser
 * between puzzles and pages so the page stays usable, though a very large book may still feel slow.
 */
function buildOnMainThread(cfg: BookConfig, onProgress: Progress, opts: JobOptions): BookJob {
    let cancelled = false;
    const promise = (async () => {
        const [{ buildBook }, { fetchFonts }] = await Promise.all([import('./pdf/book'), import('./pdf/kit')]);
        const fonts = opts.loadFonts ? await opts.loadFonts(cfg) : await fetchFonts(opts.fontsBase ?? `${location.origin}/fonts/`, ownTextScripts(cfg));
        const yieldToUi = async () => {
            if (cancelled) throw new Error('Cancelled');
            await new Promise<void>((r) => setTimeout(r, 0));
        };
        return buildBook(cfg, fonts, onProgress, yieldToUi);
    })();
    return { promise, mode: 'main', cancel: () => { cancelled = true; } };
}

/** Runs buildBook in a Web Worker. The page never blocks, and the job can be cancelled. */
export function buildBookInWorker(cfg: BookConfig, onProgress: Progress, opts: JobOptions = {}): BookJob {
    if (opts.forceMain || typeof Worker === 'undefined') return buildOnMainThread(cfg, onProgress, opts);

    let worker: Worker;
    try {
        worker = new Worker(new URL('./book.worker.ts', import.meta.url), { type: 'module' });
    } catch {
        return buildOnMainThread(cfg, onProgress, opts); // module workers not supported
    }

    const id = nextId++;
    let started = false; // true once the worker has answered; a failure before that means the worker could not run at all
    let rejectJob!: (e: Error) => void;
    let fallback: BookJob | null = null;
    const promise = new Promise<BookResult>((resolve, reject) => {
        rejectJob = reject;
        worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
            const m = e.data;
            if (m.id !== id) return;
            started = true;
            if (m.type === 'progress') onProgress(m.done, m.total, m.phase);
            else if (m.type === 'done') { resolve(m.result); worker.terminate(); }
            else { reject(new Error(m.message)); worker.terminate(); }
        };
        worker.onerror = (ev) => {
            worker.terminate();
            if (started) { reject(new Error(ev.message || 'The book worker failed')); return; }
            // The worker never got going (for example it was blocked or unsupported): build on the page instead.
            fallback = buildOnMainThread(cfg, onProgress, opts);
            fallback.promise.then(resolve, reject);
        };
        const req: WorkerRequest = { id, cfg, fontsBase: opts.fontsBase ?? `${location.origin}/fonts/` };
        worker.postMessage(req);
    });
    return {
        promise, mode: 'worker',
        cancel: () => { worker.terminate(); fallback?.cancel(); rejectJob(new Error('Cancelled')); },
    };
}
