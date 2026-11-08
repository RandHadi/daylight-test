import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/planner-model.ts';
import { duplicateTask, saveTask } from '../lib/planner-advanced.ts';
import { recordTaskActivity, preserveTaskDetails, parseTimeAmount, timeAmount } from '../lib/task-details.ts';
import { stateSchema } from '../lib/state-schema.ts';
test('time fields accept H:MM or minutes and reject impossible or excessive durations',()=>{
 assert.equal(parseTimeAmount('0:45'),45);assert.equal(parseTimeAmount('1:30'),90);assert.equal(parseTimeAmount('45'),45);assert.equal(parseTimeAmount(''),0);
 for(const value of ['-1','1:90','13:00','1e2','nope'])assert.equal(parseTimeAmount(value),null);
 assert.equal(timeAmount(90),'1:30');assert.equal(timeAmount(0),'0:00');
});
test('task details and attachment references survive validated serialization',()=>{
 const state=initialState('2026-11-07'),task=state.tasks[0];
 task.comments=[{id:'comment-1',body:'Remember this',author:'Owner',at:'2026-11-07T20:00:00.000Z',attachments:[{id:'3d7bb8ad-e64f-4b71-aad3-c083df60f333',name:'note.txt',size:12,type:'text/plain'}]}];
 task.activity=[{id:'event-1',text:'Due date updated',at:'2026-11-07T20:00:00.000Z'}];
 const saved=stateSchema.parse(JSON.parse(JSON.stringify(state)));assert.deepEqual(saved.tasks[0].comments,task.comments);assert.deepEqual(saved.tasks[0].activity,task.activity);
});
test('activity records genuine edits without inventing old creation history',()=>{
 const before=initialState('2026-11-07'),after=structuredClone(before);
 after.tasks[0].date=null;after.tasks[0].due='2026-11-10';after.tasks[0].priority='urgent';
 recordTaskActivity(before,after,'Owner','2026-11-07T20:00:00.000Z');
 assert.deepEqual(after.tasks[0].activity?.map(e=>e.text),['Moved to backlog','Due date set to 2026-11-10','Priority set to Urgent']);
 const noChange=structuredClone(after);recordTaskActivity(after,noChange,'Owner');assert.deepEqual(noChange.tasks[0].activity,after.tasks[0].activity);
});
test('older clients cannot strip new comment and activity fields',()=>{
 const saved=initialState('2026-11-07');saved.tasks[0].comments=[{id:'c',body:'Keep me',author:'Owner',at:'2026-11-07T20:00:00.000Z'}];
 saved.tasks[0].activity=[{id:'a',text:'Updated',at:'2026-11-07T20:00:00.000Z'}];
 const incoming=structuredClone(saved);delete incoming.tasks[0].comments;delete incoming.tasks[0].activity;
 preserveTaskDetails(saved,incoming);assert.deepEqual(incoming.tasks[0].comments,saved.tasks[0].comments);assert.deepEqual(incoming.tasks[0].activity,saved.tasks[0].activity);
});
test('duplicates keep task details but start with separate comments, history and time',()=>{
 const state=initialState('2026-11-07'),original=state.tasks[0];original.comments=[{id:'c',body:'Original conversation',author:'Owner',at:'2026-11-07T20:00:00.000Z'}];original.activity=[{id:'a',text:'Original history',at:'2026-11-07T20:00:00.000Z'}];
 const copy=duplicateTask(state,original.id,original.date)!;assert.notEqual(copy.id,original.id);assert.equal(copy.title,original.title);assert.equal(copy.actual,0);assert.deepEqual(copy.comments,[]);assert.deepEqual(copy.activity,[]);assert.equal(original.comments.length,1);
});
test('setting planned time to zero does not create invalid zero-length calendar blocks',()=>{
 const state=initialState('2026-11-07'),draft=structuredClone(state.tasks[0]),block=state.blocks.find(b=>b.taskId===draft.id)!;
 draft.minutes=0;saveTask(state,draft,block.start,'2026-11-07');
 assert.equal(state.tasks[0].minutes,0);assert.ok(state.blocks.every(b=>b.minutes>0));assert.equal(stateSchema.safeParse(state).success,true);
});
