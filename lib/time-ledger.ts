import type {State, TimeEntry} from './planner-model.ts';

/** One reporting ledger: keep archived history, exclude deleted/orphan records,
 * and use legacy totals only when a task has no saved session history. */
export function reportingEntries(state:State):TimeEntry[] {
  const tasks=new Map(state.tasks.filter(t=>!t.deleted).map(t=>[t.id,t]));
  const sessions=state.sessions||[], withHistory=new Set(sessions.map(e=>e.taskId));
  const entries=sessions.filter(e=>tasks.has(e.taskId));
  for(const t of tasks.values()) {
    const day=t.completedOn||t.date;
    if(day&&t.actual>0&&!withHistory.has(t.id))entries.push({id:`legacy-total:${t.id}`,taskId:t.id,title:t.title,channel:t.channel,day,seconds:t.actual*60,started:0,ended:0,kind:'legacy',timing:'day-total'});
  }
  return entries;
}

export function reportedActual(state:State, day:string, channel?:string):number {
  return reportingEntries(state).filter(e=>e.day===day&&(!channel||e.channel===channel)).reduce((n,e)=>n+e.seconds/60,0);
}
