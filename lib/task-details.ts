import { type State, type Task, uid } from './planner-model.ts';

export const priorityLabels: Record<Task['priority'],string> = {urgent:'Urgent',important:'Priority',normal:'Normal',low:'Low priority'};
export function timeAmount(minutes: number): string {
    const total = Math.round(minutes);return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
}
export function parseTimeAmount(text: string, maximum=720): number | null {
    const value=text.trim();if(!value)return 0;
    const match=value.match(/^(\d+):([0-5]\d)$/);
    const minutes=match?Number(match[1])*60+Number(match[2]):/^\d+(\.\d+)?$/.test(value)?Number(value):NaN;
    return Number.isFinite(minutes)&&minutes>=0&&minutes<=maximum?minutes:null;
}
export function recordTaskActivity(before:State,after:State,author:string,at=new Date().toISOString()) {
    const originals=new Map(before.tasks.map(t=>[t.id,t]));
    for(const task of after.tasks){
        const old=originals.get(task.id),messages:string[]=[];
        if(!old)messages.push(`${author} created this task`);
        else {
            if(old.title!==task.title)messages.push('Title updated');
            if(old.date!==task.date)messages.push(task.date?`Start date set to ${task.date}`:'Moved to backlog');
            if(old.due!==task.due)messages.push(task.due?`Due date set to ${task.due}`:'Due date removed');
            if(old.priority!==task.priority)messages.push(`Priority set to ${priorityLabels[task.priority]}`);
            if(old.channel!==task.channel)messages.push(`Channel set to ${after.channels.find(c=>c.id===task.channel)?.name||'Uncategorized'}`);
            if(old.done!==task.done)messages.push(task.done?'Task completed':'Task reopened');
            if(old.recurrence!==task.recurrence||JSON.stringify(old.rule)!==JSON.stringify(task.rule))messages.push(task.recurrence==='none'?'Repeat removed':'Repeat schedule updated');
            if(old.objective!==task.objective)messages.push(task.objective?'Aligned with an objective':'Objective removed');
            if(old.notes!==task.notes)messages.push('Notes updated');
            if(old.minutes!==task.minutes)messages.push(`Planned time set to ${timeAmount(task.minutes)}`);
            if(JSON.stringify(old.subtasks)!==JSON.stringify(task.subtasks))messages.push('Subtasks updated');
            if(!old.deleted&&task.deleted)messages.push('Moved to trash');
            if(old.archived!==task.archived)messages.push(task.archived?'Task archived':'Task restored');
        }
        // Preserve the current history even when an editor draft predates it.
        task.activity=[...(old?.activity||task.activity||[]),...messages.map(text=>({id:uid(),text,at}))].slice(-200);
    }
}

export function preserveTaskDetails(saved:State,incoming:State) {
    const originals=new Map(saved.tasks.map(t=>[t.id,t]));
    for(const task of incoming.tasks){const old=originals.get(task.id);if(!old)continue;
        // An older open client may not yet know these fields exist.
        if(task.comments===undefined&&old.comments)task.comments=structuredClone(old.comments);
        if(task.activity===undefined&&old.activity)task.activity=structuredClone(old.activity);
        if(task.calendarLink===undefined&&old.calendarLink)task.calendarLink=structuredClone(old.calendarLink);
        if(task.sunsamaImport===undefined&&old.sunsamaImport)task.sunsamaImport=structuredClone(old.sunsamaImport);
    }
}
