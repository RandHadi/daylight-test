import { type State, type Task } from './planner-model.ts';
import { saveTask } from './planner-advanced.ts';

export type QuickTaskPatch = Partial<Pick<Task,'channel'|'minutes'|'unallocatedMinutes'|'actual'|'priority'|'date'|'due'|'notes'|'comments'|'recurrence'|'rule'>>;

/** Reuse task validation and history without turning an unchanged flexible timebox into a fixed one. */
export function editTaskQuickly(state:State,id:string,patch:QuickTaskPatch,today:string,applyFuture=false) {
  const current=state.tasks.find(t=>t.id===id);
  if(!current)return;
  const first=state.blocks.find(b=>b.taskId===id);
  const moving='date' in patch&&patch.date!==current.date;
  saveTask(state,{...structuredClone(current),...patch},moving?null:first?.start??null,today,applyFuture,!moving);
}
