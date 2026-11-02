'use client';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Plus, Check, X, Sparkles, CalendarDays, Play, Pause, Coffee, Archive, Trash2, Copy, Link2, ArrowRight, Star, ChevronUp, ChevronDown, Download } from 'lucide-react';
import { type State, type Task, type Block, uid, dateKey, shiftDate, weekOf, duration, inputTime, parseTime, timerSeconds, finishTimer, pauseTimer, task } from '@/lib/planner-model';
import { buckets, ruleFor, syncSeries, generateOccurrences, addTimebox, duplicateTask, mergeTask, setActual, capture, dailyActual, importMeeting } from '@/lib/planner-advanced';
import { parseCalendar, mergeCalendar } from '@/lib/calendar-import';
import { type Suggestion, applySuggestion } from '@/lib/assistant-contract';
import { validTimezone } from '@/lib/calendar-time';
type Change = (fn: (s: State) => void, undo?: boolean) => void;
export function RuleFields({ draft, edit }: {
    draft: Task;
    edit: (v: Partial<Task>) => void;
}) {
    const r = ruleFor(draft);
    return <fieldset className="feature-fieldset"><legend>Repeat schedule</legend><div className="editor-grid"><label className="field">Every<input type="number" min="1" max="365" value={r.interval} onChange={e => edit({ rule: { ...r, interval: Number(e.target.value) } })}/></label><label className="field">Frequency<select value={r.frequency} onChange={e => edit({ rule: { ...r, frequency: e.target.value as typeof r.frequency } })}><option value="daily">Days</option><option value="weekly">Weeks</option><option value="monthly">Months</option></select></label></div>{r.frequency === 'weekly' && <div className="weekday-picker">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <button key={d} type="button" aria-pressed={r.weekdays.includes(i)} onClick={() => { const days = r.weekdays.includes(i) ? r.weekdays.filter(n => n !== i) : [...r.weekdays, i]; if (days.length)
        edit({ rule: { ...r, weekdays: days } }); }}>{d}</button>)}</div>}<label className="field">Ends after (optional)<input type="date" value={r.until} min={draft.date || undefined} onInput={e => edit({ rule: { ...r, until: e.currentTarget.value } })}/></label><p className="helper-text">Occurrences appear 3 weeks ahead, even before earlier tasks are completed. Monthly repeats use the last day of shorter months.</p></fieldset>;
}
export function TaskOrganization({ draft, edit, data }: {
    draft: Task;
    edit: (v: Partial<Task>) => void;
    data: State;
}) { return <><label className="field">Source link<input type="url" placeholder="https://…" value={draft.sourceUrl?.startsWith('http') ? draft.sourceUrl : ''} maxLength={2000} onChange={e => edit({ sourceUrl: e.target.value || undefined })}/></label><div className="editor-grid"><label className="field">Backlog horizon<select value={draft.bucket || buckets[0]} onChange={e => edit({ bucket: e.target.value })}>{buckets.map(b => <option key={b}>{b}</option>)}</select></label><label className="field">Backlog priority<select value={draft.backlogPriority || 'none'} onChange={e => edit({ backlogPriority: e.target.value as Task['backlogPriority'] })}>{['none', 'low', 'medium', 'high', 'urgent'].map(b => <option key={b} value={b}>{b === 'none' ? 'No priority' : b[0].toUpperCase() + b.slice(1)}</option>)}</select></label><label className="field">Folder<select value={draft.folder || ''} onChange={e => edit({ folder: e.target.value || undefined })}><option value="">No folder</option>{data.folders?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label className="field">Preferred start<input type="time" value={draft.preferred === undefined ? '' : inputTime(draft.preferred)} onInput={e => edit({ preferred: e.currentTarget.value ? parseTime(e.currentTarget.value) : undefined })}/></label></div><label className="checkbox-label"><input type="checkbox" checked={!!draft.pinned} onChange={e => edit({ pinned: e.target.checked })}/>Keep this task’s position when sorting</label></>; }
export function SessionsPanel({ data, id, day, onChange }: {
    data: State;
    id: string;
    day: string;
    onChange: Change;
}) {
    const t = data.tasks.find(t => t.id === id)!, [date, setDate] = useState(day), [start, setStart] = useState('09:00'), [minutes, setMinutes] = useState(30), [target, setTarget] = useState('');
    if (!t)
        return null;
    return <div><span className="dialog-eyebrow">WORKING SESSIONS</span><h2>{t.title}</h2><p className="muted">{duration(t.actual)} tracked across all days. Each timebox is independent.</p>{data.blocks.filter(b => b.taskId === id).map(b => <div className="session-row" key={b.id}><div><input aria-label={`Session date ${b.id}`} type="date" value={b.date} onInput={e=>{const value=e.currentTarget.value;if(value)onChange(s=>{s.blocks.find(n=>n.id===b.id)!.date=value;},true);}}/><div className="timebox-edit"><input aria-label={`Session start ${b.id}`} type="time" value={inputTime(b.start)} max={inputTime(1440-b.minutes)} onInput={e=>{if(e.currentTarget.value){const value=parseTime(e.currentTarget.value);onChange(s=>{const target=s.blocks.find(n=>n.id===b.id)!;target.start=Math.min(1440-target.minutes,value);target.pinned=true;},true);}}}/><input aria-label={`Session minutes ${b.id}`} type="number" min="5" max={1440-b.start} step="5" value={b.minutes} onChange={e=>{const n=+e.target.value;if(n>=5&&n+b.start<=1440)onChange(s=>{s.blocks.find(n=>n.id===b.id)!.minutes=n;},true);}}/></div><small>{b.pinned?'Fixed':'Flexible'}</small></div><button className="text-button" onClick={() => onChange(s => { s.blocks.find(n => n.id === b.id)!.pinned = !b.pinned; }, true)}>{b.pinned ? 'Unpin' : 'Pin'}</button><button className="icon" aria-label={`Remove timebox ${b.date} ${inputTime(b.start)}`} onClick={() => onChange(s => { s.blocks = s.blocks.filter(n => n.id !== b.id); }, true)}><X size={14}/></button></div>)}<form onSubmit={e => { e.preventDefault(); onChange(s => addTimebox(s, id, date, parseTime(start), minutes), true); }}><div className="editor-grid"><label className="field">Session date<input type="date" required value={date} onInput={e => setDate(e.currentTarget.value)}/></label><label className="field">Start<input type="time" required value={start} max={inputTime(1440 - minutes)} onInput={e => setStart(e.currentTarget.value)}/></label><label className="field">Minutes<input type="number" required min="5" max="720" step="5" value={minutes} onChange={e => setMinutes(+e.target.value)}/></label></div><button className="secondary" type="submit"><Plus size={14}/>Add timebox</button></form><h3 className="settings-heading">Tracked history</h3><div className="session-history">{(data.sessions || []).filter(e => e.taskId === id).map(entry => <div key={entry.id} className="session-row"><span>{entry.day}<small>{entry.kind === 'legacy' ? 'Imported from earlier task total' : entry.kind}</small></span><strong>{duration(entry.seconds / 60)}</strong></div>)}</div><h3 className="settings-heading">Task actions</h3><div className="data-actions"><button className="secondary" onClick={() => onChange(s => { duplicateTask(s, id, t.date); }, true)}><Copy size={14}/>Duplicate</button><button className="secondary" onClick={() => onChange(s => { if (s.timer?.taskId === id)
        finishTimer(s); s.tasks.find(t => t.id === id)!.deleted = new Date().toISOString(); s.blocks = s.blocks.filter(b => b.taskId !== id); }, true)}><Trash2 size={14}/>Move to trash</button></div><div className="inline-form"><select aria-label="Merge destination" value={target} onChange={e => setTarget(e.target.value)}><option value="">Merge into another task…</option>{data.tasks.filter(n => n.id !== id && !n.deleted && !n.archived).map(n => <option key={n.id} value={n.id}>{n.title}</option>)}</select><button disabled={!target} className="secondary" onClick={() => onChange(s => mergeTask(s, id, target), true)}>Merge</button></div><p className="helper-text">Merge preserves notes and tracked time in the destination. Undo is available.</p></div>;
}
export function AdvancedSettings({ data, onChange }: {
    data: State;
    onChange: Change;
}) {
    const [draft, setDraft] = useState(data.settings), [error, setError] = useState(''), [folder, setFolder] = useState('');
    useEffect(() => setDraft(data.settings), [data.settings]);
    const edit = (v: Partial<State['settings']>) => setDraft(s => ({ ...s, ...v }));
    return <><h3 className="settings-heading">Planning, focus & display</h3><form onSubmit={e => { e.preventDefault(); if (!draft.timezone || !validTimezone(draft.timezone)) {
        setError('Enter an IANA timezone such as America/Los_Angeles.');
        return;
    } onChange(s => { s.settings = { ...s.settings, ...draft }; delete s.lastMaintenance; }); setError('Preferences saved.'); }}><div className="editor-grid"><label className="field">Planner timezone<input value={draft.timezone || ''} required list="timezones" onChange={e => edit({ timezone: e.target.value })}/><datalist id="timezones">{['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'].map(z => <option key={z}>{z}</option>)}</datalist></label><label className="field">Appearance<select value={draft.theme || 'light'} onChange={e => edit({ theme: e.target.value as 'light' | 'dark' | 'system' })}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label><label className="field">Archive after incomplete days<input type="number" min="0" max="365" value={draft.archiveAfter ?? 4} onChange={e => edit({ archiveAfter: +e.target.value })}/><small>0 disables automatic archive</small></label><label className="field">Gap between timeboxes (minutes)<input type="number" min="0" max="60" value={draft.gap || 0} onChange={e => edit({ gap: +e.target.value })}/></label><label className="field">Focus interval (minutes)<input type="number" min="1" max="180" value={draft.focusMinutes || 25} onChange={e => edit({ focusMinutes: +e.target.value })}/></label><label className="field">Break (minutes)<input type="number" min="1" max="60" value={draft.breakMinutes || 5} onChange={e => edit({ breakMinutes: +e.target.value })}/></label><label className="field">Default channel<select value={draft.defaultChannel || data.channels[0].id} onChange={e => edit({ defaultChannel: e.target.value })}>{data.channels.filter(c => !c.disabled).map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label></div><div className="settings-checks">{([['rollover', 'Carry unfinished tasks forward automatically'], ['autoSort', 'Sort new tasks by daily priority'], ['splitTasks', 'Split scheduled work around meetings'], ['autoReschedule', 'Reflow flexible sessions after changes'], ['pomodoro', 'Use Pomodoro focus and break intervals']] as const).map(([key, label]) => <label key={key} className="checkbox-label"><input type="checkbox" checked={!!draft[key]} onChange={e => edit({ [key]: e.target.checked })}/>{label}</label>)}</div><p className="helper-text">Rollover catches up when you open the app. Browser reminders work while this app is open.</p><div className="data-actions"><button className="secondary" type="button" onClick={async () => { if (!('Notification' in window)) {
        setError('This browser does not support notifications.');
        return;
    } const permission = await Notification.requestPermission(); edit({ notifications: permission === 'granted' }); setError(permission === 'granted' ? 'Reminders enabled. Save preferences to keep this setting.' : 'Notifications remain disabled.'); }}>Enable browser reminders</button><button className="primary" type="submit">Save planning preferences</button></div><p role="status" className="helper-text">{error}</p></form><h3 className="settings-heading">Daily work capacity</h3><div className="weekday-capacity">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => <label className="field" key={label}>{label}<input aria-label={`${label} capacity`} type="number" min="0" max="1440" step="15" value={data.settings.weekdayCapacity?.[i] ?? data.settings.capacity} onChange={e => { const n = +e.target.value; if (n >= 0 && n <= 1440)
        onChange(s => { s.settings.weekdayCapacity ??= Array(7).fill(s.settings.capacity); s.settings.weekdayCapacity![i] = n; }); }}/></label>)}</div><h3 className="settings-heading">Edit channels & contexts</h3>{data.channels.map(c => <div className="channel-edit" key={c.id}><input aria-label={`Rename ${c.name}`} value={c.name} maxLength={100} onChange={e => { if (e.target.value.trim())
        onChange(s => { s.channels.find(n => n.id === c.id)!.name = e.target.value; }); }}/><input aria-label={`Context for ${c.name}`} value={c.context} maxLength={80} onChange={e => { if (e.target.value.trim())
        onChange(s => { s.channels.find(n => n.id === c.id)!.context = e.target.value; }); }}/><input type="color" aria-label={`Color for ${c.name}`} value={c.color} onChange={e => onChange(s => { s.channels.find(n => n.id === c.id)!.color = e.target.value; s.blocks.filter(b => s.tasks.find(t => t.id === b.taskId)?.channel === c.id).forEach(b => b.color = e.target.value); })}/></div>)}<p className="helper-text">Tasks in the Personal context are excluded from work-capacity warnings.</p><h3 className="settings-heading">Backlog folders</h3>{data.folders?.map(f => <div key={f.id} className="session-row"><span>{f.name}</span><button className="icon" aria-label={`Remove folder ${f.name}`} onClick={() => onChange(s => { s.folders = s.folders?.filter(n => n.id !== f.id); s.tasks.forEach(t => { if (t.folder === f.id)
        delete t.folder; }); }, true)}><X size={14}/></button></div>)}<form className="inline-form" onSubmit={e => { e.preventDefault(); if (folder.trim()) {
        onChange(s => { s.folders ??= []; s.folders.push({ id: uid(), name: folder.trim() }); });
        setFolder('');
    } }}><input placeholder="New backlog folder" required maxLength={100} value={folder} onChange={e => setFolder(e.target.value)}/><button className="secondary">Add folder</button></form></>;
}
export function QuickCapture({ data, day, onChange, onClose }: {
    data: State;
    day: string;
    onChange: Change;
    onClose: () => void;
}) {
    const [text, setText] = useState('');
    const preview = text.trim() ? capture(text, data, day) : null;
    return <form onSubmit={e => { e.preventDefault(); if (preview) {
        onChange(s => { s.tasks.push(preview); }, true);
        onClose();
    } }}><span className="dialog-eyebrow">QUICK CAPTURE</span><h2>Get it out of your head.</h2><textarea autoFocus rows={3} required maxLength={500} placeholder="Write brief @tomorrow ~45m !important #Product" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (preview) {
            onChange(s => { s.tasks.push(preview); }, true);
            onClose();
        }
    } }}/><p className="helper-text">Use @today, @tomorrow, @backlog or @YYYY-MM-DD, ~30m or ~2h, !urgent, and #Channel. Enter saves; Shift+Enter adds a line.</p>{preview && <div className="capture-preview"><strong>{preview.title}</strong><span>{preview.date || 'Backlog'} · {duration(preview.minutes)} · {data.channels.find(c => c.id === preview.channel)?.name}</span></div>}<div className="modal-footer"><span /><button className="primary">Add task<Plus size={14}/></button></div></form>;
}
export function WeeklyRitual({ data, day, onChange }: {
    data: State;
    day: string;
    onChange: Change;
}) {
    const week = weekOf(day), previous = shiftDate(week, -7), [notes, setNotes] = useState(data.weeklyReflections?.[week] || ''), [title, setTitle] = useState(''), [saved, setSaved] = useState(false);
    return <div><span className="dialog-eyebrow">WEEKLY PLANNING</span><h2>A direction for the week.</h2><p className="modal-description">Week of {week}. Review what remains, choose your outcomes, and make room for them.</p><h3>Carry an objective forward</h3>{data.objectives.filter(o => o.week === previous && !o.done).map(o => <div className="session-row" key={o.id}><span>{o.title}</span><button className="secondary" onClick={() => onChange(s => { s.objectives.find(n => n.id === o.id)!.week = week; }, true)}>Extend to this week</button></div>)}{!data.objectives.some(o => o.week === previous && !o.done) && <p className="helper-text">No unfinished objectives from last week.</p>}<h3 className="settings-heading">This week’s outcomes</h3>{data.objectives.filter(o => o.week === week).map(o => <div className="session-row" key={o.id}><span>{o.done ? '✓ ' : ''}{o.title}</span><button className="text-button" onClick={() => onChange(s => { const t = task(o.title, day, s.settings.defaultChannel || s.channels[0].id); t.objective = o.id; s.tasks.push(t); }, true)}>Add linked task</button></div>)}<form className="inline-form" onSubmit={e => { e.preventDefault(); if (title.trim()) {
        onChange(s => s.objectives.push({ id: uid(), title: title.trim(), week, done: false }), true);
        setTitle('');
    } }}><input required value={title} maxLength={500} placeholder="Add a weekly outcome" onChange={e => setTitle(e.target.value)}/><button className="secondary"><Plus size={14}/>Add</button></form><label className="field">Weekly reflection & intentions<textarea rows={5} value={notes} maxLength={10000} onChange={e => setNotes(e.target.value)} placeholder="What worked? What deserves your attention this week?"/></label><div className="modal-footer"><span role="status">{saved ? 'Weekly plan saved.' : ''}</span><button className="primary" onClick={() => { onChange(s => { s.weeklyReflections ??= {}; s.weeklyReflections[week] = notes; s.weeklyPlanned = [...new Set([...(s.weeklyPlanned || []), week])]; }); setSaved(true); }}>Save weekly plan<Check size={14}/></button></div></div>;
}
export function Highlights({ data, day, onChange }: {
    data: State;
    day: string;
    onChange: Change;
}) {
    const [text, setText] = useState('');
    const rows = data.highlights?.[day] || [];
    const update = (fn: (items: typeof rows) => void) => onChange(s => { s.highlights ??= {}; s.highlights[day] ??= []; fn(s.highlights[day]); }, true);
    return <div className="highlights"><h3>Daily highlights</h3>{rows.map((h, i) => <div className="highlight-row" key={h.id}><button type="button" className="icon" aria-label={`Star ${h.text}`} onClick={() => update(a => { a[i].starred = !a[i].starred; })}><Star size={14} fill={h.starred ? 'currentColor' : 'none'}/></button><span>{h.text}</span><button type="button" className="icon" disabled={i === 0} aria-label={`Move highlight up ${h.text}`} onClick={() => update(a => { [a[i - 1], a[i]] = [a[i], a[i - 1]]; })}><ChevronUp size={12}/></button><button type="button" className="icon" aria-label={`Remove highlight ${h.text}`} onClick={() => update(a => { a.splice(i, 1); })}><X size={12}/></button></div>)}<div className="inline-form"><input aria-label="New daily highlight" maxLength={1000} placeholder="A moment worth remembering" value={text} onChange={e => setText(e.target.value)}/><button type="button" className="secondary" onClick={() => { if (text.trim()) {
        update(a => a.push({ id: uid(), text: text.trim(), starred: false }));
        setText('');
    } }}>Add</button></div><button type="button" className="text-button" onClick={() => update(a => { for (const t of data.tasks.filter(t => t.done && t.completedOn === day && !t.deleted))
        if (!a.some(h => h.text === t.title))
            a.push({ id: uid(), text: t.title, starred: false }); })}>Add completed tasks as highlights</button></div>;
}
export function CalendarImport({ data, onChange }: {
    data: State;
    onChange: Change;
}) {
    const ref = useRef<HTMLInputElement>(null), [events, setEvents] = useState<Block[]>([]), [warnings, setWarnings] = useState<string[]>([]), [message, setMessage] = useState('');
    return <div><span className="dialog-eyebrow">CALENDAR & CONNECTIONS</span><h2>Bring your calendar along.</h2><p className="modal-description">Import a calendar export from Google, Outlook, or Apple. Imported events block time unless marked free.</p><input hidden ref={ref} type="file" accept=".ics,text/calendar" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file)
        return; try {
        if (file.size > 2000000)
            throw Error('Choose a file smaller than 2 MB.');
        const parsed = parseCalendar(await file.text(), data.settings.timezone!);
        setEvents(parsed.events);
        setWarnings(parsed.warnings);
        setMessage(`${parsed.events.length} event segments ready to import.`);
    }
    catch (err) {
        setMessage(err instanceof Error ? err.message : 'Could not read this calendar.');
        setEvents([]);
    } }}/><button className="secondary" onClick={() => ref.current?.click()}><CalendarDays size={14}/>Choose calendar file (.ics)</button><p role="status" className="helper-text">{message}</p>{warnings.length > 0 && <div className="warning">{warnings.slice(0, 6).map(w => <p key={w}>{w}</p>)}</div>}{events.length > 0 && <><div className="import-preview">{events.slice(0, 12).map(b => <div className="session-row" key={b.id}><span>{b.title}<small>{b.date} · {inputTime(b.start)}</small></span><span>{duration(b.minutes)}</span></div>)}</div><button className="primary" onClick={() => { let result = { added: 0, updated: 0 }; onChange(s => { result = mergeCalendar(s, events); }, true); setMessage(`${result.added} added, ${result.updated} updated. Existing unrelated events were preserved.`); setEvents([]); }}>Import {events.length} events</button></>}<p className="helper-text">This is a one-time import. Re-importing the same event updates it without duplicates. Recurring rules are not expanded. Live provider synchronization still requires a supported connection.</p><h3 className="settings-heading">Turn a meeting into a task</h3><div className="import-preview">{data.blocks.filter(b => !b.taskId).slice(0, 30).map(b => <div className="session-row" key={b.id}><span>{b.title}<small>{b.date}</small></span><button className="text-button" onClick={() => { onChange(s => { importMeeting(s, b); }, true); setMessage('Meeting added to your task list.'); }}>Add task</button></div>)}</div></div>;
}
export function AssistantPanel({ data, day, onChange }: {
    data: State;
    day: string;
    onChange: Change;
}) {
    const [prompt, setPrompt] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<Suggestion | null>(null), [applied, setApplied] = useState(false), [available, setAvailable] = useState<boolean | null>(null);
    useEffect(() => { fetch('/api/assistant', { cache: 'no-store' }).then(r => r.json()).then((b: any) => setAvailable(!!b.available)).catch(() => setAvailable(false)); }, []);
    const ask = async (text: string) => { setPrompt(text); setBusy(true); setError(''); setResult(null); setApplied(false); try {
        const r = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, state: data, day }) });
        const b = await r.json() as {
            error?: string;
            suggestion: Suggestion;
        };
        if (!r.ok)
            throw Error(b.error || 'Could not reach the assistant.');
        setResult(b.suggestion);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Please try again.');
    }
    finally {
        setBusy(false);
    } };
    return <div><span className="dialog-eyebrow"><Sparkles size={15}/>DAYLIGHT ASSISTANT</span><h2>Make a plan that fits.</h2><p className="modal-description">Ask about your tasks, draft a realistic day, or break down a project. Review proposed edits before applying them.</p>{available === false && <p className="warning">AI is awaiting secure configuration on this server. Your planner works independently.</p>}<div className="suggestion-chips">{['Draft a realistic plan for this day', 'Summarize my progress', 'Suggest what I can defer'].map(p => <button disabled={busy || available === false} key={p} className="secondary" onClick={() => ask(p)}>{p}</button>)}</div><form onSubmit={e => { e.preventDefault(); if (prompt.trim())
        void ask(prompt); }}><label className="field">What would help?<textarea autoFocus rows={3} required maxLength={3000} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="I have 3 hours today. Help me prioritize…"/></label><button className="primary" disabled={busy || available === false} type="submit"><Sparkles size={14}/>{busy ? 'Thinking…' : 'Ask assistant'}</button></form><p className="helper-text">Your request and relevant planner context are sent to the OpenAI API. Calls happen only when you ask.</p>{error && <p role="alert" className="warning">{error}</p>}{result && <div className="assistant-result"><p>{result.actions.length?'Review these proposed changes. Nothing is saved until you apply them.':result.message}</p>{result.actions.map((a, i) => <div className="suggested-action" key={i}><strong>{a.kind === 'create' ? 'Add' : a.kind === 'schedule' ? 'Move' : a.kind === 'prioritize' ? 'Prioritize' : 'Update'}: {a.title}</strong><span>{a.date || 'Backlog'} · {duration(a.minutes)} · {a.priority}</span></div>)}{result.actions.length > 0 && <button className="primary" disabled={applied} onClick={() => { try {
        onChange(s => applySuggestion(s, result), true);
        setApplied(true);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not apply changes.');
    } }}>{applied ? 'Changes applied' : 'Apply these changes'}<Check size={14}/></button>}</div>}</div>;
}
export function FocusWorkspace({ data, day, onChange, onNext }: {
    data: State;
    day: string;
    onChange: Change;
    onNext: (id?: string) => void;
}) {
    const t = data.tasks.find(t => t.id === data.timer?.taskId), elapsed = timerSeconds(data), breakSeconds = Math.max(0, Math.ceil(((data.breakUntil || 0) - Date.now()) / 1000)), remaining = Math.max(0, (data.settings.focusMinutes || 25) * 60 - elapsed), display = data.settings.pomodoro ? remaining : elapsed, fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    const takeBreak = () => onChange(s => { finishTimer(s); s.breakUntil = Date.now() + (s.settings.breakMinutes || 5) * 60000; });
    if (data.breakUntil)
        return <div className="focus-modal"><span className="dialog-eyebrow"><Coffee size={16}/>A LITTLE BREATHING ROOM</span><h2>{breakSeconds ? 'Step away for a moment.' : 'Ready when you are.'}</h2><div className="timer-display">{fmt(breakSeconds)}</div><p className="muted">Break time is not recorded as work.</p><div className="focus-actions"><button className="secondary" onClick={() => onChange(s => { s.breakUntil = Date.now() + 5 * 60000; })}>5 more minutes</button><button className="primary" onClick={() => { onChange(s => { s.breakUntil = null; }); onNext(); }}>Back to focus<Play size={14}/></button></div></div>;
    return <div className="focus-modal"><span className="dialog-eyebrow">ONE THING AT A TIME</span>{t ? <><h2>{t.title}</h2><div className="timer-display">{fmt(display)}</div><p className="muted">{data.settings.pomodoro ? 'Focus interval remaining' : 'Work time'} · {duration(t.minutes)} planned</p><div className="focus-actions"><button className="secondary" onClick={() => onChange(s => { if (s.timer?.started)
        pauseTimer(s);
    else if (s.timer)
        s.timer.started = Date.now(); })}>{data.timer?.started ? <Pause size={15}/> : <Play size={15}/>}{data.timer?.started ? 'Pause' : 'Resume'}</button><button className="secondary" onClick={takeBreak}><Coffee size={15}/>Take a break</button><button className="primary" onClick={() => onNext(t.id)}><Check size={15}/>Complete & next</button></div><div className="focus-details"><label className="field">Notes<textarea rows={4} value={t.notes} onChange={e => onChange(s => { const n = s.tasks.find(n => n.id === t.id)!; n.notes = e.target.value.slice(0, 10000); n.edited = true; })}/></label>{t.subtasks.map(sub => <label key={sub.id} className="checkbox-label"><input type="checkbox" checked={sub.done} onChange={() => onChange(s => { const n = s.tasks.find(n => n.id === t.id)!; n.subtasks.find(n => n.id === sub.id)!.done = !sub.done; n.edited = true; })}/>{sub.title}</label>)}</div><button className="text-button" onClick={() => onChange(s => finishTimer(s))}>Finish session without completing</button></> : <><h2>A little space to focus.</h2>{data.tasks.filter(t => t.date === day && !t.done && !t.archived && !t.deleted).map(t => <button className="search-result" key={t.id} onClick={() => onNext(t.id + '|start')}><Play size={14}/>{t.title}<span>{duration(t.minutes)}</span></button>)}</>}</div>;
}
