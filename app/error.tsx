'use client';

import { useEffect } from 'react';
import { reportError } from '../lib/report';

/** Shown when something in a page fails while it runs. The game keeps its progress in local storage, so a retry is safe. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { console.error(error); reportError('page', error); }, [error]);
    return (
        <div className="app">
            <main id="main" tabIndex={-1} className="panel legal" role="alert">
                <h1>Something went wrong</h1>
                <p>The page hit a problem. Your saved game and statistics are kept on your device, so you will not lose them.</p>
                <p><button type="button" className="cta" onClick={reset}>Try again</button></p>
            </main>
        </div>
    );
}
