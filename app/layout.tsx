import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Orbitron, Rajdhani } from 'next/font/google';
import Providers from '../components/Providers';
import SiteFooter from '../components/SiteFooter';
import SkipLink from '../components/SkipLink';
import { themeCss } from '../lib/uiTheme';
import { BASE_URL, SITE, SITE_DESCRIPTION } from '../lib/site';
import './globals.css';

const display = Orbitron({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-display', display: 'swap' });
const body = Rajdhani({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-body', display: 'swap' });

const TITLE = `${SITE.name}: play sudoku and make puzzle books`;

export const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),
    title: { default: TITLE, template: `%s · ${SITE.name}` },
    description: SITE_DESCRIPTION,
    applicationName: SITE.name,
    keywords: ['sudoku', 'sudoku generator', 'sudoku puzzle book', 'printable sudoku', 'sudoku hints', 'daily sudoku'],
    alternates: { canonical: '/' },
    openGraph: { type: 'website', siteName: SITE.name, title: TITLE, description: SITE_DESCRIPTION, url: '/', locale: 'en_US' },
    twitter: { card: 'summary_large_image', title: TITLE, description: SITE_DESCRIPTION },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    colorScheme: 'light dark',
    themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f3f1ff' }, { media: '(prefers-color-scheme: dark)', color: '#0b0e28' }],
};

const JSON_LD = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE.name,
    url: BASE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern browser with JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    inLanguage: 'en',
});

/** Runs before first paint so the saved theme, light/dark mode and effects setting never flash. */
const BOOT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('sudoku-theme');if(t&&/^[a-z]+$/.test(t))d.dataset.theme=t;var m=localStorage.getItem('sudoku-mode')||'system';var dark=matchMedia('(prefers-color-scheme: dark)').matches;d.dataset.mode=m==='light'||m==='dark'?m:(dark?'dark':'light');var l=localStorage.getItem('sudoku-locale');if(l&&/^[a-z]{2}$/.test(l)){d.lang=l;d.dir=l==='ar'?'rtl':'ltr';}var e=localStorage.getItem('sudoku-effects');d.dataset.effects=e?e:(matchMedia('(prefers-reduced-motion: reduce)').matches?'off':'on');}catch(x){d.dataset.mode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.dataset.effects='on';}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    // Set by proxy.ts for every request. Reading it makes pages render per request, which is what lets the nonce change each time.
    const nonce = (await headers()).get('x-nonce') ?? undefined;
    return (
        <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
            <head>
                <style nonce={nonce} dangerouslySetInnerHTML={{ __html: themeCss() }} />
                <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOT }} />
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
            </head>
            <body>
                <SkipLink />
                <Providers>
                    {children}
                    <SiteFooter />
                </Providers>
            </body>
        </html>
    );
}
