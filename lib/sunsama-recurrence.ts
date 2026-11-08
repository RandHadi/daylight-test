import {type State,type Task,type RecurrenceRule,uid,fromKey} from './planner-model.ts';
import {generateOccurrences} from './planner-advanced.ts';
export function suggestedRepeat(text:string,day:string):RecurrenceRule|undefined {
  const raw=text.trim().toUpperCase(),base={interval:1,weekdays:[] as number[],until:''};
  if(raw==='REPEATS EVERY DAY')return {...base,frequency:'daily'};
  if(raw==='REPEATS EVERY WEEKDAY')return {...base,frequency:'weekly',weekdays:[1,2,3,4,5]};
  const parts=raw.replace(/^RRULE:/,'').split(';').map(p=>p.split('='));
  if(parts.some(([k,v])=>!['FREQ','INTERVAL','BYDAY','UNTIL'].includes(k)||!v))return;
  const r=Object.fromEntries(parts),interval=Number(r.INTERVAL||1);
  if(!['DAILY','WEEKLY','MONTHLY'].includes(r.FREQ)||!Number.isInteger(interval)||interval<1||interval>365)return;
  // More complicated monthly/day-position rules need manual review.
  if(r.BYDAY&&r.FREQ!=='WEEKLY')return;
  const days=['SU','MO','TU','WE','TH','FR','SA'],weekdays=r.BYDAY?r.BYDAY.split(',').map((d:string)=>days.indexOf(d)):[fromKey(day).getDay()];
  if(weekdays.some((d:number)=>d<0))return;
  if(r.UNTIL&&!/^\d{8}$/.test(r.UNTIL))return;
  const until=r.UNTIL?`${r.UNTIL.slice(0,4)}-${r.UNTIL.slice(4,6)}-${r.UNTIL.slice(6,8)}`:'';
  return {frequency:r.FREQ.toLowerCase() as RecurrenceRule['frequency'],interval,weekdays:r.FREQ==='WEEKLY'?[...new Set(weekdays)] as number[]:[],until};
}
export function repeatReviewGroups(s:State):Task[][] {
  const groups=new Map<string,Task[]>();
  for(const t of s.tasks){if(t.deleted||t.seriesId||t.sunsamaImport?.repeatReview!=='pending'||!t.sunsamaImport.repeatText)continue;
    const key=JSON.stringify([t.title.normalize('NFKC').trim().toLowerCase(),t.channel,t.sunsamaImport.repeatText]);
    groups.set(key,[...(groups.get(key)||[]),t]);
  }
  return [...groups.values()];
}
/** Called only after the user reviews the members, rule, and starting date. */
export function enableImportedRepeat(s:State,ids:string[],rule:RecurrenceRule,start:string,preferred?:number):void {
  const members=s.tasks.filter(t=>ids.includes(t.id)&&!t.deleted);
  if(!members.length||members.length!==new Set(ids).size||members.some(t=>t.seriesId))throw new Error('These occurrences changed. Review them again.');
  if(s.series?.length&&s.series.length>=1000)throw new Error('The planner has reached its repeating-series limit.');
  if(s.series?.some(r=>!r.stopped&&r.template.title.toLowerCase()===members[0].title.toLowerCase()&&r.template.channel===members[0].channel))throw new Error('A matching active series already exists. Keep these imported occurrences without creating another.');
  const template=structuredClone([...members].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]);
  const id=uid();Object.assign(template,{seriesId:id,recurrence:'custom',rule,preferred,rigid:preferred!==undefined,calendarLink:undefined,sunsamaImport:undefined,activity:[],comments:[]});
  s.series??=[];s.series.push({id,anchor:start,rule,template});
  for(const t of members){t.seriesId=id;t.occurrence=t.sunsamaImport?.originalDate||t.date||start;t.recurrence='custom';t.rule=structuredClone(rule);if(t.sunsamaImport)t.sunsamaImport.repeatReview='enabled';}
  generateOccurrences(s,start);
}
