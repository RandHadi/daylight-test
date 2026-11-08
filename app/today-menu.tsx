'use client';
import { useState } from 'react';
import { CalendarDays, ArrowLeft, ArrowRight } from 'lucide-react';
import { shiftDate } from '@/lib/planner-model';
import { DatePicker } from './task-details';
import { FloatingPanel } from './floating-panel';

export function TodayMenu({selected,today,monday,visibleDays,onSelect}:{selected:string;today:string;monday:boolean;visibleDays:string[];onSelect:(day:string)=>void}) {
  const [anchor,setAnchor]=useState<HTMLButtonElement|null>(null);
  const choose=(day:string)=>{onSelect(day);setAnchor(null);};
  return <><button className="planner-menu-trigger" aria-label="Today date menu" aria-expanded={!!anchor} aria-haspopup="dialog" onClick={e=>setAnchor(anchor?null:e.currentTarget)}><CalendarDays size={15}/>Today</button>{anchor&&<FloatingPanel anchor={anchor} label="Go to date" onClose={()=>setAnchor(null)} className="today-menu"><div className="date-navigation-actions"><button onClick={()=>choose(today)}>Go to today<kbd>⇧ Space</kbd></button><button onClick={()=>choose(shiftDate(selected,1))}>Go to next day<kbd>⇧ <ArrowRight size={15}/></kbd></button><button onClick={()=>choose(shiftDate(selected,-1))}>Go to previous day<kbd>⇧ <ArrowLeft size={15}/></kbd></button></div><DatePicker value={selected} today={today} monday={monday} label="Go to date" range={visibleDays} onPick={choose}/></FloatingPanel>}</>;
}
