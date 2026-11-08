import {type State,type Task,type Block,uid} from './planner-model.ts';

const name=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function linkedCalendarTask(s:State,b:Block):Task|undefined {
  return s.tasks.find(t=>!t.deleted&&(t.calendarLink?.calendarId===b.externalCalendarId&&t.calendarLink?.eventId===b.externalEventId&&!!b.externalEventId||t.sourceUrl===`daylight:event:${b.id}`));
}
export function taskCalendarBlocks(s:State,t:Task):Block[] {
  return s.blocks.filter(b=>b.taskId===t.id||(b.provider==='google'&&t.calendarLink?.calendarId===b.externalCalendarId&&t.calendarLink?.eventId===b.externalEventId&&!!b.externalEventId));
}
/** Suggestions only. A changed time is never linked by title without review. */
export function calendarLinkCandidates(s:State,b:Block):Task[] {
  if(b.provider!=='google'||b.busyOnly||b.allDay||!b.externalEventId||linkedCalendarTask(s,b))return [];
  return s.tasks.filter(t=>!t.deleted&&!t.archived&&!t.done&&!t.calendarLink&&t.sunsamaImport?.meeting&&t.sunsamaImport.calendarId===b.externalCalendarId&&t.date===b.date&&name(t.title)===name(b.title)&&new Set(s.blocks.filter(n=>n.taskId===t.id&&n.sourceUid?.startsWith('sunsama:')).map(n=>n.sourceUid)).size<=1);
}
export function linkCalendarTask(s:State,taskId:string,blockId:string):void {
  const t=s.tasks.find(t=>t.id===taskId&&!t.deleted),b=s.blocks.find(b=>b.id===blockId);
  if(!t||!b||b.provider!=='google'||b.busyOnly||!b.externalCalendarId||!b.externalEventId)throw new Error('Choose an available Google event and task.');
  const existing=linkedCalendarTask(s,b);
  if(existing&&existing.id!==taskId)throw new Error('This event is already linked to another task.');
  if(t.calendarLink&&(t.calendarLink.calendarId!==b.externalCalendarId||t.calendarLink.eventId!==b.externalEventId))throw new Error('This task is already linked to another event.');
  if(new Set(s.blocks.filter(n=>n.taskId===t.id&&n.sourceUid?.startsWith('sunsama:')).map(n=>n.sourceUid)).size>1)throw new Error('This task has several imported timeboxes. Review them individually before linking one event.');
  const parts=s.blocks.filter(n=>n.provider==='google'&&n.externalCalendarId===b.externalCalendarId&&n.externalEventId===b.externalEventId).sort((a,b)=>a.date.localeCompare(b.date));
  const first=parts[0],minutes=Math.min(720,parts.reduce((n,p)=>n+p.minutes,0));
  t.calendarLink={calendarId:b.externalCalendarId,eventId:b.externalEventId,lastDate:first.date,lastMinutes:minutes,lastTitle:b.title,status:'linked'};
  if(!t.done){t.date=first.date;t.minutes=minutes;}
  // Retire only imported copies of this meeting. Other user-created timeboxes stay.
  s.blocks=s.blocks.filter(n=>!(n.taskId===t.id&&n.sourceUid?.startsWith('sunsama:')));
}
export function reconcileCalendarLinks(s:State,window?:{from:string;to:string;calendarIds:string[]}):void {
  for(const t of s.tasks){const link=t.calendarLink;if(!link||t.deleted)continue;
    const parts=taskCalendarBlocks(s,t).filter(b=>b.provider==='google').sort((a,b)=>a.date.localeCompare(b.date));
    if(!parts.length){if(window?.calendarIds.includes(link.calendarId)&&link.lastDate>=window.from&&link.lastDate<window.to)link.status='unavailable';continue;}
    const first=parts[0],minutes=Math.min(720,parts.reduce((n,b)=>n+b.minutes,0));
    // Follow source changes only for values the user has not independently edited.
    if(!t.done){if(t.date===link.lastDate)t.date=first.date;if(t.minutes===link.lastMinutes)t.minutes=minutes;if(t.title===link.lastTitle)t.title=first.title;}
    Object.assign(link,{lastDate:first.date,lastMinutes:minutes,lastTitle:first.title,status:'linked'});
  }
}
export function unlinkCalendarTask(s:State,id:string):void {
  const t=s.tasks.find(t=>t.id===id);if(!t?.calendarLink)return;
  for(const b of taskCalendarBlocks(s,t).filter(b=>b.provider==='google'))s.blocks.push({id:uid(),taskId:id,title:t.title,date:b.date,start:b.start,minutes:b.minutes,color:s.channels.find(c=>c.id===t.channel)?.color||b.color,pinned:true,busy:b.busy,allDay:b.allDay});
  t.calendarLink=null;
  if(t.sourceUrl?.startsWith('daylight:event:'))delete t.sourceUrl;
}
