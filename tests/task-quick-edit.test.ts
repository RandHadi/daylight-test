import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/planner-model.ts';
import { editTaskQuickly } from '../lib/task-quick-edit.ts';
import { stateSchema } from '../lib/state-schema.ts';

test('quick metadata edits preserve flexible and split timeboxes and task details',()=>{
 const s=initialState('2026-11-08'),t=s.tasks[0],b=s.blocks.find(b=>b.taskId===t.id)!;
 b.pinned=false;s.blocks.push({...b,id:'second-session',start:b.start+90,minutes:15});
 t.notes='Keep notes';t.comments=[{id:'c',body:'Keep comment',author:'Me',at:'2026-11-08T12:00:00Z'}];
 const blocks=structuredClone(s.blocks.filter(b=>b.taskId===t.id)),details=structuredClone(t);
 editTaskQuickly(s,t.id,{priority:'urgent'},'2026-11-08');
 assert.deepEqual(s.blocks.filter(b=>b.taskId===t.id),blocks);
 assert.equal(t.preferred,details.preferred);assert.equal(t.rigid,details.rigid);
 assert.equal(t.notes,details.notes);assert.deepEqual(t.comments,details.comments);assert.equal(t.priority,'urgent');
});
test('quick time edits update the existing box and actual ledger without adding a duplicate',()=>{
 const s=initialState('2026-11-08'),t=s.tasks[0],b=s.blocks.find(b=>b.taskId===t.id)!;b.pinned=false;
 editTaskQuickly(s,t.id,{minutes:45,actual:20},'2026-11-08');
 assert.equal(t.minutes,45);assert.equal(t.actual,20);assert.equal(b.minutes,45);assert.equal(b.pinned,false);
 assert.equal(s.blocks.filter(b=>b.taskId===t.id).length,1);
 assert.equal(s.sessions?.filter(e=>e.taskId===t.id).reduce((sum,e)=>sum+e.seconds,0),1200);
 assert.equal(stateSchema.safeParse(s).success,true);
});
test('moving a task from its quick date menu removes old timeboxes while preserving history',()=>{
 const s=initialState('2026-11-08'),t=s.tasks[0];
 editTaskQuickly(s,t.id,{actual:15},'2026-11-08');const sessions=structuredClone(s.sessions);
 editTaskQuickly(s,t.id,{date:null},'2026-11-08');
 assert.equal(t.date,null);assert.equal(s.blocks.some(b=>b.taskId===t.id),false);assert.deepEqual(s.sessions,sessions);
});
