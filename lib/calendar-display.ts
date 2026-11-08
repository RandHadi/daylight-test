import {type State,type Task,type Block,shiftDate,duration} from './planner-model.ts';
import {scheduleDay} from './planner-advanced.ts';
import {zonedParts,wallToEpoch} from './calendar-time.ts';

export type CalendarDisplay = {
  local: boolean;
  projections: boolean;
  actual: boolean;
  comparison: boolean;
  completions: boolean;
  hiddenGoogleCalendars: string[];
};
export const defaultCalendarDisplay:CalendarDisplay={local:true,projections:true,actual:true,comparison:true,completions:true,hiddenGoogleCalendars:[]};
export function calendarDisplay(s:State):CalendarDisplay{return {...defaultCalendarDisplay,...s.settings.calendarDisplay};}
export type CalendarSource={id:string;label:string;detail?:string};
export type CalendarItem=Block & {layer:'event'|'scheduled'|'projection'|'planned'|'actual'|'actual-summary'|'completion';virtual?:boolean;completed?:boolean;detail?:string;sources?:CalendarSource[];googleEventId?:string};

const slot=(b:Block)=>JSON.stringify([b.date,b.start,b.minutes,!!b.allDay]);
const matchingSlot=(b:Block)=>slot(b)+b.title.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const source=(b:CalendarItem):CalendarSource=>({id:b.id,label:b.provider==='google'?'Google Calendar':b.layer==='actual'?'Actual time':'Planned time',detail:b.detail});
function combined(rows:CalendarItem[]):CalendarItem{
  const base=rows.find(b=>b.layer==='actual')||rows.find(b=>b.taskId)||rows[0];
  const sources=rows.flatMap(b=>b.sources||[source(b)]).sort((a,b)=>['Google Calendar','Planned time','Actual time'].indexOf(a.label)-['Google Calendar','Planned time','Actual time'].indexOf(b.label));
  return {...base,virtual:true,sources,googleEventId:rows.find(b=>b.provider==='google')?.id||base.googleEventId,detail:[...new Set(sources.map(s=>s.label.replace(' Calendar','').replace(' time','')))].join(' · ')};
}
/** Collapse exact display matches only; source records and time ledgers stay independent. */
export function combineCalendarItems(items:CalendarItem[]):CalendarItem[]{
  const taskGroups=new Map<string,CalendarItem[]>(),other:CalendarItem[]=[];
  for(const b of items){
    if(!b.taskId||b.allDay||!['scheduled','planned','projection','actual'].includes(b.layer)||(b.layer==='projection'&&b.virtual)){other.push(b);continue;}
    const key=b.taskId+slot(b);taskGroups.set(key,[...(taskGroups.get(key)||[]),b]);
  }
  // Repeated records for one task at the exact same interval share a visual card.
  // Keep every source in its detail view; never combine different tasks or intervals.
  for(const group of taskGroups.values())other.push(...(group.length>1?[combined(group)]:group));
  const exactGroups=new Map<string,CalendarItem[]>();
  for(const b of other){const key=matchingSlot(b);exactGroups.set(key,[...(exactGroups.get(key)||[]),b]);}
  const result:CalendarItem[]=[];
  for(const group of exactGroups.values()){
    const events=group.filter(b=>b.provider==='google'&&!b.busyOnly),tasks=group.filter(b=>b.taskId&&!b.allDay&&!(b.layer==='projection'&&b.virtual));
    // Two calendars or two tasks with the same title/time are ambiguous: keep them separate.
    if(events.length===1&&tasks.length===1){const pair=new Set([events[0],tasks[0]]);result.push(combined([...pair]),...group.filter(b=>!pair.has(b)));}
    else result.push(...group);
  }
  return result.sort((a,b)=>a.start-b.start);
}

/** Display-only layers. Hiding a calendar never changes saved blocks or busy time. */
export function calendarItems(s:State,day:string,{filter=()=>true,completed=true,now=Date.now(),blocks=s.blocks}:{filter?:(t:Task)=>boolean;completed?:boolean;now?:number;blocks?:Block[]}={}):CalendarItem[]{
  const prefs=calendarDisplay(s),zone=s.settings.timezone||'UTC',today=zonedParts(now,zone),tasks=new Map(s.tasks.map(t=>[t.id,t]));
  const allowed=(t:Task|undefined)=>!!t&&!t.deleted&&(completed||!t.done)&&filter(t);
  const actual:CalendarItem[]=[],summary=new Map<string,number>();
  if(prefs.actual){
    const start=wallToEpoch(day,0,zone),end=wallToEpoch(shiftDate(day,1),0,zone);
    const entries=[...(s.sessions||[])];
    const active=s.timer,t=active&&tasks.get(active.taskId);
    if(active&&t){for(const [i,segment]of [...(active.segments||[]),...(active.started?[{start:active.started,end:now}]:[])].entries())entries.push({id:`running:${i}`,taskId:t.id,title:t.title,channel:t.channel,day,started:segment.start,ended:segment.end,seconds:(segment.end-segment.start)/1000,kind:'timer'});}
    for(const e of entries){
      const t=tasks.get(e.taskId);if(!allowed(t)||e.seconds<=0)continue;
      if(!e.started||e.ended<=e.started){if(e.day===day)summary.set(t!.id,(summary.get(t!.id)||0)+e.seconds/60);continue;}
      const a=Math.max(start,e.started),b=Math.min(end,e.ended);if(b<=a)continue;
      const at=zonedParts(a,zone).minute,to=b===end?1440:zonedParts(b,zone).minute;
      // A fall-back clock change can repeat an hour; keep the displayed interval positive.
      const minutes=Math.max(1,Math.min(1440-at,to>at?to-at:Math.ceil((b-a)/60000)));
      actual.push({id:`actual:${e.id}:${day}`,taskId:t!.id,title:t!.title,date:day,start:at,minutes,color:s.channels.find(c=>c.id===t!.channel)?.color||'#709b8d',layer:'actual',virtual:true,completed:prefs.completions&&t!.done,detail:`${duration(e.seconds/60*(b-a)/(e.ended-e.started))} actual`});
    }
    for(const [id,minutes]of summary){const t=tasks.get(id)!;actual.push({id:`actual-summary:${id}:${day}`,taskId:id,title:t.title,date:day,start:0,minutes:1,allDay:true,color:s.channels.find(c=>c.id===t.channel)?.color||'#709b8d',layer:'actual-summary',virtual:true,completed:prefs.completions&&t.done,detail:`${duration(minutes)} actual · time not recorded`});}
  }
  // A day total without timestamps cannot replace a scheduled interval.
  const actualTasks=new Set(actual.filter(b=>b.layer==='actual').map(b=>b.taskId));
  const dayBlocks=blocks.filter(b=>b.date===day);
  const plannedTasks=new Map<string,Set<string>>(),googleCounts=new Map<string,number>(),visibleEventTasks=new Set<string>();
  for(const b of dayBlocks){
    if(b.allDay||b.busyOnly)continue;
    const key=matchingSlot(b);
    if(b.provider==='google')googleCounts.set(key,(googleCounts.get(key)||0)+1);
    else if(b.taskId)plannedTasks.set(key,new Set([...(plannedTasks.get(key)||[]),b.taskId]));
  }
  const items=blocks.filter(b=>b.date===day).flatMap<CalendarItem>(b=>{
    if(b.provider==='google'){
      if(prefs.hiddenGoogleCalendars.includes(b.externalCalendarId||''))return [];
      const key=matchingSlot(b),matches=plannedTasks.get(key);
      // Only a unique matching timebox establishes a link; unrelated meetings stay visible.
      const linkedTask=b.taskId||(googleCounts.get(key)===1&&matches?.size===1?[...matches][0]:undefined);
      if(!prefs.comparison&&linkedTask&&actualTasks.has(linkedTask))return [];
      const t=linkedTask?tasks.get(linkedTask):undefined;
      if(allowed(t))visibleEventTasks.add(t!.id);
      return [{...b,layer:'event' as const,completed:prefs.completions&&allowed(t)&&t!.done}];
    }
    if(!b.taskId)return prefs.local?[{...b,layer:'event' as const}]:[];
    const t=tasks.get(b.taskId);if(!prefs.local||!allowed(t))return [];
    if(actualTasks.has(t!.id))return prefs.comparison?[{...b,title:t!.title,layer:'planned' as const,completed:prefs.completions&&t!.done,detail:`${duration(b.minutes)} planned`}]:[];
    return [{...b,title:t!.title,layer:'scheduled' as const,completed:prefs.completions&&t!.done,detail:`${duration(b.minutes)} scheduled`}];
  });
  if(prefs.projections&&day>=today.day){
    // Reuse the scheduler on a small copy; generated projections are never saved.
    const scope:State={...s,tasks:s.tasks.filter(t=>t.date===day&&!t.archived&&!t.deleted),blocks:blocks.filter(b=>b.date===day),sessions:[],series:[]};
    const saved=new Set(scope.blocks.map(b=>b.id));
    for(const b of scheduleDay(scope,day,{project:true,from:day===today.day?today.minute:0}).blocks){if(saved.has(b.id)||!allowed(tasks.get(b.taskId||'')))continue;items.push({...b,id:`projection:${b.taskId}:${day}:${b.start}`,layer:'projection',virtual:true,detail:'Projected · not scheduled'});}
  }
  items.push(...actual);
  if(prefs.completions&&completed){for(const t of s.tasks){if(!allowed(t)||!t.done||(t.completedOn||t.date)!==day||visibleEventTasks.has(t.id)||items.some(b=>b.taskId===t.id))continue;items.push({id:`completed:${t.id}:${day}`,taskId:t.id,title:t.title,date:day,start:0,minutes:1,allDay:true,color:s.channels.find(c=>c.id===t.channel)?.color||'#709b8d',layer:'completion',virtual:true,completed:true,detail:'Completed'});}}
  return combineCalendarItems(items);
}
