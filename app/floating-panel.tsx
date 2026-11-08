'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './planner-controls.css';

/** A non-modal popup that stays inside the viewport, including in scrolling task lists. */
export function FloatingPanel({anchor,label,onClose,children,className=''}:{anchor:HTMLElement;label:string;onClose:()=>void;children:ReactNode;className?:string}) {
  const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);
  close.current=onClose;
  const [position,setPosition]=useState({left:0,top:0,ready:false});
  useLayoutEffect(()=>{
    const panel=ref.current!;
    const place=()=>{
      if(!anchor.isConnected){close.current();return;}
      const a=anchor.getBoundingClientRect(),p=panel.getBoundingClientRect();
      const below=a.bottom+8,above=a.top-p.height-8;
      setPosition({left:Math.max(8,Math.min(a.left,innerWidth-p.width-8)),top:Math.max(8,Math.min(below+p.height<=innerHeight-8||above<8?below:above,innerHeight-p.height-8)),ready:true});
    };
    place();
    panel.focus({preventScroll:true});
    const outside=(e:PointerEvent)=>{if(!panel.contains(e.target as Node)&&!anchor.contains(e.target as Node))close.current();};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close.current();anchor.focus({preventScroll:true});}};
    const resize=new ResizeObserver(place);resize.observe(panel);
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{resize.disconnect();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[anchor]);
  return createPortal(<div ref={ref} tabIndex={-1} role="dialog" aria-label={label} className={`floating-panel ${className}`} style={{left:position.left,top:position.top,visibility:position.ready?'visible':'hidden'}} onKeyDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>{children}</div>,document.body);
}
