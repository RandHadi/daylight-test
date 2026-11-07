import { getChatGPTUser } from '@/app/chatgpt-auth';
import { beginOAuth } from '@/lib/google-calendar-server';
import { GoogleError } from '@/lib/google-calendar';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { const user = await getChatGPTUser(); const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }; if (!user)
    return Response.json({ error: 'Sign in first.' }, { status: 401, headers }); if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers }); try {
    const raw = await request.text();
    if (raw.length > 1000)
        return Response.json({ error: 'Request too large.' }, { status: 413, headers });
    let body;
    try {
        body = JSON.parse(raw);
    }
    catch {
        return Response.json({ error: 'Invalid request.' }, { status: 400, headers });
    }
    if (!body || !['read', 'write'].includes(body.mode))
        return Response.json({ error: 'Invalid connection request.' }, { status: 400, headers });
    return Response.json({ url: await beginOAuth(user.userId, body.mode) }, { headers });
}
catch (e) {
    return Response.json({ error: e instanceof GoogleError ? e.message : 'Could not start Google authorization.' }, { status: e instanceof GoogleError ? e.status : 503, headers });
} }
