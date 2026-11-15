'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookConfig } from '../lib/bookConfig';
import { buildBookInWorker, type BookJob } from '../lib/bookClient';
import BookPreview from './BookPreview';

/** A cheap fingerprint of the picture's bytes, so replacing the picture refreshes the preview. */
const fingerprint = (b: Uint8Array) => { let h = b.length; for (let i = 0; i < b.length; i += Math.max(1, Math.floor(b.length / 64))) h = (h * 31 + b[i]) | 0; return h; };

/**
 * A live picture of the cover while the book is being set up, so nothing has to be built to see it.
 * It redraws a moment after the last change, and never generates the puzzles.
 */
export default function CoverPreview({ cfg }: { cfg: BookConfig }) {
    const [bytes, setBytes] = useState<Uint8Array | null>(null);
    const [state, setState] = useState<'working' | 'ready' | 'error'>('working');
    const [error, setError] = useState('');
    const jobRef = useRef<BookJob | null>(null);
    const cfgRef = useRef(cfg);
    useEffect(() => { cfgRef.current = cfg; });

    // Only what shows on the cover starts a redraw. The puzzle counts, for example, do not (apart from the page count on print covers).
    const key = useMemo(() => JSON.stringify({
        t: cfg.title, a: cfg.author, th: cfg.theme, m: cfg.mode, w: cfg.pageWidth, h: cfg.pageHeight, p: cfg.print, ink: cfg.inkSaver, bc: cfg.barcodeArea, back: cfg.backCover,
        total: Object.values(cfg.counts).reduce((n, v) => n + v, 0), per: cfg.puzzlesPerPage, lp: cfg.largePrint, cr: cfg.copyright.enabled, np: cfg.extras.notesPages, seed: cfg.seed,
        c: { ...cfg.cover, image: cfg.cover.image ? { n: fingerprint(cfg.cover.image.bytes), alt: cfg.cover.image.alt } : null },
    }), [cfg]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the preview is regenerated whenever the cover settings change
        setState('working');
        const timer = setTimeout(() => {
            jobRef.current?.cancel();
            const job = buildBookInWorker(cfgRef.current, () => {}, { kind: 'cover' });
            jobRef.current = job;
            job.promise.then((r) => { if (jobRef.current === job) { setBytes(r.interior); setState('ready'); } }).catch((e: Error) => {
                if (e.message === 'Cancelled') return;
                setError(e.message); setState('error');
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [key]);
    useEffect(() => () => jobRef.current?.cancel(), []);

    return (
        <div className="cover-preview" aria-busy={state === 'working'}>
            <h3 className="field-label">Cover preview</h3>
            {state === 'error' && <p className="status err" role="alert">The cover preview could not be drawn: {error}</p>}
            {bytes && state !== 'error' && <BookPreview bytes={bytes} single pageLabel={() => (cfg.print ? 'Live cover preview: back cover, spine and front cover' : 'Live cover preview: the front cover')} />}
            <p className="hint" role="status">{state === 'working' ? 'Updating the cover preview…' : cfg.print ? 'Back cover, spine and front cover, as they will be printed.' : 'The front cover, as it will appear in the book.'}</p>
        </div>
    );
}
