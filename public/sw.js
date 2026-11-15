/* Offline support. The app is a static shell plus code that runs in the browser, so once it has been opened online
 * it can run without a connection. Nothing about the player is stored here, only copies of this site's own files. */
const CACHE = 'sudoku-offline-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        for (const name of await caches.keys()) if (name.startsWith('sudoku-offline-') && name !== CACHE) await caches.delete(name);
        await self.clients.claim();
    })());
});

const sameOrigin = (url) => url.origin === self.location.origin;
const skip = (url) => url.pathname.startsWith('/api/') || url.pathname === '/ads.txt' || url.pathname === '/sw.js';

async function put(request, response) {
    if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
    }
    return response;
}

// Pages: ask the network first so a new release shows up, and use the saved copy when there is no connection.
async function page(request) {
    try {
        return await put(request, await fetch(request));
    } catch {
        const cached = (await caches.match(request)) || (await caches.match('/'));
        return cached || new Response('You are offline, and this page has not been saved yet. Reconnect and open it once.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}

// Built files have a fingerprint in their name and never change, so the saved copy is always right.
async function asset(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return put(request, await fetch(request));
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || request.headers.has('range')) return;
    const url = new URL(request.url);
    if (!sameOrigin(url) || skip(url)) return; // ads and anything on another site go straight to the network
    if (request.mode === 'navigate') event.respondWith(page(request));
    else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/') || /\.(?:svg|png|ico|woff2?|css|js|mjs)$/.test(url.pathname)) event.respondWith(asset(request));
});

// The page lists the files it has loaded so far, so the first visit is saved too and not only the second.
self.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'cache' || !Array.isArray(event.data.urls)) return;
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        for (const u of event.data.urls.slice(0, 200)) {
            try {
                const url = new URL(u, self.location.origin);
                if (!sameOrigin(url) || skip(url) || (await cache.match(url.href))) continue;
                const res = await fetch(url.href, { credentials: 'same-origin' });
                if (res.ok && res.type === 'basic') await cache.put(url.href, res);
            } catch { /* one file failing must not stop the rest */ }
        }
    })());
});
