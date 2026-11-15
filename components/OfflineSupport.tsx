'use client';

import { useEffect } from 'react';

/** Registers the service worker that lets the app open without a connection. Production only, so development reloads stay simple. */
export default function OfflineSupport() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
        let cancelled = false;
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready).then((reg) => {
            if (cancelled) return;
            // Once the page has settled, hand over everything it has loaded from this site so it can be saved.
            const save = () => {
                const urls = [location.pathname, ...performance.getEntriesByType('resource').map((e) => e.name)].filter((u) => u.startsWith('/') || u.startsWith(location.origin));
                reg.active?.postMessage({ type: 'cache', urls });
            };
            if (document.readyState === 'complete') setTimeout(save, 1500);
            else window.addEventListener('load', () => setTimeout(save, 1500), { once: true });
        }).catch(() => { /* offline support is optional */ });
        return () => { cancelled = true; };
    }, []);
    return null;
}
