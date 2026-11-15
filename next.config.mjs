const isProd = process.env.NODE_ENV === 'production';

// The Content-Security-Policy is set per request, with a fresh nonce, in proxy.ts. The other security headers are static.

const securityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    poweredByHeader: false,
    reactStrictMode: true,
    // Only the Playwright test servers set this, so two builds can sit side by side. Vercel uses the default.
    distDir: process.env.NEXT_DIST_DIR || '.next',
    async headers() {
        return [
            { source: '/:path*', headers: securityHeaders },
            // The service worker file must never be cached for long, or a fixed worker could not reach people.
            { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, max-age=0' }, { key: 'Service-Worker-Allowed', value: '/' }] },
            { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        ];
    },
};

export default nextConfig;
