const isProd = process.env.NODE_ENV === 'production';

/**
 * Content-Security-Policy. Next.js adds small inline scripts and styles to every page, so 'unsafe-inline' is
 * needed for those; everything else is restricted to this site plus what AdSense documents it needs.
 * In development React needs 'unsafe-eval', so the policy is only applied to production builds.
 */
const ads = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? 'https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.doubleclick.net https://fundingchoicesmessages.google.com' : '';
const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${ads ? `'unsafe-eval' ${ads}` : ''}`,
    `style-src 'self' 'unsafe-inline' ${ads}`,
    `img-src 'self' data: blob: ${ads ? 'https:' : ''}`,
    "font-src 'self' data:",
    `connect-src 'self' ${ads}`,
    `frame-src ${ads || "'none'"}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
    ...(isProd ? [{ key: 'Content-Security-Policy', value: csp }] : []),
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
            { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        ];
    },
};

export default nextConfig;
