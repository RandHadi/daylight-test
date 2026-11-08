import { type Block, type State, shiftDate } from './planner-model.ts';
import { wallToEpoch, zonedParts, validTimezone } from './calendar-time.ts';
export const READ_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly'];
export const WRITE_SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';
export const BUSY_SCOPE = 'https://www.googleapis.com/auth/calendar.events.freebusy';
export type GoogleConnectMode = 'read' | 'write' | 'busy';
export function canReadBusy(scopes: string) {
    return scopes.split(' ').some(scope => [BUSY_SCOPE, 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar'].includes(scope));
}
export type GoogleCalendar = {
    id: string;
    name: string;
    color: string;
    primary: boolean;
    accessRole: string;
};
export type GoogleEvent = {
    id?: string;
    status?: string;
    summary?: string;
    htmlLink?: string;
    transparency?: string;
    eventType?: string;
    attendees?: {
        self?: boolean;
        responseStatus?: string;
    }[];
    start?: {
        date?: string;
        dateTime?: string;
    };
    end?: {
        date?: string;
        dateTime?: string;
    };
    extendedProperties?: {
        private?: Record<string, string>;
    };
};
export type CalendarSync = {
    from: string;
    to: string;
    blocks: Block[];
    calendarIds: string[];
    failures: {
        calendarId: string;
        message: string;
    }[];
    fetchedAt: number;
    connectionRevision: number;
};
export type GoogleStatus = {
    configured: boolean;
    connected: boolean;
    email?: string;
    canPublish?: boolean;
    canReadBusy?: boolean;
    calendars?: GoogleCalendar[];
    selected?: string[];
    revision?: number;
    error?: string;
};
export class GoogleError extends Error {
    status: number;
    reconnect: boolean;
    constructor(message: string, status = 502, reconnect = false) { super(message); this.status = status; this.reconnect = reconnect; }
}
const enc = new TextEncoder(), dec = new TextDecoder();
function base64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function unbase64(value: string) { return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0)); }
export function randomSecret() { return base64(crypto.getRandomValues(new Uint8Array(32))); }
export async function digest(value: string) { return base64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))); }
export async function seal(value: unknown, key: string, owner: string) {
    const raw = unbase64(key);
    if (raw.length !== 32)
        throw new Error('Invalid token encryption key.');
    const aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(`daylight:google:${owner}`) }, aes, enc.encode(JSON.stringify(value)));
    return `v1.${base64(iv)}.${base64(new Uint8Array(cipher))}`;
}
export async function unseal<T>(value: string, key: string, owner: string): Promise<T> {
    const [v, iv, data] = value.split('.');
    if (v !== 'v1' || !iv || !data)
        throw new Error('Invalid token storage.');
    const aes = await crypto.subtle.importKey('raw', unbase64(key), 'AES-GCM', false, ['decrypt']);
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv), additionalData: enc.encode(`daylight:google:${owner}`) }, aes, unbase64(data))));
}
export function authorizeUrl(clientId: string, redirect: string, state: string, challenge: string, mode: GoogleConnectMode) {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: [...READ_SCOPES, ...(mode === 'write' ? [WRITE_SCOPE] : mode === 'busy' ? [BUSY_SCOPE] : [])].join(' '), access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
    return u.toString();
}
export function validateWindow(from: string, to: string, timezone: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !validTimezone(timezone))
        throw new GoogleError('Choose valid dates and a planner timezone.', 400);
    const start = Date.parse(from), end = Date.parse(to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString().slice(0, 10) !== from || new Date(end).toISOString().slice(0, 10) !== to || end <= start || (end - start) / 86400000 > 62)
        throw new GoogleError('Refresh a window of up to 62 days.', 400);
    return { timeMin: new Date(wallToEpoch(from, 0, timezone)).toISOString(), timeMax: new Date(wallToEpoch(to, 0, timezone)).toISOString() };
}
export async function googleJson(url: string, accessToken: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<any> {
    // All callers construct fixed Google API origins; provider input is never a URL.
    if (new URL(url).origin !== 'https://www.googleapis.com')
        throw new GoogleError('Unsupported Google endpoint.', 400);
    const response = await fetcher(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
        if (response.status === 401)
            throw new GoogleError('Reconnect Google Calendar to continue.', 401, true);
        if (response.status === 403)
            throw new GoogleError('Google denied access. Check the Calendar API and the permissions you granted.', 403);
        if (response.status === 429)
            throw new GoogleError('Google is limiting requests. Try again shortly.', 429);
        throw new GoogleError('Google Calendar could not complete this request. Try again.');
    }
    return response.status === 204 ? {} : response.json();
}
export async function listCalendars(token: string, fetcher: typeof fetch = fetch): Promise<GoogleCalendar[]> {
    const items: GoogleCalendar[] = [];
    let next = '';
    for (let page = 0; page < 5; page++) {
        const u = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
        u.search = new URLSearchParams({ maxResults: '100', showDeleted: 'false', fields: 'items(id,summary,summaryOverride,backgroundColor,primary,accessRole),nextPageToken', ...(next ? { pageToken: next } : {}) }).toString();
        const body = await googleJson(u.toString(), token, {}, fetcher);
        for (const c of body.items || [])
            if (typeof c.id === 'string' && ['owner', 'writer', 'writerWithoutPrivateAccess', 'reader', 'freeBusyReader'].includes(c.accessRole))
                items.push({ id: c.id, name: (c.summaryOverride || c.summary || 'Calendar').slice(0, 200), color: /^#[0-9a-f]{6}$/i.test(c.backgroundColor) ? c.backgroundColor : '#779bc1', primary: !!c.primary, accessRole: c.accessRole });
        next = body.nextPageToken || '';
        if (!next)
            return items;
    }
    throw new GoogleError('Too many calendars to load completely. No calendar settings were changed.');
}
export async function eventBlocks(event: GoogleEvent, calendar: GoogleCalendar, from: string, to: string, timezone: string): Promise<Block[]> {
    if (!event.id || event.status === 'cancelled' || event.attendees?.some(a => a.self && a.responseStatus === 'declined'))
        return [];
    // Published task sessions are already represented by their local Daylight timeboxes.
    if (event.extendedProperties?.private?.daylightBlockId)
        return [];
    const allDay = !!event.start?.date;
    let start = allDay ? wallToEpoch(event.start!.date!, 0, timezone) : Date.parse(event.start?.dateTime || ''), end = allDay ? wallToEpoch(event.end?.date || event.start!.date!, 0, timezone) : Date.parse(event.end?.dateTime || '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        return [];
    start = Math.max(start, wallToEpoch(from, 0, timezone));
    end = Math.min(end, wallToEpoch(to, 0, timezone));
    if (end <= start)
        return [];
    const id = await digest(`${calendar.id}\n${event.id}`), blocks: Block[] = [];
    let cursor = start;
    while (cursor < end && blocks.length < 63) {
        const p = zonedParts(cursor, timezone), boundary = wallToEpoch(shiftDate(p.day, 1), 0, timezone), stop = Math.min(end, boundary);
        if (stop <= cursor)
            break;
        const finish = stop === boundary ? 1440 : zonedParts(stop, timezone).minute;
        const minutes = Math.max(1, Math.min(1440 - p.minute, finish > p.minute ? finish - p.minute : Math.ceil((stop - cursor) / 60000)));
        blocks.push({ id: `google:${id}:${p.day}`, title: (event.summary?.trim() || 'Busy').slice(0, 500), date: p.day, start: allDay ? 0 : p.minute, minutes: allDay ? 1440 : minutes, color: calendar.color, pinned: true, busy: event.transparency !== 'transparent' && event.eventType !== 'workingLocation', sourceUid: `google:${id}:${p.day}`, provider: 'google', externalCalendarId: calendar.id, externalEventId: event.id, externalUrl: event.htmlLink?.startsWith('https://calendar.google.com/') ? event.htmlLink : undefined, allDay });
        cursor = stop;
    }
    return blocks;
}
export async function fetchCalendarEvents(token: string, calendar: GoogleCalendar, from: string, to: string, timezone: string, fetcher: typeof fetch = fetch) {
    const window = validateWindow(from, to, timezone), blocks: Block[] = [];
    if (calendar.accessRole === 'freeBusyReader') {
        const body = await googleJson('https://www.googleapis.com/calendar/v3/freeBusy', token, {
            method: 'POST', body: JSON.stringify({ ...window, timeZone: timezone, items: [{ id: calendar.id }] })
        }, fetcher);
        const result = body.calendars?.[calendar.id];
        // A 200 response can contain per-calendar errors. Never erase old busy times on a partial response.
        if (!result || result.errors?.length || !Array.isArray(result.busy))
            throw new GoogleError('Google could not read this shared calendar’s availability. Check its sharing settings and try again. Existing busy times were kept.');
        if (result.busy.length > 3000)
            throw new GoogleError('This calendar has too many busy periods in this range. Choose a shorter range.');
        const seen = new Set<string>();
        for (const period of result.busy) {
            const start = typeof period.start === 'string' ? Date.parse(period.start) : NaN;
            const end = typeof period.end === 'string' ? Date.parse(period.end) : NaN;
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
                throw new GoogleError('Google returned an invalid busy period. Existing busy times were kept.');
            const id = `busy:${start}:${end}`;
            if (seen.has(id)) continue;
            seen.add(id);
            const parts = await eventBlocks({ id, summary: 'Busy', start: { dateTime: new Date(start).toISOString() }, end: { dateTime: new Date(end).toISOString() } }, calendar, from, to, timezone);
            // Availability periods are not individual events and reveal no event details.
            blocks.push(...parts.map(block => ({ ...block, busyOnly: true, externalEventId: undefined })));
            if (blocks.length > 3000)
                throw new GoogleError('This calendar has too many busy periods in this range. Choose a shorter range.');
        }
        return blocks;
    }
    let next = '';
    for (let page = 0; page < 8; page++) {
        const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
        u.search = new URLSearchParams({ ...window, singleEvents: 'true', showDeleted: 'false', maxResults: '250', fields: 'items(id,status,summary,htmlLink,transparency,eventType,start,end,attendees(self,responseStatus),extendedProperties/private),nextPageToken', ...(next ? { pageToken: next } : {}) }).toString();
        const body = await googleJson(u.toString(), token, {}, fetcher);
        for (const e of body.items || [])
            blocks.push(...await eventBlocks(e, calendar, from, to, timezone));
        if (blocks.length > 3000)
            throw new GoogleError('This calendar has too many events in this range. Choose a shorter range.');
        next = body.nextPageToken || '';
        if (!next)
            return blocks;
    }
    throw new GoogleError('Google returned more events than can be loaded safely. Existing events were kept.');
}
export function applyCalendarSync(state: State, sync: CalendarSync) {
    const ids = new Set(sync.calendarIds);
    const incoming = new Map(sync.blocks.map(b => [b.id, b]));
    const next: Block[] = [];
    // Refresh in place so unchanged events do not reorder the saved planner.
    for (const block of state.blocks) {
        if (!(block.provider === 'google' && ids.has(block.externalCalendarId || '') && block.date >= sync.from && block.date < sync.to)) next.push(block);
        else { const fresh = incoming.get(block.id); if (fresh) { const same = (Object.keys({...block,...fresh}) as (keyof Block)[]).every(key => block[key] === fresh[key]); next.push(same ? block : fresh); } incoming.delete(block.id); }
    }
    next.push(...incoming.values());
    if (next.length > 4900)
        throw new Error('There are too many calendar events to save. Choose fewer calendars.');
    state.blocks = next;
}
export function removeGoogleCalendars(state: State, keep: string[] = []) { const ids = new Set(keep); state.blocks = state.blocks.filter(b => b.provider !== 'google' || ids.has(b.externalCalendarId || '')); }
