'use client';

import { useEffect, useId, useRef, useState } from 'react';

/** Renders pages of a finished PDF to a canvas so the book can be checked before it is downloaded. */
export default function BookPreview({ bytes, pageLabel, single }: { bytes: Uint8Array; pageLabel?: (n: number) => string; single?: boolean }) {
    const uid = useId();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [doc, setDoc] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(null);
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [text, setText] = useState('');

    useEffect(() => {
        let cancelled = false;
        let task: import('pdfjs-dist').PDFDocumentLoadingTask | null = null;
        (async () => {
            try {
                const pdfjs = await import('pdfjs-dist');
                pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
                task = pdfjs.getDocument({ data: bytes.slice() });
                const loaded = await task.promise;
                if (cancelled) { void task.destroy(); return; }
                setDoc(loaded);
                setPage(1);
                setError('');
            } catch (e) {
                if (!cancelled) setError(`The preview could not be shown: ${(e as Error).message}`);
            }
        })();
        return () => { cancelled = true; void task?.destroy(); };
    }, [bytes]);

    useEffect(() => {
        if (!doc || !canvasRef.current) return;
        let cancelled = false;
        (async () => {
            const p = await doc.getPage(page);
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const base = p.getViewport({ scale: 1 });
            const cssWidth = Math.min(560, canvasRef.current?.parentElement?.clientWidth || 560);
            const viewport = p.getViewport({ scale: (cssWidth / base.width) * dpr });
            const canvas = canvasRef.current;
            if (!canvas || cancelled) return;
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
            canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
            await p.render({ canvas, viewport }).promise;
            const tc = await p.getTextContent();
            if (!cancelled) setText(tc.items.map((i) => ('str' in i ? i.str : '')).join(' ').replace(/\s+/g, ' ').trim());
        })().catch((e) => { if (!cancelled) setError(`The preview could not be shown: ${(e as Error).message}`); });
        return () => { cancelled = true; };
    }, [doc, page]);

    const pages = doc?.numPages ?? 0;
    const go = (n: number) => setPage(Math.max(1, Math.min(pages, n)));

    if (error) return <p className="status err" role="alert">{error}</p>;
    return (
        <div className="preview">
            {!single && <div className="preview-nav" role="group" aria-label="Preview pages">
                <button type="button" onClick={() => go(1)} disabled={page <= 1} aria-label="First page">«</button>
                <button type="button" onClick={() => go(page - 1)} disabled={page <= 1}>Previous</button>
                <label className="preview-count">
                    <span className="sr-only">Page number</span>
                    <input type="number" min={1} max={pages || 1} value={page} onChange={(e) => go(Number(e.target.value) || 1)} aria-describedby={`${uid}-of`} />
                    <span id={`${uid}-of`}> of {pages}</span>
                </label>
                <button type="button" onClick={() => go(page + 1)} disabled={page >= pages}>Next</button>
                <button type="button" onClick={() => go(pages)} disabled={page >= pages} aria-label="Last page">»</button>
            </div>}
            <div className="preview-page">
                <canvas ref={canvasRef} role="img" aria-label={pageLabel ? pageLabel(page) : `Preview of page ${page} of ${pages}`} aria-describedby={`${uid}-text`} />
            </div>
            <p id={`${uid}-text`} className="sr-only">{text ? `Text on this page: ${text}` : ''}</p>
        </div>
    );
}
