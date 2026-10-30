import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { initialState, shiftDate, weekOf, completeTask, autoSchedule, scheduleTask, moveTask, task, finishTimer, exportCalendar } from '../lib/planner-model.ts';
test('calendar dates cross month, year, leap day, and daylight-saving boundaries',()=>{
 assert.equal(shiftDate('2026-12-31',1),'2027-01-01');assert.equal(shiftDate('2028-02-28',1),'2028-02-29');assert.equal(shiftDate('2026-11-01',1),'2026-11-02');assert.equal(weekOf('2026-11-01'),'2026-10-26');
});
test('weekday recurrence advances Friday to Monday and reopening does not duplicate',()=>{
 const s=initialState('2026-10-30');const t=s.tasks[0];t.recurrence='weekdays';completeTask(s,t.id,'2026-10-30');const next=s.tasks.find(n=>n.generatedFrom===t.id)!;assert.equal(next.date,'2026-11-02');assert.equal(next.done,false);assert.ok(next.subtasks.every(n=>!n.done));completeTask(s,t.id,'2026-10-30');completeTask(s,t.id,'2026-10-30');assert.equal(s.tasks.filter(n=>n.generatedFrom===t.id).length,1);
});
test('auto-scheduling avoids existing events, honors workday and reports overflow',()=>{
 const s=initialState('2026-10-30');s.tasks=[task('A','2026-10-30','product',60),task('B','2026-10-30','product',60),task('C','2026-10-30','product',60)];s.blocks=[{id:'meeting',title:'Meeting',date:'2026-10-30',start:570,minutes:60,color:'#709b8d'}];s.settings={...s.settings,start:540,end:750};assert.equal(autoSchedule(s,'2026-10-30'),1);assert.deepEqual(s.blocks.filter(b=>b.taskId).map(b=>b.start),[630,690]);assert.equal(autoSchedule(s,'2026-10-30'),1);assert.equal(s.blocks.length,3);
});
test('timeboxing replaces old timebox, clamps to day, and moving removes stale calendar block',()=>{
 const s=initialState('2026-10-30');const t=s.tasks[1];scheduleTask(s,t.id,'2026-10-31',1430);assert.equal(s.blocks.filter(b=>b.taskId===t.id).length,1);assert.equal(s.blocks.find(b=>b.taskId===t.id)!.start,1350);assert.equal(t.date,'2026-10-31');moveTask(s,t.id,null);assert.equal(t.date,null);assert.ok(!s.blocks.some(b=>b.taskId===t.id));
});
test('completing a focused task credits tracked time once',()=>{
 const s=initialState('2026-10-30');const t=s.tasks[0];s.timer={taskId:t.id,started:null,seconds:120};completeTask(s,t.id,'2026-10-30');assert.equal(t.actual,2);assert.equal(s.timer,null);finishTimer(s);assert.equal(t.actual,2);
});
test('calendar export escapes title delimiters and creates UTC event timestamps',()=>{
 const s=initialState('2026-10-30');s.tasks=[];s.blocks=[{id:'a',title:'Meet, plan; act\nNext',date:'2026-10-30',start:540,minutes:60,color:'#709b8d'}];const ics=exportCalendar(s);assert.ok(ics.includes('SUMMARY:Meet\\, plan\\; act\\nNext'));assert.match(ics,/DTSTART:\d{8}T\d{6}Z/);assert.ok(ics.endsWith('END:VCALENDAR'));
});
