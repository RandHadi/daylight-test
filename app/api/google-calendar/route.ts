import { getChatGPTUser } from '@/app/chatgpt-auth';
import { GoogleError } from '@/lib/google-calendar';
import { status, chooseCalendars, refreshCalendarList, syncCalendars, disconnectGoogle, publishTimeboxes } from '@/lib/google-calendar-server';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
const failure = (e: unknown) => reply({ error: e instanceof GoogleError ? e.message : 'Google Calendar is temporarily unavailable. Your planner is still saved.', reconnect: e instanceof GoogleError && e.reconnect }, e instanceof GoogleError ? e.status : 503);
export async function GET() { const user = await getChatGPTUser(); if (!user)
    return reply({ error: 'Sign in first.' }, 401); try {
    return reply(await status(user.userId));
}
catch (e) {
    return failure(e);
} }
export async function POST(request: Request) {
    const user = await getChatGPTUser();
    if (!user)
        return reply({ error: 'Sign in first.' }, 401);
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return reply({ error: 'Invalid request origin.' }, 403);
    try {
        const raw = await request.text();
        if (raw.length > 12000)
            return reply({ error: 'Request too large.' }, 413);
        let b: any;
        try {
            b = JSON.parse(raw);
        }
        catch {
            return reply({ error: 'Invalid request.' }, 400);
        }
        if (!b || typeof b !== 'object' || Array.isArray(b))
            return reply({ error: 'Invalid request.' }, 400);
        switch (b.action) {
            case 'select': return reply(await chooseCalendars(user.userId, b.selected, b.revision));
            case 'calendars': return reply(await refreshCalendarList(user.userId));
            case 'sync':
                if (typeof b.from !== 'string' || typeof b.to !== 'string' || typeof b.timezone !== 'string')
                    return reply({ error: 'Choose a valid date range.' }, 400);
                return reply(await syncCalendars(user.userId, b.from, b.to, b.timezone));
            case 'disconnect': return reply(await disconnectGoogle(user.userId));
            case 'publish':
                if (typeof b.calendarId !== 'string' || b.calendarId.length > 1024)
                    return reply({ error: 'Choose a calendar.' }, 400);
                return reply(await publishTimeboxes(user.userId, b.calendarId, b.blockIds));
            default: return reply({ error: 'Unknown calendar action.' }, 400);
        }
    }
    catch (e) {
        return failure(e);
    }
}
