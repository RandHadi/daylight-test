'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type DragEvent,type KeyboardEvent} from 'react';
import {Plus} from 'lucide-react';
import {dateKey,fromKey,clockLabel,type State} from '@/lib/planner-model';
import {viewDays,type CalendarLayout} from '@/lib/workspace-views';
import {calendarAnchor,calendarWindow,shiftCalendarDate} from '@/lib/calendar-scroll';
import {calendarItems,calendarDisplay,type CalendarItem} from '@/lib/calendar-display';
import './calendar-workspace.css';

type Props={data:State;day:string;layout:CalendarLayout;filter:(t:State['tasks'][number])=>boolean;completed:boolean;onEntry:(item:CalendarItem)=>void;onTask:(id:string)=>void;onEvent:(id?:string,start?:number,day?:string)=>void;onSelect:(d:string)=>void;onDrop:(id:string,d:string,start:number)=>void};

/** Keep a bounded date strip and replenish its edges without resetting vertical time. */
function useCalendarStrip(day:string,layout:CalendarLayout,monday:boolean,onSelect:(day:string)=>void) {
  const monthly=layout==='month',visible=monthly||layout==='day'?1:layout==='three'?3:layout==='weekdays'?5:7;
  const buffer=monthly?2:14,total=visible+buffer*2,gutter=monthly?0:48;
  const ref=useRef<HTMLDivElement>(null);
  const [start,setStart]=useState(()=>shiftCalendarDate(calendarAnchor(day,layout,monday),-buffer,layout));
  const [width,setWidth]=useState(240);
  const desired=useRef(calendarAnchor(day,layout,monday)),previousDay=useRef(day),reported=useRef<string|null>(null),fraction=useRef(0),lastLeft=useRef(0);
  const settled=useRef<ReturnType<typeof setTimeout>|null>(null);
  const dates=calendarWindow(start,total,layout);
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return;
    const observer=new ResizeObserver(()=>{if(el.clientWidth)setWidth(Math.max(monthly?280:120,(el.clientWidth-gutter)/visible));});
    observer.observe(el);return()=>{observer.disconnect();if(settled.current)clearTimeout(settled.current);};
  },[visible,gutter,monthly]);
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return;
    if(previousDay.current!==day){
      if(reported.current!==day){desired.current=calendarAnchor(day,layout,monday);fraction.current=0;}
      reported.current=null;previousDay.current=day;
    }
    const index=dates.indexOf(desired.current);
    if(index<0||index>total-visible){setStart(shiftCalendarDate(desired.current,-buffer,layout));return;}
    if(settled.current)clearTimeout(settled.current);
    el.scrollLeft=(index+fraction.current)*width;
    lastLeft.current=el.scrollLeft;
  },[day,start,width,layout,monday]);
  function onScroll(){
    const el=ref.current;if(!el||Math.abs(el.scrollLeft-lastLeft.current)<0.5)return;
    lastLeft.current=el.scrollLeft;
    if(settled.current)clearTimeout(settled.current);
    settled.current=setTimeout(()=>{
      const el=ref.current;if(!el)return;
      const index=Math.max(0,Math.min(total-visible,Math.round(el.scrollLeft/width))),next=dates[index];
      fraction.current=el.scrollLeft/width-index;desired.current=next;
      if(next!==day){reported.current=next;onSelect(next);}
      if(index<visible||index>total-visible*2)setStart(shiftCalendarDate(next,-buffer,layout));
    },180);
  }
  function onKeyDown(e:KeyboardEvent<HTMLDivElement>){
    if(e.target!==e.currentTarget||e.shiftKey||e.metaKey||e.ctrlKey||e.altKey)return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();
    ref.current?.scrollBy({left:e.key==='ArrowLeft'?-width*visible:e.key==='ArrowRight'?width*visible:0,top:e.key==='ArrowUp'?-168:e.key==='ArrowDown'?168:0,behavior:'smooth'});
  }
  return {ref,dates,width,onScroll,onKeyDown};
}

export function CalendarWorkspace(props:Props) {
  return <CalendarStrip key={`${props.layout}:${props.data.settings.weekStartsMonday}`} {...props}/>;
}
function CalendarStrip({data,day,layout,filter,completed,onEntry,onTask,onEvent,onSelect,onDrop}:Props) {
  const {ref,dates,width,onScroll,onKeyDown}=useCalendarStrip(day,layout,data.settings.weekStartsMonday,onSelect);
  const monthly=layout==='month';
  useEffect(()=>{if(!monthly&&ref.current)ref.current.scrollTop=Math.max(0,(data.settings.start/60-1)*56);},[]);
  const items=useMemo(()=>{const days=monthly?[...new Set(dates.flatMap(d=>viewDays(d,'month',data.settings.weekStartsMonday)))]:dates;return new Map(days.map(d=>[d,calendarItems(data,d,{filter,completed})]));},[data,dates.join(','),filter,completed,monthly]);
  const blocks=(d:string)=>items.get(d)||[];
  const prefs=calendarDisplay(data);
  const open=(b:CalendarItem)=>b.sources?onEntry(b):b.taskId?onTask(b.taskId):onEvent(b.id,undefined,b.date);
  const drop=(e:DragEvent,d:string,min:number)=>{e.preventDefault();const v=e.dataTransfer.getData('text/plain');if(v.startsWith('task:'))onDrop(v.slice(5),d,min);};
  return <div className="scrollable-calendar"><div ref={ref} className={`calendar-date-scroll ${monthly?'calendar-month-scroll':''}`} role="region" aria-label={monthly?'Calendar months. Scroll left or right for more months.':'Calendar dates. Scroll left or right for more days, up or down for hours.'} tabIndex={0} onScroll={onScroll} onKeyDown={onKeyDown}>
    {monthly?<div className="calendar-month-strip" style={{gridTemplateColumns:`repeat(${dates.length},${width}px)`}}>{dates.map(month=>{
      const days=viewDays(month,'month',data.settings.weekStartsMonday);
      return <section className="month-workspace" data-calendar-month={month} key={month}><h3 className="scroll-month-title">{fromKey(month).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h3><div className="month-weekdays">{days.slice(0,7).map(d=><span key={d}>{fromKey(d).toLocaleDateString('en-US',{weekday:'short'})}</span>)}</div><div className="month-cells">{days.map(d=><section key={d} className={fromKey(d).getMonth()!==fromKey(month).getMonth()?'outside-month':''} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,d,data.settings.start)}><button className={`month-day ${d===dateKey()?'is-today':''}`} onClick={()=>onSelect(d)}>{fromKey(d).getDate()}</button><button className="month-add" aria-label={`Add event on ${d}`} onClick={()=>onEvent(undefined,data.settings.start,d)}><Plus size={12}/></button>{blocks(d).map(b=><button className={`month-event calendar-layer-${b.layer}`} data-calendar-layer={b.layer} data-virtual={b.virtual} title={b.detail||(b.provider==='google'?'Google Calendar':undefined)} data-calendar-sources={b.sources?.map(s=>s.label).join(',')} key={b.id} style={{borderColor:b.color}} onClick={()=>open(b)}>{b.completed&&<span className="calendar-completion-mark">✓</span>}{!b.allDay&&<small>{clockLabel(b.start,data.settings.timeFormat||'12')} </small>}{b.title}</button>)}{data.tasks.filter(t=>t.date===d&&!t.archived&&!t.deleted&&(completed||!t.done)&&(t.done?prefs.completions:prefs.projections)&&filter(t)&&!blocks(d).some(b=>b.taskId===t.id)).map(t=><button className="month-task" key={t.id} onClick={()=>onTask(t.id)}>{t.done?'✓':'○'} {t.title}</button>)}</section>)}</div></section>;
    })}</div>:<div className="calendar-date-canvas" style={{gridTemplateColumns:`48px repeat(${dates.length},${width}px)`}}><div className="calendar-corner"/>{dates.map(d=><div className="calendar-date-header" data-calendar-date={d} key={d}><button onClick={()=>onSelect(d)}><small>{fromKey(d).toLocaleDateString('en-US',{weekday:'short'})}</small><strong>{fromKey(d).getDate()}</strong><span>{fromKey(d).toLocaleDateString('en-US',{month:'short'})}</span></button><div className="calendar-day-extras">{blocks(d).filter(b=>b.allDay).map(b=><button className={`calendar-all-day calendar-layer-${b.layer}`} data-calendar-layer={b.layer} title={b.detail||(b.provider==='google'?'Google Calendar':undefined)} data-calendar-sources={b.sources?.map(s=>s.label).join(',')} key={b.id} onClick={()=>open(b)}>{b.completed&&<span className="calendar-completion-mark">✓</span>}{b.title}{b.layer==='actual-summary'&&<small> · {b.detail}</small>}</button>)}</div></div>)}<div className="calendar-hours">{Array.from({length:24},(_,h)=><span style={{top:h*56}} key={h}>{clockLabel(h*60,data.settings.timeFormat||'12')}</span>)}</div>{dates.map(d=>{
      const items=blocks(d).filter(b=>!b.allDay).sort((a,b)=>a.start-b.start),placed:{b:CalendarItem;lane:number;count:number}[]=[];
      let group:typeof placed=[],end=0;
      const flush=()=>{const count=Math.max(1,...group.map(g=>g.lane+1));placed.push(...group.map(g=>({...g,count})));group=[];};
      for(const b of items){if(group.length&&b.start>=end)flush();const occupied=new Set(group.filter(g=>g.b.start+Math.max(g.b.minutes,22/56*60)>b.start).map(g=>g.lane));let lane=0;while(occupied.has(lane))lane++;group.push({b,lane,count:1});end=Math.max(b.start+Math.max(b.minutes,22/56*60),group.length===1?0:end);}flush();
      return <div className="calendar-week-day" data-calendar-day={d} key={d}>{Array.from({length:48},(_,i)=><button key={i} className="calendar-grid-slot" style={{top:i*28}} aria-label={`Add event ${d} ${clockLabel(i*30,data.settings.timeFormat||'12')}`} onClick={()=>onEvent(undefined,i*30,d)} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,d,i*30)}/>)}{placed.map(({b,lane,count})=><button key={b.id} className={`calendar-grid-event calendar-layer-${b.layer}`} data-calendar-layer={b.layer} data-virtual={b.virtual} title={b.detail||(b.provider==='google'?'Google Calendar':undefined)} data-calendar-sources={b.sources?.map(s=>s.label).join(',')} style={{top:b.start/60*56,height:Math.max(20,b.minutes/60*56-2),left:`${lane/count*100}%`,width:`calc(${100/count}% - 3px)`,borderColor:b.color,background:`${b.color}25`}} onClick={()=>open(b)}><strong>{b.completed&&<span className="calendar-completion-mark">✓</span>}{b.title}</strong><small>{clockLabel(b.start,data.settings.timeFormat||'12')} – {clockLabel(b.start+b.minutes,data.settings.timeFormat||'12')}</small>{b.minutes>=30&&(b.detail||b.provider==='google')&&<span className="calendar-layer-label">{b.detail||(b.provider==='google'?'Google Calendar':'')}</span>}</button>)}</div>;
    })}</div>}
  </div><div className="calendar-scroll-hint">← Scroll for earlier {monthly?'months':'days'}<span>Scroll for later {monthly?'months':'days'} →</span></div></div>;
}
