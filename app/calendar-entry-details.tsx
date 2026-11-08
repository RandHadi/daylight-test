'use client';
import type {CalendarItem} from '@/lib/calendar-display';
import {clockLabel,fromKey,type State} from '@/lib/planner-model';

export function CalendarEntryDetails({item,data,onTask,onSessions,onEvent}:{item:CalendarItem;data:State;onTask:(id:string)=>void;onSessions:(id:string)=>void;onEvent:(id:string)=>void}){
  return <div className="calendar-entry-details"><span className="dialog-eyebrow">CALENDAR ENTRY</span><h2>{item.title}</h2><p className="modal-description">{fromKey(item.date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} · {clockLabel(item.start,data.settings.timeFormat||'12')}–{clockLabel(item.start+item.minutes,data.settings.timeFormat||'12')}</p><p className="helper-text">These entries have the same time and appear together on your calendar.</p><div className="calendar-entry-sources">{item.sources?.map(s=><div key={s.id}><strong>{s.label}</strong>{s.detail&&<small>{s.detail}</small>}</div>)}</div><div className="google-actions">{item.taskId&&<><button className="primary" onClick={()=>onTask(item.taskId!)}>Open task</button><button className="secondary" onClick={()=>onSessions(item.taskId!)}>View planned & actual time</button></>}{item.googleEventId&&<button className="secondary" onClick={()=>onEvent(item.googleEventId!)}>View Google event</button>}</div></div>;
}
