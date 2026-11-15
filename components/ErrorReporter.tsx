'use client';

import { useEffect } from 'react';
import { reportError } from '../lib/report';

/** Reports script errors and unhandled promise failures from the page, so problems on real devices are not invisible. */
export default function ErrorReporter() {
    useEffect(() => {
        const onError = (e: ErrorEvent) => reportError('error', e.error ?? e.message);
        const onRejection = (e: PromiseRejectionEvent) => reportError('promise', e.reason);
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
    }, []);
    return null;
}
