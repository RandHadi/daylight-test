'use client';
import {useEffect,useLayoutEffect,useId,useRef,useState} from 'react';
import {Check,Filter} from 'lucide-react';
import type {State} from '@/lib/planner-model';
import {calendarDisplay,type CalendarDisplay} from '@/lib/calendar-display';
import type {useGoogleCalendar} from './google-calendar-features';
import './calendar-menu.css';

export function CalendarMenu({data,connection:c,onChange,onManage}:{data:State;connection:ReturnType<typeof useGoogleCalendar>;onChange:(fn:(s:State)=>void)=>void;onManage:()=>void}){
  const [open,setOpen]=useState(false),ref=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),id=useId(),prefs=calendarDisplay(data);
  const [placement,setPlacement]=useState({top:0,left:0,width:310,maxHeight:500});
  useLayoutEffect(()=>{if(!open)return;const place=()=>{const r=button.current?.getBoundingClientRect();if(!r)return;const edge=document.querySelector('.right-rail')?.getBoundingClientRect().left||window.innerWidth,width=Math.min(310,window.innerWidth-64),top=r.bottom+8;setPlacement({top,left:Math.max(12,Math.min(r.left,edge-width-8)),width,maxHeight:Math.max(100,window.innerHeight-top-42)});};place();window.addEventListener('resize',place);return()=>window.removeEventListener('resize',place);},[open]);
  useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
  const edit=(value:Partial<CalendarDisplay>)=>onChange(s=>{s.settings.calendarDisplay={...calendarDisplay(s),...value};});
  const tick=(checked:boolean,color?:string)=><span aria-hidden="true" className={`calendar-choice-dot ${color?'colored':''} ${checked?'checked':''}`} style={color?{borderColor:color,background:checked?color:'transparent'}:undefined}>{!color&&checked&&<Check size={13}/>}</span>;
  const selected=c.status?.selected||[],calendars=c.status?.calendars||[];
  return <div ref={ref} className="calendar-menu" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'&&open){setOpen(false);button.current?.focus();}}}>
    <button ref={button} type="button" className="calendars-trigger" aria-expanded={open} aria-controls={id} title="Select calendars" onClick={()=>setOpen(!open)}><Filter size={15}/>Calendars</button>
    {open&&<div id={id} style={placement} className="calendars-popover" role="group" aria-label="Select calendars"><p className="calendar-menu-title">Select calendars:</p><h3>Daylight</h3>
      <button type="button" role="checkbox" aria-checked={prefs.local} onClick={()=>edit({local:!prefs.local})}>{tick(prefs.local,'#ffb44e')}<span>Daylight Calendar</span></button>
      {([['projections','Task projections'],['actual','Task actual times'],['comparison','Planned vs. actual'],['completions','Task completions']] as const).map(([key,label])=><button type="button" role="checkbox" aria-checked={prefs[key]} disabled={key==='comparison'&&!prefs.actual} className={key==='comparison'?'calendar-nested-choice':''} key={key} onClick={()=>edit({[key]:!prefs[key]})}>{tick(prefs[key])}<span>{label}</span></button>)}
      {c.status?.connected?<><h3 className="calendar-account-name">{c.status.email||'Google Calendar'}</h3>{calendars.map(cal=>{const synced=selected.includes(cal.id),checked=synced&&!prefs.hiddenGoogleCalendars.includes(cal.id),limit=!synced&&selected.length>=8;return <button type="button" role="checkbox" key={cal.id} aria-label={cal.name} aria-checked={checked} disabled={c.busy||limit} title={limit?'Manage calendars to change the eight calendars being synced':cal.name} onClick={()=>{if(!synced){void c.choose([...selected,cal.id]);edit({hiddenGoogleCalendars:prefs.hiddenGoogleCalendars.filter(id=>id!==cal.id)});}else edit({hiddenGoogleCalendars:checked?[...prefs.hiddenGoogleCalendars,cal.id]:prefs.hiddenGoogleCalendars.filter(id=>id!==cal.id)});}}>{tick(checked,cal.color)}<span>{cal.name}</span></button>;})}{!calendars.length&&<p className="calendar-menu-note">Reload your calendar list in Manage calendars.</p>}</>:<p className="calendar-menu-note">Connect Google Calendar to show your calendars here.</p>}
      {c.busy&&<p className="calendar-menu-note" role="status">Refreshing calendars…</p>}{c.error&&<p className="calendar-menu-error" role="alert">{c.error}</p>}
      <div className="calendar-menu-footer"><button type="button" onClick={()=>{setOpen(false);onManage();}}>Manage calendars</button></div>
    </div>}
  </div>;
}
