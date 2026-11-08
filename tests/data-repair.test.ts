import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,task,type State,type Block} from '../lib/planner-model.ts';
import {dailyActual,generateOccurrences,duplicateTask,importMeeting,scheduleDay} from '../lib/planner-advanced.ts';
import {analyticsRows} from '../lib/workspace-views.ts';
import {reportingEntries} from '../lib/time-ledger.ts';
import {mergeSunsama} from '../lib/sunsama-import.ts';
import {repairSunsamaImport} from '../lib/sunsama-repair.ts';
import {linkCalendarTask,linkedCalendarTask,calendarLinkCandidates,unlinkCalendarTask} from '../lib/calendar-links.ts';
import {applyCalendarSync,type CalendarSync} from '../lib/google-calendar.ts';
import {calendarItems} from '../lib/calendar-display.ts';
import {repeatReviewGroups,enableImportedRepeat,suggestedRepeat} from '../lib/sunsama-recurrence.ts';
import {stateSchema} from '../lib/state-schema.ts';
import {preserveTaskDetails} from '../lib/task-details.ts';
const day='2026-11-08';
function empty():State {const s=initialState(day);s.tasks=[];s.blocks=[];s.sessions=[];s.series=[];s.settings.timezone='America/Los_Angeles';return s;}
const raw={id:'meeting',text:'An imported meeting',startDate:day,timeEstimate:20,channel:'Personal',context:'Personal',scheduledTime:[{startDate:'2026-11-09T02:30:00Z',endDate:'2026-11-09T05:30:00Z',autoImported:true,calendarId:'cal@example.test'}]};
const bundle=(tasks:unknown[],metadata:unknown[]=[])=>({format:'daylight-sunsama-export',version:1,timezone:'America/Los_Angeles',tasks,metadata});
const event:Block={id:'google:event:2026-11-08',provider:'google',externalCalendarId:'cal@example.test',externalEventId:'event',title:raw.text,date:day,start:1170,minutes:180,color:'#123456',busy:true};
const sync=(blocks:Block[],extra:Partial<CalendarSync>={}):CalendarSync=>({from:'2026-11-01',to:'2026-11-20',calendarIds:['cal@example.test'],blocks,failures:[],fetchedAt:1,connectionRevision:1,...extra});
function oldImport(){const s=mergeSunsama(empty(),bundle([raw])).state;delete s.tasks[0].sunsamaImport;s.tasks[0].minutes=20;s.blocks.push(structuredClone(event));return s;}

test('reporting totals agree across daily, analytics, channel and export ledger policies',()=>{
 const s=empty(),live=task('Active',day),archived=task('Archived',day),deleted=task('Deleted',day),legacy=task('Legacy',day);
 archived.archived=true;deleted.deleted='2026-11-08T00:00:00Z';legacy.actual=15;live.actual=999;
 s.tasks=[live,archived,deleted,legacy];s.sessions=[live,archived,deleted].map((t,i)=>({id:`s${i}`,taskId:t.id,title:t.title,channel:t.channel,day,seconds:600,started:0,ended:0,kind:'manual'}));
 s.sessions.push({...s.sessions[0],id:'orphan',taskId:'missing',seconds:3300});
 assert.equal(dailyActual(s,day),35);assert.equal(analyticsRows(s,[day])[0].actual,35);
 assert.equal(reportingEntries(s).reduce((n,e)=>n+e.seconds/60,0),35);
 assert.equal(dailyActual(s,day,'product'),35);assert.equal(dailyActual(s,day,'personal'),0);
 assert.equal(s.sessions.length,4); // Reporting never deletes the ledger.
});
test('meeting duration comes from auto-imported event while normal explicit estimates stay independent',()=>{
 assert.equal(mergeSunsama(empty(),bundle([raw])).state.tasks[0].minutes,180);
 assert.equal(mergeSunsama(empty(),bundle([{...raw,scheduledTime:raw.scheduledTime.map(e=>({...e,autoImported:false}))}])).state.tasks[0].minutes,20);
 assert.equal(mergeSunsama(empty(),bundle([{...raw,timeEstimate:0,scheduledTime:[]}])).state.tasks[0].minutes,0);
});
test('repair is idempotent, non-mutating and preserves manual estimates, notes and history',()=>{
 const s=oldImport(),before=structuredClone(s);s.tasks[0].notes='Keep my notes';
 const fixed=repairSunsamaImport(s,bundle([raw]));assert.equal(fixed.state.tasks[0].minutes,180);assert.equal(fixed.state.tasks[0].notes,'Keep my notes');assert.equal(s.tasks[0].minutes,20);
 const again=repairSunsamaImport(fixed.state,bundle([raw]));assert.deepEqual(again.state,fixed.state);assert.equal(again.report.estimates.length,0);
 before.tasks[0].minutes=45;assert.equal(repairSunsamaImport(before,bundle([raw])).state.tasks[0].minutes,45);
 before.tasks[0].minutes=20;before.tasks[0].activity=[{id:'manual',text:'Planned time set to 0:20',at:'2026-11-08T00:00:00Z'}];
 assert.equal(repairSunsamaImport(before,bundle([raw])).state.tasks[0].minutes,20);
});
test('changed event times require review, then one linked event replaces stale imported copies',()=>{
 const s=repairSunsamaImport(oldImport(),bundle([raw])).state,t=s.tasks[0];
 assert.equal(t.calendarLink,undefined);assert.equal(calendarLinkCandidates(s,event)[0].id,t.id);assert.equal(s.blocks.length,2);
 linkCalendarTask(s,t.id,event.id);assert.equal(s.blocks.length,1);assert.equal(s.blocks[0].start,1170);
 assert.equal(linkedCalendarTask(s,event)?.id,t.id);assert.equal(importMeeting(s,event).id,t.id);assert.equal(s.tasks.length,1);
 s.settings.calendarDisplay={local:true,projections:true,actual:true,comparison:true,completions:true,hiddenGoogleCalendars:[]};
 const items=calendarItems(s,day,{now:Date.parse('2026-11-08T16:00:00Z')});assert.equal(items.length,1);assert.equal(items[0].taskId,t.id);
 assert.equal(scheduleDay(s,day,{project:true}).blocks.length,1);
 assert.deepEqual(stateSchema.parse(JSON.parse(JSON.stringify(s))),JSON.parse(JSON.stringify(s)));
});
test('exact match repair establishes identity, but ambiguous matches and user estimates are kept',()=>{
 const s=oldImport();s.blocks.find(b=>b.provider==='google')!.start=1110;
 const fixed=repairSunsamaImport(s,bundle([raw]));assert.equal(fixed.report.linked.length,1);assert.equal(fixed.state.blocks.length,1);
 s.blocks.push({...s.blocks[1],id:'second',externalEventId:'different'});assert.equal(repairSunsamaImport(s,bundle([raw])).report.linked.length,0);
});
test('a meeting link cannot remove multiple independent imported timeboxes',()=>{
 const s=repairSunsamaImport(oldImport(),bundle([raw])).state,t=s.tasks[0];s.blocks.push({...s.blocks[0],id:'extra',sourceUid:'sunsama:meeting:1',start:600});
 assert.equal(calendarLinkCandidates(s,event).length,0);const before=structuredClone(s);
 assert.throws(()=>linkCalendarTask(s,t.id,event.id),/several imported/);assert.deepEqual(s,before);
});
test('stable event identity follows time/date edits, preserves manual overrides and never follows another calendar',()=>{
 const s=repairSunsamaImport(oldImport(),bundle([raw])).state,t=s.tasks[0];linkCalendarTask(s,t.id,event.id);
 const moved={...event,id:'google:event:2026-11-09',date:'2026-11-09',start:1000,minutes:120,title:'New meeting title'};
 applyCalendarSync(s,sync([moved]));assert.equal(t.date,'2026-11-09');assert.equal(t.minutes,120);assert.equal(t.title,moved.title);
 t.minutes=45;t.title='My own wording';t.date='2026-11-10';applyCalendarSync(s,sync([{...moved,start:1020,minutes:90,title:'Source edit'}]));
 assert.equal(t.minutes,45);assert.equal(t.title,'My own wording');assert.equal(t.date,'2026-11-10');
 const snapshot=JSON.stringify(s);applyCalendarSync(s,sync([],{calendarIds:[],failures:[{calendarId:'cal@example.test',message:'Offline'}]}));assert.equal(JSON.stringify(s),snapshot);
 applyCalendarSync(s,sync([{...moved,externalCalendarId:'other@example.test',externalEventId:'other',id:'other'}]));assert.equal(t.calendarLink?.status,'unavailable');assert.equal(t.minutes,45);
});
test('completed task history stays fixed when its live event changes; duplicates do not inherit links',()=>{
 const s=repairSunsamaImport(oldImport(),bundle([raw])).state,t=s.tasks[0];linkCalendarTask(s,t.id,event.id);t.done=true;
 applyCalendarSync(s,sync([{...event,minutes:90,title:'Updated'}]));assert.equal(t.minutes,180);assert.equal(t.title,raw.text);
 const copy=duplicateTask(s,t.id,day)!;assert.equal(copy.calendarLink,undefined);assert.equal(copy.sunsamaImport,undefined);
 unlinkCalendarTask(s,t.id);assert.equal(t.calendarLink,null);assert.equal(s.blocks.filter(b=>b.taskId===t.id).length,1);
});
test('repeat review groups occurrences without auto-creating series; enable preserves history and avoids known future duplicates',()=>{
 const rows=[{...raw,id:'repeat1',text:'Read',scheduledTime:[],sequenceRule:'repeats every day'},{...raw,id:'repeat2',text:'Read',startDate:'2026-11-10',scheduledTime:[],sequenceRule:'repeats every day'}];
 const s=mergeSunsama(empty(),bundle(rows)).state;s.tasks[0].done=true;s.tasks[0].actual=12;
 const groups=repeatReviewGroups(s);assert.equal(groups.length,1);assert.equal(groups[0].length,2);assert.equal(s.series?.length,0);
 enableImportedRepeat(s,groups[0].map(t=>t.id),suggestedRepeat('RRULE:FREQ=DAILY',day)!,'2026-11-09',540);
 assert.equal(s.series!.length,1);assert.equal(s.tasks[0].actual,12);assert.equal(s.tasks[0].done,true);assert.equal(s.tasks.filter(t=>t.date==='2026-11-10').length,1);
 const count=s.tasks.length;generateOccurrences(s,'2026-11-09');assert.equal(s.tasks.length,count);assert.equal(repeatReviewGroups(s).length,0);
 assert.throws(()=>enableImportedRepeat(s,[s.tasks[0].id],suggestedRepeat('repeats every day',day)!,'2026-11-09'));
 assert.doesNotThrow(()=>stateSchema.parse(s));
});
test('repeat suggestions never silently simplify unsupported rules',()=>{
 assert.deepEqual(suggestedRepeat('RRULE:FREQ=WEEKLY;BYDAY=SU',day),{frequency:'weekly',interval:1,weekdays:[0],until:''});
 for(const rule of ['RRULE:FREQ=MONTHLY;BYDAY=2MO','RRULE:FREQ=DAILY;COUNT=5','RRULE:FREQ=WEEKLY;BYDAY=BAD','RRULE:FREQ=DAILY;INTERVAL=0'])assert.equal(suggestedRepeat(rule,day),undefined);
});
test('older client saves cannot strip import identity or links; explicit unlink remains possible',()=>{
 const saved=repairSunsamaImport(oldImport(),bundle([raw])).state;linkCalendarTask(saved,saved.tasks[0].id,event.id);
 const old=structuredClone(saved);delete old.tasks[0].sunsamaImport;delete old.tasks[0].calendarLink;
 preserveTaskDetails(saved,old);assert.deepEqual(old.tasks[0].sunsamaImport,saved.tasks[0].sunsamaImport);assert.deepEqual(old.tasks[0].calendarLink,saved.tasks[0].calendarLink);
 old.tasks[0].calendarLink=null;preserveTaskDetails(saved,old);assert.equal(old.tasks[0].calendarLink,null);
});
