import { zonedParts, wallToEpoch } from './calendar-time.ts';
export type RecurrenceRule = {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    weekdays: number[];
    until: string;
};
export type TimeEntry = {
    id: string;
    taskId: string;
    title: string;
    channel: string;
    day: string;
    seconds: number;
    started: number;
    ended: number;
    kind: 'timer' | 'manual' | 'legacy';
};
export type Series = {
    id: string;
    anchor: string;
    rule: RecurrenceRule;
    template: Task;
    stopped?: boolean;
};
export type Channel = {
    id: string;
    name: string;
    color: string;
    context: string;
    disabled?: boolean;
};
export type Task = {
    id: string;
    title: string;
    date: string | null;
    channel: string;
    minutes: number;
    actual: number;
    done: boolean;
    notes: string;
    subtasks: {
        id: string;
        title: string;
        done: boolean;
    }[];
    priority: 'low' | 'normal' | 'important' | 'urgent';
    recurrence: 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';
    due: string;
    archived: boolean;
    sample?: boolean;
    generatedFrom?: string;
    objective?: string;
    completedOn?: string;
    rule?: RecurrenceRule;
    seriesId?: string;
    occurrence?: string;
    edited?: boolean;
    rolloverSince?: string;
    rolloverCount?: number;
    backlogPriority?: 'urgent' | 'high' | 'medium' | 'low' | 'none';
    bucket?: string;
    folder?: string;
    pinned?: boolean;
    preferred?: number;
    deleted?: string;
    sourceUrl?: string;
};
export type Block = {
    id: string;
    taskId?: string;
    title: string;
    date: string;
    start: number;
    minutes: number;
    color: string;
    sample?: boolean;
    pinned?: boolean;
    busy?: boolean;
    sourceUid?: string;
};
export type Objective = {
    id: string;
    title: string;
    week: string;
    done: boolean;
    sample?: boolean;
};
export type State = {
    version: 1;
    tasks: Task[];
    blocks: Block[];
    channels: Channel[];
    objectives: Objective[];
    settings: {
        start: number;
        end: number;
        capacity: number;
        weekStartsMonday: boolean;
        timezone?: string;
        rollover?: boolean;
        archiveAfter?: number;
        autoReschedule?: boolean;
        gap?: number;
        splitTasks?: boolean;
        autoSort?: boolean;
        pomodoro?: boolean;
        focusMinutes?: number;
        breakMinutes?: number;
        notifications?: boolean;
        theme?: 'light' | 'dark' | 'system';
        defaultChannel?: string;
        personalContexts?: string[];
        weekdayCapacity?: number[];
    };
    reflections: Record<string, string>;
    planned: string[];
    timer: {
        taskId: string;
        started: number | null;
        seconds: number;
        segments?: {
            start: number;
            end: number;
        }[];
    } | null;
    series?: Series[];
    sessions?: TimeEntry[];
    highlights?: Record<string, {
        id: string;
        text: string;
        starred: boolean;
    }[]>;
    weeklyReflections?: Record<string, string>;
    weeklyPlanned?: string[];
    folders?: {
        id: string;
        name: string;
    }[];
    lastMaintenance?: string;
    breakUntil?: number | null;
};
export const uid = () => crypto.randomUUID();
export function dateKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function fromKey(value: string): Date { return new Date(`${value}T12:00:00`); }
export function shiftDate(value: string, days: number): string { const d = fromKey(value); d.setDate(d.getDate() + days); return dateKey(d); }
export function weekOf(value: string): string { const d = fromKey(value); return shiftDate(value, -((d.getDay() + 6) % 7)); }
export function duration(m: number): string { const n = Math.round(m); return n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}` : `${n}m`; }
export function clockLabel(minutes: number): string { const h = Math.floor(minutes / 60); return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; }
export function inputTime(minutes: number): string { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
export function parseTime(value: string): number { const [h, m] = value.split(':').map(Number); return h * 60 + m; }
export function task(title: string, day: string | null, channel = 'product', minutes = 30): Task { return { id: uid(), title, date: day, channel, minutes, actual: 0, done: false, notes: '', subtasks: [], priority: 'normal', recurrence: 'none', due: '', archived: false }; }
export function initialState(today: string): State {
    const yesterday = shiftDate(today, -1), tomorrow = shiftDate(today, 1);
    const tasks = [task('Review the week & tie up loose ends', today, 'product', 45), task('Make progress on the next big thing', today, 'product', 90), task('Clear the inbox', today, 'operations', 25), task('A little time outside', today, 'wellbeing', 30), task('Prepare for next week', tomorrow, 'product', 30), task('Read something inspiring', tomorrow, 'personal', 20), task('Capture ideas for the project', yesterday, 'product', 40), task('Catch up on the little things', yesterday, 'operations', 25), task('Explore a new idea', null, 'product', 45), task('Book that appointment', null, 'personal', 15)];
    tasks.forEach(t => t.sample = true);
    tasks[0].priority = 'important';
    tasks[0].subtasks = [{ id: uid(), title: 'Review open tasks', done: true }, { id: uid(), title: 'Write down the next steps', done: false }];
    tasks[1].notes = 'Make a little room for focused work. One thing at a time.';
    tasks[6].done = true;
    tasks[6].actual = 35;
    tasks[6].completedOn = yesterday;
    tasks[7].done = true;
    tasks[7].actual = 20;
    tasks[7].completedOn = yesterday;
    return { version: 1, tasks, blocks: [{ id: uid(), title: 'Morning check-in', date: today, start: 540, minutes: 30, color: '#b28dba', sample: true }, { id: uid(), title: tasks[0].title, taskId: tasks[0].id, date: today, start: 600, minutes: 45, color: '#709b8d', sample: true }, { id: uid(), title: tasks[1].title, taskId: tasks[1].id, date: today, start: 660, minutes: 90, color: '#709b8d', sample: true }, { id: uid(), title: 'Lunch & a little reset', date: today, start: 780, minutes: 60, color: '#c49b65', sample: true }, { id: uid(), title: tasks[3].title, taskId: tasks[3].id, date: today, start: 930, minutes: 30, color: '#b28dba', sample: true }], channels: [{ id: 'product', name: 'Product', color: '#709b8d', context: 'Work' }, { id: 'operations', name: 'Operations', color: '#779bc1', context: 'Work' }, { id: 'personal', name: 'Personal', color: '#c49b65', context: 'Personal' }, { id: 'wellbeing', name: 'Wellbeing', color: '#b28dba', context: 'Personal' }], objectives: [{ id: uid(), title: 'Make space for meaningful work', week: weekOf(today), done: false, sample: true }], settings: { start: 540, end: 1020, capacity: 360, weekStartsMonday: true }, reflections: {}, planned: [], timer: null };
}
export function timerSeconds(s: State): number { return s.timer ? s.timer.seconds + (s.timer.started ? Math.max(0, Math.floor((Date.now() - s.timer.started) / 1000)) : 0) : 0; }
export function pauseTimer(s: State, now = Date.now()): void { if (s.timer?.started) {
    const end = Math.max(s.timer.started, now);
    s.timer.segments ??= [];
    s.timer.segments.push({ start: s.timer.started, end });
    s.timer.seconds += Math.floor((end - s.timer.started) / 1000);
    s.timer.started = null;
} }
export function finishTimer(s: State, now = Date.now()): void {
    if (!s.timer)
        return;
    pauseTimer(s, now);
    const timer = s.timer, t = s.tasks.find(t => t.id === timer.taskId);
    s.sessions ??= [];
    if (t) {
        const tz = s.settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        let recorded = 0;
        for (const segment of timer.segments || []) {
            let start = segment.start;
            while (start < segment.end) {
                const day = zonedParts(start, tz).day;
                const midnight = wallToEpoch(shiftDate(day, 1), 0, tz);
                const end = Math.min(segment.end, midnight > start ? midnight : start + 86400000);
                const seconds = Math.floor((end - start) / 1000);
                if (seconds > 0) {
                    s.sessions.push({ id: uid(), taskId: t.id, title: t.title, channel: t.channel, day, seconds, started: start, ended: end, kind: 'timer' });
                    recorded += seconds;
                }
                start = end;
            }
        }
        const legacy = Math.max(0, timer.seconds - recorded);
        if (legacy)
            s.sessions.push({ id: uid(), taskId: t.id, title: t.title, channel: t.channel, day: zonedParts(now, tz).day, seconds: legacy, started: now - legacy * 1000, ended: now, kind: 'timer' });
        t.actual += timer.seconds / 60;
    }
    s.timer = null;
}
export function completeTask(s: State, id: string, today: string): void {
    const t = s.tasks.find(t => t.id === id);
    if (!t)
        return;
    t.done = !t.done;
    t.completedOn = t.done ? today : undefined;
    if (t.done && s.timer?.taskId === id)
        finishTimer(s);
    if (t.done && !t.seriesId && t.recurrence !== 'none' && !s.tasks.some(n => n.generatedFrom === id)) {
        let day = shiftDate(t.date || today, t.recurrence === 'weekly' ? 7 : 1);
        if (t.recurrence === 'weekdays')
            while ([0, 6].includes(fromKey(day).getDay()))
                day = shiftDate(day, 1);
        s.tasks.push({ ...structuredClone(t), id: uid(), date: day, done: false, actual: 0, generatedFrom: id, completedOn: undefined, due: '', subtasks: t.subtasks.map(st => ({ ...st, id: uid(), done: false })) });
    }
}
export function moveTask(s: State, id: string, day: string | null): void { const t = s.tasks.find(t => t.id === id); if (t) {
    t.date = day;
    s.blocks = s.blocks.filter(b => b.taskId !== id);
} }
export function scheduleTask(s: State, id: string, day: string, start: number): void { const t = s.tasks.find(t => t.id === id); if (!t)
    return; t.date = day; s.blocks = s.blocks.filter(b => b.taskId !== id); s.blocks.push({ id: uid(), taskId: id, title: t.title, date: day, start: Math.max(0, Math.min(1440 - t.minutes, start)), minutes: t.minutes, color: s.channels.find(c => c.id === t.channel)?.color || '#709b8d', sample: t.sample, pinned:true }); }
export function autoSchedule(s: State, day: string): number { let missed = 0; for (const t of s.tasks.filter(t => !t.done && !t.archived && t.date === day && !s.blocks.some(b => b.taskId === t.id))) {
    let at = s.settings.start;
    const blocks = s.blocks.filter(b => b.date === day).sort((a, b) => a.start - b.start);
    for (const b of blocks) {
        if (at + t.minutes <= b.start)
            break;
        if (at < b.start + b.minutes)
            at = b.start + b.minutes;
    }
    if (at + t.minutes <= s.settings.end)
        scheduleTask(s, t.id, day, at);
    else
        missed++;
} return missed; }
export function exportCalendar(s: State): string { const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); const stamp = (d: string, m: number) => { const v = new Date(wallToEpoch(d, m, s.settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)); return v.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }; return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daylight//Planner//EN', ...s.blocks.flatMap(b => ['BEGIN:VEVENT', `UID:${b.id}@daylight`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART:${stamp(b.date, b.start)}`, `DTEND:${stamp(b.date, b.start + b.minutes)}`, `SUMMARY:${esc(s.tasks.find(t => t.id === b.taskId)?.title || b.title)}`, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n'); }
