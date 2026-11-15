'use client';

import Script from 'next/script';
import { useConsent } from './ConsentProvider';

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/** Loads the AdSense script, but only once the visitor has agreed to ads. */
export default function AdScript() {
    const { adsAllowed, choice } = useConsent();
    if (!CLIENT || !adsAllowed) return null;
    return (
        <>
            <Script id="adsense-config" strategy="afterInteractive">
                {`window.adsbygoogle=window.adsbygoogle||[];window.adsbygoogle.requestNonPersonalizedAds=${choice === 'ads-limited' ? 1 : 0};`}
            </Script>
            <Script id="adsense" async strategy="afterInteractive" crossOrigin="anonymous"
                src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`} />
        </>
    );
}
