/**
 * Error reports. When something breaks in a visitor's browser the app sends a short, anonymous note to this site's own
 * /api/report endpoint, which writes it to the hosting log (Vercel's runtime logs). Nothing goes to a third party.
 * A report holds the error text, where in the code it happened, the page path (no query, no fragment), the build and
 * the browser's user-agent string. It never holds puzzles, progress, settings, book text or anything typed by the visitor.
 */
export interface ErrorReport {
    /** What kind of failure: a script error, an unhandled promise, or a page that crashed. */
    kind: 'error' | 'promise' | 'page';
    message: string;
    stack: string;
    path: string;
    build: string;
    agent: string;
}

const LIMITS = { message: 300, stack: 1500, path: 100, build: 40, agent: 200 };
const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

/** Takes web addresses out of stack traces (they can carry query strings) and keeps only the file name and position. */
export function cleanStack(stack: string): string {
    return stack.replace(/https?:\/\/[^\s)]+\/([^/\s)?#]+)(?:\?[^\s):]*)?/g, '$1');
}

export function makeReport(kind: ErrorReport['kind'], err: unknown, env: { path: string; build?: string; agent?: string }): ErrorReport {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error');
    return {
        kind,
        message: clip(e.message, LIMITS.message),
        stack: clip(cleanStack(e.stack ?? ''), LIMITS.stack),
        path: clip(env.path.split(/[?#]/)[0], LIMITS.path),
        build: clip(env.build ?? '', LIMITS.build),
        agent: clip(env.agent ?? '', LIMITS.agent),
    };
}

/** Checks a report that arrives at the endpoint: right shape, short strings, nothing else. Returns null for anything else. */
export function parseReport(raw: unknown): ErrorReport | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (r.kind !== 'error' && r.kind !== 'promise' && r.kind !== 'page') return null;
    if (typeof r.message !== 'string' || typeof r.stack !== 'string' || typeof r.path !== 'string') return null;
    return {
        kind: r.kind, message: clip(r.message, LIMITS.message), stack: clip(r.stack, LIMITS.stack), path: clip(r.path, LIMITS.path),
        build: clip(r.build, LIMITS.build), agent: clip(r.agent, LIMITS.agent),
    };
}

const MAX_PER_PAGE = 5;
const sent = new Set<string>();

/** Sends a report from the browser: at most five per page load, each distinct message only once. Never throws. */
export function reportError(kind: ErrorReport['kind'], err: unknown) {
    try {
        if (typeof navigator === 'undefined' || sent.size >= MAX_PER_PAGE) return;
        const report = makeReport(kind, err, { path: location.pathname, build: process.env.NEXT_PUBLIC_BUILD_ID, agent: navigator.userAgent });
        const id = `${report.kind}:${report.message}`;
        if (sent.has(id)) return;
        sent.add(id);
        const body = JSON.stringify(report);
        if (!navigator.sendBeacon?.('/api/report', new Blob([body], { type: 'application/json' }))) {
            void fetch('/api/report', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
        }
    } catch { /* reporting must never cause an error of its own */ }
}
