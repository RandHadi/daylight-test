import type {State} from './planner-model.ts';
import {parseSunsamaExport,importedMeetingMinutes,sunsamaImportInfo} from './sunsama-import.ts';
import {calendarLinkCandidates,linkCalendarTask} from './calendar-links.ts';
import {stateSchema} from './state-schema.ts';
export type RepairReport={estimates:{taskId:string;title:string;before:number;after:number}[];linked:string[];metadata:number;repeats:number;preserved:number};
export function repairSunsamaImport(current:State,input:unknown) {
  const source=parseSunsamaExport(input,current.settings.timezone),s=structuredClone(current);
  const metadata=new Map(source.metadata.map(m=>[m._id,m]));
  const report:RepairReport={estimates:[],linked:[],metadata:0,repeats:0,preserved:0};
  for(const raw of source.tasks){
    const t=s.tasks.find(t=>t.id==='sunsama:'+raw.id);if(!t||t.deleted)continue;
    const info=sunsamaImportInfo(raw,metadata.get(raw.id));
    if(!t.sunsamaImport){t.sunsamaImport=info;report.metadata++;}
    if(t.sunsamaImport.repeatReview==='pending'&&!t.seriesId)report.repeats++;
    const minutes=importedMeetingMinutes(raw);
    if(minutes!==undefined&&minutes!==t.minutes&&!t.calendarLink){
      if(t.minutes===info.originalMinutes&&!t.subtasks.some(st=>(st.minutes||0)>0)&&!t.activity?.some(a=>a.text.startsWith('Planned time set to'))){report.estimates.push({taskId:t.id,title:t.title,before:t.minutes,after:minutes});t.minutes=minutes;}
      else report.preserved++;
    }
  }
  // Exact, unambiguous auto-imported meeting matches can establish durable identity.
  // Different times remain suggestions for explicit review, never guessed links.
  for(const b of [...s.blocks].filter(b=>b.provider==='google'&&!b.allDay)){
    const candidates=calendarLinkCandidates(s,b).filter(t=>s.blocks.some(n=>n.taskId===t.id&&n.sourceUid?.startsWith('sunsama:')&&n.date===b.date&&n.start===b.start&&n.minutes===b.minutes));
    const sameEvents=s.blocks.filter(n=>n.provider==='google'&&n.externalCalendarId===b.externalCalendarId&&n.date===b.date&&n.start===b.start&&n.minutes===b.minutes&&n.title.trim().toLowerCase()===b.title.trim().toLowerCase());
    if(candidates.length===1&&sameEvents.length===1&&candidates[0].minutes===Math.min(720,b.minutes)&&!candidates[0].activity?.some(a=>a.text.startsWith('Planned time set to'))){linkCalendarTask(s,candidates[0].id,b.id);report.linked.push(candidates[0].id);}
  }
  const checked=stateSchema.safeParse(s);
  if(!checked.success||JSON.stringify(s).length>1900000)throw new Error('The repaired planner exceeds supported limits. No records were changed.');
  return {state:checked.data as State,report};
}
