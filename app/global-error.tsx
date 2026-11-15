'use client';

import { useEffect } from 'react';
import { reportError } from '../lib/report';

/** Last-resort page for errors in the root layout itself. It has to bring its own html and body. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { reportError('page', error); }, [error]);
    return (
        <html lang="en">
            <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#14213d', color: '#ffffff', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
                <main style={{ maxWidth: 520 }} role="alert">
                    <h1>Something went wrong</h1>
                    <p>The site could not load. Your saved game is kept on your device.</p>
                    <button type="button" onClick={reset} style={{ padding: '12px 20px', fontSize: 16, fontWeight: 700, border: 0, borderRadius: 10, background: '#fca311', color: '#14213d', cursor: 'pointer' }}>Try again</button>
                </main>
            </body>
        </html>
    );
}
