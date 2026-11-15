'use client';

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ADS_ENABLED } from '../lib/site';
import { consentAllowsAds, readConsent, subscribeConsent, writeConsent, type ConsentChoice } from '../lib/consent';

interface Ctx {
    choice: ConsentChoice | null;
    adsAllowed: boolean;
    bannerOpen: boolean;
    choose: (c: ConsentChoice) => void;
    /** Opens the choices again, for the "Privacy choices" link in the footer. */
    reopen: () => void;
}

const ConsentCtx = createContext<Ctx>({ choice: null, adsAllowed: false, bannerOpen: false, choose: () => {}, reopen: () => {} });
export const useConsent = () => useContext(ConsentCtx);

type GoogleFc = { callbackQueue?: Array<() => void>; showRevocationMessage?: () => void };

export default function ConsentProvider({ children }: { children: ReactNode }) {
    // Read from localStorage after hydration; the server render always sees "no choice yet".
    const choice = useSyncExternalStore(subscribeConsent, readConsent, () => null);
    const [reopened, setReopened] = useState(false);

    const choose = useCallback((c: ConsentChoice) => {
        const hadAds = consentAllowsAds(readConsent());
        writeConsent(c);
        setReopened(false);
        // Withdrawing consent after ads have loaded: reload so no further ad requests are made.
        if (hadAds && !consentAllowsAds(c)) window.location.reload();
    }, []);

    const reopen = useCallback(() => {
        setReopened(true);
        // If Google's own consent message (Privacy & messaging in AdSense) is active, let it re-open too.
        const fc = (window as unknown as { googlefc?: GoogleFc }).googlefc;
        fc?.callbackQueue?.push(() => fc.showRevocationMessage?.());
    }, []);

    const value = useMemo<Ctx>(() => ({
        choice,
        adsAllowed: ADS_ENABLED && consentAllowsAds(choice),
        bannerOpen: ADS_ENABLED && (choice === null || reopened),
        choose,
        reopen,
    }), [choice, reopened, choose, reopen]);

    return <ConsentCtx.Provider value={value}>{children}</ConsentCtx.Provider>;
}
