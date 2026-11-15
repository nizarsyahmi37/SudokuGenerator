'use client';

import type { ReactNode } from 'react';
import ThemeProvider, { useTheme } from './ThemeProvider';
import ThreeBackground from './ThreeBackground';

function Backdrop() {
    const { effects } = useTheme();
    return effects ? <ThreeBackground /> : null;
}

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <Backdrop />
            {children}
        </ThemeProvider>
    );
}
