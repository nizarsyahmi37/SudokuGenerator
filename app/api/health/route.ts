/** Liveness check for hosts and load balancers. */
export const dynamic = 'force-dynamic';

export function GET() {
    return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
}
