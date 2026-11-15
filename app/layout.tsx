import type { Metadata, Viewport } from 'next';
import { Orbitron, Rajdhani } from 'next/font/google';
import Script from 'next/script';
import Providers from '../components/Providers';
import { themeCss } from '../lib/uiTheme';
import './globals.css';

const display = Orbitron({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-display', display: 'swap' });
const body = Rajdhani({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
    title: 'Sudoku — play, generate and print puzzle books',
    description: 'Play sudoku at ten difficulty levels and turn them into a printable PDF puzzle book with solutions.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, colorScheme: 'light dark' };

/** Runs before first paint so the saved theme, light/dark mode and effects setting never flash. */
const BOOT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('sudoku-theme');if(t&&/^[a-z]+$/.test(t))d.dataset.theme=t;var m=localStorage.getItem('sudoku-mode')||'system';var dark=matchMedia('(prefers-color-scheme: dark)').matches;d.dataset.mode=m==='light'||m==='dark'?m:(dark?'dark':'light');var e=localStorage.getItem('sudoku-effects');d.dataset.effects=e?e:(matchMedia('(prefers-reduced-motion: reduce)').matches?'off':'on');}catch(x){d.dataset.mode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.dataset.effects='on';}})();`;

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
            <head>
                <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
                <script dangerouslySetInnerHTML={{ __html: BOOT }} />
            </head>
            <body>
                <a className="skip-link" href="#main">Skip to main content</a>
                <Providers>{children}</Providers>
                {ADSENSE_CLIENT && (
                    <Script
                        id="adsense"
                        async
                        strategy="afterInteractive"
                        crossOrigin="anonymous"
                        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`}
                    />
                )}
            </body>
        </html>
    );
}
