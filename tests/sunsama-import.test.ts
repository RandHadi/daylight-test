import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSunsama, notesText } from '../lib/sunsama-import.ts';
import { initialState } from '../lib/planner-model.ts';
const base=()=>{const s=initialState('2026-11-07');s.settings.timezone='America/Los_Angeles';return s;};
const exported={id:'task1',text:'Imported work',startDate:'2026-10-20',channel:'#Research',context:'#work',timeEstimate:0,notes:'<p>Read <a href="https://example.test">source</a></p>',completedDate:'',actualTime:[{startDate:'2026-11-07T18:00:00Z',duration:300,endDate:null,isTimerEntry:false}],scheduledTime:[{startDate:'2026-11-07T18:00:00Z',endDate:'2026-11-07T18:05:00Z'}]};
const bundle=(tasks:unknown[],metadata:unknown[]=[])=>({format:'daylight-sunsama-export',version:1,timezone:'America/Los_Angeles',tasks,metadata});
test('import preserves current records, applies current provider dates and keeps zero estimates',()=>{
 const s=base(),original=structuredClone(s);const result=mergeSunsama(s,bundle([exported],[{_id:'task1',scheduledDate:'2026-11-07',isBacklogged:false,completed:false,isArchived:false,deleted:false,dailyPriority:'urgent'}]));
 assert.deepEqual(s,original);assert.deepEqual(result.state.tasks.slice(0,s.tasks.length),s.tasks);
 const task=result.state.tasks.at(-1)!;assert.equal(task.date,'2026-11-07');assert.equal(task.minutes,0);assert.equal(task.priority,'urgent');assert.equal(task.actual,5);
 assert.equal(result.state.blocks.at(-1)!.start,600);assert.equal(result.state.sessions!.at(-1)!.day,'2026-11-07');
});
test('reimport skips known source IDs and preserves edits and all related time records',()=>{
 const first=mergeSunsama(base(),bundle([exported]));first.state.tasks.at(-1)!.title='Edited in Daylight';
 const second=mergeSunsama(first.state,bundle([exported]));assert.deepEqual(second.state,first.state);assert.equal(second.report.skipped,1);assert.equal(second.report.tasks,0);
});
test('backlog, completion dates, subtasks, priorities and note content survive mapping',()=>{
 const result=mergeSunsama(base(),bundle([{...exported,startDate:'',completedDate:'2026-11-08T00:30:00Z',latestDailyPriority:'Priority',backlogPriority:'High',subtasks:[{_id:'sub1',title:'Step',completedDate:'2026-11-07T20:00:00Z',timeEstimate:0}]}],[{_id:'task1',scheduledDate:'not scheduled for a specific date',isBacklogged:true,completed:true,completedOnDate:'2026-11-07',isArchived:false,deleted:false,backlogHorizon:'in the next month'}]));
 const t=result.state.tasks.at(-1)!;assert.equal(t.date,null);assert.equal(t.completedOn,'2026-11-07');assert.equal(t.subtasks[0].done,true);assert.equal(t.bucket,'Next month');assert.equal(t.backlogPriority,'high');assert.equal(t.priority,'important');assert.equal(t.notes,'Read source (https://example.test)');
});
test('multi-day boxes split at local midnight and date-only markers do not fabricate time',()=>{
 const result=mergeSunsama(base(),bundle([{...exported,scheduledTime:[{startDate:'2026-11-08T07:30:00Z',endDate:'2026-11-08T08:30:00Z'},{startDate:'2027-11-04T07:00:00Z',endDate:'2027-11-04T07:00:00Z'}]}]));
 const boxes=result.state.blocks.slice(-2);assert.deepEqual(boxes.map(b=>[b.date,b.start,b.minutes]),[['2026-11-07',1410,30],['2026-11-08',0,30]]);assert.equal(result.report.dateMarkers,1);
});
test('null timer durations are derived and recurrence copies do not create duplicate series',()=>{
 const r=mergeSunsama(base(),bundle([{...exported,sequenceRule:'repeats every weekday',actualTime:[{startDate:'2026-11-07T18:00:00Z',endDate:'2026-11-07T18:00:01.500Z',duration:null,isTimerEntry:true}]}]));
 assert.equal(r.state.sessions!.at(-1)!.seconds,1.5);assert.match(r.state.tasks.at(-1)!.notes,/repeats every weekday/);assert.equal(r.state.series?.length||0,0);
});
test('invalid rows fail atomically, including duplicates and backwards timeboxes',()=>{
 const s=base(),snapshot=structuredClone(s);
 for(const rows of [[exported,exported],[{...exported,startDate:'2026-02-30'}],[{...exported,timeEstimate:-1}],[{...exported,scheduledTime:[{startDate:'2026-11-07T18:00:00Z',endDate:'2026-11-07T17:00:00Z'}]}]])assert.throws(()=>mergeSunsama(s,bundle(rows)));
 assert.deepEqual(s,snapshot);assert.equal(notesText('<script>alert(1)</script><p>Safe</p>'),'Safe');
});
