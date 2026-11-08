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
export type CalendarItem=Block & {layer:'event'|'projection'|'planned'|'actual'|'actual-summary'|'completion';virtual?:boolean;completed?:boolean;detail?:string};

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
  const actualTasks=new Set(actual.map(b=>b.taskId));
  const items=blocks.filter(b=>b.date===day).flatMap<CalendarItem>(b=>{
    if(b.provider==='google')return prefs.hiddenGoogleCalendars.includes(b.externalCalendarId||'')?[]:[{...b,layer:'event' as const}];
    if(!b.taskId)return prefs.local?[{...b,layer:'event' as const}]:[];
    const t=tasks.get(b.taskId);if(!allowed(t))return [];
    if(actualTasks.has(t!.id))return prefs.comparison?[{...b,title:t!.title,layer:'planned' as const,completed:prefs.completions&&t!.done,detail:`${duration(b.minutes)} planned`}]:[];
    if(t!.done)return prefs.completions?[{...b,title:t!.title,layer:'planned' as const,completed:true,detail:`${duration(b.minutes)} planned`}]:[];
    return prefs.projections&&!t!.archived?[{...b,title:t!.title,layer:'projection' as const,detail:`${duration(b.minutes)} planned`}]:[];
  });
  if(prefs.projections&&day>=today.day){
    // Reuse the scheduler on a small copy; generated projections are never saved.
    const scope:State={...s,tasks:s.tasks.filter(t=>t.date===day&&!t.archived&&!t.deleted),blocks:blocks.filter(b=>b.date===day),sessions:[],series:[]};
    const saved=new Set(scope.blocks.map(b=>b.id));
    for(const b of scheduleDay(scope,day,{project:true,from:day===today.day?today.minute:0}).blocks){if(saved.has(b.id)||!allowed(tasks.get(b.taskId||'')))continue;items.push({...b,id:`projection:${b.taskId}:${day}:${b.start}`,layer:'projection',virtual:true,detail:'Projected · not scheduled'});}
  }
  items.push(...actual);
  if(prefs.completions&&completed){for(const t of s.tasks){if(!allowed(t)||!t.done||(t.completedOn||t.date)!==day||items.some(b=>b.taskId===t.id))continue;items.push({id:`completed:${t.id}:${day}`,taskId:t.id,title:t.title,date:day,start:0,minutes:1,allDay:true,color:s.channels.find(c=>c.id===t.channel)?.color||'#709b8d',layer:'completion',virtual:true,completed:true,detail:'Completed'});}}
  return items.sort((a,b)=>a.start-b.start);
}
