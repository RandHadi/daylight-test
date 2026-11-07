'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, RefreshCw, Link2 } from 'lucide-react';
import { type State, type Block, shiftDate, inputTime } from '@/lib/planner-model';
import { importMeeting } from '@/lib/planner-advanced';
import { applyCalendarSync, removeGoogleCalendars, type GoogleStatus, type CalendarSync } from '@/lib/google-calendar';
type Change = (fn: (s: State) => void, undo?: boolean) => void;
async function request(body?: unknown) { const r = await fetch('/api/google-calendar', { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(180000) }); const result = await r.json() as any; if (!r.ok)
    throw new Error(result.error || 'Could not reach Google Calendar.'); return result; }
export function useGoogleCalendar(ready: boolean, day: string, timezone: string, onChange: Change) {
    const [status, setStatus] = useState<GoogleStatus | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [lastSync, setLastSync] = useState(0);
    const context = useRef({ ready, day, timezone, onChange, status });
    context.current = { ready, day, timezone, onChange, status };
    const epoch = useRef(0), working = useRef(false), retry = useRef(false), refreshRef = useRef<() => void>(() => { });
    const load = useCallback(async () => { try {
        const next = await request();
        setStatus(next);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load calendar connection.');
    } }, []);
    useEffect(() => { void load(); }, [load]);
    const run = useCallback(async (action: () => Promise<void>) => { if (working.current)
        return; working.current = true; setBusy(true); setError(''); setMessage(''); try {
        await action();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Calendar action failed.');
    }
    finally {
        working.current = false;
        setBusy(false);
        if (retry.current) {
            retry.current = false;
            refreshRef.current();
        }
    } }, []);
    const refresh = useCallback(() => { if (working.current) {
        retry.current = true;
        return Promise.resolve();
    } return run(async () => { const c = context.current; if (!c.ready || !c.status?.connected)
        return; const generation = epoch.current; const sync: CalendarSync = await request({ action: 'sync', from: shiftDate(c.day, -7), to: shiftDate(c.day, 35), timezone: c.timezone }); if (generation !== epoch.current || context.current.status?.revision !== sync.connectionRevision)
        return; c.onChange(s => applyCalendarSync(s, sync)); setLastSync(sync.fetchedAt); if (sync.failures.length)
        setError(sync.failures.map(f => `${c.status?.calendars?.find(x => x.id === f.calendarId)?.name || 'Calendar'}: ${f.message}`).join(' ')); }); }, [run]);
    refreshRef.current = () => void refresh();
    useEffect(() => { if (ready && status?.configured)
        onChange(s => removeGoogleCalendars(s, status.connected ? status.selected : [])); }, [ready, status?.revision, status?.connected]);
    useEffect(() => { epoch.current++; if (!ready || !status?.connected)
        return; const t = setTimeout(() => void refresh(), 400); const interval = setInterval(() => { if (document.visibilityState === 'visible')
        void refresh(); }, 300000); return () => { epoch.current++; clearTimeout(t); clearInterval(interval); }; }, [ready, day, timezone, status?.revision, status?.connected, refresh]);
    const connect = (mode: 'read' | 'write') => run(async () => { const r = await fetch('/api/google-calendar/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) }); const b = await r.json() as {
        url: string;
        error?: string;
    }; if (!r.ok)
        throw new Error(b.error || 'Could not start authorization.'); const url = new URL(b.url); if (url.origin !== 'https://accounts.google.com')
        throw new Error('Invalid authorization address.'); window.location.assign(url.toString()); });
    const choose = (selected: string[]) => run(async () => { epoch.current++; const next = await request({ action: 'select', selected, revision: context.current.status?.revision }); context.current.onChange(s => removeGoogleCalendars(s, next.selected)); setStatus(next); setMessage('Calendar selection saved.'); });
    const calendars = () => run(async () => { epoch.current++; const next = await request({ action: 'calendars' }); context.current.onChange(s => removeGoogleCalendars(s, next.selected)); setStatus(next); });
    const disconnect = () => run(async () => { epoch.current++; const result = await request({ action: 'disconnect' }); context.current.onChange(s => removeGoogleCalendars(s)); setStatus({ configured: true, connected: false }); setLastSync(0); setMessage(result.revoked ? 'Disconnected. Google events were removed from Daylight. Published Google events and imported tasks were kept.' : 'Disconnected locally. Google could not confirm revocation; remove Daylight access in your Google Account connections.'); });
    const publish = (calendarId: string, blockIds: string[], before: () => Promise<boolean>) => run(async () => { if (!await before())
        throw new Error('Wait until all planner changes are saved, then publish again.'); const result = await request({ action: 'publish', calendarId, blockIds }); const failed = result.results.filter((x: {
        ok: boolean;
    }) => !x.ok); setMessage(`${result.results.length - failed.length} timebox(es) published or updated.`); if (failed.length)
        setError(failed.map((x: {
            message: string;
        }) => x.message).join(' ')); });
    return { status, busy, error, message, lastSync, refresh, connect, choose, calendars, disconnect, publish, load };
}
type Connection = ReturnType<typeof useGoogleCalendar>;
export function GoogleCalendarPanel({ connection: c, data, day, beforePublish }: {
    connection: Connection;
    data: State;
    day: string;
    beforePublish: () => Promise<boolean>;
}) {
    const [selected, setSelected] = useState<string[]>(c.status?.selected || []), [target, setTarget] = useState(''), [disconnecting, setDisconnecting] = useState(false);
    useEffect(() => setSelected(c.status?.selected || []), [c.status?.revision, c.status?.connected]);
    const owners = (c.status?.calendars || []).filter(x => x.accessRole === 'owner');
    const destination = owners.some(x => x.id === target) ? target : owners.find(x => x.primary)?.id || owners[0]?.id || '';
    const blocks = data.blocks.filter(b => b.date === day && b.taskId && !b.provider && data.tasks.some(t => t.id === b.taskId && !t.deleted && !t.archived && !t.done));
    return <section className="google-connection"><span className="dialog-eyebrow"><Link2 size={15}/>CALENDAR CONNECTIONS</span><h2>Your calendars, together.</h2><p className="modal-description">Bring Google events into your plan. Refreshes every five minutes while Daylight is open and visible.</p>{!c.status ? <p role="status">Checking the connection… <button className="text-button" onClick={() => void c.load()}>Retry</button></p> : !c.status.configured ? <div className="warning">Google setup is in progress. The app registration and secure server credentials must be configured before you can connect.</div> : !c.status.connected ? <><button className="primary" disabled={c.busy} onClick={() => void c.connect('read')}><CalendarDays size={15}/>Connect Google Calendar</button><p className="helper-text">You’ll choose a Google account and approve access to view your calendar list and events.</p></> : <><div className="google-account"><div><strong>Google Calendar</strong><small>{c.status.email}</small></div><span className="connected-label">Connected</span></div><fieldset className="google-calendars"><legend>Show in Daylight · up to eight calendars</legend>{c.status.calendars?.map(cal => <label key={cal.id} className="checkbox-label"><input type="checkbox" checked={selected.includes(cal.id)} disabled={c.busy || (!selected.includes(cal.id) && selected.length >= 8)} onChange={e => setSelected(e.target.checked ? [...selected, cal.id] : selected.filter(id => id !== cal.id))}/><i style={{ background: cal.color }}/>{cal.name}{cal.primary ? ' · Primary' : ''}</label>)}</fieldset><div className="google-actions"><button className="primary" disabled={c.busy} onClick={() => void c.choose(selected)}>Save calendar selection</button><button className="secondary" disabled={c.busy} onClick={() => void c.refresh()}><RefreshCw size={14}/>Refresh events</button><button className="text-button" disabled={c.busy} onClick={() => void c.calendars()}>Reload calendar list</button></div><p className="helper-text">Refresh covers one week before and five weeks after {day}. Navigate to another date to load that period. {c.lastSync ? `Last refreshed ${new Date(c.lastSync).toLocaleTimeString()}.` : ''} Calendar events are edited in Google Calendar.</p><details className="google-publishing"><summary>Publish task timeboxes to Google</summary><p className="helper-text">Publishing creates or updates Daylight timeboxes in a calendar you own. It does not send invitations. Changes and deletions in either app do not automatically update the other; use Publish again after changing a timebox, and remove unwanted published events in Google Calendar.</p>{!c.status.canPublish ? <button className="secondary" disabled={c.busy} onClick={() => void c.connect('write')}>Enable publishing in Google</button> : <><label className="field">Publish to<select value={destination} onChange={e => setTarget(e.target.value)}>{owners.map(cal => <option value={cal.id} key={cal.id}>{cal.name}</option>)}</select></label><p>{blocks.length} unfinished task timebox(es) on {day}</p><div className="import-preview">{blocks.map(b => <div className="session-row" key={b.id}><span>{data.tasks.find(t => t.id === b.taskId)?.title}</span><small>{inputTime(b.start)}–{inputTime(b.start + b.minutes)}</small></div>)}</div><button className="primary" disabled={c.busy || !blocks.length || blocks.length > 30 || !destination} onClick={() => void c.publish(destination, blocks.map(b => b.id), beforePublish)}>Publish / update {blocks.length} timeboxes</button>{blocks.length > 30 && <p className="warning">Publish up to 30 timeboxes at a time.</p>}</>}</details><div className="google-disconnect">{disconnecting ? <><p>Disconnect and remove Google events from Daylight? Imported tasks and published Google events will stay.</p><button className="danger-button" disabled={c.busy} onClick={() => { setDisconnecting(false); void c.disconnect(); }}>Disconnect Google Calendar</button><button className="text-button" onClick={() => setDisconnecting(false)}>Cancel</button></> : <button className="text-button" disabled={c.busy} onClick={() => setDisconnecting(true)}>Disconnect account</button>}</div></>}{c.busy && <p role="status">Working with Google Calendar…</p>}{c.error && <p className="warning" role="alert">{c.error} {c.status?.connected && <button className="text-button" disabled={c.busy} onClick={() => void c.connect(c.status?.canPublish ? 'write' : 'read')}>Reconnect</button>}</p>}{c.message && <p className="helper-text" role="status">{c.message}</p>}<p className="helper-text">Google access tokens are encrypted on the server. Calendar syncing does not use AI; the optional assistant receives only busy/free times for Google events.</p></section>;
}
export function GoogleEventDetails({ block, data, onChange }: {
    block: Block;
    data: State;
    onChange: Change;
}) { const [added, setAdded] = useState(false); return <><span className="dialog-eyebrow">GOOGLE CALENDAR</span><h2>{block.title}</h2><p>{block.date} · {block.allDay ? 'All day' : `${inputTime(block.start)}–${inputTime(block.start + block.minutes)}`} · {block.busy === false ? 'Free' : 'Busy'}</p><p className="helper-text">This event is kept up to date from Google. Edit it there, then refresh Daylight.</p><div className="google-actions">{block.externalUrl && <a className="secondary" href={block.externalUrl} target="_blank" rel="noopener noreferrer">Open in Google Calendar</a>}<button className="primary" disabled={added || data.tasks.some(t => t.sourceUrl === `daylight:event:${block.id}`)} onClick={() => { onChange(s => importMeeting(s, { ...block, minutes: Math.min(720, Math.max(5, block.minutes)) }), true); setAdded(true); }}>{added ? 'Added to tasks' : 'Add as task'}</button></div></>; }
