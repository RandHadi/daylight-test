import { type State, type Task, type WorkWindow, uid, finishTimer, pauseTimer, shiftDate, fromKey, task } from './planner-model.ts';
import { occursOn, generateOccurrences } from './planner-advanced.ts';

export function plannedMinutes(t: Task): number {
  const total = t.subtasks.reduce((n, st) => n + (st.minutes || 0), 0) + (t.unallocatedMinutes || 0);
  return total > 0 ? total : t.minutes;
}
export function reconcileEstimates(s: State): void {
  for (const t of s.tasks) {
    const total = t.subtasks.reduce((n, st) => n + (st.minutes || 0), 0) + (t.unallocatedMinutes || 0);
    if (total > 0) t.minutes = total;
  }
}
export function startTimer(s: State, taskId: string, subtaskId?: string, now = Date.now()): void {
  const t = s.tasks.find(t => t.id === taskId && !t.deleted && !t.archived);
  if (!t || (subtaskId && !t.subtasks.some(st => st.id === subtaskId))) return;
  if (s.timer?.taskId === taskId && s.timer?.subtaskId === subtaskId) {
    if (!s.timer.started) s.timer.started = now;
    return;
  }
  finishTimer(s, now);
  s.breakUntil = null;
  s.timer = { taskId, subtaskId, started: now, seconds: 0, segments: [] };
}
export function toggleSubtaskTimer(s: State, taskId: string, subtaskId: string, now = Date.now()): void {
  if (s.timer?.taskId === taskId && s.timer.subtaskId === subtaskId && s.timer.started) pauseTimer(s, now);
  else startTimer(s, taskId, subtaskId, now);
}
export function completeSubtask(s: State, taskId: string, subtaskId: string): void {
  const t = s.tasks.find(t => t.id === taskId), st = t?.subtasks.find(st => st.id === subtaskId);
  if (!t || !st) return;
  if (!st.done && s.timer?.taskId === taskId && s.timer.subtaskId === subtaskId) finishTimer(s);
  st.done = !st.done; t.edited = true;
}
export function actualOn(s: State, taskId: string, day: string, subtaskId?: string): number {
  return (s.sessions || []).filter(e => e.taskId === taskId && e.day === day && (!subtaskId || e.subtaskId === subtaskId)).reduce((n, e) => n + e.seconds / 60, 0);
}
/** Edit one day's total. Parent corrections reduce entries only on that day. */
export function setDayActual(s: State, taskId: string, day: string, minutes: number, subtaskId?: string): void {
  const t = s.tasks.find(t => t.id === taskId);
  if (!t || !Number.isFinite(minutes) || minutes < 0 || minutes > 1000000 || (subtaskId && !t.subtasks.some(st => st.id === subtaskId))) return;
  if (s.timer?.taskId === taskId) finishTimer(s);
  s.sessions ??= [];
  const entries = s.sessions.filter(e => e.taskId === taskId && e.day === day && (!subtaskId || e.subtaskId === subtaskId));
  const delta = minutes * 60 - entries.reduce((n, e) => n + e.seconds, 0);
  if (delta > 0) s.sessions.push({ id: uid(), taskId, subtaskId, title: t.title, channel: t.channel, day, seconds: delta, started: 0, ended: 0, kind: 'manual' });
  else {
    let remove = -delta;
    for (const e of [...entries].reverse()) { const n = Math.min(e.seconds, remove); e.seconds -= n; remove -= n; if (remove <= 0) break; }
    s.sessions = s.sessions.filter(e => e.seconds > 0);
  }
  t.actual = s.sessions.filter(e => e.taskId === taskId).reduce((n, e) => n + e.seconds / 60, 0);
  for (const st of t.subtasks) st.actual = s.sessions.filter(e => e.taskId === taskId && e.subtaskId === st.id).reduce((n, e) => n + e.seconds / 60, 0);
}
export function workingWindow(s: State, day: string, channelId?: string): WorkWindow {
  const weekday = fromKey(day).getDay();
  return (channelId ? s.channels.find(c => c.id === channelId)?.hours?.[weekday] : undefined) || s.settings.weekdayHours?.[weekday] || { enabled: true, start: s.settings.start, end: s.settings.end };
}
export function recurrenceNeighbor(s: State, taskId: string, direction: -1 | 1): Task | undefined {
  const current = s.tasks.find(t => t.id === taskId), series = s.series?.find(r => r.id === current?.seriesId);
  if (!current || !series) return;
  const anchor = current.occurrence || current.date || series.anchor;
  const existing = s.tasks.filter(t => t.seriesId === series.id && !t.deleted && (direction === -1 ? (t.occurrence || t.date || '') < anchor : (t.occurrence || t.date || '') > anchor)).sort((a, b) => (a.occurrence || a.date || '').localeCompare(b.occurrence || b.date || '') * direction);
  if (direction === -1) return existing[0];
  // Search to the next valid date instead of filling every intervening day.
  for (let i = 1; i <= 366 * 3; i++) {
    const day = shiftDate(anchor, i);
    if (series.rule.until && day > series.rule.until) return;
    if (occursOn(series, day)) { generateOccurrences(s, day, 0); return s.tasks.find(t => t.seriesId === series.id && (t.occurrence || t.date) === day && !t.deleted); }
  }
  return existing[0];
}
export function promoteSubtask(s: State, taskId: string, subtaskId: string): Task | undefined {
  const parent = s.tasks.find(t => t.id === taskId), st = parent?.subtasks.find(st => st.id === subtaskId);
  if (!parent || !st) return;
  if(st.mergedTaskId){
    const original=s.tasks.find(t=>t.id===st.mergedTaskId);if(!original)return;
    if(s.timer?.taskId===taskId&&s.timer.subtaskId===subtaskId)finishTimer(s);
    const actual=st.actual||0;parent.actual=Math.max(0,parent.actual-actual);parent.minutes=Math.max(5,parent.minutes-(st.minutes||0));parent.subtasks=parent.subtasks.filter(x=>x.id!==subtaskId);
    original.actual=actual;original.minutes=st.minutes||original.minutes;original.title=st.title;original.done=st.done;original.archived=false;delete original.deleted;delete original.mergedInto;
    for(const e of s.sessions||[])if(e.taskId===taskId&&e.subtaskId===subtaskId){e.taskId=original.id;e.subtaskId=e.originalSubtaskId;delete e.originalSubtaskId;e.title=original.title;e.channel=original.channel;}
    for(const b of s.blocks)if(b.originalTaskId===original.id){b.taskId=original.id;b.title=original.title;delete b.originalTaskId;}
    for(const child of original.subtasks)child.actual=(s.sessions||[]).filter(e=>e.taskId===original.id&&e.subtaskId===child.id).reduce((n,e)=>n+e.seconds/60,0);
    if(!parent.subtasks.some(x=>x.minutes)){parent.minutes=Math.max(5,parent.unallocatedMinutes||parent.minutes);delete parent.unallocatedMinutes;}
    reconcileEstimates(s);return original;
  }
  if (s.timer?.taskId === taskId && s.timer.subtaskId === subtaskId) finishTimer(s);
  const remainingEstimate = Math.max(5, parent.minutes - (st.minutes || 0));
  const promoted = task(st.title, parent.date, parent.channel, st.minutes || 30);
  promoted.actual = st.actual || 0; promoted.done = st.done; promoted.priority = parent.priority; promoted.objective = parent.objective;
  parent.subtasks = parent.subtasks.filter(x => x.id !== subtaskId); parent.minutes = remainingEstimate; parent.actual = Math.max(0, parent.actual - promoted.actual);
  for (const e of s.sessions || []) if (e.taskId === taskId && e.subtaskId === subtaskId) { e.taskId = promoted.id; delete e.subtaskId; e.title = promoted.title; }
  s.tasks.push(promoted); reconcileEstimates(s); return promoted;
}
export function resizeBlock(s: State, id: string, minutes: number): void {
  const b = s.blocks.find(b => b.id === id); if (!b) return;
  b.minutes = Math.min(1440 - b.start, Math.max(5, Math.round(minutes / 5) * 5)); b.pinned = true;
}
export function concludeTimeboxes(s: State, taskId: string, day: string, minute: number): void {
  s.blocks = s.blocks.filter(b => {
    if (b.taskId !== taskId || b.date < day) return true;
    if (b.date > day || b.start >= minute) return false;
    if (b.start + b.minutes > minute) {
      const elapsed = Math.floor((minute - b.start) / 5) * 5;
      if (elapsed < 5) return false;
      b.minutes = elapsed;
    }
    return true;
  });
}
export function reminderDue(s: State, day: string, minute: number, now = Date.now()): 'planning' | 'shutdown' | undefined {
  for (const kind of ['shutdown', 'planning'] as const) {
    const r = kind === 'shutdown' ? s.settings.shutdownReminder : s.settings.planningReminder;
    const complete = kind === 'shutdown' ? Object.prototype.hasOwnProperty.call(s.reflections, day) : s.planned.includes(day);
    const target = kind === 'shutdown' ? (s.shutdownTimes?.[day] ?? r?.minute) : r?.minute;
    if (r?.enabled && r.weekdays.includes(fromKey(day).getDay()) && target !== undefined && minute >= target && !complete && (s.reminderDismissals?.[`${day}:${kind}`] || 0) <= now) return kind;
  }
}
