import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL_UPDATED } from '../lib/site';

/** Shared frame for the policy pages: a way back, one h1, the date, and readable prose. */
export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="app">
            <main id="main" tabIndex={-1} className="panel legal">
                <p className="back"><Link href="/">← Back to the game</Link></p>
                <h1>{title}</h1>
                <p className="updated">Last updated {LEGAL_UPDATED}</p>
                {children}
            </main>
        </div>
    );
}
