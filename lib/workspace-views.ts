import { dateKey, fromKey, shiftDate, type State } from './planner-model.ts';
export type CalendarLayout = 'board' | 'day' | 'three' | 'weekdays' | 'week' | 'month';
export const layouts: [CalendarLayout,string][] = [['board','Board'],['day','Calendar · One day'],['three','Calendar · Three days'],['weekdays','Calendar · Weekdays'],['week','Calendar · Week'],['month','Calendar · Month']];
export function viewDays(day:string, layout:CalendarLayout, monday=true):string[] {
  if(layout==='month') {const d=fromKey(day),first=dateKey(new Date(d.getFullYear(),d.getMonth(),1)),offset=(fromKey(first).getDay()+(monday?6:0))%7;return Array.from({length:42},(_,i)=>shiftDate(first,i-offset));}
  const offset=(fromKey(day).getDay()+(monday||layout==='weekdays'?6:0))%7;
  const start=layout==='week'||layout==='weekdays'?shiftDate(day,-offset):day;
  return Array.from({length:layout==='week'?7:layout==='weekdays'?5:layout==='three'?3:1},(_,i)=>shiftDate(start,i));
}
export function analyticsRows(state:State,days:string[],filter='all') {
  const matches=(id:string)=>filter==='all'||id===filter||state.channels.find(c=>c.id===id)?.context===filter;
  const tasks=state.tasks.filter(t=>!t.deleted&&matches(t.channel));
  const entries=state.sessions||[],sessionTasks=new Set(entries.map(s=>s.taskId));
  return days.map(day=>{
    const channels:Record<string,number>={};
    for(const session of entries) if(session.day===day&&matches(session.channel)&&state.tasks.some(t=>t.id===session.taskId&&!t.deleted))channels[session.channel]=(channels[session.channel]||0)+session.seconds/60;
    // Old backups may contain task totals without session history. Never count both.
    for(const t of tasks)if(!sessionTasks.has(t.id)&&(t.completedOn||t.date)===day&&t.actual)channels[t.channel]=(channels[t.channel]||0)+t.actual;
    return {day,channels,actual:Object.values(channels).reduce((a,b)=>a+b,0),planned:tasks.filter(t=>t.date===day).reduce((n,t)=>n+t.minutes,0),completed:tasks.filter(t=>t.done&&(t.completedOn||t.date)===day).length};
  });
}
export function analyticsCsv(rows:ReturnType<typeof analyticsRows>,state:State) {
  const esc=(v:string)=>'"'+v.replaceAll('"','""')+'"';
  return ['Date,Channel,Actual minutes,Planned minutes,Completed tasks',...rows.flatMap(row=>[`${row.day},Total,${row.actual.toFixed(2)},${row.planned},${row.completed}`,...Object.entries(row.channels).map(([id,m])=>`${row.day},${esc(state.channels.find(c=>c.id===id)?.name||'Uncategorized')},${m.toFixed(2)},,`)])].join('\r\n');
}
