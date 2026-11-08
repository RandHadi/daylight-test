import {dateKey,fromKey,shiftDate} from './planner-model.ts';
import {viewDays,type CalendarLayout} from './workspace-views.ts';

export function calendarAnchor(day:string,layout:CalendarLayout,monday:boolean) {
  return layout==='month'?`${day.slice(0,7)}-01`:viewDays(day,layout,monday)[0];
}
export function shiftCalendarDate(day:string,amount:number,layout:CalendarLayout):string {
  if(layout==='month') {const d=fromKey(day);return dateKey(new Date(d.getFullYear(),d.getMonth()+amount,1));}
  if(layout!=='weekdays')return shiftDate(day,amount);
  let result=day;
  for(let i=0;i<Math.abs(amount);i++){do{result=shiftDate(result,Math.sign(amount));}while([0,6].includes(fromKey(result).getDay()));}
  return result;
}
export function calendarWindow(start:string,count:number,layout:CalendarLayout) {
  return Array.from({length:count},(_,i)=>shiftCalendarDate(start,i,layout));
}
