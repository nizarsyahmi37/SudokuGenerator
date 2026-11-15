import { NextResponse, type NextRequest } from 'next/server';

/**
 * Content-Security-Policy with a fresh nonce for every page request. Only scripts that carry the nonce (or that a nonced
 * script loads, through 'strict-dynamic') run, so an injected <script> or inline handler is blocked. Styles use a nonce too;
 * `style-src-attr` still allows style="" attributes, which the app uses for theme colours and which cannot run code.
 * Next.js reads the nonce from this header and puts it on its own scripts and styles.
 */
const ADS = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
const ADS_HOSTS = 'https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.doubleclick.net https://fundingchoicesmessages.google.com';

export function proxy(request: NextRequest) {
    const nonce = btoa(crypto.randomUUID());
    const dev = process.env.NODE_ENV !== 'production';
    const csp = [
        "default-src 'self'",
        // React needs eval in development for readable errors. AdSense needs it in production.
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev || ADS ? " 'unsafe-eval'" : ''}${ADS ? ` ${ADS_HOSTS}` : ''}`,
        // AdSense writes its own inline styles, which cannot carry our nonce, so with ads the nonce is dropped for 'unsafe-inline'.
        ADS ? `style-src 'self' 'unsafe-inline' ${ADS_HOSTS}` : `style-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-inline'" : ''}`,
        "style-src-attr 'unsafe-inline'",
        `img-src 'self' data: blob:${ADS ? ' https:' : ''}`,
        "font-src 'self' data:",
        `connect-src 'self'${ADS ? ` ${ADS_HOSTS}` : ''}${dev ? ' ws:' : ''}`,
        `frame-src ${ADS ? ADS_HOSTS : "'none'"}`,
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        ...(dev ? [] : ['upgrade-insecure-requests']),
    ].join('; ');

    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('content-security-policy', csp);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set('content-security-policy', csp);
    return response;
}

export const config = {
    matcher: [
        {
            // Pages only: not the API, built files, fonts, the service worker, or generated images and metadata files.
            source: '/((?!api|_next/static|_next/image|fonts|sw.js|opengraph-image|twitter-image|apple-icon|.*\\..*).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
};
