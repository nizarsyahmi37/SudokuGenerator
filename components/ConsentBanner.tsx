'use client';

import Link from 'next/link';
import { useConsent } from './ConsentProvider';

/**
 * Asks before any advertising code is loaded. The three answers have equal weight, and the page
 * stays fully usable whatever is chosen. It is a region, not a modal, so it never traps keyboard focus.
 */
export default function ConsentBanner() {
    const { bannerOpen, choose, choice } = useConsent();
    if (!bannerOpen) return null;
    return (
        <section className="consent" role="region" aria-labelledby="consent-title" aria-describedby="consent-text">
            <h2 id="consent-title">Ads and your privacy</h2>
            <p id="consent-text">
                This site can show ads from Google AdSense, which may use cookies and similar identifiers. Nothing is loaded until you choose.
                Games, puzzle books and exports work the same whichever you pick. You can change your mind at any time from <strong>Privacy choices</strong> in the footer.
                Read the <Link href="/privacy">privacy and cookie policy</Link>.
            </p>
            <div className="consent-actions">
                <button type="button" onClick={() => choose('ads')}>Allow ads</button>
                <button type="button" onClick={() => choose('ads-limited')}>Non-personalised ads only</button>
                <button type="button" onClick={() => choose('essential')}>No ads</button>
            </div>
            {choice && <p className="hint">Your current choice: {choice === 'ads' ? 'ads allowed' : choice === 'ads-limited' ? 'non-personalised ads only' : 'no ads'}.</p>}
        </section>
    );
}
