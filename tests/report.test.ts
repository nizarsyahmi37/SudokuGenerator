import { describe, expect, it } from 'vitest';
import { cleanStack, makeReport, parseReport } from '../lib/report';

describe('error reports', () => {
    it('keeps the message and location but drops web addresses, queries and the page query string', () => {
        const err = new Error('boom');
        err.stack = 'Error: boom\n    at f (https://example.com/_next/static/chunks/app-1a2b.js?token=secret:10:5)\n    at g (https://example.com/_next/static/chunks/page.js:3:1)';
        const r = makeReport('error', err, { path: '/privacy?seed=ABCD#top', build: 'abc123', agent: 'TestBrowser/1.0' });
        expect(r.path).toBe('/privacy');
        expect(r.stack).toContain('app-1a2b.js');
        expect(r.stack).not.toContain('secret');
        expect(r.stack).not.toContain('https://');
        expect(r).toMatchObject({ kind: 'error', message: 'boom', build: 'abc123', agent: 'TestBrowser/1.0' });
        expect(cleanStack('at x (http://localhost:3000/a/b/c.js:1:2)')).toBe('at x (c.js:1:2)');
    });

    it('caps lengths and copes with things that are not errors', () => {
        const long = makeReport('promise', 'x'.repeat(5000), { path: '/'.padEnd(500, 'a') });
        expect(long.message.length).toBeLessThanOrEqual(300);
        expect(long.path.length).toBeLessThanOrEqual(100);
        expect(makeReport('promise', undefined, { path: '/' }).message).toBe('Unknown error');
    });

    it('accepts only well-formed reports at the endpoint and trims them again', () => {
        const ok = { kind: 'page', message: 'm', stack: 's', path: '/', build: 'b', agent: 'a', extra: 'ignored' };
        expect(parseReport(ok)).toEqual({ kind: 'page', message: 'm', stack: 's', path: '/', build: 'b', agent: 'a' });
        expect(parseReport({ ...ok, kind: 'other' })).toBeNull();
        expect(parseReport({ kind: 'error', message: 5, stack: '', path: '/' })).toBeNull();
        expect(parseReport(null)).toBeNull();
        expect(parseReport({ ...ok, message: 'y'.repeat(900) })?.message.length).toBe(300);
    });
});
