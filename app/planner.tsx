'use client';
import { useEffect, useRef, useState, useCallback, type ReactNode, type FormEvent } from 'react';
import { Sun, House, CalendarDays, Inbox, Target, BarChart3, Search, Plus, ChevronLeft, ChevronRight, ChevronDown, ArrowUpRight, MoreHorizontal, X, Check, Clock3, Play, Pause, CircleCheck, Settings, LogOut, ArrowRight, Flag, Repeat2, Archive, PanelRightClose, PanelRightOpen, Keyboard, Download, Upload, Link2, ListTodo, Sparkles, CheckCheck, GripVertical, RotateCcw, Coffee, CloudCheck, AlertCircle, LoaderCircle, Menu, Focus, Moon, CalendarPlus, SlidersHorizontal, PanelLeftClose, PanelLeftOpen, Folder } from 'lucide-react';
import { type State, type Task, type Block, type Objective, initialState, dateKey, fromKey, shiftDate, weekOf, duration, clockLabel, inputTime, parseTime, uid, task, completeTask, moveTask, scheduleTask, autoSchedule, timerSeconds, finishTimer, pauseTimer, exportCalendar } from '@/lib/planner-model';
import { upgradeState, maintainDay, syncSeries, generateOccurrences, dailyActual, workMinutes, capacity, scheduleDay, sortDay, setActual, saveTask, duplicateTask, buckets } from '@/lib/planner-advanced';
import { zonedParts } from '@/lib/calendar-time';
import { RuleFields, TaskOrganization, SessionsPanel, AdvancedSettings, QuickCapture, WeeklyRitual, Highlights, CalendarImport, AssistantPanel, FocusWorkspace } from './planner-features';
import { actualOn, plannedMinutes, reconcileEstimates, startTimer, completeSubtask, promoteSubtask, recurrenceNeighbor, resizeBlock, concludeTimeboxes, reminderDue } from '@/lib/planner-parity';
import { NotesEditor, SubtaskFields, RecurrenceNavigation, PlanningPreferences, WeeklyBreakdown } from './parity-features';
import { GoogleCalendarPanel, GoogleEventDetails, useGoogleCalendar } from './google-calendar-features';
import { stateSchema } from '@/lib/state-schema';
import { DayBoard } from './day-board';
import { SunsamaImportPanel, type ImportResult } from './sunsama-import-panel';
import { TaskDetails } from './task-details';
import { recordTaskActivity } from '@/lib/task-details';
import { selectPlannerDraft, applyUndo } from '@/lib/planner-sync';
import { Analytics, BacklogFilters, BacklogFolders, CalendarWorkspace, ChannelFilter, ViewOptions, Shortcuts } from './workspace-views';
import { viewDays, type CalendarLayout } from '@/lib/workspace-views';
import {CalendarMenu} from './calendar-menu';
import {CalendarEntryDetails} from './calendar-entry-details';
import {calendarItems,type CalendarItem} from '@/lib/calendar-display';
import {calendarColors} from '@/lib/calendar-colors';
type View = 'analytics' | 'home' | 'today' | 'backlog' | 'objectives' | 'review' | 'archive';
type Modal = {type:'calendar-entry';item:CalendarItem} | {
    type: 'task';
    id?: string;
    day?: string | null;
    focusField?: 'planned' | 'actual';
} | {
    type: 'event';
    id?: string;
    start?: number;
    day?: string;
} | {
    type: 'sessions';
    id: string;
} | {
    type: 'plan' | 'focus' | 'settings' | 'search' | 'shutdown' | 'integrations' | 'shortcuts' | 'objective' | 'quick' | 'weekly' | 'assistant' | 'commands';
} | null;
const dayName = (d: string) => fromKey(d).toLocaleDateString('en-US', { weekday: 'long' });
const monthDay = (d: string) => fromKey(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
function download(name: string, content: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function ModalShell({ children, onClose, wide = false, sheet = false, taskDetails = false, label }: {
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
    sheet?: boolean;
    taskDetails?: boolean;
    label: string;
}) { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { ref.current?.showModal(); const d = ref.current; return () => d?.close(); }, []); return <dialog aria-label={label} ref={ref} className={`modal ${wide ? 'wide' : ''} ${sheet ? 'sheet' : ''} ${taskDetails ? 'task-dialog' : ''}`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget)
    onClose(); }}><div className="modal-inside">{!taskDetails&&<button className="icon modal-close" aria-label="Close dialog" onClick={onClose}><X size={19}/></button>}{children}</div></dialog>; }
function IconButton({ label, children, onClick, className = '' }: {
    label: string;
    children: ReactNode;
    onClick: () => void;
    className?: string;
}) { return <button className={`icon ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>; }
export default function Planner({ name, userId }: {
    name: string;
    userId: string;
}) {
    const [data, setData] = useState<State | null>(null), dataRef = useRef<State | null>(null), revision = useRef(0), pending = useRef(false), saving = useRef(false), blocked = useRef(false);
    const [saveStatus, setSaveStatus] = useState('Loading your planner…'), [saveError, setSaveError] = useState(''), [loadError, setLoadError] = useState('');
    const [recoveredDrafts, setRecoveredDrafts] = useState<string[]>([]);
    const refreshing = useRef(false);
    const [today, setToday] = useState(dateKey()), [selected, setSelected] = useState(dateKey()), [view, setView] = useState<View>('home'), [filter, setFilter] = useState('all'), [modal, setModal] = useState<Modal>(null), [calendar, setCalendar] = useState(true), [mobileCalendar, setMobileCalendar] = useState(false), [mobileNav, setMobileNav] = useState(false), [toast, setToast] = useState(''), [draggingId, setDraggingId] = useState<string | null>(null), [query, setQuery] = useState(''), [tick, setTick] = useState(0), [planStep, setPlanStep] = useState(0), [calMonth, setCalMonth] = useState(dateKey());
    const [bucketFilter, setBucketFilter] = useState('all'), [folderFilter, setFolderFilter] = useState('all'), [priorityFilter, setPriorityFilter] = useState('all'), [playlist, setPlaylist] = useState(false);
    const [sidePanel,setSidePanel]=useState<'calendar'|'backlog'|'tasks'|'objectives'|'integrations'>('calendar');
    const [leftCollapsed,setLeftCollapsed]=useState(false),[layout,setLayout]=useState<CalendarLayout>('board'),[showCompleted,setShowCompleted]=useState(true),[prefsReady,setPrefsReady]=useState(false),[integrationTab,setIntegrationTab]=useState<'google'|'ics'|'sunsama'>('google');
    useEffect(()=>{try{const p=JSON.parse(localStorage.getItem('daylight-view:'+userId)||'{}');setLeftCollapsed(p.leftCollapsed===true);setCalendar(p.rightOpen!==false);if(['board','day','three','weekdays','week','month'].includes(p.layout))setLayout(p.layout);setShowCompleted(p.completed!==false);}catch{}setPrefsReady(true);},[userId]);
    useEffect(()=>{if(prefsReady)try{localStorage.setItem('daylight-view:'+userId,JSON.stringify({leftCollapsed,rightOpen:calendar,layout,completed:showCompleted}));}catch{}},[leftCollapsed,calendar,layout,showCompleted,prefsReady,userId]);
    const openSide=(panel:typeof sidePanel)=>{const open=sidePanel!==panel||!calendar||(typeof window!=='undefined'&&window.innerWidth<=760&&!mobileCalendar);setSidePanel(panel);setCalendar(open);setMobileCalendar(open);};
    const [selectedTaskId,setSelectedTaskId]=useState<string|null>(null);
    const [scheduleOverflow,setScheduleOverflow]=useState<string[]>([]);
    const [resizePreview,setResizePreview]=useState<{id:string;minutes:number}|null>(null);
    const resizing=useRef<{id:string;y:number;minutes:number}|null>(null);
    const draggingRef = useRef<string | null>(null);const returnToPlan=useRef(false);const blockPointer=useRef<{x:number;y:number}|null>(null);const blockWasDragged=useRef(false);
    const importing = useRef(false);
    const taskDetailsClose = useRef<(() => boolean) | null>(null);
    const closeModal = () => { if (modal?.type === 'task' && taskDetailsClose.current?.() === false) return; setModal(modal?.type === 'task' && returnToPlan.current ? {type:'plan'} : null); returnToPlan.current=false; };
    const undo = useRef<State | null>(null), calendarRef = useRef<HTMLDivElement>(null), fileRef = useRef<HTMLInputElement>(null);
    const notify = (s: string) => { setToast(s); };
    useEffect(() => { if (toast) {
        const t = setTimeout(() => setToast(''), 5000);
        return () => clearTimeout(t);
    } }, [toast]);
    const preserveDraft = useCallback((raw: string) => {
        const key = 'daylight-recovered-drafts:' + userId;
        const stored = JSON.parse(localStorage.getItem(key) || '[]') as string[];
        if (!stored.includes(raw)) stored.push(raw);
        // Only remove the active draft after a separate recovery copy is durable.
        localStorage.setItem(key, JSON.stringify(stored));
        setRecoveredDrafts(stored);
    }, [userId]);
    const load = useCallback(async () => { if (saving.current || importing.current || refreshing.current) return; refreshing.current = true; try {
        setLoadError('');
        const r = await fetch('/api/planner', { cache: 'no-store' });
        const body = await r.json() as {
            error?: string;
            revision: number;
            state: State | null;
        };
        if (!r.ok)
            throw new Error(body.error);
        const cloud = body.state || initialState(dateKey());
        const key = 'daylight-draft:' + userId;
        const raw = localStorage.getItem(key);
        const resolved = selectPlannerDraft(cloud, body.revision, raw);
        if (resolved.archive) {
            preserveDraft(resolved.archive);
            if (localStorage.getItem(key) === raw) localStorage.removeItem(key);
        }
        setRecoveredDrafts(JSON.parse(localStorage.getItem('daylight-recovered-drafts:' + userId) || '[]'));
        revision.current = body.revision;
        blocked.current = false;
        setSaveError('');
        let fresh = upgradeState(resolved.state);
        const day = zonedParts(Date.now(), fresh.settings.timezone!).day;
        maintainDay(fresh, day);
        setToday(day);
        setSelected(day);
        const linkedTask = new URL(window.location.href).searchParams.get('task');
        if (linkedTask && fresh.tasks.some(t=>t.id===linkedTask&&!t.deleted)) setModal({type:'task',id:linkedTask});
        if (resolved.recovered) setToast('Recovered your unsaved draft.');
        dataRef.current = fresh;
        setData(fresh);
        undo.current = null;
        pending.current = JSON.stringify(fresh) !== JSON.stringify(body.state);
        setSaveStatus(pending.current ? 'Saving…' : 'All changes saved');
    }
    catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Could not load your planner.');
    } finally { refreshing.current = false; } }, [userId, preserveDraft]);
    useEffect(() => { load(); if (window.matchMedia('(max-width:760px)').matches)
        setView('today'); }, [load]);
    const flush = useCallback(async () => { if (saving.current || blocked.current)
        return; saving.current = true; setSaveError(''); while (pending.current) {
        pending.current = false;
        setSaveStatus('Saving…');
        try {
            const r = await fetch('/api/planner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: dataRef.current, revision: revision.current }) });
            const b = await r.json() as {
                error?: string;
                revision: number;
            };
            if (!r.ok) {
                if (r.status === 409)
                    blocked.current = true;
                throw new Error(b.error || 'Could not save.');
            }
            revision.current = b.revision;
            if (!pending.current) {
                try {
                    localStorage.removeItem('daylight-draft:' + userId);
                }
                catch { }
            }
            else {
                try {
                    localStorage.setItem('daylight-draft:' + userId, JSON.stringify({ state: dataRef.current, revision: revision.current }));
                }
                catch { }
            }
            setSaveStatus('All changes saved');
        }
        catch (e) {
            pending.current = true;
            setSaveStatus('Changes not saved');
            setSaveError(e instanceof Error ? e.message : 'Check your connection, then try again.');
            break;
        }
    } saving.current = false; }, []);
    const change = (fn: (s: State) => void, canUndo = false) => { if (!dataRef.current || importing.current || blocked.current || refreshing.current)
        return false; const s = structuredClone(dataRef.current); fn(s); if(JSON.stringify(s)===JSON.stringify(dataRef.current))return true; if(canUndo)undo.current=structuredClone(dataRef.current); reconcileEstimates(s); if (s.settings.autoSort) {
        for (const d of new Set(s.tasks.map(t => t.date).filter(Boolean)))
            sortDay(s, d!);
    } if (s.settings.autoReschedule) {
        const now = zonedParts(Date.now(), s.settings.timezone!);
        scheduleDay(s, now.day, { reschedule: true, from: now.minute });
    } recordTaskActivity(dataRef.current, s, name.split(' ')[0]||name); const checked = stateSchema.safeParse(s); if (!checked.success) {
        notify('That change contains invalid fields. Check dates, durations, or text lengths.');
        return false;
    } dataRef.current = s; setData(s); if(canUndo)setToast('Change made. Undo is available.'); try {
        localStorage.setItem('daylight-draft:' + userId, JSON.stringify({ state: s, revision: revision.current }));
    }
    catch { } pending.current = true; void flush(); return true; };
    const google=useGoogleCalendar(!!data,selected,data?.settings.timezone||'UTC',change);
    useEffect(()=>{const u=new URL(window.location.href),result=u.searchParams.get('google');if(result){setModal({type:'integrations'});notify(result==='connected'?'Google Calendar connected.':result==='cancelled'?'Google connection was cancelled.':'Google connection did not finish. Try connecting again.');u.searchParams.delete('google');window.history.replaceState(null,'',u.pathname+u.search+u.hash);}},[]);
    useEffect(() => { const handle = (e: BeforeUnloadEvent) => { if (pending.current || saving.current) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', handle); return () => window.removeEventListener('beforeunload', handle); }, []);
    useEffect(() => { const t = setInterval(() => { setTick(n => n + 1); setToday(dataRef.current?.settings.timezone ? zonedParts(Date.now(), dataRef.current.settings.timezone).day : dateKey()); }, 1000); return () => clearInterval(t); }, []);
    useEffect(() => { calendarRef.current?.scrollTo({ top: Math.max(0, ((data?.settings.start || 540) / 60 - 1) * 64) }); }, [calendar, sidePanel, selected, view, !!data]);
    useEffect(() => { if (data && pending.current)
        void flush(); }, [data, flush]);
    const loadLatest = async () => {
        if (saving.current || importing.current) return;
        try {
            if (dataRef.current && pending.current) preserveDraft(JSON.stringify({state:dataRef.current,revision:revision.current}));
            await load();
        } catch { setSaveError('Your draft could not be preserved. Export it before reloading.'); }
    };
    // Refresh idle tabs on focus and periodically. Recheck after the request so
    // an edit or import that began in flight can never be replaced by this read.
    useEffect(() => {
        let cancelled = false;
        const refresh = async () => {
            if (document.visibilityState !== 'visible' || modal || pending.current || saving.current || blocked.current || importing.current || refreshing.current) return;
            const base = revision.current;
            try {
                const response = await fetch('/api/planner', {cache:'no-store'});
                if (!response.ok) return;
                const latest = await response.json() as {state:State|null;revision:number};
                if (cancelled || !latest.state || latest.revision <= base || revision.current !== base || pending.current || saving.current || blocked.current || importing.current || refreshing.current) return;
                revision.current = latest.revision;
                dataRef.current = upgradeState(latest.state);
                setData(dataRef.current);undo.current = null;
                setSaveStatus('All changes saved');
            } catch { /* Keep the visible planner and retry on the next focus. */ }
        };
        const timer = setInterval(refresh, 30000);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {cancelled=true;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
    }, [modal]);
    useEffect(() => { const online = () => { if (pending.current)
        void flush(); }; window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, [flush]);
    useEffect(() => { if (data && data.lastMaintenance !== today)
        change(s => { maintainDay(s, today); }); }, [today, data?.lastMaintenance]);
    useEffect(() => { const theme=data?.settings.theme||'light',media=window.matchMedia('(prefers-color-scheme:dark)');const apply=()=>{document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme;};apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply); }, [data?.settings.theme]);
    useEffect(()=>{if(dataRef.current){const copy=structuredClone(dataRef.current);if(generateOccurrences(copy,selected,7)>0)change(s=>{generateOccurrences(s,selected,7);});}},[selected]);
    useEffect(() => { const s = dataRef.current; if (!s?.timer?.started || !s.settings.pomodoro)
        return; const target = (s.settings.focusMinutes || 25) * 60; if (timerSeconds(s) >= target) {
        change(n => { const deadline = n.timer!.started! + Math.max(0, target - n.timer!.seconds) * 1000; finishTimer(n, deadline); n.breakUntil = Date.now() + (n.settings.breakMinutes || 5) * 60000; });
        setModal({ type: 'focus' });
        notify('Focus interval complete. Time for a break.');
        if (s.settings.notifications && 'Notification' in window && Notification.permission === 'granted')
            new Notification('Daylight · Time for a break');
    } }, [tick]);
    const openTask = (id?: string, day: string | null = selected) => {returnToPlan.current=modal?.type==='plan';setModal({ type: 'task', id, day });};
    const go = (v: View) => { setView(v); if(v==='home')setLayout('board'); if(v==='backlog')setFolderFilter('all'); setMobileNav(false); if (v === 'today')
        setSelected(today); };
    const startFocus = (id?: string, subtaskId?: string) => { const s=dataRef.current;if(!s)return;const t=id?s.tasks.find(t=>t.id===id):s.tasks.find(t=>t.date===today&&!t.done&&!t.archived&&!t.deleted);if(!t){notify('Add a task to today to start focusing.');return;}change(n=>startTimer(n,t.id,subtaskId));setModal({type:'focus'}); };
    const toggleTimer = () => change(s => { if (!s.timer)
        return; if (s.timer.started) {
        pauseTimer(s);
    }
    else
        s.timer.started = Date.now(); });
    const finish = (id: string) => { change(s => {completeTask(s,id,today);if(s.tasks.find(t=>t.id===id)?.done){const now=zonedParts(Date.now(),s.settings.timezone!);concludeTimeboxes(s,id,now.day,now.minute);}},true); };
    useEffect(() => { const listener=(e:KeyboardEvent)=>{
      const k=e.key.toLowerCase(),command=e.metaKey||e.ctrlKey;
      if(command&&k==='k'){e.preventDefault();setQuery('');setModal({type:'commands'});return;}
      if(k==='escape'){closeModal();setMobileNav(false);return;}
      if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')||e.altKey||modal||dataRef.current?.settings.shortcuts===false)return;
      const cards=Array.from(document.querySelectorAll<HTMLElement>('.task-card[data-task-id]')).filter(card=>{
        const board=card.closest('.board-scroll');if(!board)return true;
        const bounds=board.getBoundingClientRect(),rect=card.getBoundingClientRect();return rect.right>bounds.left&&rect.left<bounds.right;
      });
      const chosen=cards.find(card=>card.dataset.taskId===selectedTaskId)?.dataset.taskId||cards[0]?.dataset.taskId,t=dataRef.current?.tasks.find(t=>t.id===chosen);
      if(k==='<'||k==='>'){e.preventDefault();if(k==='<')setLeftCollapsed(v=>!v);else{setCalendar(v=>!v);setMobileCalendar(v=>!v);}return;}
      if(e.shiftKey&&!command){if(k==='arrowleft'||k==='arrowright'){e.preventDefault();setSelected(shiftDate(selected,k==='arrowright'?1:-1));return;}if(k===' '){e.preventDefault();setSelected(today);return;}const panels={c:'calendar',b:'backlog',t:'tasks',r:'objectives'} as const;if(k in panels){e.preventDefault();openSide(panels[k as keyof typeof panels]);return;}}
      if(command&&k==='d'&&t){e.preventDefault();let id='';change(s=>{id=duplicateTask(s,t.id,t.date)?.id||'';},true);if(id)openTask(id);return;}
      if(k==='s'&&!command&&t){e.preventDefault();change(s=>moveTask(s,t.id,today),true);return;}
      if(k==='arrowdown'||k==='arrowup'){e.preventDefault();const current=cards.findIndex(c=>c.dataset.taskId===selectedTaskId);const next=cards[Math.max(0,Math.min(cards.length-1,current+(k==='arrowdown'?1:-1)))];if(next){setSelectedTaskId(next.dataset.taskId!);next.focus();next.scrollIntoView({block:'nearest'});}return;}
      if(command){if(k==='enter'&&t){e.preventDefault();openTask(t.id);}if((k==='delete'||k==='backspace')&&t){e.preventDefault();change(s=>{if(s.timer?.taskId===t.id)finishTimer(s);s.tasks.find(n=>n.id===t.id)!.deleted=new Date().toISOString();s.blocks=s.blocks.filter(b=>b.taskId!==t.id);},true);notify('Task moved to trash.');}if(k==='z'&&undo.current){e.preventDefault();const old=undo.current;undo.current=null;change(s=>applyUndo(s,old));}return;}
      if(['a','q','p','f','h','b','g','/','?','t','c','x','d','z','w','e','o',' '].includes(k))e.preventDefault();
      if(k==='a')openTask();if(k==='q')setModal({type:'quick'});if(k==='p'){setPlanStep(0);setModal({type:'plan'});}if(k==='o')setModal({type:'shutdown'});
      if(k==='h')go('home');if(k==='b')go('backlog');if(k==='t')go('today');if(k==='/')setModal({type:'search'});if(k==='?')setModal({type:'shortcuts'});
      if(k==='f')startFocus(t?.id);
      if(!t)return;
      if(k===' '){change(s=>{if(s.timer?.taskId===t.id&&s.timer.started)pauseTimer(s);else startTimer(s,t.id);});}
      if(k==='c')finish(t.id);
      if(k==='d')change(s=>moveTask(s,t.id,shiftDate(t.date||selected,1)),true);
      if(k==='z')change(s=>moveTask(s,t.id,null),true);
      if(k==='w')setModal({type:'task',id:t.id,focusField:'planned'});
      if(k==='e')setModal({type:'sessions',id:t.id});
      if(k==='x'){let missed:string[]=[];change(s=>{if(!t.date)moveTask(s,t.id,selected);const day=t.date||selected,now=zonedParts(Date.now(),s.settings.timezone!);missed=scheduleDay(s,day,{taskId:t.id,noSplit:e.shiftKey,from:day===now.day?now.minute:0}).missed;},true);setScheduleOverflow(missed);notify(missed.length?'This task needs more room.':'Task scheduled.');}
      if(k==='g'&&t.sourceUrl?.match(/^https?:\/\//))window.open(t.sourceUrl,'_blank','noopener,noreferrer');
    };window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);});
    const exportData = () => { if (dataRef.current)
        download(`daylight-${today}.json`, JSON.stringify(dataRef.current, null, 2)); };
    const importSunsama = async (source: unknown): Promise<ImportResult> => {
        if (saving.current || importing.current) throw new Error('Wait for the current save to finish, then import again.');
        importing.current = true;
        const oldDraft = localStorage.getItem('daylight-draft:' + userId);
        try {
            const response = await fetch('/api/import/sunsama', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({source, draft:dataRef.current})});
            const result = await response.json() as ImportResult & {error?:string};
            if (!response.ok) throw new Error(result.error);
            dataRef.current=result.state;setData(result.state);revision.current=result.revision;pending.current=false;blocked.current=false;
            setSaveError('');setSaveStatus('All changes saved');undo.current=null;
            if(localStorage.getItem('daylight-draft:'+userId)===oldDraft)localStorage.removeItem('daylight-draft:'+userId);
            notify(`${result.report.tasks} Sunsama tasks imported. Your previous planner and local draft are backed up.`);
            return result;
        } finally { importing.current = false; }
    };
    const clearSamples = () => { change(s => { const ids = new Set(s.tasks.filter(t => t.sample).map(t => t.id)); s.tasks = s.tasks.filter(t => !t.sample); s.blocks = s.blocks.filter(b => !b.sample && !ids.has(b.taskId || '')); s.objectives = s.objectives.filter(o => !o.sample); if (s.timer && ids.has(s.timer.taskId))
        s.timer = null; }, true); notify('Sample tasks cleared. Your planner is ready.'); };
    const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file)
        return; try {
        if (file.size > 2000000)
            throw new Error('Choose a Daylight backup smaller than 2 MB.');
        const incoming = stateSchema.parse(JSON.parse(await file.text())) as State;
        change(s => { for (const key of ['tasks', 'blocks', 'objectives', 'channels', 'sessions', 'series', 'folders'] as const) {
            s[key]??=[];const existing = new Set(s[key]!.map(i => i.id));
            (s[key] as any[]).push(...(incoming[key]||[]).filter(i => !existing.has(i.id)));
        } s.reflections = { ...incoming.reflections, ...s.reflections };s.highlights={...incoming.highlights,...s.highlights};s.weeklyReflections={...incoming.weeklyReflections,...s.weeklyReflections}; s.planned = [...new Set([...s.planned, ...incoming.planned])]; }, true);
        notify('Backup merged. Existing items were preserved.');
    }
    catch (e) {
        notify(e instanceof Error && e.message.startsWith('Choose') ? e.message : 'That file is not a valid Daylight backup.');
    } };
    if (!data)
        return <div className="loading-screen"><Sun size={34}/><h1>Daylight</h1>{loadError ? <><p>{loadError}</p><button className="primary" onClick={load}>Try again</button></> : <p>Making room for your day…</p>}</div>;
    const timeLabel=(m:number)=>clockLabel(m,data.settings.timeFormat||'12');
    const liveTasks = data.tasks.filter(t => !t.archived && !t.deleted), filterTask = (t: Task) => filter === 'all' || t.channel === filter || data.channels.find(c => c.id === t.channel)?.context === filter;
    const dayTasks = (d: string) => liveTasks.filter(t => t.date === d && filterTask(t));
    const todays = liveTasks.filter(t => t.date === today), todayDone = todays.filter(t => t.done).length, dayMinutes = (d: string) => liveTasks.filter(t => t.date === d).reduce((n, t) => n + t.minutes, 0);
    const activeTask = data.tasks.find(t => t.id === data.timer?.taskId), elapsed = timerSeconds(data), timeString = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor(elapsed / 60) % 60).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    const month = fromKey(calMonth), first = new Date(month.getFullYear(), month.getMonth(), 1), offset = data.settings.weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay(), firstKey = dateKey(first), monthDays = Array.from({ length: 35 + (offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() > 35 ? 7 : 0) }, (_, i) => shiftDate(firstKey, i - offset));
    const weeks = Array.from({ length: 7 }, (_, i) => shiftDate(weekOf(selected), i));
    const dragTask = (e: React.DragEvent, id: string) => { e.dataTransfer.setData('text/plain', `task:${id}`); e.dataTransfer.effectAllowed = 'move'; };
    const dropDay = (e: React.DragEvent, day: string | null, before?: string) => { e.preventDefault(); e.stopPropagation(); const value = e.dataTransfer.getData('text/plain'); if (!value.startsWith('task:'))
        return; const id = value.slice(5); if (id === before)
        return; change(s => { const t = s.tasks.find(t => t.id === id); if (!t)
        return; if (t.date !== day)
        moveTask(s, id, day); if (before) {
        t.pinned=true;
        s.tasks = s.tasks.filter(t => t.id !== id);
        s.tasks.splice(s.tasks.findIndex(t => t.id === before), 0, t);
    } }, true); };
    const pointerDrop = (e: React.PointerEvent, id: string) => { if (!draggingRef.current)
        return; draggingRef.current = null; setDraggingId(null); const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null; const slot = el?.closest<HTMLElement>('[data-drop-time]'); if (slot) {
        change(s => scheduleTask(s, id, slot.dataset.dropDay!, Number(slot.dataset.dropTime)), true);
        notify('Task scheduled.');
        return;
    } const timeline = el?.closest<HTMLElement>('.timeline'); if (timeline) {
        const minute = Math.round((e.clientY - timeline.getBoundingClientRect().top) / 64 * 60 / 15) * 15;
        change(s => scheduleTask(s, id, selected, minute), true);
        notify('Task scheduled.');
        return;
    } const target = el?.closest<HTMLElement>('[data-drop-day]'); if (!target)
        return; const day = target.dataset.dropDay || null; const before = target.dataset.taskId; if (before === id)
        return; change(s => { const t = s.tasks.find(t => t.id === id); if (!t)
        return; if (t.date !== day)
        moveTask(s, id, day); if (before) {
        t.pinned=true;
        s.tasks = s.tasks.filter(t => t.id !== id);
        s.tasks.splice(s.tasks.findIndex(t => t.id === before), 0, t);
    } }, true); notify('Task moved.'); };
    const card = (t: Task) => { const ch = data.channels.find(c => c.id === t.channel), blocks = data.blocks.filter(b => b.taskId === t.id), doneSubs = t.subtasks.filter(s => s.done).length; return <article key={t.id} data-task-id={t.id} data-drop-day={t.date || ''} tabIndex={0} onFocus={()=>setSelectedTaskId(t.id)} onPointerEnter={()=>setSelectedTaskId(t.id)} className={`task-card ${blocks.length?'has-timebox':''} ${t.actual>0?'has-actual':''} ${selectedTaskId===t.id?'is-selected':''} ${t.done ? 'completed' : ''} ${data.timer?.taskId === t.id ? 'is-focusing' : ''}`} draggable={!t.done && !draggingId} onDragStart={e => dragTask(e, t.id)} onDragOver={e => e.preventDefault()} onDrop={e => dropDay(e, t.date, t.id)}><div className="task-top">{!t.done && <button className="drag-handle" aria-label={`Move ${t.title}`} title="Drag to move or schedule" onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); draggingRef.current = t.id; setDraggingId(t.id); }} onPointerUp={e => pointerDrop(e, t.id)} onPointerCancel={() => { draggingRef.current = null; setDraggingId(null); }}><GripVertical size={12}/></button>}<button className={`check ${t.done ? 'checked' : ''}`} aria-label={`${t.done ? 'Reopen' : 'Complete'} ${t.title}`} onClick={() => finish(t.id)}>{t.done && <Check size={12}/>}</button><button className="task-title" onClick={() => openTask(t.id)}>{t.title}</button><button className="card-more icon" aria-label={`Edit ${t.title}`} onClick={() => openTask(t.id)}><MoreHorizontal size={16}/></button></div>{t.subtasks.length > 0 && <div className="card-subtasks">{t.subtasks.slice(0, 2).map(st => <button key={st.id} className={st.done ? 'sub-done' : ''} onClick={() => change(s => { completeSubtask(s,t.id,st.id); })}><span className={`mini-check ${st.done ? 'checked' : ''}`}>{st.done && <Check size={9}/>}</span>{st.title}</button>)}{t.subtasks.length > 2 && <span className="muted">+{t.subtasks.length - 2} more</span>}</div>}<div className="task-meta"><span className="channel-tag" ><span style={{ background: ch?.color }}/>{ch?.name || 'Uncategorized'}</span><span className="meta-right">{t.priority !== 'normal' && <Flag size={11} className={t.priority === 'urgent' ? 'urgent' : ''}/>}{t.recurrence !== 'none' && <Repeat2 size={11}/>}<Clock3 size={11}/>{t.actual>0?`${duration(t.date?actualOn(data,t.id,t.date):t.actual)} / `:''}{duration(t.minutes)}</span></div>{(blocks.length > 0 || t.due) && <div className="task-bottom">{blocks.length > 0 ? <span><CalendarDays size={11}/>{timeLabel(blocks[0].start)}</span> : <span>Due {monthDay(t.due)}</span>}{!t.done && <button title="Focus on task" aria-label={`Focus on ${t.title}`} onClick={() => startFocus(t.id)}><Play size={11}/></button>}</div>}</article>; };
    const section = (d: string) => { const tasks = dayTasks(d), done = tasks.filter(t => t.done), remaining = tasks.filter(t => !t.done), isToday = d === today; return <section key={d} data-drop-day={d} className={`day-column ${isToday ? 'current-day' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => dropDay(e, d)}><button className="day-heading" onClick={() => setSelected(d)}><span><span className="eyebrow">{monthDay(d)}</span><strong>{dayName(d)}</strong></span><span className="column-total">{duration(tasks.reduce((n, t) => n + t.minutes, 0))}</span></button><div className="capacity-track"><span style={{ width: `${Math.min(100, workMinutes(data,d) / Math.max(1,capacity(data,d)) * 100)}%`, background: workMinutes(data,d) > capacity(data,d) ? '#d57753' : undefined }}/></div><button className="add-task" onClick={() => openTask(undefined, d)}><Plus size={15}/> Add a task <kbd>A</kbd></button><div className="task-stack">{remaining.map(card)}{!remaining.length && <div className="empty-day"><Sun size={24}/><p>{done.length ? 'A little breathing room.' : 'A fresh start.'}</p><span>{done.length ? 'Everything here is checked off.' : 'Add a task or drop one here.'}</span></div>}</div>{showCompleted && done.length > 0 && <details className="done-section" open><summary><ChevronDown size={12}/>Completed <span>{done.length}</span></summary>{done.map(card)}</details>}<button className="column-footer" onClick={() => { setSelected(d); setModal({ type: 'shutdown' }); }}><Moon size={12}/>{data.reflections[d] ? 'View daily reflection' : 'Reflect on your day'}</button></section>; };
    const now = zonedParts(Date.now(), data.settings.timezone!);
    const dueReminder=reminderDue(data,today,now.minute);
    const visibleBlocks = playlist ? scheduleDay(data, selected, { project: true, reschedule: true, from: selected === today ? now.minute : 0 }).blocks : data.blocks;
    const calendarBlocks = calendarItems(data,selected,{blocks:visibleBlocks,filter:filterTask,completed:showCompleted});
    const layoutBlocks: {
        b: CalendarItem;
        lane: number;
        count: number;
    }[] = [];
    let group: typeof layoutBlocks = [], end = 0;
    const finishGroup = () => { const count = Math.max(1, ...group.map(x => x.lane + 1)); group.forEach(x => layoutBlocks.push({ ...x, count })); group = []; };
    for (const b of calendarBlocks.filter(b=>!b.allDay)) {
        if (b.start >= end && group.length)
            finishGroup();
        const occupied = new Set(group.filter(x => x.b.start + Math.max(x.b.minutes,23/64*60) > b.start).map(x => x.lane));
        let lane = 0;
        while (occupied.has(lane))
            lane++;
        group.push({ b, lane, count: 1 });
        end = Math.max(b.start + Math.max(b.minutes,23/64*60), group.length === 1 ? 0 : end);
    }
    finishGroup();
    const navigateDate=(direction:number)=>{if(view==='analytics'||view==='review'||view==='objectives')return shiftDate(selected,7*direction);if(view==='home'&&layout==='month'){const d=fromKey(selected);return dateKey(new Date(d.getFullYear(),d.getMonth()+direction,1));}return shiftDate(selected,direction*(view==='home'?(layout==='board'||layout==='three'?3:layout==='week'||layout==='weekdays'?7:1):1));};
    const backlogTasks=liveTasks.filter(t=>!t.date&&!t.done&&filterTask(t)&&(folderFilter==='all'||(folderFilter==='none'?!t.folder:t.folder===folderFilter))&&(priorityFilter==='all'||(t.backlogPriority||'none')===priorityFilter)).sort((a,b)=>['urgent','high','medium','low','none'].indexOf(a.backlogPriority||'none')-['urgent','high','medium','low','none'].indexOf(b.backlogPriority||'none'));
    const backlogFilters=<BacklogFilters data={data} bucket={bucketFilter} folder={folderFilter} priority={priorityFilter} setBucket={setBucketFilter} setFolder={setFolderFilter} setPriority={setPriorityFilter}/>;
    const panelClose=<IconButton className="right-panel-close" label="Collapse right sidebar" onClick={()=>{setCalendar(false);setMobileCalendar(false);}}><PanelRightClose size={16}/></IconButton>;
    const calendarsMenu=<CalendarMenu data={data} connection={google} onChange={change} onManage={()=>{setIntegrationTab('google');setModal({type:'integrations'});}}/>;
    const integrationTiles=<>{([['google',CalendarDays,'Google Calendar',google.status?.connected?(google.status.canPublish?'Connected · Read and write':'Connected · Read only'):'Connect your calendar'],['ics',Upload,'Calendar files','Import an ICS file from another calendar'],['sunsama',Download,'Sunsama import','Import tasks and history from your export']] as const).map(([id,Icon,title,description])=><button className="integration-tile" key={id} onClick={()=>{setIntegrationTab(id);setModal({type:'integrations'});}}><Icon size={21}/><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={15}/></button>)}</>;
    return <div className={`app-shell view-${view} ${leftCollapsed?'sidebar-collapsed':''} ${draggingId ? 'is-dragging' : ''}`}>
 <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}><IconButton className="sidebar-collapse" label="Collapse left sidebar" onClick={()=>setLeftCollapsed(true)}><PanelLeftClose size={16}/></IconButton><button className="brand" onClick={() => { go('home'); setSelected(today); }}><span className="brand-sun"><Sun size={24}/></span><span>Daylight</span><ChevronDown size={13}/></button><button className="workspace"><span className="avatar">{name[0]?.toUpperCase() || 'R'}</span><span>My workspace<small>Just a little more intentional.</small></span></button><button className="search-launch" onClick={() => setModal({ type: 'search' })}><Search size={14}/><span>Search anything</span><kbd>/</kbd></button><nav className="main-nav">{([['home', House, 'Home', 'H'], ['today', Sun, 'Today', 'T'], ['backlog', Inbox, 'Backlog', 'B']] as const).map(([v, Icon, label, key]) => <button key={v} className={view === v ? 'active' : ''} onClick={() => go(v)}><Icon size={16}/>{label}<span>{v === 'backlog' ? liveTasks.filter(t => !t.date && !t.done).length : <kbd>{key}</kbd>}</span></button>)}<BacklogFolders data={data} selected={view==='backlog'?folderFilter:''} onChange={change} onSelect={id=>{go('backlog');setFolderFilter(id);}}/><button onClick={()=>startFocus()}><Coffee size={16}/>Focus<span><kbd>F</kbd></span></button><div className="nav-section-label">Daily rituals</div><button onClick={() => { setPlanStep(0); setModal({ type: 'plan' }); }}><ListTodo size={16}/>Daily planning<span><kbd>P</kbd></span></button><button onClick={()=>setModal({type:'shutdown'})}><Moon size={16}/>Daily shutdown<span><kbd>O</kbd></span></button><div className="nav-section-label">Capture & plan</div><button onClick={() => setModal({ type: 'quick' })}><Plus size={16}/>Quick capture<span><kbd>Q</kbd></span></button><button onClick={() => setModal({ type: 'assistant' })}><Sparkles size={16}/>AI assistant</button><div className="nav-section-label">Weekly rituals</div><button onClick={() => setModal({ type: 'weekly' })}><CalendarDays size={16}/>Weekly planning</button><button onClick={() => go('objectives')} className={view === 'objectives' ? 'active' : ''}><Target size={16}/>Weekly objectives</button><button onClick={() => go('review')} className={view === 'review' ? 'active' : ''}><BarChart3 size={16}/>Weekly review</button><button onClick={()=>go('analytics')} className={view==='analytics'?'active':''}><BarChart3 size={16}/>Analytics</button><button onClick={()=>setModal({type:'integrations'})}><Link2 size={16}/>Integrations</button></nav>
 <div className="mini-calendar"><div className="month-label"><strong>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><span><IconButton label="Previous month" onClick={() => setCalMonth(dateKey(new Date(month.getFullYear(), month.getMonth() - 1, 1)))}><ChevronLeft size={13}/></IconButton><IconButton label="Next month" onClick={() => setCalMonth(dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)))}><ChevronRight size={13}/></IconButton></span></div><div className="month-grid">{(data.settings.weekStartsMonday ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((s, i) => <span className="weekday" key={i}>{s}</span>)}{monthDays.map(d => <button key={d} aria-label={monthDay(d)} className={`${d === selected ? 'selected' : ''} ${d === today ? 'today' : ''} ${fromKey(d).getMonth() !== month.getMonth() ? 'other-month' : ''}`} onClick={() => { setSelected(d); go('home'); }}>{fromKey(d).getDate()}{liveTasks.some(t => t.date === d && !t.done) && <i />}</button>)}</div></div>
 <div className="channels"><div className="sidebar-label"><span>CHANNELS</span><IconButton label="Manage channels" onClick={() => setModal({ type: 'settings' })}><Plus size={14}/></IconButton></div><button className={`channel-filter ${filter === 'all' ? 'chosen' : ''}`} onClick={() => setFilter('all')}><span className="all-dot"/>All channels<small>{liveTasks.filter(t => !t.done).length}</small></button>{[...new Set(data.channels.map(c => c.context))].map(context => <div key={context}><button className={`context-heading ${filter === context ? 'chosen' : ''}`} onClick={() => setFilter(filter === context ? 'all' : context)}><ChevronDown size={11}/>{context}</button>{data.channels.filter(c => c.context === context && !c.disabled).map(c => <button key={c.id} className={`channel-filter ${filter === c.id ? 'chosen' : ''}`} onClick={() => setFilter(filter === c.id ? 'all' : c.id)}><span style={{ background: c.color }}/>{c.name}<small>{liveTasks.filter(t => t.channel === c.id && !t.done).length || ''}</small></button>)}</div>)}</div>
 <div className="sidebar-bottom"><button onClick={() => go('archive')}><Archive size={15}/>Archive</button><button onClick={() => setModal({ type: 'settings' })}><Settings size={15}/>Settings<ArrowUpRight size={12}/></button><div className="sidebar-footnote"><span className="status-dot"/>Your space to slow down.<button aria-label="Keyboard shortcuts" onClick={() => setModal({ type: 'shortcuts' })}><Keyboard size={14}/></button></div></div></aside>
 <main className="main"><header className="topbar"><div className="breadcrumbs"><IconButton className="mobile-menu" label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={18}/></IconButton><House size={15}/><span>My workspace</span><ChevronRight size={12}/><strong>{({ analytics:'Analytics', home: 'Home', today: 'Today', backlog: 'Backlog', objectives: 'Weekly objectives', review: 'Weekly review', archive: 'Archive' })[view]}</strong></div><div className="topbar-right"><span className={`save-status ${saveError ? 'error' : ''}`}>{saving.current ? <LoaderCircle size={12}/> : saveError ? <AlertCircle size={12}/> : <CloudCheck size={13}/>}<span>{saveStatus}</span></span><IconButton label="Open search" onClick={() => setModal({ type: 'search' })}><Search size={17}/></IconButton><button className="tiny-avatar" onClick={() => setModal({ type: 'settings' })}>{name[0]?.toUpperCase()}</button></div></header>
 {saveError && <div className="save-error" role="alert"><AlertCircle size={15}/><span>{saveError}</span><button onClick={exportData}>Export draft</button>{!blocked.current && <button onClick={() => flush()}>Retry save</button>}{blocked.current && <button onClick={loadLatest}>Load latest saved planner</button>}</div>}
 {recoveredDrafts.length > 0 && <div className="draft-recovery" role="status"><span>An older local draft was preserved separately. You’re viewing the latest planner.</span><button onClick={() => download(`daylight-preserved-drafts-${today}.json`, JSON.stringify(recoveredDrafts.map(raw => { try { return JSON.parse(raw); } catch { return {raw}; } }), null, 2))}>Download preserved drafts</button></div>}
 {dueReminder && <div className="ritual-reminder" role="status"><Moon size={16}/><span>{dueReminder==='shutdown'?'Ready to close your day?':'Take a moment to plan your day.'}</span><button className="secondary" onClick={()=>{setSelected(today);setPlanStep(0);setModal({type:dueReminder==='shutdown'?'shutdown':'plan'});}}>Begin</button><button className="text-button" onClick={()=>change(s=>{s.reminderDismissals??={};s.reminderDismissals[`${today}:${dueReminder}`]=Date.now()+15*60000;})}>In 15 minutes</button><button className="icon" aria-label="Dismiss ritual reminder today" onClick={()=>change(s=>{s.reminderDismissals??={};s.reminderDismissals[`${today}:${dueReminder}`]=Date.now()+24*60*60000;})}><X size={14}/></button></div>}
 <div className="page-toolbar"><div className="title-group"><span className="eyebrow">{view === 'home' || view === 'today' ? 'ONE DAY AT A TIME' : 'MAKE ROOM FOR WHAT MATTERS'}</span><h1>{({ analytics:'Your time, in perspective.', home: 'A little structure. A lot of space.', today: 'Make today a good day.', backlog: 'Good things, for another day.', objectives: 'A week with intention.', review: 'Look how far you’ve come.', archive: 'Out of sight. Still here.' })[view]}</h1></div><div className="toolbar-actions"><button className="secondary focus-button" onClick={() => startFocus()}><Focus size={15}/>Focus</button><button className="primary" onClick={() => { setPlanStep(0); setModal({ type: 'plan' }); }}><Sun size={15}/>Plan your day<ArrowRight size={14}/></button></div></div>
 <div className="view-toolbar"><div className="date-nav"><IconButton className="left-expand" label={leftCollapsed?'Expand left sidebar':'Collapse left sidebar'} onClick={()=>setLeftCollapsed(!leftCollapsed)}>{leftCollapsed?<PanelLeftOpen size={16}/>:<PanelLeftClose size={16}/>}</IconButton><IconButton label="Previous dates" onClick={() => setSelected(navigateDate(-1))}><ChevronLeft size={16}/></IconButton><IconButton label="Next dates" onClick={() => setSelected(navigateDate(1))}><ChevronRight size={16}/></IconButton><strong>{view==='analytics'?`${monthDay(viewDays(selected,'week',data.settings.weekStartsMonday)[0])} – ${fromKey(viewDays(selected,'week',data.settings.weekStartsMonday)[6]).getDate()}`:view === 'review' || view === 'objectives' ? `${monthDay(weeks[0])} – ${fromKey(weeks[6]).getDate()}` : monthDay(selected)}</strong><button className="today-pill" onClick={() => { setSelected(today); setCalMonth(today); }}>Today</button></div><div className="view-controls"><span className={`compact-save ${saveError?'error':''}`} aria-live="polite">{saveStatus}</span>{data.tasks.some(t => t.sample) && <button className="sample-label" onClick={clearSamples} title="Remove the clearly marked example tasks">Sample tasks <span>· Start fresh</span></button>}{view==='home'&&layout!=='board'&&calendarsMenu}<ChannelFilter data={data} value={filter} onChange={setFilter}/>{(view==='home'||view==='today')&&<ViewOptions value={view==='today'?'board':layout} onChange={v=>{setView('home');setLayout(v);}} completed={showCompleted} onCompleted={setShowCompleted}/>}</div></div>
 <div className="workspace-body"><div className={`content-area ${view === 'today' ? 'single-day' : ''} ${mobileCalendar ? 'mobile-calendar-open' : ''}`}>{(view === 'home' || view === 'today') && <>{view === 'today' && <div className="today-summary"><span><Sun size={22}/> You have {duration(dayMinutes(selected))} planned.</span><p>{workMinutes(data,selected)>capacity(data,selected) ? 'A full day. Consider moving something to tomorrow.' : 'There’s room to do good work, and room to breathe.'}</p></div>}{view === 'today' ? <div className="board one-column">{section(selected)}</div> : layout==='board'?<DayBoard selected={selected} onSelect={setSelected} renderDay={section}/>:<CalendarWorkspace data={data} day={selected} layout={layout} filter={filterTask} completed={showCompleted} onEntry={item=>setModal({type:'calendar-entry',item})} onTask={id=>openTask(id)} onSelect={setSelected} onEvent={(id,start,day)=>setModal({type:'event',id,start,day})} onDrop={(id,day,start)=>change(s=>scheduleTask(s,id,day,start),true)}/>}</>}
 {view === 'backlog' && <div className="list-page"><div className="section-intro"><div><h2>{data.folders?.find(f=>f.id===folderFilter)?.name||'Backlog'}</h2><p>Capture now. Choose when it matters.</p></div><button className="secondary" onClick={()=>openTask(undefined,null)}><Plus size={15}/>Add to backlog</button></div>{backlogFilters}{buckets.filter(b=>bucketFilter==='all'||b===bucketFilter).map(bucket=>{const tasks=backlogTasks.filter(t=>(t.bucket||buckets[0])===bucket);return <section className="backlog-group" key={bucket}><div className="backlog-group-heading"><strong>{bucket}</strong><small>{tasks.length} tasks</small></div><div className="backlog-grid" data-drop-day="" onDragOver={e=>e.preventDefault()} onDrop={e=>dropDay(e,null)}>{tasks.map(card)}</div>{!tasks.length&&<p className="muted">No tasks match these filters.</p>}</section>;})}</div>}
 {view==='analytics'&&<Analytics data={data} day={selected} filter={filter}/>}
 {view === 'archive' && <div className="list-page"><div className="section-intro"><div><h2>Your archived tasks</h2><p>Everything you’ve put away. Restore a task whenever you need it.</p></div></div>{data.tasks.filter(t => t.archived && !t.deleted).map(t => <div className="archive-row" key={t.id}><Archive size={16}/><span>{t.title}</span><button className="secondary" onClick={() => change(s => { const n = s.tasks.find(n => n.id === t.id)!; n.archived = false; n.date = null; delete n.rolloverSince; n.rolloverCount = 0; }, true)}><RotateCcw size={13}/>Restore</button></div>)}<h3 className="settings-heading">Trash</h3>{data.tasks.filter(t => t.deleted).map(t => <div className="archive-row" key={t.id}><span>{t.title}</span><button className="secondary" onClick={() => change(s => { const n = s.tasks.find(n => n.id === t.id)!;if(n.mergedInto){const parent=s.tasks.find(p=>p.id===n.mergedInto),sub=parent?.subtasks.find(st=>st.mergedTaskId===n.id);if(parent&&sub)promoteSubtask(s,parent.id,sub.id);}delete n.deleted;n.archived=false;n.date=null; }, true)}>Restore to backlog</button></div>)}{!data.tasks.some(t => t.archived || t.deleted) && <div className="large-empty"><Archive size={35}/><h3>A clean slate.</h3><p>Archived tasks will stay here for safekeeping.</p></div>}</div>}
 {view === 'objectives' && <div className="list-page"><div className="section-intro"><div><h2>What would make this a good week?</h2><p>A few meaningful outcomes. Keep it simple.</p></div><button className="secondary" onClick={() => setModal({ type: 'objective' })}><Plus size={15}/>Add objective</button></div>{data.objectives.filter(o => (o.week === weekOf(selected) || o.weeks?.includes(weekOf(selected)))).map(o => { const linked = liveTasks.filter(t => t.objective === o.id), done = linked.filter(t => t.done).length; return <div className="objective-card" key={o.id}><div><button aria-label={`Complete objective ${o.title}`} className={`check ${o.done ? 'checked' : ''}`} onClick={() => change(s => { const ob = s.objectives.find(x => x.id === o.id)!; ob.done = !ob.done; })}>{o.done && <Check size={12}/>}</button><h3 className={o.done ? 'strike' : ''}>{o.title}</h3><button className="icon" aria-label={`Remove objective ${o.title}`} onClick={() => { change(s => { s.objectives = s.objectives.filter(x => x.id !== o.id); s.tasks.forEach(t => { if (t.objective === o.id)
        delete t.objective; }); }, true); notify('Objective removed. Undo is available.'); }}><X size={14}/></button></div><p>{linked.length ? `${done} of ${linked.length} linked tasks completed` : 'Link tasks from their task details to track progress.'}</p><div className="objective-progress"><span style={{ width: `${o.done ? 100 : linked.length ? done / linked.length * 100 : 0}%` }}/></div>{linked.map(t => <button className="linked-task" key={t.id} onClick={() => openTask(t.id)}>{t.done ? <CircleCheck size={14}/> : <span className="mini-check"/>}{t.title}<ArrowUpRight size={13}/></button>)}</div>; })}{!data.objectives.some(o => (o.week === weekOf(selected) || o.weeks?.includes(weekOf(selected)))) && <div className="large-empty"><Target size={35}/><h3>Give your week a little direction.</h3><p>Add your first objective above.</p></div>}</div>}
 {view === 'review' && <div className="list-page"><div className="section-intro"><div><h2>Progress, at your own pace.</h2><p>The small things add up. Here’s your week in perspective.</p></div></div><div className="review-stats"><div><span>Tasks completed</span><strong>{liveTasks.filter(t => t.done && weeks.includes(t.completedOn || t.date || '')).length}<small> little wins</small></strong></div><div><span>Focus time tracked</span><strong>{duration(weeks.reduce((n, d) => n + dailyActual(data, d), 0))}</strong></div><div><span>Weekly objectives</span><strong>{data.objectives.filter(o => (o.week === weekOf(selected) || o.weeks?.includes(weekOf(selected))) && o.done).length}<small> / {data.objectives.filter(o => (o.week === weekOf(selected) || o.weeks?.includes(weekOf(selected)))).length} achieved</small></strong></div></div><div className="review-chart"><h3>Your time, day by day</h3><div className="chart-legend"><span><i />Planned</span><span><i />Tracked</span></div><div className="chart-bars">{weeks.map(d => { const ts = liveTasks.filter(t => t.date === d), planned = ts.reduce((n, t) => n + t.minutes, 0), actual = dailyActual(data, d), max = Math.max(data.settings.capacity, ...weeks.map(d => dayMinutes(d)), ...weeks.map(d => dailyActual(data, d))); return <div className="chart-day" key={d}><div className="bar-pair"><div title={`${duration(planned)} planned`} style={{ height: `${planned / max * 100}%` }}/><div title={`${duration(actual)} tracked`} style={{ height: `${actual / max * 100}%` }}/></div><strong>{dayName(d).slice(0, 3)}</strong><span>{duration(actual)}</span></div>; })}</div></div><button className="secondary" onClick={() => setModal({ type: 'weekly' })}>Weekly reflection & planning</button>{data.weeklyReflections?.[weekOf(selected)] && <div className="reflection"><p>{data.weeklyReflections[weekOf(selected)]}</p></div>}<WeeklyBreakdown data={data} days={weeks}/><h3 className="reflection-heading">Moments worth remembering</h3>{weeks.filter(d => data.reflections[d]).map(d => <div className="reflection" key={d}><span>{dayName(d)}, {monthDay(d)}</span><p>{data.reflections[d]}</p></div>)}{!weeks.some(d => data.reflections[d]) && <p className="muted">Your daily reflections will appear here. Take a moment at the end of today.</p>}</div>}
 </div>
 {calendar && sidePanel==='calendar' && <aside className={`calendar-panel ${mobileCalendar ? 'mobile-show' : ''}`}><div className="calendar-heading">{calendarsMenu}{panelClose}</div><div className="calendar-date"><div><span className="calendar-date-num">{fromKey(selected).getDate()}</span><span><strong>{dayName(selected)}</strong><small>{monthDay(selected)}{selected === today ? ' · Today' : ''}</small></span></div><IconButton label="Create calendar event" onClick={() => setModal({ type: 'event', start: 540 })}><Plus size={16}/></IconButton></div><div className="calendar-subtitle"><span><i />My planner</span><button onClick={() => { let missed:string[] = []; change(s => { missed = scheduleDay(s, selected, { from: selected === today ? now.minute : 0 }).missed; }, true); setScheduleOverflow(missed); notify(missed.length ? `${missed.length} task${missed.length > 1 ? 's' : ''} didn’t fit before shutdown.` : 'Your tasks have a little space on the calendar.'); }}>Auto-schedule<Sparkles size={11}/></button></div>{scheduleOverflow.length>0&&<div className="schedule-overflow" role="status"><strong>{scheduleOverflow.length} task(s) need more room</strong><button onClick={()=>{let missed:string[]=[];change(s=>{for(const id of scheduleOverflow){const t=s.tasks.find(t=>t.id===id);if(t?.date)missed.push(...scheduleDay(s,t.date,{taskId:id,allowOutside:true,from:t.date===today?now.minute:0}).missed);}},true);setScheduleOverflow(missed);}}>Allow outside work hours</button><button onClick={()=>{change(s=>{for(const id of scheduleOverflow){const t=s.tasks.find(t=>t.id===id);if(t)moveTask(s,id,shiftDate(t.date||selected,1));}},true);setScheduleOverflow([]);}}>Defer to tomorrow</button></div>}<div className="playlist-controls"><label><input type="checkbox" checked={playlist} onChange={e => setPlaylist(e.target.checked)}/>Playlist preview</label><button onClick={() => { change(s => { scheduleDay(s, selected, { reschedule: true, from: selected === today ? now.minute : 0 }); }, true); setPlaylist(false); notify('Flexible sessions rescheduled. Fixed sessions stayed put.'); }}>Reflow day</button></div><div className="google-sync-bar"><button onClick={()=>setModal({type:'integrations'})}>{google.status?.connected?(google.error?'Google · needs attention':google.busy?'Google · refreshing…':'Google connected'):'Connect Google Calendar'}</button>{google.status?.connected&&<button disabled={google.busy} onClick={()=>void google.refresh()}>Refresh</button>}</div>{calendarBlocks.some(b=>b.allDay)&&<div className="all-day-events"><small>ALL DAY</small>{calendarBlocks.filter(b=>b.allDay).map(b=><button key={b.id} className={`calendar-layer-${b.layer}`} data-calendar-layer={b.layer} title={b.detail} style={calendarColors(b.color)} onClick={()=>b.taskId?openTask(b.taskId):setModal({type:'event',id:b.id})}>{b.completed&&<span className="calendar-completion-mark">✓</span>}{b.title}{b.layer==='actual-summary'&&<small> · {b.detail}</small>}</button>)}</div>}<div className="calendar-scroll" ref={calendarRef}><div className="timeline">{Array.from({ length: 24 }, (_, i) => i).map(h => <div className="hour-row" key={h} style={{ top: h * 64 }}><span>{data.settings.timeFormat==='24'?`${String(h).padStart(2,'0')}:00`:h%12||12}{data.settings.timeFormat!=='24'&&<small>{h>=12?'PM':'AM'}</small>}</span>{[0, 15, 30, 45].map(m => <button key={m} data-drop-time={h * 60 + m} data-drop-day={selected} className="time-slot" aria-label={`Add event at ${timeLabel(h * 60 + m)}`} style={{ top: m / 60 * 64 }} onClick={() => setModal({ type: 'event', start: h * 60 + m })} onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drop-target'); }} onDragLeave={e => e.currentTarget.classList.remove('drop-target')} onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drop-target'); const v = e.dataTransfer.getData('text/plain'); if (v.startsWith('task:'))
        change(s => scheduleTask(s, v.slice(5), selected, h * 60 + m), true); if (v.startsWith('block:'))
        change(s => { const b = s.blocks.find(b => b.id === v.slice(6)); if (b && !b.provider) {
            b.start = Math.min(1440 - b.minutes, h * 60 + m);
            b.date = selected;
            b.pinned = true;
        } }, true); }}/>)}</div>)}{layoutBlocks.map(({ b, lane, count }) => { const t = data.tasks.find(t => t.id === b.taskId); return <button key={b.id} onPointerDown={e=>{if(b.provider||b.virtual)return;if((e.target as HTMLElement).closest('.resize-grip')){resizing.current={id:b.id,y:e.clientY,minutes:b.minutes};e.currentTarget.setPointerCapture(e.pointerId);blockWasDragged.current=false;return;}blockPointer.current={x:e.clientX,y:e.clientY};blockWasDragged.current=false;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const r=resizing.current;if(r?.id===b.id)setResizePreview({id:b.id,minutes:Math.max(5,Math.min(1440-b.start,Math.round((r.minutes+(e.clientY-r.y)/64*60)/5)*5))});}} onPointerCancel={()=>{resizing.current=null;setResizePreview(null);blockPointer.current=null;}} onPointerUp={e=>{if(b.provider||b.virtual)return;const resize=resizing.current;if(resize?.id===b.id){resizing.current=null;setResizePreview(null);blockWasDragged.current=true;change(s=>resizeBlock(s,b.id,resize.minutes+(e.clientY-resize.y)/64*60),true);return;}const from=blockPointer.current;blockPointer.current=null;if(from&&Math.hypot(e.clientX-from.x,e.clientY-from.y)>6){blockWasDragged.current=true;const rect=calendarRef.current?.querySelector('.timeline')?.getBoundingClientRect();if(rect){const minute=b.start+Math.round((e.clientY-from.y)/64*60/15)*15;change(s=>{const target=s.blocks.find(n=>n.id===b.id);if(target){target.start=Math.max(0,Math.min(1440-target.minutes,minute));target.pinned=true;}},true);}}}} draggable={false} onDragStart={e => e.dataTransfer.setData('text/plain', `block:${b.id}`)} className={`calendar-event calendar-layer-${b.layer}`} data-calendar-layer={b.layer} data-virtual={b.virtual} title={b.detail|| (b.provider==='google'?'Google Calendar':undefined)} data-calendar-sources={b.sources?.map(s=>s.label).join(',')} style={{ top: b.start / 60 * 64, height: Math.max(20, (resizePreview?.id===b.id?resizePreview.minutes:b.minutes) / 60 * 64 - 3), left: `calc(48px + (100% - 59px) * ${lane / count})`, width: `calc((100% - 59px) / ${count} - 3px)`, ...calendarColors(b.color) }} onClick={() => {if(blockWasDragged.current){blockWasDragged.current=false;return;}b.sources ? setModal({type:'calendar-entry',item:b}) : b.taskId ? setModal({ type: 'sessions', id: b.taskId }) : setModal({ type: 'event', id: b.id });}}><strong>{b.completed && <span className="calendar-completion-mark">✓</span>}{t?.title || b.title}</strong>{b.minutes >= 30 && <span>{timeLabel(b.start)} – {timeLabel(b.start + b.minutes)}</span>}{b.minutes>=30&&(b.detail||b.provider==='google')&&<small className="calendar-layer-label">{b.detail||(b.provider==='google'?'Google Calendar':'')}</small>}{!b.provider&&!b.virtual&&<span className="resize-grip" aria-hidden="true" title="Drag to resize"/>}</button>; })}{selected === today && <div className="now-line" style={{ top: now.minute / 60 * 64 }}><i /></div>}<div className="shutdown-line" style={{ top: (data.shutdownTimes?.[selected]??data.settings.end) / 60 * 64 }}><Moon size={10}/><span>Time to wind down</span></div></div></div><div className="calendar-footer"><span><GripVertical size={12}/>Drag a task here to make time for it</span></div></aside>}
 {calendar&&sidePanel==='backlog'&&<aside className={`calendar-panel backlog-side ${mobileCalendar?'mobile-show':''}`}><div className="calendar-heading"><strong>Backlog</strong>{panelClose}</div><div className="backlog-side-heading"><button className="text-button" onClick={()=>go('backlog')}>Open full backlog<ArrowUpRight size={13}/></button><button className="icon" aria-label="Add backlog task" onClick={()=>openTask(undefined,null)}><Plus size={17}/></button></div>{backlogFilters}<div className="backlog-side-scroll" data-drop-day="" onDragOver={e=>e.preventDefault()} onDrop={e=>dropDay(e,null)}>{buckets.filter(b=>bucketFilter==='all'||b===bucketFilter).map(bucket=>{const tasks=backlogTasks.filter(t=>(t.bucket||buckets[0])===bucket);return <section className="backlog-bucket" key={bucket}><div className="bucket-heading"><strong>{bucket}</strong><span>{tasks.length}</span></div>{tasks.map(card)}{!tasks.length&&<p className="helper-text">No tasks match these filters.</p>}</section>;})}</div></aside>}
 {calendar&&sidePanel==='tasks'&&<aside className={`calendar-panel ${mobileCalendar?'mobile-show':''}`}><div className="calendar-heading"><strong>Tasks</strong>{panelClose}</div><div className="task-side-content">{section(selected)}</div></aside>}
 {calendar&&sidePanel==='objectives'&&<aside className={`calendar-panel ${mobileCalendar?'mobile-show':''}`}><div className="calendar-heading"><strong>Weekly objectives</strong>{panelClose}</div><div className="integration-side"><button className="secondary" onClick={()=>setModal({type:'objective'})}><Plus size={14}/>Add objective</button>{data.objectives.filter(o=>o.week===weekOf(selected)||o.weeks?.includes(weekOf(selected))).map(o=><label className="checkbox-label" key={o.id}><input type="checkbox" checked={o.done} onChange={e=>change(s=>{s.objectives.find(n=>n.id===o.id)!.done=e.target.checked;})}/>{o.title}</label>)}<button className="text-button" onClick={()=>go('objectives')}>Open objectives<ArrowUpRight size={14}/></button></div></aside>}
 {calendar&&sidePanel==='integrations'&&<aside className={`calendar-panel ${mobileCalendar?'mobile-show':''}`}><div className="calendar-heading"><strong>Integrations</strong>{panelClose}</div><div className="integration-side">{integrationTiles}<p className="helper-text">Your existing connections and imports. Additional providers can be connected later.</p></div></aside>}
 <nav className="right-rail" aria-label="Planner tools">{([['tasks',ListTodo,'Tasks'],['calendar',CalendarDays,'Calendar'],['backlog',Inbox,'Backlog'],['objectives',Target,'Objectives'],['integrations',Link2,'Integrations']] as const).map(([panel,Icon,label])=><button key={panel} title={label} aria-label={`${label} panel`} aria-pressed={calendar&&sidePanel===panel} onClick={()=>openSide(panel)}><Icon size={19}/></button>)}<span className="rail-divider"/><button title="Analytics" aria-label="Open analytics" onClick={()=>go('analytics')}><BarChart3 size={19}/></button><button title="Archive" aria-label="Open archive" onClick={()=>go('archive')}><Archive size={18}/></button><button title="Search" aria-label="Search tasks" onClick={()=>setModal({type:'search'})}><Search size={19}/></button><button title="AI assistant" aria-label="Open AI assistant" onClick={()=>setModal({type:'assistant'})}><Sparkles size={19}/></button><button className="rail-bottom" title="Keyboard shortcuts" aria-label="Open keyboard shortcuts" onClick={()=>setModal({type:'shortcuts'})}><Keyboard size={19}/></button></nav>
 </div><footer className="statusbar"><span><span className="status-dot"/>{todayDone} of {todays.length} tasks completed today</span><span>{data.settings.timezone?.replace('_', ' ')}<span className="footer-dot">·</span><button onClick={() => setModal({ type: 'shortcuts' })}>Keyboard shortcuts <kbd>?</kbd></button></span></footer></main>
 {activeTask && <div className="focus-bar"><span className="focus-pulse"/><button onClick={() => setModal({ type: 'focus' })}><small>IN FOCUS</small>{data.timer?.subtaskId?activeTask.subtasks.find(st=>st.id===data.timer!.subtaskId)?.title:activeTask.title}</button><strong>{timeString}</strong><IconButton label={data.timer?.started ? 'Pause timer' : 'Resume timer'} onClick={toggleTimer}>{data.timer?.started ? <Pause size={16}/> : <Play size={16}/>}</IconButton><IconButton label="Finish focus session" onClick={() => { change(s => finishTimer(s)); notify('Focus time saved.'); }}><X size={16}/></IconButton></div>}
 {draggingId && <div className="drag-instruction"><GripVertical size={15}/>Drop onto a day, another task, or a calendar time.</div>}
 {toast && <div className="toast" role="status"><Check size={15}/><span>{toast}</span>{undo.current && <button onClick={() => { const previous = undo.current; undo.current = null; if (previous)
        change(s => applyUndo(s, previous)); setToast('Change undone.'); }}>Undo</button>}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={13}/></button></div>}
 <input hidden type="file" ref={fileRef} accept=".json" onChange={onImport}/>
 {modal && <ModalShell label={modal.type === 'task' ? 'Task details' : modal.type === 'plan' ? 'Daily planning' : modal.type} taskDetails={modal.type === 'task'} wide={['plan', 'settings', 'focus', 'assistant', 'weekly', 'sessions'].includes(modal.type)} onClose={closeModal}>
 {modal.type === 'task' && <TaskDetails key={modal.id || 'new'} data={data} initial={modal.id ? data.tasks.find(t=>t.id===modal.id) : undefined} day={modal.day===undefined?selected:modal.day} today={today} author={name.split(' ')[0]||name} saveStatus={saveStatus} saveError={saveError} focusField={modal.focusField} onClose={closeModal} registerClose={handler=>{taskDetailsClose.current=handler;}}
 onSave={(draft,start,applyFuture,close=false)=>{const accepted=change(s=>{const old=s.tasks.find(t=>t.id===draft.id);if(!old&&!draft.date){if(folderFilter!=='all'&&folderFilter!=='none')draft={...draft,folder:folderFilter};if(bucketFilter!=='all')draft={...draft,bucket:bucketFilter};}const toggleDone=!!old&&old.done!==draft.done;saveTask(s,toggleDone?{...draft,done:old!.done}:draft,start,today,applyFuture);if(toggleDone)completeTask(s,draft.id,today);},true);if(accepted&&close){setModal(returnToPlan.current?{type:'plan'}:null);returnToPlan.current=false;}else if(accepted&&modal.type==='task'&&!modal.id)setModal({type:'task',id:draft.id});return accepted;}}
 onTimer={(draft,start,subId)=>{change(s=>{saveTask(s,draft,start,today);if(s.timer?.taskId===draft.id&&s.timer.subtaskId===subId&&s.timer.started)pauseTimer(s);else startTimer(s,draft.id,subId);});}}
 onSessions={id=>setModal({type:'sessions',id})}
 onMoveTop={draft=>{change(s=>{saveTask(s,draft,null,today);const moved=s.tasks.find(t=>t.id===draft.id)!;s.tasks=s.tasks.filter(t=>t.id!==draft.id);s.tasks.unshift(moved);},true);}}
 onDuplicate={(draft,start)=>{let id:string|undefined;const accepted=change(s=>{saveTask(s,draft,start,today);id=duplicateTask(s,draft.id,draft.date)?.id;},true);if(accepted&&id){setModal({type:'task',id});notify('Task duplicated.');}}}
 onDelete={id=>{const accepted=change(s=>{const found=s.tasks.find(t=>t.id===id);if(!found)return;if(s.timer?.taskId===id)finishTimer(s);found.deleted=new Date().toISOString();s.blocks=s.blocks.filter(b=>b.taskId!==id);},true);if(accepted){setModal(null);notify('Task moved to trash. Undo is available.');}}}
 onArchive={id=>{const accepted=change(s=>{s.tasks.find(t=>t.id===id)!.archived=true;s.blocks=s.blocks.filter(b=>b.taskId!==id);if(s.timer?.taskId===id)finishTimer(s);},true);if(accepted)setModal(null);}}
 onNavigate={(draft,start,direction)=>{let next:string|undefined;change(s=>{saveTask(s,draft,start,today);next=recurrenceNeighbor(s,draft.id,direction)?.id;},true);if(next)setModal({type:'task',id:next});else notify('No further occurrence in this series.');}}
 onPromote={(draft,start,subId)=>{let id:string|undefined;change(s=>{saveTask(s,draft,start,today);id=promoteSubtask(s,draft.id,subId)?.id;},true);if(id)setModal({type:'task',id});}}/>}
 {modal.type==='calendar-entry'&&<CalendarEntryDetails item={modal.item} data={data} onTask={id=>openTask(id)} onSessions={id=>setModal({type:'sessions',id})} onEvent={id=>setModal({type:'event',id})}/>}
 {modal.type === 'event' && data.blocks.find(b=>b.id===modal.id)?.provider==='google' && <GoogleEventDetails block={data.blocks.find(b=>b.id===modal.id)!} data={data} onChange={change}/>}
 {modal.type === 'event' && data.blocks.find(b=>b.id===modal.id)?.provider!=='google' && <EventEditor key={modal.id || 'new'} initial={data.blocks.find(b => b.id === (modal as any).id)} day={modal.day||selected} start={modal.start ?? 540} onSave={block => { change(s => { s.blocks = s.blocks.filter(b => b.id !== block.id); s.blocks.push(block); }, true); setModal(null); notify('Calendar event saved.'); }} onDelete={id => { change(s => { s.blocks = s.blocks.filter(b => b.id !== id); }, true); setModal(null); notify('Calendar event removed.'); }}/>}
 {modal.type === 'plan' && <div className="planning"><span className="dialog-eyebrow"><Sun size={16}/> YOUR DAILY RITUAL</span><h2>{['A fresh start.', 'What matters on this day?', 'Give your work some space.', 'Your day, with intention.'][planStep]}</h2><p className="modal-description">{['Take a breath. Let’s make a day that feels doable.', 'Choose a few things you want to move forward.', 'A realistic plan is a kind plan. Leave a little breathing room.', 'You have a plan. Now you can focus on one thing at a time.'][planStep]}</p><div className="steps">{['Look back', 'Choose tasks', 'Make time', 'Begin'].map((v, i) => <button key={v} className={i === planStep ? 'active' : i < planStep ? 'complete' : ''} onClick={() => setPlanStep(i)}><span>{i < planStep ? <Check size={12}/> : i + 1}</span>{v}</button>)}</div>
 {planStep === 0 && <div className="plan-body"><h3>Carry forward, or let it go.</h3><p className="muted">Unfinished tasks from earlier days</p>{liveTasks.filter(t => t.date && t.date < selected && !t.done).map(t => <div className="plan-row" key={t.id}><span>{t.title}<small>{monthDay(t.date!)}</small></span><button className="secondary" onClick={() => change(s => moveTask(s, t.id, selected), true)}>This day<ArrowRight size={12}/></button><button className="icon" aria-label={`Move ${t.title} to backlog`} onClick={() => change(s => moveTask(s, t.id, null), true)}><Inbox size={15}/></button></div>)}{!liveTasks.some(t => t.date && t.date < selected && !t.done) && <div className="plan-positive"><CircleCheck size={30}/><h3>No loose ends to carry.</h3><p>You’re starting with a little breathing room.</p></div>}</div>}
 {planStep === 1 && <div className="plan-body"><div className="section-intro"><h3>Your priorities for this day</h3><button className="text-button" onClick={() => openTask(undefined, selected)}><Plus size={13}/>New task</button></div>{liveTasks.filter(t=>t.date===selected).filter(t => !t.done).map(t => <div className="plan-row" key={t.id}><span>{t.title}</span><span className="muted">{duration(t.minutes)}</span><button className="icon" aria-label={`Move ${t.title} to tomorrow`} onClick={() => change(s => moveTask(s, t.id, shiftDate(selected, 1)), true)}><ArrowRight size={15}/></button></div>)}<h4 className="list-subheading">FROM YOUR BACKLOG</h4>{liveTasks.filter(t => !t.date && !t.done).map(t => <div className="plan-row" key={t.id}><span>{t.title}</span><button className="secondary" onClick={() => change(s => moveTask(s, t.id, selected), true)}><Plus size={12}/>This day</button></div>)}</div>}
 {planStep === 2 && <div className="plan-body"><label className="field">Shutdown time for this day<input aria-label="Daily shutdown time" type="time" value={inputTime(data.shutdownTimes?.[selected]??data.settings.end)} onInput={e=>{const v=e.currentTarget.value;if(v)change(s=>{s.shutdownTimes??={};s.shutdownTimes[selected]=parseTime(v);});}}/></label><div className="planning-capacity"><span>{duration(workMinutes(data, selected))}<small>work planned</small></span><span>{duration(capacity(data, selected))}<small>daily capacity</small></span></div><div className="capacity-track large"><span style={{ width: `${Math.min(100, workMinutes(data, selected) / Math.max(1, capacity(data, selected)) * 100)}%` }}/></div>{workMinutes(data, selected) > capacity(data, selected) && <p className="warning">This plan is over your daily capacity. Move a task to tomorrow for more breathing room.</p>}{liveTasks.filter(t=>t.date===selected).filter(t => !t.done).map(t => <div className="plan-row" key={t.id}><span>{t.title}</span><input aria-label={`Estimate for ${t.title}`} type="number" min="5" max="720" step="5" value={t.minutes} onChange={e => { const n = Number(e.target.value); if (n >= 5 && n <= 720)
                change(s => { s.tasks.find(n => n.id === t.id)!.minutes = n; s.blocks.forEach(b => { if (b.taskId === t.id&&s.blocks.filter(n=>n.taskId===t.id).length===1)
                    b.minutes = Math.min(n, 1440 - b.start); }); }); }}/><small>min</small></div>)}<button className="secondary full" onClick={() => { let missed = 0; change(s => { missed = scheduleDay(s,selected,{from:selected===today?now.minute:0}).missed.length; }, true); notify(missed ? `${missed} task(s) couldn’t fit in your work hours.` : 'Tasks scheduled around your existing events.'); }}><Sparkles size={14}/>Find time on my calendar</button></div>}
 {planStep === 3 && <div className="plan-positive"><span className="sun-illustration"><Sun size={48}/></span><h3>{liveTasks.filter(t=>t.date===selected).filter(t => !t.done).length} tasks. One good day.</h3><p>{duration(dayMinutes(selected))} of planned work, with a shutdown at {timeLabel(data.settings.end)}.<br />You don’t have to do everything. Just the next thing.</p></div>}
 <div className="modal-footer"><button className="text-button" onClick={() => planStep ? setPlanStep(planStep - 1) : setModal(null)}>{planStep ? 'Back' : 'Maybe later'}</button><button className="primary" onClick={() => { if (planStep < 3)
                setPlanStep(planStep + 1);
            else {
                change(s => { if (!s.planned.includes(selected))
                    s.planned.push(selected); });
                setSelected(selected);
                setView('today');
                setModal(null);
                notify('Your day is ready. One thing at a time.');
            } }}>{planStep === 3 ? 'Let’s begin' : 'Continue'}<ArrowRight size={15}/></button></div></div>}
 {modal.type === 'focus' && <FocusWorkspace data={data} day={selected} onChange={change} onNext={id => { if (id?.endsWith('|start')) {
            startFocus(id.slice(0, -6));
            return;
        } if (id)
            finish(id); const next = dataRef.current?.tasks.find(t => t.date === today && !t.done && !t.archived && !t.deleted); if (next)
            startFocus(next.id);
        else
            notify('Your focus queue is complete.'); }}/>}
 {modal.type === 'settings' && <><SettingsPanel data={data} onChange={change} onExport={exportData} onImport={() => fileRef.current?.click()} onCalendarExport={() => download(`daylight-calendar-${today}.ics`, exportCalendar(data), 'text/calendar')} onClearSamples={clearSamples}/><SunsamaImportPanel draft={data} hasConflict={!!saveError} onImport={importSunsama}/></>}
 {modal.type === 'search' && <div className="search-modal"><span className="dialog-eyebrow"><Search size={15}/> FIND A LITTLE CLARITY</span><input autoFocus className="search-input" placeholder="Search your tasks, notes, and subtasks…" value={query} onChange={e => setQuery(e.target.value)}/><div className="search-results">{data.tasks.filter(t => !t.deleted).filter(t => `${t.title} ${t.notes} ${t.subtasks.map(s => s.title).join(' ')}`.toLowerCase().includes(query.toLowerCase())).map(t => <button key={t.id} className="search-result" onClick={() => openTask(t.id)}>{t.done ? <CircleCheck size={16}/> : <span className="mini-check"/>}<div>{t.title}<small>{t.archived ? 'Archived' : t.date ? monthDay(t.date) : 'Backlog'}</small></div><span>{duration(t.minutes)}</span></button>)}{!data.tasks.some(t => `${t.title} ${t.notes} ${t.subtasks.map(s => s.title).join(' ')}`.toLowerCase().includes(query.toLowerCase())) && <p className="muted">No matching tasks. Try a different word.</p>}</div></div>}
 {modal.type === 'shutdown' && <><Highlights data={data} day={selected} onChange={change}/><Shutdown day={selected} data={data} onSave={(notes, roll) => { change(s => { s.reflections[selected] = notes; if (roll)
            s.tasks.filter(t => t.date === selected && !t.done && !t.archived).forEach(t => moveTask(s, t.id, shiftDate(selected, 1))); }, true); setModal(null); notify('Reflection saved. You’ve done enough for today.'); }}/></>}
 {modal.type === 'objective' && <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const input = new FormData(e.currentTarget).get('title') as string; if (!input.trim())
            return; change(s => s.objectives.push({ id: uid(), title: input.trim(), week: weekOf(selected), done: false })); setModal(null); }}><span className="dialog-eyebrow"><Target size={16}/> A LITTLE DIRECTION</span><h2>What matters this week?</h2><p className="modal-description">An outcome you want to make progress on.</p><label className="field">Weekly objective<input autoFocus name="title" required maxLength={500} placeholder="e.g. Get the first prototype into people’s hands"/></label><div className="modal-footer"><span className="muted">Week of {monthDay(weekOf(selected))}</span><button className="primary" type="submit">Add objective<Plus size={14}/></button></div></form>}
 {modal.type==='integrations'&&<div className="integration-hub"><span className="dialog-eyebrow"><Link2 size={16}/> YOUR CONNECTIONS</span><h2>Integrations</h2><div className="integration-hub-tabs">{([['google','Google Calendar'],['ics','Calendar files'],['sunsama','Sunsama import']] as const).map(([id,label])=><button key={id} aria-pressed={integrationTab===id} onClick={()=>setIntegrationTab(id)}>{label}</button>)}</div>{integrationTab==='google'&&<GoogleCalendarPanel connection={google} data={data} day={selected} beforePublish={async()=>{await flush();return !pending.current&&!saving.current&&!blocked.current;}}/>}{integrationTab==='ics'&&<CalendarImport data={data} onChange={change}/>} {integrationTab==='sunsama'&&<SunsamaImportPanel draft={data} hasConflict={!!saveError} onImport={importSunsama}/>}</div>}
 {modal.type === 'sessions' && <SessionsPanel data={data} id={modal.id} day={selected} onChange={change} onOpen={id=>openTask(id)}/>}
 {modal.type === 'quick' && <QuickCapture data={data} day={selected} onChange={change} onClose={() => setModal(null)}/>}
 {modal.type === 'weekly' && <WeeklyRitual data={data} day={selected} onChange={change}/>}
 {modal.type === 'assistant' && <AssistantPanel data={data} day={selected} onChange={change}/>}
 {modal.type === 'commands' && <div><span className="dialog-eyebrow">COMMAND PALETTE</span><input autoFocus className="search-input" placeholder="Find an action…" value={query} onChange={e => setQuery(e.target.value)}/>{([['Quick capture', 'quick'], ['Plan the day', 'plan'], ['Focus', 'focus'], ['AI assistant', 'assistant'], ['Weekly planning', 'weekly'], ['Calendar connections', 'integrations'], ['Settings', 'settings'], ['Search tasks', 'search']] as const).filter(([label]) => label.toLowerCase().includes(query.toLowerCase())).map(([label, type]) => <button key={type} className="search-result" onClick={() => { setQuery(''); setModal({ type }); }}>{label}<ArrowRight size={14}/></button>)}</div>}
 {modal.type==='shortcuts'&&<Shortcuts enabled={data.settings.shortcuts!==false} onToggle={enabled=>change(s=>{s.settings.shortcuts=enabled;})}/> }
 </ModalShell>}
 </div>;
}
function EventEditor({ initial, day, start, onSave, onDelete }: {
    initial?: Block;
    day: string;
    start: number;
    onSave: (b: Block) => void;
    onDelete: (id: string) => void;
}) { const [b, setB] = useState<Block>(() => initial || { id: uid(), title: '', date: day, start, minutes: 30, color: '#779bc1' }); return <form onSubmit={e => { e.preventDefault(); if (b.title.trim())
    onSave({ ...b, title: b.title.trim() }); }}><span className="dialog-eyebrow"><CalendarPlus size={16}/>A PLACE IN YOUR DAY</span><h2>{initial ? 'Edit event' : 'Make a little time.'}</h2><label className="field">Event title<input autoFocus value={b.title} required maxLength={500} placeholder="What’s happening?" onChange={e => setB({ ...b, title: e.target.value })}/></label><div className="editor-grid"><label className="field">Date<input type="date" value={b.date} required onInput={e => setB({ ...b, date: e.currentTarget.value })}/></label><label className="field">Start time<input type="time" value={inputTime(b.start)} required max={inputTime(1440 - b.minutes)} onInput={e => setB({ ...b, start: parseTime(e.currentTarget.value) })}/></label><label className="field">Duration (minutes)<input type="number" value={b.minutes} min={5} max={1440 - b.start} step={5} required onChange={e => setB({ ...b, minutes: Number(e.target.value) })}/></label><label className="field">Color<input className="color-field" type="color" value={b.color} onChange={e => setB({ ...b, color: e.target.value })}/></label></div><label className="checkbox-label"><input type="checkbox" checked={b.busy!==false} onChange={e=>setB({...b,busy:e.target.checked})}/>Blocks time for task scheduling</label><p className="helper-text">Saved to your Daylight calendar. External calendars aren’t synced.</p><div className="modal-footer">{initial ? <button type="button" className="text-button" onClick={() => onDelete(b.id)}>Remove event</button> : <span />}<button className="primary" type="submit">Save event<Check size={14}/></button></div></form>; }
function Shutdown({ day, data, onSave }: {
    day: string;
    data: State;
    onSave: (notes: string, roll: boolean) => void;
}) { const [notes, setNotes] = useState(data.reflections[day] || ''), [roll, setRoll] = useState(false); const ts = data.tasks.filter(t => !t.archived && t.date === day); return <form onSubmit={e => { e.preventDefault(); onSave(notes, roll); }}><span className="dialog-eyebrow"><Moon size={16}/>CLOSE THE DAY WITH CARE</span><h2>{data.settings.closingMessage||"You’ve done enough for today."}</h2><p className="modal-description">{ts.filter(t => t.done).length} tasks completed · {duration(dailyActual(data,day))} tracked<br />{dayName(day)}, {monthDay(day)}</p><label className="field">What went well? What’s on your mind?<textarea autoFocus rows={6} value={notes} maxLength={10000} placeholder="A small win. A lesson. Something to leave behind…" onChange={e => setNotes(e.target.value)}/></label>{ts.some(t => !t.done) && <label className="checkbox-label"><input type="checkbox" checked={roll} onChange={e => setRoll(e.target.checked)}/>Move unfinished tasks to tomorrow</label>}<div className="modal-footer"><span className="muted">Rest is part of the work.</span><button className="primary" type="submit">Save reflection<Moon size={14}/></button></div></form>; }
function SettingsPanel({ data, onChange, onExport, onImport, onCalendarExport, onClearSamples }: {
    data: State;
    onChange: (f: (s: State) => void, u?: boolean) => void;
    onExport: () => void;
    onImport: () => void;
    onCalendarExport: () => void;
    onClearSamples: () => void;
}) { const [settings, setSettings] = useState(data.settings), [channelName, setChannelName] = useState(''), [context, setContext] = useState<'Work' | 'Personal'>('Work'), [color, setColor] = useState('#709b8d'), [message, setMessage] = useState(''); useEffect(() => setSettings(data.settings), [data.settings]); return <div><span className="dialog-eyebrow"><SlidersHorizontal size={16}/>MAKE YOURSELF AT HOME</span><h2>A planner that fits your day.</h2><form onSubmit={e => { e.preventDefault(); onChange(s => { s.settings = settings; }); setMessage('Preferences saved.'); }}><h3 className="settings-heading">Your workday</h3><div className="editor-grid"><label className="field">Start the day<input required type="time" value={inputTime(settings.start)} max={inputTime(settings.end - 1)} onInput={e => setSettings({ ...settings, start: parseTime(e.currentTarget.value) })}/></label><label className="field">Time to shut down<input required type="time" value={inputTime(settings.end)} min={inputTime(settings.start + 1)} onInput={e => setSettings({ ...settings, end: parseTime(e.currentTarget.value) })}/></label><label className="field">Daily capacity (minutes)<input type="number" required min={30} max={1440} step={15} value={settings.capacity} onChange={e => setSettings({ ...settings, capacity: Number(e.target.value) })}/></label><label className="field">Calendar starts on<select value={settings.weekStartsMonday ? 'monday' : 'sunday'} onChange={e => setSettings({ ...settings, weekStartsMonday: e.target.value === 'monday' })}><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label></div><div className="settings-save"><span role="status">{message}</span><button className="primary" type="submit">Save preferences</button></div></form><h3 className="settings-heading">Channels</h3><div className="settings-channels">{data.channels.map(c => <span key={c.id}><i style={{ background: c.color }}/>{c.name}<small>{c.context}</small></span>)}</div><form className="channel-form" onSubmit={e => { e.preventDefault(); if (channelName.trim()) {
    onChange(s => s.channels.push({ id: uid(), name: channelName.trim(), color, context }));
    setChannelName('');
} }}><input aria-label="Channel name" value={channelName} required maxLength={100} placeholder="New channel name" onChange={e => setChannelName(e.target.value)}/><select aria-label="Channel context" value={context} onChange={e => setContext(e.target.value as 'Work' | 'Personal')}><option>Work</option><option>Personal</option></select><input aria-label="Channel color" type="color" value={color} onChange={e => setColor(e.target.value)}/><button className="secondary" type="submit"><Plus size={14}/>Add</button></form><AdvancedSettings data={data} onChange={onChange}/><PlanningPreferences data={data} onChange={onChange}/><h3 className="settings-heading">Your data, always yours</h3><p className="muted">Tasks and settings are saved to your private account. Times stay in your saved planner timezone across devices.</p><div className="data-actions"><button className="secondary" onClick={onExport}><Download size={14}/>Export backup</button><button className="secondary" onClick={onImport}><Upload size={14}/>Merge backup</button><button className="secondary" onClick={onCalendarExport}><CalendarDays size={14}/>Export calendar</button></div>{data.tasks.some(t => t.sample) && <button className="text-button clear-samples" onClick={onClearSamples}>Remove sample tasks and events</button>}<div className="settings-footer"><span>Daylight · Built around your day</span><a href="/signout-with-chatgpt?return_to=/" target="_top"><LogOut size={13}/>Sign out</a></div></div>; }
