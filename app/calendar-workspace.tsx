'use client';
import {useEffect,useLayoutEffect,useRef,useState,type DragEvent,type KeyboardEvent} from 'react';
import {Plus} from 'lucide-react';
import {dateKey,fromKey,clockLabel,type State,type Block} from '@/lib/planner-model';
import {viewDays,type CalendarLayout} from '@/lib/workspace-views';
import {calendarAnchor,calendarWindow,shiftCalendarDate} from '@/lib/calendar-scroll';
import './calendar-workspace.css';

type Props={data:State;day:string;layout:CalendarLayout;filter:(t:State['tasks'][number])=>boolean;completed:boolean;onTask:(id:string)=>void;onEvent:(id?:string,start?:number,day?:string)=>void;onSelect:(d:string)=>void;onDrop:(id:string,d:string,start:number)=>void};

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
function CalendarStrip({data,day,layout,filter,completed,onTask,onEvent,onSelect,onDrop}:Props) {
  const {ref,dates,width,onScroll,onKeyDown}=useCalendarStrip(day,layout,data.settings.weekStartsMonday,onSelect);
  const monthly=layout==='month';
  useEffect(()=>{if(!monthly&&ref.current)ref.current.scrollTop=Math.max(0,(data.settings.start/60-1)*56);},[]);
  const blocks=(d:string)=>data.blocks.filter(b=>b.date===d&&(!b.taskId||data.tasks.some(t=>t.id===b.taskId&&!t.deleted&&!t.archived&&(completed||!t.done)&&filter(t))));
  const open=(b:Block)=>b.taskId?onTask(b.taskId):onEvent(b.id,undefined,b.date);
  const drop=(e:DragEvent,d:string,min:number)=>{e.preventDefault();const v=e.dataTransfer.getData('text/plain');if(v.startsWith('task:'))onDrop(v.slice(5),d,min);};
  return <div className="scrollable-calendar"><div ref={ref} className={`calendar-date-scroll ${monthly?'calendar-month-scroll':''}`} role="region" aria-label={monthly?'Calendar months. Scroll left or right for more months.':'Calendar dates. Scroll left or right for more days, up or down for hours.'} tabIndex={0} onScroll={onScroll} onKeyDown={onKeyDown}>
    {monthly?<div className="calendar-month-strip" style={{gridTemplateColumns:`repeat(${dates.length},${width}px)`}}>{dates.map(month=>{
      const days=viewDays(month,'month',data.settings.weekStartsMonday);
      return <section className="month-workspace" data-calendar-month={month} key={month}><h3 className="scroll-month-title">{fromKey(month).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h3><div className="month-weekdays">{days.slice(0,7).map(d=><span key={d}>{fromKey(d).toLocaleDateString('en-US',{weekday:'short'})}</span>)}</div><div className="month-cells">{days.map(d=><section key={d} className={fromKey(d).getMonth()!==fromKey(month).getMonth()?'outside-month':''} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,d,data.settings.start)}><button className={`month-day ${d===dateKey()?'is-today':''}`} onClick={()=>onSelect(d)}>{fromKey(d).getDate()}</button><button className="month-add" aria-label={`Add event on ${d}`} onClick={()=>onEvent(undefined,data.settings.start,d)}><Plus size={12}/></button>{blocks(d).map(b=><button className="month-event" key={b.id} style={{borderColor:b.color}} onClick={()=>open(b)}>{!b.allDay&&<small>{clockLabel(b.start,data.settings.timeFormat||'12')} </small>}{b.title}</button>)}{data.tasks.filter(t=>t.date===d&&!t.archived&&!t.deleted&&(completed||!t.done)&&filter(t)&&!blocks(d).some(b=>b.taskId===t.id)).map(t=><button className="month-task" key={t.id} onClick={()=>onTask(t.id)}>{t.done?'✓':'○'} {t.title}</button>)}</section>)}</div></section>;
    })}</div>:<div className="calendar-date-canvas" style={{gridTemplateColumns:`48px repeat(${dates.length},${width}px)`}}><div className="calendar-corner"/>{dates.map(d=><div className="calendar-date-header" data-calendar-date={d} key={d}><button onClick={()=>onSelect(d)}><small>{fromKey(d).toLocaleDateString('en-US',{weekday:'short'})}</small><strong>{fromKey(d).getDate()}</strong><span>{fromKey(d).toLocaleDateString('en-US',{month:'short'})}</span></button>{blocks(d).filter(b=>b.allDay).map(b=><button className="calendar-all-day" key={b.id} onClick={()=>open(b)}>{b.title}</button>)}</div>)}<div className="calendar-hours">{Array.from({length:24},(_,h)=><span style={{top:h*56}} key={h}>{clockLabel(h*60,data.settings.timeFormat||'12')}</span>)}</div>{dates.map(d=>{
      const items=blocks(d).filter(b=>!b.allDay).sort((a,b)=>a.start-b.start),placed:{b:Block;lane:number;count:number}[]=[];
      let group:typeof placed=[],end=0;
      const flush=()=>{const count=Math.max(1,...group.map(g=>g.lane+1));placed.push(...group.map(g=>({...g,count})));group=[];};
      for(const b of items){if(group.length&&b.start>=end)flush();const occupied=new Set(group.filter(g=>g.b.start+g.b.minutes>b.start).map(g=>g.lane));let lane=0;while(occupied.has(lane))lane++;group.push({b,lane,count:1});end=Math.max(b.start+b.minutes,group.length===1?0:end);}flush();
      return <div className="calendar-week-day" data-calendar-day={d} key={d}>{Array.from({length:48},(_,i)=><button key={i} className="calendar-grid-slot" style={{top:i*28}} aria-label={`Add event ${d} ${clockLabel(i*30,data.settings.timeFormat||'12')}`} onClick={()=>onEvent(undefined,i*30,d)} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,d,i*30)}/>)}{placed.map(({b,lane,count})=><button key={b.id} className="calendar-grid-event" style={{top:b.start/60*56,height:Math.max(20,b.minutes/60*56-2),left:`${lane/count*100}%`,width:`calc(${100/count}% - 3px)`,borderColor:b.color,background:`${b.color}25`}} onClick={()=>open(b)}><strong>{b.title}</strong><small>{clockLabel(b.start,data.settings.timeFormat||'12')}</small></button>)}</div>;
    })}</div>}
  </div><div className="calendar-scroll-hint">← Scroll for earlier {monthly?'months':'days'}<span>Scroll for later {monthly?'months':'days'} →</span></div></div>;
}
