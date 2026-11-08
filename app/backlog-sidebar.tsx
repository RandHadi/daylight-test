'use client';
import { useState, type ReactNode } from 'react';
import { ArrowUpRight, BarChart3, Check, Folder, Plus } from 'lucide-react';
import { type State, type Task } from '@/lib/planner-model';
import { buckets } from '@/lib/planner-advanced';
import { ChannelFilter } from './workspace-views';
import { FloatingPanel } from './floating-panel';
import './planner-columns.css';

const horizonStyle=[
  {letter:'W',color:'#73b17b',label:'Someday in the next week'},
  {letter:'M',color:'#acd476',label:'Someday in the next month'},
  {letter:'Q',color:'#d1b966',label:'Someday in the next quarter'},
  {letter:'Y',color:'#b7a2cf',label:'Someday in the next year'},
  {letter:'S',color:'#98abb5',label:'Someday'},
  {letter:'N',color:'#a8a8ac',label:'Never'},
];
const priorities=[['all','All priorities'],['urgent','Urgent'],['high','High'],['medium','Medium'],['low','Low'],['none','No priority']];

export function BacklogSidebar({data,tasks,mobile,close,channel,onChannel,onManage,bucket,onBucket,folder,onFolder,priority,onPriority,onAdd,onOpen,onDrop,renderTask}:{data:State;tasks:Task[];mobile:boolean;close:ReactNode;channel:string;onChannel:(value:string)=>void;onManage:()=>void;bucket:string;onBucket:(value:string)=>void;folder:string;onFolder:(value:string)=>void;priority:string;onPriority:(value:string)=>void;onAdd:(bucket:string)=>void;onOpen:()=>void;onDrop:(event:React.DragEvent)=>void;renderTask:(task:Task)=>ReactNode}) {
 const [popup,setPopup]=useState<{kind:'horizon'|'priority';anchor:HTMLElement}|null>(null);
 const title=folder!=='all'?(folder==='none'?'Uncategorized':data.folders?.find(f=>f.id===folder)?.name||'Backlog tasks'):bucket==='all'?'All backlog tasks':bucket;
 const choose=(fn:(value:string)=>void,value:string)=>{fn(value);setPopup(null);};
 return <aside aria-label="Backlog sidebar" className={`calendar-panel backlog-side ${mobile?'mobile-show':''}`}>
  <div className="calendar-heading"><button className="backlog-scope-button" aria-label="Select backlog view" aria-haspopup="dialog" aria-expanded={popup?.kind==='horizon'} onClick={e=>setPopup(popup?.kind==='horizon'?null:{kind:'horizon',anchor:e.currentTarget})}>{title}</button>{close}</div>
  <div className="backlog-side-scroll" role="region" aria-label="Backlog tasks" tabIndex={0} data-drop-day="" onDragOver={e=>e.preventDefault()} onDrop={onDrop}>
   <div className="backlog-side-heading"><h2>Backlog</h2><button className="icon open-full-backlog" title="Open full backlog" aria-label="Open full backlog" onClick={onOpen}><ArrowUpRight size={16}/></button></div>
   <div className="backlog-side-tools"><ChannelFilter iconOnly data={data} value={channel} onChange={onChannel} onManage={onManage}/><button className={`backlog-tool-button ${priority!=='all'?'has-filter':''}`} title="Filter backlog priority" aria-label="Filter backlog priority" aria-haspopup="dialog" aria-expanded={popup?.kind==='priority'} onClick={e=>setPopup(popup?.kind==='priority'?null:{kind:'priority',anchor:e.currentTarget})}><BarChart3 size={19}/></button></div>
   {buckets.filter(b=>bucket==='all'||b===bucket).map(b=>{const group=tasks.filter(t=>(t.bucket||buckets[0])===b),style=horizonStyle[buckets.indexOf(b)];return <section className="backlog-bucket" key={b} aria-label={style.label}><div className="bucket-heading"><span className="bucket-badge" style={{background:style.color}}>{style.letter}</span><h3>{style.label}</h3><button className="icon" aria-label={`Add task to ${b}`} title={`Add task to ${b}`} onClick={()=>onAdd(b)}><Plus size={19}/></button></div>{group.map(renderTask)}</section>;})}
  </div>
  {popup&&<FloatingPanel anchor={popup.anchor} onClose={()=>setPopup(null)} label={popup.kind==='horizon'?'Backlog view':'Backlog priority'} className="backlog-filter-popup">{popup.kind==='priority'?<><h3>Filter by priority</h3>{priorities.map(([id,label])=><button className="quick-menu-row" key={id} onClick={()=>choose(onPriority,id)}><span>{label}</span>{priority===id&&<Check size={16}/>}</button>)}</>:<><h3>Backlog tasks</h3><button className="quick-menu-row" onClick={()=>{onBucket('all');onFolder('all');setPopup(null);}}><span>All backlog tasks</span>{bucket==='all'&&folder==='all'&&<Check size={16}/>}</button>{buckets.map(b=><button className="quick-menu-row" key={b} onClick={()=>choose(onBucket,b)}><span>{b}</span>{bucket===b&&<Check size={16}/>}</button>)}<div className="quick-menu-divider"/><h3>Folders</h3>{[['all','All folders'],['none','Uncategorized'],...(data.folders||[]).map(f=>[f.id,f.name])].map(([id,label])=><button className="quick-menu-row" key={id} onClick={()=>choose(onFolder,id)}><Folder size={16}/><span>{label}</span>{folder===id&&<Check size={16}/>}</button>)}</>}</FloatingPanel>}
 </aside>;
}
