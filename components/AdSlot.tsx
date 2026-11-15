'use client';

import { useEffect, useRef, useState } from 'react';

type Placement = 'play' | 'book';

// Ads are configured through env vars. Without a publisher id and an ad unit, nothing is rendered.
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const SLOT: Record<Placement, string | undefined> = {
    play: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PLAY || process.env.NEXT_PUBLIC_ADSENSE_SLOT,
    book: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOOK || process.env.NEXT_PUBLIC_ADSENSE_SLOT,
};

/**
 * A Google AdSense slot that only takes up space when an ad is really being shown.
 * - not configured            -> renders nothing
 * - requested, not yet filled -> mounted but collapsed to zero height (AdSense needs it in the DOM)
 * - filled                    -> becomes visible, labelled "Advertisement"
 * - unfilled / blocked        -> removed, so it never leaves an empty box
 */
export default function AdSlot({ placement }: { placement: Placement }) {
    const slot = SLOT[placement];
    const [state, setState] = useState<'pending' | 'filled' | 'unfilled'>('pending');
    const ins = useRef<HTMLModElement>(null);

    useEffect(() => {
        const el = ins.current;
        if (!CLIENT || !slot || !el) return;
        const read = () => {
            const s = el.getAttribute('data-ad-status');
            if (s === 'filled') setState('filled');
            else if (s === 'unfilled') setState('unfilled');
        };
        const mo = new MutationObserver(read);
        mo.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });
        try {
            // Guard against double requests (React strict mode runs effects twice in development).
            if (!el.getAttribute('data-adsbygoogle-status')) {
                const w = window as unknown as { adsbygoogle?: unknown[] };
                (w.adsbygoogle = w.adsbygoogle || []).push({});
            }
        } catch { /* the ad script is blocked or failed: the slot just stays collapsed */ }
        read();
        return () => mo.disconnect();
    }, [slot]);

    if (!CLIENT || !slot || state === 'unfilled') return null;

    return (
        <aside className="ad" data-state={state} aria-label="Advertisement">
            <p className="ad-label" aria-hidden="true">Advertisement</p>
            <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" ref={ins} />
        </aside>
    );
}
