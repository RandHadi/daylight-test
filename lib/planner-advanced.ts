import { type State, type Task, type Block, type RecurrenceRule, type Series, uid, task, shiftDate, fromKey, weekOf, finishTimer, timerSeconds } from './planner-model.ts';
import { zonedParts, wallToEpoch } from './calendar-time.ts';
import {reportedActual} from './time-ledger.ts';
import {linkedCalendarTask,linkCalendarTask} from './calendar-links.ts';
export const buckets = ['Next week or two', 'Next month', 'Next quarter', 'Next year', 'Someday', 'Never'];
export const defaultSettings = { rollover: true, archiveAfter: 4, autoReschedule: false, gap: 0, splitTasks: true, autoSort: false, pomodoro: false, focusMinutes: 25, breakMinutes: 5, notifications: false, theme: 'light' as const, personalContexts: ['Personal'] };
export function upgradeState(s: State): State {
    s.settings = { shortcuts: true, persistPriorities: [], timeFormat: '12', ...defaultSettings, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...s.settings };
    for(const b of s.blocks)if(b.taskId&&b.pinned===undefined)b.pinned=true;
    s.sessions ??= [];
    s.series ??= [];
    // Migrate occurrence-local subtask IDs to a shared series identity without moving time.
    for (const series of s.series) {
        for (const st of series.template.subtasks) st.seriesKey ??= st.id;
        for (const t of s.tasks.filter(t => t.seriesId === series.id))
            for (const [i, st] of t.subtasks.entries()) st.seriesKey ??= series.template.subtasks.find(x => x.title === st.title)?.seriesKey || series.template.subtasks[i]?.seriesKey || st.id;
    }
    s.folders ??= [];
    s.highlights ??= {};
    s.weeklyReflections ??= {};
    s.weeklyPlanned ??= [];
    // Version-one totals did not retain dates. Keep their attribution explicit.
    for (const t of s.tasks) {
        if (t.actual > 0 && !s.sessions.some(e => e.taskId === t.id))
            s.sessions.push({ id: uid(), taskId: t.id, title: t.title, channel: t.channel, day: t.completedOn || t.date || zonedParts(Date.now(), s.settings.timezone!).day, seconds: t.actual * 60, started: 0, ended: 0, kind: 'legacy' });
    }
    return s;
}
export function ruleFor(t: Task): RecurrenceRule { return t.rule || { frequency: t.recurrence === 'monthly' ? 'monthly' : ['weekly', 'weekdays'].includes(t.recurrence) ? 'weekly' : 'daily', interval: 1, weekdays: t.recurrence === 'weekdays' ? [1, 2, 3, 4, 5] : [fromKey(t.date || '2026-01-01').getDay()], until: '' }; }
export function occursOn(series: Series, day: string): boolean {
    if (day < series.anchor || (series.rule.until && day > series.rule.until) || series.stopped)
        return false;
    const a = fromKey(series.anchor), d = fromKey(day), r = series.rule;
    if (r.frequency === 'daily')
        return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000) % r.interval === 0;
    if (r.frequency === 'weekly') {
        const weeks = Math.round((Date.parse(weekOf(day)) - Date.parse(weekOf(series.anchor))) / 604800000);
        return weeks % r.interval === 0 && r.weekdays.includes(d.getDay());
    }
    const months = (d.getFullYear() - a.getFullYear()) * 12 + d.getMonth() - a.getMonth();
    // A 29th/30th/31st series uses the last day in shorter months.
    return months % r.interval === 0 && d.getDate() === Math.min(a.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
}
export function syncSeries(s: State, t: Task, applyFuture: boolean | 'all' = false): void {
    s.series ??= [];
    if (t.recurrence === 'none') {
        if (t.seriesId) {
            const series = s.series.find(x => x.id === t.seriesId);
            if (series) {series.stopped = true; for (const future of s.tasks.filter(n=>n.seriesId===series.id&&!n.done&&(n.occurrence||n.date||'')>(t.occurrence||t.date||'')))future.archived=true;}
        }
        return;
    }
    if (!t.date)
        return;
    if(t.preferred !== undefined && t.rigid === undefined) t.rigid = true;
    for (const st of t.subtasks) st.seriesKey ??= st.id;
    let series = s.series.find(x => x.id === t.seriesId);
    const wasExisting=!!series;
    if (!series) {
        t.seriesId = uid();
        t.occurrence = t.date;
        series = { id: t.seriesId, anchor: t.date, rule: ruleFor(t), template: structuredClone(t) };
        s.series.push(series);
    }
    if (applyFuture) {
        series.rule = ruleFor(t);
        series.template = structuredClone(t);
        series.stopped = false;
        for (const next of s.tasks.filter(x => x.seriesId === series!.id && !x.done && !x.deleted && x.id !== t.id && (applyFuture==='all'||(x.occurrence || '') >= (t.occurrence || t.date!)))) {
            if (!occursOn(series, next.occurrence || next.date!)) {
                next.archived = true;
                continue;
            }
            const subtasks = t.subtasks.map(st => {
                const prior = next.subtasks.find(x => x.seriesKey === st.seriesKey);
                return { ...st, id: prior?.id || uid(), done: prior?.done || false, actual: prior?.actual || 0, mergedTaskId: prior?.mergedTaskId };
            });
            if (s.timer?.taskId === next.id && s.timer.subtaskId && !subtasks.some(st => st.id === s.timer!.subtaskId)) finishTimer(s);
            const keep = { id: next.id, date: next.date, occurrence: next.occurrence, actual: next.actual, done: next.done, rolloverCount: next.rolloverCount };
            Object.assign(next, structuredClone(t), keep);
            next.subtasks = subtasks;
        }
    }
    if(t.preferred !== undefined && t.rigid === undefined) t.rigid = true;
    t.edited = wasExisting;
}
export function generateOccurrences(s: State, today: string, horizon = 21): number {
    s.series ??= [];
    let added = 0;
    // Upgrade old recurrence chains once, keeping their existing identities.
    for (const t of s.tasks.filter(t => t.recurrence !== 'none' && !t.seriesId && !t.deleted)) {
        const parent = t.generatedFrom ? s.tasks.find(x => x.id === t.generatedFrom) : undefined;
        if (parent?.seriesId) {
            t.seriesId = parent.seriesId;
            t.occurrence = t.date || today;
        }
        else
            syncSeries(s, t);
    }
    for (const series of s.series.filter(x => !x.stopped))
        for (let day = today; day <= shiftDate(today, horizon); day = shiftDate(day, 1)) {
            if (s.tasks.length >= 4900)
                return added;
            if (!occursOn(series, day) || s.tasks.some(t => t.seriesId === series.id && (t.occurrence || t.date) === day))
                continue;
            const t: Task = { ...structuredClone(series.template), id: uid(), sunsamaImport:undefined, calendarLink:undefined, seriesId: series.id, occurrence: day, date: day, done: false, actual: 0, archived: false, edited: false, deleted: undefined, completedOn: undefined, rolloverSince: undefined, rolloverCount: 0, generatedFrom: series.template.id, subtasks: series.template.subtasks.map(st => ({ ...st, id: uid(), done: false, actual: 0, mergedTaskId: undefined })) };
            s.tasks.push(t);
            added++;
        }
    return added;
}
export function maintainDay(s: State, today: string): {
    rolled: number;
    archived: number;
    generated: number;
} {
    upgradeState(s);
    const generated = generateOccurrences(s, today);
    let rolled = 0, archived = 0;
    if (s.lastMaintenance === today)
        return { rolled, archived, generated };
    if (s.settings.rollover)
        for (const t of s.tasks.filter(t => t.date && t.date < today && !t.done && !t.archived && !t.deleted)) {
            const original = t.rolloverSince || t.date!;
            t.rolloverSince = original;
            t.rolloverCount = Math.max(1, Math.round((Date.parse(today) - Date.parse(original)) / 86400000));
            const collides = t.seriesId && s.tasks.some(n => n.id !== t.id && n.seriesId === t.seriesId && n.date === today && !n.done && !n.archived && !n.deleted);
            if ((collides && !t.edited && t.actual === 0 && !t.subtasks.some(st => st.done)) || (s.settings.archiveAfter! > 0 && t.rolloverCount >= s.settings.archiveAfter!)) {
                t.archived = true;
                archived++;
            }
            else {
                t.date = today;
                if (!s.settings.persistPriorities?.includes(t.priority)) t.priority = 'normal';
                t.rigid = false;
                rolled++;
            }
            s.blocks = s.blocks.filter(b => b.taskId !== t.id || b.date >= today);
        }
    s.lastMaintenance = today;
    return { rolled, archived, generated };
}
export function dailyActual(s: State, day: string, channel?: string): number { return reportedActual(s,day,channel); }
export function taskActualOn(s: State, id: string, day: string): number { return (s.sessions || []).filter(e => e.taskId === id && e.day === day).reduce((n, e) => n + e.seconds / 60, 0); }
export function setActual(s: State, id: string, minutes: number, day: string): void {
    const t = s.tasks.find(t => t.id === id);
    if (!t)
        return;
    if (s.timer?.taskId === id)
        finishTimer(s);
    s.sessions ??= [];
    const delta = minutes - t.actual;
    if (delta > 0)
        s.sessions.push({ id: uid(), taskId: id, title: t.title, channel: t.channel, day, seconds: delta * 60, started: 0, ended: 0, kind: 'manual' });
    else if (delta < 0) {
        let remove = -delta * 60;
        for (const entry of [...s.sessions].reverse().filter(e => e.taskId === id)) {
            const take = Math.min(entry.seconds, remove);
            entry.seconds -= take;
            remove -= take;
            if (!remove)
                break;
        }
        s.sessions = s.sessions.filter(e => e.seconds > 0);
    }
    t.actual = minutes;
    for (const st of t.subtasks) st.actual = s.sessions.filter(e=>e.taskId===id&&e.subtaskId===st.id).reduce((n,e)=>n+e.seconds/60,0);
}
export function workMinutes(s: State, day: string): number { const personal = s.settings.personalContexts || ['Personal']; return s.tasks.filter(t => t.date === day && !t.archived && !t.deleted && !personal.includes(s.channels.find(c => c.id === t.channel)?.context || '')).reduce((n, t) => n + t.minutes, 0); }
export function capacity(s: State, day: string): number { return s.settings.weekdayCapacity?.[fromKey(day).getDay()] ?? s.settings.capacity; }
export function sortDay(s: State, day: string): void { const rank = { urgent: 0, important: 1, normal: 2, low: 3 }, slots = s.tasks.map((t, i) => ({ t, i })).filter(({ t }) => t.date === day && !t.pinned && s.timer?.taskId !== t.id); const ordered = slots.map(x => x.t).sort((a, b) => rank[a.priority] - rank[b.priority] || (a.preferred ?? 1440) - (b.preferred ?? 1440)); slots.forEach(({ i }, n) => s.tasks[i] = ordered[n]); }
export function addTimebox(s: State, id: string, day: string, start: number, minutes: number, pinned = true): void { const t = s.tasks.find(t => t.id === id); if (!t)
    return; s.blocks.push({ id: uid(), taskId: id, title: t.title, date: day, start: Math.max(0, Math.min(1440 - minutes, start)), minutes, color: s.channels.find(c => c.id === t.channel)?.color || '#709b8d', pinned }); }
export function scheduleDay(s: State, day: string, options: {reschedule?: boolean; from?: number; project?: boolean; taskId?: string; noSplit?: boolean; allowOutside?: boolean} = {}): {missed: string[]; blocks: Block[]} {
    const copy = options.project ? structuredClone(s) : s;
    const gap = copy.settings.gap || 0, missed: string[] = [], created: Block[] = [];
    if (options.reschedule) copy.blocks = copy.blocks.filter(b => b.date !== day || !b.taskId || b.pinned || copy.tasks.find(t => t.id === b.taskId)?.done || (options.taskId && b.taskId !== options.taskId));
    const weekday=fromKey(day).getDay();
    const tasks=copy.tasks.filter(t=>t.date===day&&!t.archived&&!t.done&&!t.deleted&&!t.calendarLink&&(!options.taskId||t.id===options.taskId));
    // Reserve approximate times for rigid recurrence before filling flexible work.
    const ordered=[...tasks.filter(t=>t.rigid&&t.preferred!==undefined).sort((a,b)=>a.preferred!-b.preferred!),...tasks.filter(t=>!t.rigid||t.preferred===undefined)];
    for (const t of ordered) {
        const window=copy.channels.find(c=>c.id===t.channel)?.hours?.[weekday]||copy.settings.weekdayHours?.[weekday]||{enabled:true,start:copy.settings.start,end:copy.settings.end};
        let remaining=Math.max(0,t.minutes-t.actual-(copy.timer?.taskId===t.id?timerSeconds(copy)/60:0))-copy.blocks.filter(b=>b.taskId===t.id&&b.date===day).reduce((n,b)=>n+b.minutes,0);
        if(remaining<=0)continue;
        const floor=Math.max(options.allowOutside?0:window.start,options.from??0),ceiling=options.allowOutside?1440:Math.min(window.end,copy.shutdownTimes?.[day]??1440);
        if((!window.enabled&&!options.allowOutside)||floor>=ceiling){missed.push(t.id);continue;}
        remaining=Math.ceil(remaining/5)*5;
        const occupied=copy.blocks.filter(b=>b.date===day&&b.busy!==false).sort((a,b)=>a.start-b.start);
        const slots:{start:number;end:number}[]=[];let cursor=floor;
        for(const b of [...occupied,{start:ceiling,minutes:0} as Block]){
            if(b.start>cursor)slots.push({start:cursor,end:Math.min(ceiling,b.start)});
            cursor=Math.max(cursor,b.start+b.minutes+gap);if(cursor>=ceiling)break;
        }
        const split=copy.settings.splitTasks!==false&&!options.noSplit;
        const candidates=slots.filter(w=>w.end-w.start>=5&&(split||w.end-w.start>=remaining)).map(w=>{
            const latest=w.end-(split?Math.min(remaining,w.end-w.start):remaining);
            const at=t.preferred===undefined?w.start:Math.max(w.start,Math.min(latest,t.preferred));
            return {...w,at:Math.ceil(at/5)*5};
        }).sort((a,b)=>t.preferred===undefined?a.at-b.at:Math.abs(a.at-t.preferred)-Math.abs(b.at-t.preferred)||a.at-b.at);
        for(const w of candidates){
            const length=Math.min(remaining,Math.floor((w.end-w.at)/5)*5);if(length<5||(!split&&length<remaining))continue;
            addTimebox(copy,t.id,day,w.at,length,false);created.push(copy.blocks[copy.blocks.length-1]);remaining-=length;if(remaining<=0)break;
            // If a preference split this free interval, its earlier part remains usable.
            if(split&&w.at-w.start>=5){const early=Math.min(remaining,Math.floor((w.at-gap-w.start)/5)*5);if(early>=5){addTimebox(copy,t.id,day,w.start,early,false);created.push(copy.blocks[copy.blocks.length-1]);remaining-=early;}}
            if(remaining<=0)break;
        }
        if(remaining>0)missed.push(t.id);
    }
    return {missed,blocks:options.project?copy.blocks:created};
}
export function mergeTask(s: State, sourceId: string, targetId: string): boolean {
    const from=s.tasks.find(t=>t.id===sourceId),to=s.tasks.find(t=>t.id===targetId);
    if(!from||!to||from===to||from.deleted||to.deleted||from.subtasks.some(st=>st.mergedTaskId)||to.minutes+from.minutes>720)return false;
    if(s.timer?.taskId===from.id)finishTimer(s);
    to.unallocatedMinutes=to.unallocatedMinutes??Math.max(0,to.minutes-to.subtasks.reduce((n,st)=>n+(st.minutes||0),0));
    const sub={id:uid(),title:from.title,done:from.done,minutes:from.minutes,actual:from.actual,mergedTaskId:from.id};
    to.subtasks.push(sub);to.minutes+=from.minutes;to.actual+=from.actual;
    to.notes=[to.notes,`Merged: ${from.title}`,from.notes,from.sourceUrl].filter(Boolean).join('\n\n').slice(0,10000);
    for(const e of s.sessions||[])if(e.taskId===from.id){e.originalSubtaskId=e.subtaskId;e.subtaskId=sub.id;e.taskId=to.id;e.title=to.title;e.channel=to.channel;}
    for(const b of s.blocks)if(b.taskId===from.id){b.originalTaskId=from.id;b.taskId=to.id;b.title=to.title;}
    from.mergedInto=to.id;from.deleted=new Date().toISOString();from.actual=0;from.archived=true;
    if(from.seriesId){const series=s.series?.find(r=>r.id===from.seriesId);if(series)series.stopped=true;}
    return true;
}
export function duplicateTask(s: State, id: string, day: string | null): Task | undefined { const original = s.tasks.find(t => t.id === id); if (!original)
    return; const t = { ...structuredClone(original), id: uid(), sunsamaImport:undefined, calendarLink:undefined, sourceUrl:original.sourceUrl?.startsWith('daylight:event:')?undefined:original.sourceUrl, comments: [], activity: [], date: day, done: false, actual: 0, recurrence: 'none' as const, seriesId: undefined, occurrence: undefined, completedOn: undefined, deleted: undefined, archived: false, sample: false, subtasks: original.subtasks.map(st => ({ ...st, id: uid(), done: false, actual: 0, mergedTaskId: undefined })) }; s.tasks.push(t); return t; }
export function capture(text: string, s: State, day: string): Task {
    let title = text.trim(), date: string | null = day, minutes = 30, channel = s.settings.defaultChannel || s.channels[0].id, priority: Task['priority'] = 'normal';
    const take = (pattern: RegExp, fn: (m: RegExpMatchArray) => void) => { const m = title.match(pattern); if (m) {
        fn(m);
        title = title.replace(m[0], ' ').trim();
    } };
    take(/\s*@(today|tomorrow|backlog|\d{4}-\d{2}-\d{2})\b/i, m => date = m[1] === 'backlog' ? null : m[1] === 'tomorrow' ? shiftDate(day, 1) : m[1] === 'today' ? day : m[1]);
    take(/\s*~(\d+)(m|h)\b/i, m => minutes = Math.max(5, Math.min(720, Number(m[1]) * (m[2] === 'h' ? 60 : 1))));
    take(/\s*!(urgent|important|low)\b/i, m => priority = m[1].toLowerCase() as Task['priority']);
    for (const c of s.channels) {
        const token = '#' + c.name.toLowerCase();
        if (title.toLowerCase().includes(token)) {
            const pos = title.toLowerCase().indexOf(token);
            title = (title.slice(0, pos) + title.slice(pos + token.length)).trim();
            channel = c.id;
            break;
        }
    }
    const t = task(title || text.trim(), date, channel, minutes);
    t.priority = priority;
    const url = text.match(/https?:\/\/[^\s]+/);
    if (url)
        t.sourceUrl = url[0];
    return t;
}
export function importMeeting(s: State, b: Block): Task { const existing = linkedCalendarTask(s,b); if (existing)
    return existing; const t = task(b.title, b.date, s.settings.defaultChannel || s.channels[0].id, Math.min(720, b.minutes)); t.sourceUrl = `daylight:event:${b.id}`; s.tasks.push(t); if(b.provider==='google'&&b.externalEventId)linkCalendarTask(s,t.id,b.id); return t; }

export function saveTask(s:State,draft:Task,start:number|null,today:string,applyFuture:boolean|'all'=false):void {
 const total=draft.subtasks.reduce((n,st)=>n+(st.minutes||0),0)+(draft.unallocatedMinutes||0);if(total>0)draft.minutes=total;
 const current=s.tasks.find(t=>t.id===draft.id),previous=s.blocks.find(b=>b.taskId===draft.id),oldMinutes=current?.minutes;
 if(current){let desiredActual=draft.actual;const oldActual=current.actual;if(s.timer?.taskId===current.id&&s.timer.subtaskId&&!draft.subtasks.some(st=>st.id===s.timer!.subtaskId&&!st.done)){finishTimer(s);if(desiredActual===oldActual){desiredActual=current.actual;draft.actual=current.actual;}}if(desiredActual!==current.actual)setActual(s,current.id,desiredActual,draft.date||today);const changedDate=current.date!==draft.date;Object.assign(current,structuredClone(draft));for(const st of current.subtasks){const entries=(s.sessions||[]).filter(e=>e.taskId===current.id&&e.subtaskId===st.id);if(entries.length||st.actual!==undefined)st.actual=entries.reduce((n,e)=>n+e.seconds/60,0);}current.edited=true;if(changedDate)s.blocks=s.blocks.filter(b=>b.taskId!==current.id);}
 else s.tasks.push(structuredClone(draft));
 const saved=s.tasks.find(t=>t.id===draft.id)!;const remaining=s.blocks.filter(b=>b.taskId===saved.id);
 for(const b of remaining){b.title=saved.title;b.color=s.channels.find(c=>c.id===saved.channel)?.color||b.color;if(remaining.length===1&&saved.minutes>0&&oldMinutes!==saved.minutes)b.minutes=Math.min(saved.minutes,1440-b.start);}
 if(start!==null&&saved.date){const first=remaining.find(b=>b.id===previous?.id);if(first){first.start=Math.min(start,1440-first.minutes);first.date=saved.date;first.pinned=true;}else if(saved.minutes>0)addTimebox(s,saved.id,saved.date,start,saved.minutes,true);}
 else if(previous)s.blocks=s.blocks.filter(b=>b.id!==previous.id);
 if(saved.date)delete saved.folder;if(start!==null&&saved.recurrence!=='none'){saved.preferred??=start;saved.rigid??=true;}syncSeries(s,saved,applyFuture);generateOccurrences(s,today);
}
