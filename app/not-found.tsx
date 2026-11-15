import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
    return (
        <div className="app">
            <main id="main" tabIndex={-1} className="panel legal">
                <h1>Page not found</h1>
                <p>We could not find that page. It may have moved, or the link may be mistyped.</p>
                <p><Link href="/">Back to the game</Link></p>
            </main>
        </div>
    );
}
