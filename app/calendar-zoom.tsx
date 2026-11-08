'use client';
import {useLayoutEffect,useRef,type RefObject} from 'react';
import {Minus,Plus} from 'lucide-react';
import './calendar-zoom.css';

const levels=[0.5,0.75,1,1.25,1.5,1.75,2];
export function calendarZoom(value:unknown):number {
  return typeof value==='number'&&levels.includes(value)?value:1;
}
export function CalendarZoom({value,onChange,label='Calendar zoom'}:{value:number;onChange:(value:number)=>void;label?:string}) {
  const index=levels.indexOf(calendarZoom(value));
  return <div className="calendar-zoom" role="group" aria-label={label}>
    <button type="button" aria-label="Zoom out calendar" title="Zoom out · show more hours" disabled={index===0} onClick={()=>onChange(levels[index-1])}><Minus size={14}/></button>
    <button type="button" className="calendar-zoom-reset" aria-label={`Calendar zoom ${Math.round(value*100)}%. Reset to 100%`} title="Reset calendar zoom to 100%" onClick={()=>onChange(1)}><span aria-live="polite">{Math.round(value*100)}%</span></button>
    <button type="button" aria-label="Zoom in calendar" title="Zoom in · taller time slots" disabled={index===levels.length-1} onClick={()=>onChange(levels[index+1])}><Plus size={14}/></button>
  </div>;
}

/** Retain the visible time when the hour scale changes; leave date scrolling alone. */
export function useTimelineZoom(ref:RefObject<HTMLDivElement|null>,hourHeight:number) {
  const previous=useRef<{element:HTMLDivElement;height:number;top:number}|null>(null);
  useLayoutEffect(()=>{
    const element=ref.current,old=previous.current;
    if(!element){previous.current=null;return;}
    // The browser may clamp scrollTop as the grid shrinks. Use the position
    // recorded before resizing so zooming out near midnight keeps its anchor.
    if(element&&old?.element===element&&old.height!==hourHeight)
      element.scrollTop=old.top/old.height*hourHeight;
    const current={element,height:hourHeight,top:element.scrollTop};
    previous.current=current;
    const remember=()=>{current.top=element.scrollTop;};
    element.addEventListener('scroll',remember,{passive:true});
    return()=>element.removeEventListener('scroll',remember);
  });
}
