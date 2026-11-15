import { parseReport } from '../../../lib/report';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4096;

/**
 * Receives an anonymous error report from the app and writes it to the runtime log. Only this site's own pages may send one,
 * the body is capped at 4 KB, and nothing is stored beyond the log line.
 */
export async function POST(request: Request) {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== new URL(request.url).host) return new Response(null, { status: 403 });
    const text = await request.text();
    if (text.length > MAX_BYTES) return new Response(null, { status: 413 });
    let report = null;
    try { report = parseReport(JSON.parse(text)); } catch { /* not JSON */ }
    if (!report) return new Response(null, { status: 400 });
    console.error('[client-error]', JSON.stringify(report));
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
