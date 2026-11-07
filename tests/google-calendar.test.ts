import test from 'node:test';
import assert from 'node:assert/strict';
import { randomSecret, seal, unseal, digest, authorizeUrl, READ_SCOPES, WRITE_SCOPE, validateWindow, eventBlocks, fetchCalendarEvents, listCalendars, applyCalendarSync, removeGoogleCalendars, googleJson, type CalendarSync } from '../lib/google-calendar.ts';
import { publishBlock } from '../lib/google-calendar-publish.ts';
import { initialState, type Block } from '../lib/planner-model.ts';
import { stateSchema } from '../lib/state-schema.ts';
const calendar = { id: 'personal@example.test', name: 'Personal', color: '#779bc1', primary: true, accessRole: 'owner' };
const from = '2026-11-01', to = '2026-11-10', zone = 'America/Los_Angeles';
const event = { id: 'event1', summary: 'Meeting', start: { dateTime: '2026-11-02T09:00:00-08:00' }, end: { dateTime: '2026-11-02T10:00:00-08:00' } };
const json = (body: unknown, status = 200) => Response.json(body, { status });
test('tokens use authenticated encryption bound to the account, with fresh ciphertext', async () => {
    const key = randomSecret(), token = { accessToken: 'test-only', refreshToken: 'test-refresh' };
    const encrypted = await seal(token, key, 'alice');
    assert.deepEqual(await unseal(encrypted, key, 'alice'), token);
    assert.notEqual(await seal(token, key, 'alice'), encrypted);
    assert(!encrypted.includes('test-only'));
    await assert.rejects(unseal(encrypted, key, 'bob'));
    await assert.rejects(unseal(encrypted, randomSecret(), 'alice'));
    const pieces = encrypted.split('.');
    pieces[2] = (pieces[2][0] === 'a' ? 'b' : 'a') + pieces[2].slice(1);
    await assert.rejects(unseal(pieces.join('.'), key, 'alice'));
});
test('OAuth uses random state, PKCE, offline access, and explicit incremental write scope', async () => {
    const state = randomSecret(), verifier = randomSecret();
    assert.match(state, /^[\w-]{43}$/);
    assert.notEqual(state, verifier);
    const read = new URL(authorizeUrl('client', 'https://daylight.test/api/google-calendar/callback', state, await digest(verifier), 'read'));
    assert.equal(read.searchParams.get('state'), state);
    assert.equal(read.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(read.searchParams.get('access_type'), 'offline');
    assert.deepEqual(read.searchParams.get('scope')?.split(' '), READ_SCOPES);
    assert(!read.toString().includes(verifier));
    assert(new URL(authorizeUrl('client', 'https://daylight.test/api/google-calendar/callback', state, await digest(verifier), 'write')).searchParams.get('scope')?.includes(WRITE_SCOPE));
});
test('refresh range rejects invalid/oversized dates and follows DST boundaries', () => {
    assert.throws(() => validateWindow('2026-02-30', to, zone));
    assert.throws(() => validateWindow(to, from, zone));
    assert.throws(() => validateWindow(from, '2027-11-01', zone));
    assert.throws(() => validateWindow(from, to, 'Mars/Phobos'));
    assert.deepEqual(validateWindow('2026-11-01', '2026-11-02', zone), { timeMin: '2026-11-01T07:00:00.000Z', timeMax: '2026-11-02T08:00:00.000Z' });
});
test('Google events normalize timezone, stable IDs, short events, and survive schema save/reload', async () => {
    const [b] = await eventBlocks(event, calendar, from, to, zone);
    assert.equal(b.start, 540);
    assert.equal(b.minutes, 60);
    assert.equal(b.provider, 'google');
    assert.equal(b.id, (await eventBlocks({ ...event, summary: 'Renamed' }, calendar, from, to, zone))[0].id);
    assert.notEqual(b.id, (await eventBlocks(event, { ...calendar, id: 'other' }, from, to, zone))[0].id);
    const state = initialState(from);
    state.blocks = [b, ...await eventBlocks({ ...event, id: 'short', start: { dateTime: '2026-11-02T23:59:00-08:00' }, end: { dateTime: '2026-11-03T00:00:00-08:00' } }, calendar, from, to, zone)];
    const saved = stateSchema.parse(JSON.parse(JSON.stringify(state)));
    assert.equal(saved.blocks[0].externalEventId, 'event1');
    assert.equal(saved.blocks[1].minutes, 1);
});
test('all-day and overnight events split at local midnight with exclusive end dates', async () => {
    const all = await eventBlocks({ id: 'holiday', start: { date: '2026-11-01' }, end: { date: '2026-11-03' } }, calendar, from, to, zone);
    assert.deepEqual(all.map(b => [b.date, b.start, b.minutes, b.allDay]), [['2026-11-01', 0, 1440, true], ['2026-11-02', 0, 1440, true]]);
    const night = await eventBlocks({ ...event, start: { dateTime: '2026-11-02T23:30:00-08:00' }, end: { dateTime: '2026-11-03T00:30:00-08:00' } }, calendar, from, to, zone);
    assert.deepEqual(night.map(b => [b.date, b.start, b.minutes]), [['2026-11-02', 1410, 30], ['2026-11-03', 0, 30]]);
});
test('cancelled, declined and Daylight-published events do not duplicate; free events remain free', async () => {
    for (const extra of [{ status: 'cancelled' }, { attendees: [{ self: true, responseStatus: 'declined' }] }, { extendedProperties: { private: { daylightBlockId: 'local' } } }])
        assert.deepEqual(await eventBlocks({ ...event, ...extra }, calendar, from, to, zone), []);
    assert.equal((await eventBlocks({ ...event, transparency: 'transparent' }, calendar, from, to, zone))[0].busy, false);
    assert.equal((await eventBlocks({ ...event, eventType: 'workingLocation' }, calendar, from, to, zone))[0].busy, false);
    const [fall] = await eventBlocks({ ...event, start: { dateTime: '2026-11-01T01:30:00-07:00' }, end: { dateTime: '2026-11-01T01:15:00-08:00' } }, calendar, from, to, zone);
    assert.equal(fall.minutes, 45);
});
test('complete paginated fetch expands recurring instances and refuses partial pages', async () => {
    let calls = 0;
    const fake: typeof fetch = async (input) => { const u = new URL(String(input)); assert.equal(u.searchParams.get('singleEvents'), 'true'); calls++; return json(calls === 1 ? { items: [event], nextPageToken: 'p2' } : { items: [{ ...event, id: 'event2' }] }); };
    assert.equal((await fetchCalendarEvents('token', calendar, from, to, zone, fake)).length, 2);
    assert.equal(calls, 2);
    let failures = 0;
    await assert.rejects(fetchCalendarEvents('token', calendar, from, to, zone, async () => ++failures === 1 ? json({ items: [event], nextPageToken: 'next' }) : json({ error: 'test' }, 500)));
    await assert.rejects(fetchCalendarEvents('token', calendar, from, to, zone, async () => json({ items: [], nextPageToken: 'loop' })), /more events/);
});
test('calendar enumeration filters unreadable calendars; API requests cannot redirect credentials to arbitrary origins', async () => {
    const c = await listCalendars('token', async () => json({ items: [{ ...calendar, summary: 'Mine', backgroundColor: '#123456' }, { id: 'limited', accessRole: 'freeBusyReader' }] }));
    assert.equal(c.length, 1);
    assert.equal(c[0].name, 'Mine');
    await assert.rejects(googleJson('https://attacker.test', 'secret'), /Unsupported/);
    await assert.rejects(googleJson('https://www.googleapis.com/calendar', 'token', {}, async () => json({}, 401)), /Reconnect/);
});
test('sync removes cancelled events only in successfully fetched calendars/window and is idempotent', async () => {
    const [old] = await eventBlocks(event, calendar, from, to, zone);
    const outside = { ...old, id: 'outside', date: '2026-12-01' }, failed = { ...old, id: 'failed', externalCalendarId: 'failed' }, local: Block = { id: 'local', title: 'Local', date: '2026-11-02', start: 600, minutes: 30, color: '#123456' };
    const state = initialState(from);
    state.blocks = [old, outside, failed, local];
    const sync: CalendarSync = { from, to, calendarIds: [calendar.id], blocks: [], failures: [{ calendarId: 'failed', message: 'Unavailable' }], fetchedAt: 1, connectionRevision: 1 };
    applyCalendarSync(state, sync);
    assert.deepEqual(state.blocks.map(b => b.id), ['outside', 'failed', 'local']);
    const before = JSON.stringify(state);
    applyCalendarSync(state, sync);
    assert.equal(JSON.stringify(state), before);
    removeGoogleCalendars(state);
    assert.deepEqual(state.blocks, [local]);
});
const block: Block = { id: 'timebox', taskId: 'task', title: 'Task', date: '2026-11-02', start: 540, minutes: 30, color: '#123456' };
test('publishing creates deterministic IDs without invitations and updates only owned unshared events with ETag', async () => {
    let stored: any = null;
    const writes: RequestInit[] = [];
    const fake: typeof fetch = async (_input, init) => { if (!init?.method)
        return stored ? json(stored) : json({}, 404); writes.push(init); stored = { ...stored, ...JSON.parse(String(init.body)), etag: 'version1' }; return json(stored); };
    await publishBlock('token', 'alice', calendar.id, block, 'First', zone, fake);
    assert.equal(writes[0].method, 'POST');
    assert.match(stored.id, /^[a-v0-9]{65}$/);
    assert.equal(stored.start.dateTime, '2026-11-02T17:00:00.000Z');
    assert.equal(stored.attendees, undefined);
    await publishBlock('token', 'alice', calendar.id, block, 'Edited', zone, fake);
    assert.equal(writes[1].method, 'PATCH');
    assert.equal((writes[1].headers as any)['If-Match'], 'version1');
    assert.equal(stored.summary, 'Edited');
    stored.attendees = [{ email: 'other@example.test' }];
    await assert.rejects(publishBlock('token', 'alice', calendar.id, block, 'No', zone, fake), /shared/);
    assert.equal(writes.length, 2);
});
test('ambiguous publish failures are not automatically repeated', async () => {
    let calls = 0;
    await assert.rejects(publishBlock('token', 'alice', calendar.id, block, 'Task', zone, async (_u, init) => { calls++; return init?.method ? json({}, 409) : json({}, 404); }), /already be published/);
    assert.equal(calls, 2);
    await assert.rejects(publishBlock('token', 'alice', calendar.id, block, 'Task', zone, async () => json({ extendedProperties: { private: { daylightOwner: 'someone-else' } } })), /changed/);
});
