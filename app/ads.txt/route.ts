/** Serves /ads.txt for AdSense from the configured publisher id; 404 when ads are not configured. */
export const dynamic = 'force-static';

export function GET() {
    const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    if (!client) return new Response('Not found', { status: 404 });
    return new Response(`google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
