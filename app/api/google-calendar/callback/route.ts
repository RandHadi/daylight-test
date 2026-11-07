import { getChatGPTUser } from '@/app/chatgpt-auth';
import { finishOAuth, googleReturnUrl } from '@/lib/google-calendar-server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { const user = await getChatGPTUser(); if (!user)
    return new Response('Sign in to Daylight, then start the Google connection again.', { status: 401, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }); let result = 'failed'; try {
    const u = new URL(request.url);
    result = await finishOAuth(user.userId, u.searchParams.get('state') || '', u.searchParams.get('code'), !!u.searchParams.get('error'));
}
catch { /* Do not log authorization codes, tokens, or provider responses. */ } try {
    return new Response(null, { status: 303, headers: { Location: googleReturnUrl(result), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
catch {
    return new Response('Google Calendar setup needs attention. Return to Daylight and try again.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
} }
