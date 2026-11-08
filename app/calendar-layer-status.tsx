'use client';
import {calendarDisplay,calendarProjection,type CalendarItem} from '@/lib/calendar-display';
import {duration,fromKey,type State,type Task} from '@/lib/planner-model';
import {zonedParts} from '@/lib/calendar-time';
import {calendarColors} from '@/lib/calendar-colors';

export function CalendarDayExtras({items,onOpen}:{items:CalendarItem[];onOpen:(item:CalendarItem)=>void}) {
  const totals=items.filter(b=>b.layer==='actual-summary');
  const card=(b:CalendarItem)=><button key={b.id} className={`calendar-all-day calendar-layer-${b.layer}`} data-calendar-layer={b.layer} title={b.detail} style={calendarColors(b.color)} onClick={()=>onOpen(b)}>{b.completed&&<span className="calendar-completion-mark">✓</span>}<span>{b.title}</span>{b.layer==='actual-summary'&&<small>{duration(b.actualMinutes||0)} actual</small>}</button>;
  return <>{items.filter(b=>b.allDay&&b.layer!=='actual-summary').map(card)}{totals.length>0&&<details className="calendar-untimed"><summary>Actual · {duration(totals.reduce((n,b)=>n+(b.actualMinutes||0),0))}<small>{totals.length} {totals.length===1?'task':'tasks'} · no clock times</small></summary><p>Durations were recorded without start/end times.</p>{totals.map(card)}</details>}</>;
}

export function CalendarLayerStatus({data,day,items,filter,onExtend,onSettings}:{data:State;day:string;items:CalendarItem[];filter:(t:Task)=>boolean;onExtend:()=>void;onSettings:()=>void}) {
  const prefs=calendarDisplay(data),past=day<zonedParts(Date.now(),data.settings.timezone||'UTC').day;
  if(!prefs.projections&&!prefs.actual)return null;
  const projection=calendarProjection(data,day,{filter}),projected=items.filter(b=>b.layer==='projection'),timed=items.filter(b=>b.layer==='actual'),untimed=items.filter(b=>b.layer==='actual-summary');
  const actual=timed.reduce((n,b)=>n+(b.actualMinutes||0),0)+untimed.reduce((n,b)=>n+(b.actualMinutes||0),0);
  const label=fromKey(day).toLocaleDateString('en-US',{month:'short',day:'numeric'});
  return <section className="calendar-layer-status" aria-label={`Calendar layers for ${day}`}>
    <strong>{label}</strong>
    {prefs.projections&&<span><i className="projection-key"/>Projections: {past?'future work only':`${projected.length} ${projected.length===1?'block':'blocks'}${prefs.projectionsOutsideHours?' · extended hours':''}`}</span>}
    {prefs.actual&&<span><i className="actual-key"/>Actual: {actual>0?`${duration(actual)}${untimed.length?` · ${duration(untimed.reduce((n,b)=>n+(b.actualMinutes||0),0))} without clock times`:''}`:'none recorded'}</span>}
    {prefs.projections&&projection.missed.length>0&&<details className="calendar-projection-overflow"><summary>{projection.missed.length} {projection.missed.length===1?'task needs':'tasks need'} more room</summary><p>{prefs.projectionsOutsideHours?'Some remaining work cannot fit before midnight.':'Remaining work cannot fit around busy events before your working-hours or shutdown cutoff.'} Projections never change saved timeboxes.</p><div>{!prefs.projectionsOutsideHours&&<button className="secondary" onClick={onExtend}>Preview outside work hours</button>}<button className="text-button" onClick={onSettings}>Edit working hours</button></div><ul>{projection.missed.map(id=><li key={id}>{data.tasks.find(t=>t.id===id)?.title}</li>)}</ul></details>}
  </section>;
}
