import { type Block } from './planner-model.ts';
import { wallToEpoch } from './calendar-time.ts';
import { digest } from './google-calendar.ts';
export async function publishBlock(token: string, userId: string, calendarId: string, block: Block, title: string, timezone: string, fetcher: typeof fetch = fetch) {
    const owner = await digest(userId);
    const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${userId}:${block.id}`));
    const eventId = 'd' + Array.from(new Uint8Array(raw), n => n.toString(16).padStart(2, '0')).join('');
    const root = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, url = root + '/' + eventId;
    const start = wallToEpoch(block.date, block.start, timezone), end = wallToEpoch(block.date, block.start + block.minutes, timezone);
    const body = { summary: title, start: { dateTime: new Date(start).toISOString(), timeZone: timezone }, end: { dateTime: new Date(end).toISOString(), timeZone: timezone }, transparency: 'opaque', extendedProperties: { private: { daylightBlockId: block.id, daylightOwner: owner } }, description: 'Planned in Daylight. Changes here do not automatically move the task in Daylight.' };
    const prior = await fetcher(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    let method = 'POST', target = root, payload: unknown = { id: eventId, ...body }, etag = '';
    if (prior.ok) {
        const found = await prior.json() as any;
        if (found.status === 'cancelled' || found.extendedProperties?.private?.daylightOwner !== owner || found.extendedProperties?.private?.daylightBlockId !== block.id || found.attendees?.length || !found.etag)
            throw new Error('This Google event was changed, deleted, or shared. Update it in Google Calendar.');
        method = 'PATCH';
        target = url;
        payload = body;
        etag = found.etag;
    }
    else if (prior.status !== 404)
        throw new Error('Could not check the existing Google event. Try again.');
    const response = await fetcher(target + '?sendUpdates=none', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
    if (!response.ok)
        throw new Error(response.status === 409 ? 'This timebox may already be published. Refresh and try again.' : response.status === 412 ? 'The Google event changed. Review it and try again.' : 'Google could not publish this timebox.');
}
