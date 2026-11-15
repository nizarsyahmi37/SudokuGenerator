'use client';

import type { ReactNode } from 'react';
import ThemeProvider, { useTheme } from './ThemeProvider';
import ThreeBackground from './ThreeBackground';
import ConsentProvider from './ConsentProvider';
import ConsentBanner from './ConsentBanner';
import AdScript from './AdScript';
import OfflineSupport from './OfflineSupport';
import I18nProvider from './I18nProvider';
import ErrorReporter from './ErrorReporter';

function Backdrop() {
    const { effects } = useTheme();
    return effects ? <ThreeBackground /> : null;
}

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <I18nProvider>
            <ConsentProvider>
                <Backdrop />
                <ConsentBanner />
                {children}
                <AdScript />
                <OfflineSupport />
                <ErrorReporter />
            </ConsentProvider>
            </I18nProvider>
        </ThemeProvider>
    );
}
