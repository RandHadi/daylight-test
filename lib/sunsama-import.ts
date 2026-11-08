import { z } from 'zod';
import { type State, type Task, shiftDate, weekOf } from './planner-model.ts';
import { stateSchema } from './state-schema.ts';
import { validTimezone, zonedParts, wallToEpoch } from './calendar-time.ts';

const date = z.string().refine(s => !s || (/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+'T12:00:00Z')) && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s));
const entry = z.object({startDate:z.string(),endDate:z.string().nullable().optional(),duration:z.number().nonnegative().nullable().optional(),isTimerEntry:z.boolean().optional()});
const row = z.object({
    id:z.string().min(1).max(70),text:z.string().min(1).max(500),notes:z.string().max(10000).default(''),
    startDate:date.default(''),completedDate:z.string().default(''),dueDate:date.default(''),
    channel:z.string().max(100).default(''),context:z.string().max(80).default(''),objective:z.string().max(500).default(''),
    timeEstimate:z.union([z.number().int().min(0).max(720),z.literal(''),z.null()]).default(''),
    actualTime:z.array(entry).default([]),scheduledTime:z.array(entry.extend({calendarId:z.string().optional(),autoImported:z.boolean().optional()})).default([]),
    subtasks:z.array(z.object({_id:z.string().max(70),title:z.string().min(1).max(500),completedDate:z.string().nullable().optional(),timeEstimate:z.number().int().min(0).max(720).nullable().optional(),actualTime:z.array(entry).nullable().optional()})).max(100).default([]),
    comments:z.array(z.unknown()).default([]),url:z.string().max(2000).default(''),sequenceRule:z.string().max(1000).default(''),
    backlogPriority:z.string().default(''),latestDailyPriority:z.string().default(''),dailyPriority:z.array(z.object({priority:z.string(),day:date})).default([]),
});
const metadata = z.object({_id:z.string(),scheduledDate:z.string(),isBacklogged:z.boolean(),completed:z.boolean(),isArchived:z.boolean(),deleted:z.boolean(),completedOnDate:date.optional(),backlogHorizon:z.string().optional(),dailyPriority:z.string().optional(),sortOrder:z.number().optional(),integrationDetails:z.object({url:z.string().optional()}).optional()});
const bundleSchema = z.object({format:z.literal('daylight-sunsama-export'),version:z.literal(1),timezone:z.string().refine(validTimezone),tasks:z.array(row).min(1).max(5000),metadata:z.array(metadata).max(5000).default([])});
export type ImportReport = {tasks:number;completed:number;backlog:number;channels:number;subtasks:number;sessions:number;timeboxes:number;skipped:number;recurrenceNotes:number;dateMarkers:number;warnings:string[]};

function key(value:string) {
    let h=BigInt('14695981039346656037');
    for(const c of value){h^=BigInt(c.codePointAt(0)!);h=BigInt.asUintN(64,h*BigInt('1099511628211'));}
    return h.toString(16);
}
const cleanName=(value:string,fallback:string)=>value.replace(/^#/,'').trim()||fallback;
export function notesText(value:string):string {
    return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
      .replace(/<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,'$2 ($1)')
      .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])>/gi,'\n').replace(/<li\b[^>]*>/gi,'• ').replace(/<[^>]*>/g,'')
      .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
      .replace(/\n{3,}/g,'\n\n').trim();
}
const priority=(value:string):Task['priority']=>({urgent:'urgent',important:'important',priority:'important',low:'low','low priority':'low'} as const)[value.toLowerCase() as 'urgent']||'normal';
const backlogPriority=(value:string):NonNullable<Task['backlogPriority']>=>({urgent:'urgent',high:'high',medium:'medium',low:'low'} as const)[value.toLowerCase() as 'high']||'none';
const buckets:Record<string,string>={'in the next two weeks':'Next week or two','in the next month':'Next month','in the next quarter':'Next quarter','in the next year':'Next year',someday:'Someday',never:'Never'};

export function mergeSunsama(current:State,input:unknown) {
    const parsed=bundleSchema.safeParse(Array.isArray(input)?{format:'daylight-sunsama-export',version:1,timezone:current.settings.timezone||'UTC',tasks:input}:input);
    if(!parsed.success)throw new Error(`Invalid Sunsama export field: ${parsed.error.issues[0].path.join('.')}. No records were changed.`);
    const source=parsed.data,s=structuredClone(current),zone=s.settings.timezone||source.timezone;
    const meta=new Map(source.metadata.map(t=>[t._id,t]));
    if(new Set(source.tasks.map(t=>t.id)).size!==source.tasks.length)throw new Error('The export contains duplicate task IDs. No records were changed.');
    const report:ImportReport={tasks:0,completed:0,backlog:0,channels:0,subtasks:0,sessions:0,timeboxes:0,skipped:0,recurrenceNotes:0,dateMarkers:0,warnings:[]};
    s.sessions??=[];s.folders??=[];
    const existing=new Set(s.tasks.map(t=>t.id));
    const sorted=[...source.tasks].sort((a,b)=>(meta.get(a.id)?.sortOrder||0)-(meta.get(b.id)?.sortOrder||0));
    for(const raw of sorted){
        const taskId='sunsama:'+raw.id;
        if(existing.has(taskId)){report.skipped++;continue;}
        const m=meta.get(raw.id),context=cleanName(raw.context,'Personal'),name=cleanName(raw.channel,context);
        let ch=s.channels.find(c=>c.name.toLowerCase()===name.toLowerCase()&&c.context.toLowerCase()===context.toLowerCase());
        if(!ch){ch={id:'sunsama-channel:'+key(context+'\0'+name),name,context,color:['#709b8d','#779bc1','#c49b65','#b28dba','#cf8e76'][report.channels%5]};s.channels.push(ch);report.channels++;}
        if(context.toLowerCase()==='personal'&&!s.settings.personalContexts?.includes(context))s.settings.personalContexts=[...s.settings.personalContexts||[],context];
        const planned=m?(m.isBacklogged?null:/^\d{4}-\d{2}-\d{2}$/.test(m.scheduledDate)?m.scheduledDate:raw.startDate||null):raw.startDate||null;
        const done=m?.completed??!!raw.completedDate;
        const completedOn=m?.completedOnDate||(raw.completedDate?zonedParts(Date.parse(raw.completedDate),zone).day:undefined);
        const additions=[raw.sequenceRule?`Sunsama repeat pattern: ${raw.sequenceRule}. Imported occurrences are preserved; review before enabling a new repeating series in Daylight.`:''];
        if(raw.comments.length)additions.push('Sunsama comments:\n'+raw.comments.map(c=>typeof c==='string'?notesText(c):JSON.stringify(c)).join('\n'));
        const t:Task={id:taskId,title:raw.text,date:planned,channel:ch.id,minutes:typeof raw.timeEstimate==='number'?raw.timeEstimate:0,actual:0,done,
            notes:[notesText(raw.notes),...additions].filter(Boolean).join('\n\n'),subtasks:[],priority:priority(m?.dailyPriority||raw.latestDailyPriority),recurrence:'none',due:raw.dueDate,
            archived:m?.isArchived||false,backlogPriority:backlogPriority(raw.backlogPriority),bucket:buckets[m?.backlogHorizon||'']||'Someday',pinned:true};
        if(completedOn)t.completedOn=completedOn;
        if(m?.deleted)t.deleted=new Date().toISOString();
        const url=m?.integrationDetails?.url||raw.url;if(/^https?:\/\//i.test(url))t.sourceUrl=url;
        if(raw.objective){const id='sunsama-objective:'+key(raw.objective+'\0'+weekOf(planned||completedOn||raw.startDate||'2026-01-01'));t.objective=id;if(!s.objectives.some(o=>o.id===id))s.objectives.push({id,title:raw.objective,week:weekOf(planned||completedOn||raw.startDate||'2026-01-01'),done:false});}
        function addTime(entries:z.infer<typeof entry>[],subtaskId?:string){
            let seconds=0;
            entries.forEach((e,index)=>{
                const started=Date.parse(e.startDate),ended=e.endDate?Date.parse(e.endDate):undefined;
                const duration=e.duration??(ended===undefined?0:(ended-started)/1000);
                if(!Number.isFinite(started)||!Number.isFinite(duration)||duration<0||(ended!==undefined&&(!Number.isFinite(ended)||ended<started)))throw new Error('An actual-time entry has an invalid date or duration. No records were changed.');
                if(!duration)return;
                const interval=!!e.isTimerEntry||(ended!==undefined&&ended>started);
                s.sessions!.push({id:`${subtaskId||taskId}:time:${index}`,taskId,subtaskId,title:t.title,channel:ch!.id,day:zonedParts(started,zone).day,seconds:duration,started:interval?started:0,ended:interval?(ended??started+duration*1000):0,kind:e.isTimerEntry?'timer':'manual',timing:interval?'interval':'day-total'});
                seconds+=duration;report.sessions++;
            });
            return seconds/60;
        }
        t.actual=addTime(raw.actualTime);
        for(const st of raw.subtasks){const subId='sunsama:'+st._id;const actual=addTime(st.actualTime||[],subId);t.subtasks.push({id:subId,title:st.title,done:!!st.completedDate,minutes:st.timeEstimate||0,actual});t.actual+=actual;report.subtasks++;}
        const subMinutes=t.subtasks.reduce((n,st)=>n+(st.minutes||0),0);if(subMinutes>0)t.unallocatedMinutes=Math.max(0,t.minutes-subMinutes);
        raw.scheduledTime.forEach((e,index)=>{
            let cursor=Date.parse(e.startDate);const end=Date.parse(e.endDate||'');
            if(!Number.isFinite(cursor)||!Number.isFinite(end)||end<cursor||end-cursor>366*86400000)throw new Error('A scheduled timebox has invalid dates. No records were changed.');
            if(end===cursor){report.dateMarkers++;t.notes+=`\n\nSunsama calendar date marker (no duration): ${zonedParts(cursor,zone).day}`;return;}
            let part=0;
            while(cursor<end){const p=zonedParts(cursor,zone),next=wallToEpoch(shiftDate(p.day,1),0,zone);const stop=Math.min(end,next);const endParts=zonedParts(stop,zone);const minutes=Math.max(1,Math.min(1440-p.minute,endParts.day===p.day?endParts.minute-p.minute:1440-p.minute));
                s.blocks.push({id:`${taskId}:box:${index}:${part++}`,taskId,title:t.title,date:p.day,start:p.minute,minutes,color:ch!.color,pinned:true,busy:true,sourceUid:`sunsama:${raw.id}:${index}`});report.timeboxes++;cursor=stop;
            }
        });
        if(raw.sequenceRule)report.recurrenceNotes++;
        s.tasks.push(t);existing.add(taskId);report.tasks++;if(done)report.completed++;if(planned===null)report.backlog++;
    }
    if(report.recurrenceNotes)report.warnings.push(`${report.recurrenceNotes} recurring task records retain their original repeat patterns in notes. New automatic series are not created because the export does not identify their series reliably.`);
    if(report.dateMarkers)report.warnings.push(`${report.dateMarkers} calendar markers had no duration. Their tasks and source dates are preserved without inventing timed blocks.`);
    if(!source.metadata.length)report.warnings.push('Dates came from the export. Sunsama may have rolled tasks to a later day since their original start date.');
    const checked=stateSchema.safeParse(s);if(!checked.success)throw new Error('The imported planner would exceed supported limits or contains an invalid record. No records were changed.');
    if(JSON.stringify(checked.data).length>1900000)throw new Error('The merged planner would exceed the storage limit. No records were changed.');
    return {state:checked.data as State,report};
}
