'use client';

import type { ReactNode } from 'react';
import ThemeProvider, { useTheme } from './ThemeProvider';
import ThreeBackground from './ThreeBackground';
import ConsentProvider from './ConsentProvider';
import ConsentBanner from './ConsentBanner';
import AdScript from './AdScript';

function Backdrop() {
    const { effects } = useTheme();
    return effects ? <ThreeBackground /> : null;
}

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <ConsentProvider>
                <Backdrop />
                <ConsentBanner />
                {children}
                <AdScript />
            </ConsentProvider>
        </ThemeProvider>
    );
}
