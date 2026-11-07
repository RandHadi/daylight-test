import { env } from 'cloudflare:workers';
import { and, eq, gt, lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { googleConnections, googleOAuthAttempts, planners } from '@/db/schema';
import { type State } from '@/lib/planner-model';
import { publishBlock } from '@/lib/google-calendar-publish';
import { authorizeUrl, digest, GoogleError, listCalendars, fetchCalendarEvents, randomSecret, seal, unseal, validateWindow, WRITE_SCOPE, type GoogleCalendar, type CalendarSync } from '@/lib/google-calendar';
type Tokens = {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
};
const runtime = () => env as unknown as Record<string, string>;
const value = (key: string) => runtime()[key] || process.env[key] || '';
export const googleConfigured = () => !!(value('GOOGLE_CLIENT_ID') && value('GOOGLE_CLIENT_SECRET') && value('GOOGLE_TOKEN_ENCRYPTION_KEY') && value('DAYLIGHT_PUBLIC_URL'));
function config() { if (!googleConfigured())
    throw new GoogleError('Google Calendar setup is not finished yet.', 503); const origin = new URL(value('DAYLIGHT_PUBLIC_URL')).origin; if (!origin.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    throw new GoogleError('Google Calendar configuration needs attention.', 503); return { clientId: value('GOOGLE_CLIENT_ID'), clientSecret: value('GOOGLE_CLIENT_SECRET'), key: value('GOOGLE_TOKEN_ENCRYPTION_KEY'), origin, redirect: origin + '/api/google-calendar/callback' }; }
export function googleReturnUrl(result: string) { return config().origin + '/?google=' + encodeURIComponent(result); }
async function connection(userId: string) { const [row] = await getDb().select().from(googleConnections).where(eq(googleConnections.userId, userId)).limit(1); if (!row)
    throw new GoogleError('Connect Google Calendar first.', 401, true); return row; }
export async function status(userId: string) { if (!googleConfigured())
    return { configured: false, connected: false }; const rows = await getDb().select({ email: googleConnections.email, scopes: googleConnections.scopes, calendars: googleConnections.calendars, selected: googleConnections.selected, revision: googleConnections.revision }).from(googleConnections).where(eq(googleConnections.userId, userId)).limit(1); const row = rows[0]; return row ? { configured: true, connected: true, email: row.email, canPublish: row.scopes.split(' ').includes(WRITE_SCOPE), calendars: JSON.parse(row.calendars), selected: JSON.parse(row.selected), revision: row.revision } : { configured: true, connected: false }; }
async function tokenRequest(parameters: Record<string, string>) { const c = config(); const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...parameters, client_id: c.clientId, client_secret: c.clientSecret }), signal: AbortSignal.timeout(20000) }); const b = await r.json() as any; if (!r.ok || !b.access_token)
    throw new GoogleError(b.error === 'invalid_grant' ? 'Google access expired or was revoked. Reconnect your calendar.' : 'Google could not authorize the connection. Try connecting again.', 401, true); return b; }
async function access(userId: string) { const row = await connection(userId), c = config(); let token = await unseal<Tokens>(row.encryptedTokens, c.key, userId); if (token.expiresAt < Date.now() + 60000) {
    const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: token.refreshToken });
    token = { accessToken: fresh.access_token, refreshToken: fresh.refresh_token || token.refreshToken, expiresAt: Date.now() + Math.min(86400, Number(fresh.expires_in) || 3600) * 1000 };
    const rows = await getDb().update(googleConnections).set({ encryptedTokens: await seal(token, c.key, userId), updatedAt: Date.now() }).where(and(eq(googleConnections.userId, userId), eq(googleConnections.encryptedTokens, row.encryptedTokens))).returning({ userId: googleConnections.userId });
    if (!rows.length) {
        const latest = await connection(userId);
        token = await unseal<Tokens>(latest.encryptedTokens, c.key, userId);
    }
} return { row, token: token.accessToken }; }
export async function beginOAuth(userId: string, mode: 'read' | 'write') {
    const c = config(), state = randomSecret(), verifier = randomSecret();
    const db = getDb();
    await db.delete(googleOAuthAttempts).where(lt(googleOAuthAttempts.expiresAt, Date.now()));
    await db.delete(googleOAuthAttempts).where(eq(googleOAuthAttempts.userId, userId));
    await db.insert(googleOAuthAttempts).values({ stateHash: await digest(state), userId, encryptedVerifier: await seal(verifier, c.key, userId), mode, expiresAt: Date.now() + 10 * 60000 });
    return authorizeUrl(c.clientId, c.redirect, state, await digest(verifier), mode);
}
export async function finishOAuth(userId: string, state: string, code: string | null, denied: boolean) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state) || (!denied && (!code || code.length > 4096)))
        throw new GoogleError('This connection request is invalid. Start again in Daylight.', 400);
    const db = getDb(), c = config();
    const [attempt] = await db.delete(googleOAuthAttempts).where(and(eq(googleOAuthAttempts.stateHash, await digest(state)), eq(googleOAuthAttempts.userId, userId), gt(googleOAuthAttempts.expiresAt, Date.now()))).returning();
    if (!attempt)
        throw new GoogleError('This connection request expired or was already used. Start again in Daylight.', 400);
    if (denied)
        return 'cancelled';
    const verifier = await unseal<string>(attempt.encryptedVerifier, c.key, userId);
    const fresh = await tokenRequest({ grant_type: 'authorization_code', code: code!, redirect_uri: c.redirect, code_verifier: verifier });
    const scopes = String(fresh.scope || '');
    const granted = scopes.split(' ');
    if (!granted.includes('https://www.googleapis.com/auth/calendar.calendarlist.readonly') || (!granted.includes('https://www.googleapis.com/auth/calendar.events.readonly') && !granted.includes(WRITE_SCOPE)))
        throw new GoogleError('Calendar permissions were not granted. Reconnect and select calendar access.', 403);
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${fresh.access_token}` }, signal: AbortSignal.timeout(15000) });
    const profile = await profileResponse.json() as any;
    if (!profileResponse.ok || typeof profile.email !== 'string' || !profile.email_verified)
        throw new GoogleError('Google account could not be verified.', 401, true);
    // Never reuse an old account's refresh token after switching Google accounts.
    if (!fresh.refresh_token)
        throw new GoogleError('Google did not provide continuing access. Reconnect and approve the requested access.', 401, true);
    const calendars = await listCalendars(fresh.access_token);
    const old = await db.select().from(googleConnections).where(eq(googleConnections.userId, userId)).limit(1);
    const selected = old[0]?.email === profile.email ? JSON.parse(old[0].selected).filter((id: string) => calendars.some(c => c.id === id)) : calendars.filter(c => c.primary).map(c => c.id).slice(0, 1);
    const record = { encryptedTokens: await seal({ accessToken: fresh.access_token, refreshToken: fresh.refresh_token, expiresAt: Date.now() + (Number(fresh.expires_in) || 3600) * 1000 }, c.key, userId), email: profile.email, scopes, calendars: JSON.stringify(calendars), selected: JSON.stringify(selected), revision: (old[0]?.revision || 0) + 1, updatedAt: Date.now() };
    await db.insert(googleConnections).values({ userId, ...record }).onConflictDoUpdate({ target: googleConnections.userId, set: record });
    return 'connected';
}
export async function chooseCalendars(userId: string, selected: unknown, revision: unknown) {
    if (!Array.isArray(selected) || selected.length > 8 || selected.some(x => typeof x !== 'string' || x.length > 1024) || new Set(selected).size !== selected.length || !Number.isSafeInteger(revision))
        throw new GoogleError('Select up to eight calendars.', 400);
    const { row, token } = await access(userId);
    if (row.revision !== revision)
        throw new GoogleError('Calendar settings changed. Reload the connection panel.', 409);
    const calendars = await listCalendars(token);
    if (selected.some(id => !calendars.some(c => c.id === id)))
        throw new GoogleError('One of those calendars is no longer available. Reload the connection panel.', 400);
    const rows = await getDb().update(googleConnections).set({ calendars: JSON.stringify(calendars), selected: JSON.stringify(selected), revision: row.revision + 1, updatedAt: Date.now() }).where(and(eq(googleConnections.userId, userId), eq(googleConnections.revision, row.revision))).returning();
    if (!rows.length)
        throw new GoogleError('The connection changed. Reload the connection panel.', 409);
    return status(userId);
}
export async function refreshCalendarList(userId: string) { const { row, token } = await access(userId), calendars = await listCalendars(token); const selected = JSON.parse(row.selected).filter((id: string) => calendars.some(c => c.id === id)); const rows = await getDb().update(googleConnections).set({ calendars: JSON.stringify(calendars), selected: JSON.stringify(selected), revision: row.revision + 1 }).where(and(eq(googleConnections.userId, userId), eq(googleConnections.revision, row.revision))).returning(); if (!rows.length)
    throw new GoogleError('The connection changed. Try again.', 409); return status(userId); }
const active = new Set<string>();
export async function syncCalendars(userId: string, from: string, to: string, timezone: string): Promise<CalendarSync> {
    validateWindow(from, to, timezone);
    if (active.has(userId))
        throw new GoogleError('A calendar refresh is already running.', 429);
    active.add(userId);
    try {
        const { row, token } = await access(userId), selected: string[] = JSON.parse(row.selected), calendars: GoogleCalendar[] = JSON.parse(row.calendars);
        const result: CalendarSync = { from, to, blocks: [], calendarIds: [], failures: [], fetchedAt: Date.now(), connectionRevision: row.revision };
        for (const id of selected) {
            const calendar = calendars.find(c => c.id === id);
            if (!calendar)
                continue;
            try {
                const blocks = await fetchCalendarEvents(token, calendar, from, to, timezone);
                result.blocks.push(...blocks);
                result.calendarIds.push(id);
            }
            catch (e) {
                if (e instanceof GoogleError && e.reconnect)
                    throw e;
                result.failures.push({ calendarId: id, message: e instanceof GoogleError ? e.message : 'Could not refresh this calendar. Existing events were kept.' });
            }
        }
        if (result.blocks.length > 4000)
            throw new GoogleError('Too many events. Select fewer calendars or a smaller date range.', 413);
        const current = await connection(userId);
        if (current.revision !== row.revision)
            throw new GoogleError('Calendar selection changed during refresh. Refresh again.', 409);
        return result;
    }
    finally {
        active.delete(userId);
    }
}
export async function disconnectGoogle(userId: string) {
    const row = await connection(userId), tokens = await unseal<Tokens>(row.encryptedTokens, config().key, userId);
    let revoked = false;
    try {
        const r = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tokens.refreshToken }), signal: AbortSignal.timeout(15000) });
        revoked = r.ok;
    }
    catch { }
    await getDb().batch([getDb().delete(googleConnections).where(eq(googleConnections.userId, userId)), getDb().delete(googleOAuthAttempts).where(eq(googleOAuthAttempts.userId, userId))]);
    return { disconnected: true, revoked };
}
export async function publishTimeboxes(userId: string, calendarId: string, blockIds: unknown) {
    if (!Array.isArray(blockIds) || !blockIds.length || blockIds.length > 30 || blockIds.some(id => typeof id !== 'string' || id.length > 128) || new Set(blockIds).size !== blockIds.length)
        throw new GoogleError('Select between one and 30 task timeboxes.', 400);
    const { row, token } = await access(userId);
    if (!row.scopes.split(' ').includes(WRITE_SCOPE))
        throw new GoogleError('Enable calendar publishing first.', 403, true);
    const calendar = (JSON.parse(row.calendars) as GoogleCalendar[]).find(c => c.id === calendarId && c.accessRole === 'owner');
    if (!calendar)
        throw new GoogleError('Choose a calendar you own.', 400);
    const [planner] = await getDb().select().from(planners).where(eq(planners.userId, userId)).limit(1);
    if (!planner)
        throw new GoogleError('Save your planner first.', 400);
    const state = JSON.parse(planner.payload) as State;
    const blocks = blockIds.map(id => state.blocks.find(b => b.id === id && b.taskId && !b.provider));
    if (blocks.some(b => !b))
        throw new GoogleError('A selected timebox changed. Save and try again.', 409);
    const results: {
        id: string;
        ok: boolean;
        message?: string;
    }[] = [];
    for (const b of blocks) {
        const block = b!, task = state.tasks.find(t => t.id === block.taskId && !t.deleted && !t.archived);
        if (!task) {
            results.push({ id: block.id, ok: false, message: 'Task is no longer available.' });
            continue;
        }
        try {
            await publishBlock(token, userId, calendarId, block, task.title, state.settings.timezone!);
            results.push({ id: block.id, ok: true });
        }
        catch (e) {
            results.push({ id: block.id, ok: false, message: e instanceof Error ? e.message : 'Could not publish this timebox.' });
        }
    }
    return { results };
}
