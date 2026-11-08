import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,task,clockLabel,type State} from '../lib/planner-model.ts';
import {calendarItems,calendarProjection,defaultCalendarDisplay} from '../lib/calendar-display.ts';
import {stateSchema} from '../lib/state-schema.ts';
import {applyCalendarSync} from '../lib/google-calendar.ts';
const day='2026-11-07',now=Date.parse('2026-11-07T08:00:00Z');
function setup():State{const s=initialState(day);s.tasks=[task('Focused work',day,'product',60)];s.blocks=[];s.settings.timezone='UTC';s.settings.calendarDisplay={...defaultCalendarDisplay,hiddenGoogleCalendars:[]};s.sessions=[];return s;}
function tracked(s:State){s.sessions=[{id:'session',taskId:s.tasks[0].id,title:'Focused work',channel:'product',day,seconds:1800,started:Date.parse(day+'T10:15:00Z'),ended:Date.parse(day+'T10:45:00Z'),kind:'timer'}];s.blocks=[{id:'plan',taskId:s.tasks[0].id,title:'Focused work',date:day,start:600,minutes:60,color:'#709b8d'}];}
test('calendar visibility hides only the chosen source and leaves saved events intact',()=>{const s=setup();s.blocks=[{id:'g1',provider:'google',externalCalendarId:'a',title:'Meeting',date:day,start:540,minutes:60,color:'#709b8d'},{id:'g2',provider:'google',externalCalendarId:'b',title:'Other',date:day,start:600,minutes:60,color:'#709b8d'},{id:'local',title:'Local event',date:day,start:700,minutes:30,color:'#709b8d'}];s.settings.calendarDisplay!.hiddenGoogleCalendars=['a'];s.settings.calendarDisplay!.local=false;const before=JSON.stringify(s),items=calendarItems(s,day,{now});assert.deepEqual(items.filter(i=>i.layer==='event').map(i=>i.id),['g2']);assert.equal(JSON.stringify(s),before);assert.ok(items.filter(i=>i.layer==='projection').every(i=>i.start>=660));});
test('projections are virtual, honor busy time, and do not write timeboxes',()=>{const s=setup(),before=JSON.stringify(s);const items=calendarItems(s,day,{now});assert.equal(items.length,1);assert.equal(items[0].start,540);assert.equal(items[0].virtual,true);assert.equal(JSON.stringify(s),before);s.settings.calendarDisplay!.projections=false;assert.equal(calendarItems(s,day,{now}).length,0);});
test('actual and planned layers can be controlled independently',()=>{const s=setup();tracked(s);s.tasks[0].done=true;s.tasks[0].completedOn=day;let items=calendarItems(s,day,{now});assert.deepEqual(items.map(i=>i.layer),['planned','actual']);assert.equal(items.find(i=>i.layer==='actual')?.start,615);assert.equal(items.find(i=>i.layer==='actual')?.minutes,30);s.settings.calendarDisplay!.comparison=false;assert.deepEqual(calendarItems(s,day,{now}).map(i=>i.layer),['actual']);s.settings.calendarDisplay!.completions=false;assert.equal(calendarItems(s,day,{now})[0].completed,false);s.settings.calendarDisplay!.actual=false;assert.deepEqual(calendarItems(s,day,{now}).map(i=>i.layer),['scheduled']);});
test('actual intervals are split at midnight in the planner timezone',()=>{const s=setup();tracked(s);s.settings.timezone='America/Los_Angeles';s.sessions![0]={...s.sessions![0],started:Date.parse('2026-11-08T07:45:00Z'),ended:Date.parse('2026-11-08T08:15:00Z')};const a=calendarItems(s,'2026-11-07',{now}).find(i=>i.layer==='actual')!,b=calendarItems(s,'2026-11-08',{now}).find(i=>i.layer==='actual')!;assert.equal(a.start,1425);assert.equal(a.minutes,15);assert.equal(b.start,0);assert.equal(b.minutes,15);});
test('untimed manual entries remain day summaries instead of invented clock times',()=>{const s=setup();s.sessions=[{id:'manual',taskId:s.tasks[0].id,title:'Focused work',channel:'product',day,seconds:2400,started:0,ended:0,kind:'manual'}];const item=calendarItems(s,day,{now}).find(i=>i.layer==='actual-summary')!;assert.equal(item.allDay,true);assert.equal(item.detail,'40m actual · time not recorded');});
test('legacy imported manual durations no longer draw inferred time slots',()=>{
  const s=setup();tracked(s);s.blocks=[];s.tasks[0].done=true;
  s.sessions![0]={...s.sessions![0],id:'sunsama:example:time:0',kind:'manual'};
  const before=JSON.stringify(s),items=calendarItems(s,day,{now});
  assert.deepEqual(items.map(i=>i.layer),['actual-summary']);
  assert.equal(items[0].detail,'30m actual · time not recorded');
  assert.equal(JSON.stringify(s),before);
  s.sessions![0].timing='interval';
  assert.equal(calendarItems(s,day,{now})[0].layer,'actual');
  assert.equal(stateSchema.parse(s).sessions![0].timing,'interval');
});
test('completion markers include archived history while respecting task and channel filters',()=>{const s=setup();s.tasks[0].done=true;s.tasks[0].archived=true;s.tasks[0].completedOn=day;assert.equal(calendarItems(s,day,{now})[0].layer,'completion');assert.equal(calendarItems(s,day,{now,completed:false}).length,0);assert.equal(calendarItems(s,day,{now,filter:()=>false}).length,0);s.tasks[0].deleted=new Date(now).toISOString();assert.equal(calendarItems(s,day,{now}).length,0);});
test('calendar settings round trip through the saved planner schema',()=>{const s=setup();s.settings.calendarDisplay!.hiddenGoogleCalendars=['personal@example.test'];s.settings.calendarDisplay!.actual=false;assert.deepEqual(stateSchema.parse(s).settings.calendarDisplay,s.settings.calendarDisplay);});

test('full work hours explain missing projections and extended preview never writes schedules',()=>{
 const s=setup();s.blocks=[{id:'busy',title:'Busy afternoon',date:day,start:660,minutes:360,color:'#709b8d',provider:'google'}];
 const at=Date.parse(day+'T13:00:00Z'),before=JSON.stringify(s);
 assert.deepEqual(calendarProjection(s,day,{now:at}).missed,[s.tasks[0].id]);
 assert.equal(calendarItems(s,day,{now:at}).filter(i=>i.layer==='projection').length,0);
 assert.equal(JSON.stringify(s),before);
 s.settings.calendarDisplay!.projectionsOutsideHours=true;const extended=JSON.stringify(s);
 assert.equal(calendarProjection(s,day,{now:at}).missed.length,0);
 const projected=calendarItems(s,day,{now:at}).find(i=>i.layer==='projection')!;
 assert.equal(projected.start,1020);assert.equal(projected.minutes,60);assert.equal(projected.virtual,true);
 assert.equal(JSON.stringify(s),extended);assert.equal(stateSchema.parse(s).settings.calendarDisplay!.projectionsOutsideHours,true);
 s.settings.calendarDisplay!.projections=false;assert.equal(calendarProjection(s,day,{now:at}).blocks.length,0);
});
test('channel filtering gives visible tasks projection slots while hidden saved meetings remain busy',()=>{
 const s=setup();s.tasks[0].minutes=480;s.tasks.push(task('Visible work',day,'personal',30));
 s.blocks=[{id:'busy',title:'Hidden calendar meeting',date:day,start:540,minutes:60,color:'#709b8d',provider:'google',externalCalendarId:'hidden'}];
 s.settings.calendarDisplay!.hiddenGoogleCalendars=['hidden'];
 const rows=calendarItems(s,day,{now,filter:t=>t.channel==='personal'});
 assert.equal(rows.length,1);assert.equal(rows[0].title,'Visible work');assert.equal(rows[0].start,600);
});
test('extended projections preserve the next day start and label midnight correctly',()=>{
 const s=setup();s.settings.calendarDisplay!.projectionsOutsideHours=true;
 const projection=calendarProjection(s,day,{now:Date.parse('2026-11-06T20:00:00Z')});
 assert.equal(projection.blocks[0].start,s.settings.start);
 assert.equal(clockLabel(1440),'12:00 AM');assert.equal(clockLabel(1440,'24'),'00:00');assert.equal(clockLabel(720),'12:00 PM');
});
test('actual toggle shows completed history independently of board completed visibility',()=>{
 const s=setup();tracked(s);s.tasks[0].done=true;s.tasks[0].archived=true;
 assert.equal(calendarItems(s,day,{now,completed:false}).filter(b=>b.layer==='actual').length,1);
 assert.equal(calendarItems(s,day,{now,completed:false,filter:()=>false}).length,0);
 s.settings.calendarDisplay!.actual=false;assert.equal(calendarItems(s,day,{now,completed:false}).length,0);
});
test('legacy actual totals render once with duration metadata and no invented clock interval',()=>{
 const s=setup();s.tasks[0].actual=45;s.tasks[0].done=true;
 let actual=calendarItems(s,day,{now}).filter(b=>b.layer.startsWith('actual'));
 assert.equal(actual.length,1);assert.equal(actual[0].actualMinutes,45);assert.equal(actual[0].allDay,true);
 tracked(s);actual=calendarItems(s,day,{now}).filter(b=>b.layer.startsWith('actual'));
 assert.equal(actual.length,1);assert.equal(actual[0].layer,'actual');assert.equal(actual[0].actualMinutes,30);
});

test('turning projections off hides suggestions but keeps saved timeboxes',()=>{
  const s=setup();tracked(s);s.sessions=[];
  s.tasks.push(task('Unscheduled work',day,'product',30));
  s.settings.calendarDisplay!.projections=false;
  const items=calendarItems(s,day,{now});
  assert.deepEqual(items.map(i=>i.id),['plan']);
  assert.equal(items[0].layer,'scheduled');
  s.settings.calendarDisplay!.local=false;
  assert.deepEqual(calendarItems(s,day,{now}),[]);
});

test('every toggle combination keeps saved, projected, tracked and completed layers independent',()=>{
  for(const local of [false,true])for(const projections of [false,true])for(const actual of [false,true])for(const comparison of [false,true])for(const completions of [false,true]){
    const s=setup();tracked(s);s.tasks[0].done=true;s.tasks[0].completedOn=day;
    s.tasks.push(task('Remaining work',day,'product',30));
    s.blocks.push({id:'local-event',title:'Local appointment',date:day,start:780,minutes:30,color:'#709b8d'});
    s.settings.calendarDisplay={local,projections,actual,comparison,completions,hiddenGoogleCalendars:[]};
    const before=JSON.stringify(s),items=calendarItems(s,day,{now});
    assert.equal(items.some(i=>i.id==='local-event'),local);
    assert.equal(items.some(i=>i.id==='plan'),local&&(!actual||comparison));
    assert.equal(items.some(i=>i.layer==='projection'),projections);
    assert.equal(items.some(i=>i.layer==='actual'),actual);
    assert.equal(items.some(i=>i.completed),completions);
    assert.equal(JSON.stringify(s),before);
  }
});

test('completions add marks without resurrecting hidden scheduled intervals',()=>{
  const s=setup();tracked(s);s.tasks[0].done=true;s.tasks[0].completedOn=day;
  s.settings.calendarDisplay={local:false,projections:false,actual:false,comparison:true,completions:false,hiddenGoogleCalendars:[]};
  assert.deepEqual(calendarItems(s,day,{now}),[]);
  s.settings.calendarDisplay.completions=true;
  const items=calendarItems(s,day,{now});
  assert.deepEqual(items.map(i=>i.layer),['completion']);
  assert.equal(items[0].allDay,true);
});

test('untimed actual totals do not hide a scheduled interval in actual-only mode',()=>{
  const s=setup();tracked(s);s.tasks[0].done=true;
  s.sessions![0]={...s.sessions![0],started:0,ended:0,kind:'manual'};
  s.settings.calendarDisplay!.comparison=false;
  assert.deepEqual(calendarItems(s,day,{now}).map(i=>i.layer),['actual-summary','scheduled']);
});

function matching(){const s=setup();tracked(s);s.tasks[0].done=true;s.tasks[0].completedOn=day;s.sessions![0]={...s.sessions![0],started:Date.parse(day+'T10:00:00Z'),ended:Date.parse(day+'T11:00:00Z'),seconds:3600};s.blocks.push({id:'google-event',title:s.tasks[0].title,date:day,start:600,minutes:60,color:'#779bc1',provider:'google',externalCalendarId:'personal'});return s;}
test('one event with matching Google, planned, and actual times renders one card without changing data',()=>{const s=matching(),before=JSON.stringify(s),items=calendarItems(s,day,{now});assert.equal(items.length,1);assert.equal(items[0].layer,'actual');assert.equal(items[0].googleEventId,'google-event');assert.deepEqual(items[0].sources?.map(s=>s.label),['Google Calendar','Planned time','Actual time']);assert.equal(items[0].detail,'Google · Planned · Actual');assert.equal(JSON.stringify(s),before);});
test('anonymous busy periods stay separate from a task named Busy at the same time',()=>{const s=matching();s.tasks[0].title='Busy';s.blocks.forEach(b=>b.title='Busy');s.blocks[1].busyOnly=true;const items=calendarItems(s,day,{now});assert.equal(items.length,2);assert.equal(items.find(i=>i.busyOnly)?.sources,undefined);assert.equal(items.find(i=>i.taskId)?.googleEventId,undefined);});
test('matching cards respect each display toggle without losing the remaining sources',()=>{for(const google of [true,false])for(const actual of [true,false])for(const comparison of [true,false]){const s=matching();s.settings.calendarDisplay!.actual=actual;s.settings.calendarDisplay!.comparison=comparison;s.settings.calendarDisplay!.hiddenGoogleCalendars=google?[]:['personal'];const items=calendarItems(s,day,{now});assert.equal(items.length,1);const labels=items[0].sources?.map(s=>s.label)||[items[0].layer==='actual'?'Actual time':'Planned time'];assert.equal(labels.includes('Google Calendar'),google&&(!actual||comparison));assert.equal(labels.includes('Actual time'),actual);assert.equal(labels.includes('Planned time'),!actual||comparison);}});
test('different actual times stay distinct from the Google and planned time comparison',()=>{const s=matching();s.sessions![0].started+=15*60000;s.sessions![0].ended+=15*60000;const items=calendarItems(s,day,{now});assert.equal(items.length,2);assert.deepEqual(items[0].sources?.map(s=>s.label),['Google Calendar','Planned time']);assert.equal(items[1].layer,'actual');assert.equal(items[1].start,615);});
test('actual-only mode hides a uniquely linked Google plan but keeps unrelated events',()=>{
  const s=matching();s.sessions![0].started+=15*60000;s.sessions![0].ended+=15*60000;
  s.blocks.push({id:'unrelated',title:'Team meeting',date:day,start:600,minutes:60,color:'#779bc1',provider:'google',externalCalendarId:'personal'});
  s.settings.calendarDisplay!.comparison=false;
  let items=calendarItems(s,day,{now});
  assert.deepEqual(items.map(i=>i.id),['unrelated',`actual:session:${day}`]);
  s.settings.calendarDisplay!.actual=false;
  items=calendarItems(s,day,{now});
  assert.equal(items.length,2);
  assert.ok(items.some(i=>i.googleEventId==='google-event'));
});
test('a visible linked Google event carries completion without a duplicate day marker',()=>{
  const s=matching();s.settings.calendarDisplay!.local=false;s.settings.calendarDisplay!.actual=false;
  const items=calendarItems(s,day,{now});
  assert.equal(items.length,1);assert.equal(items[0].id,'google-event');assert.equal(items[0].completed,true);
});
test('actual-only mode does not hide ambiguous or busy-only Google events',()=>{
  const s=matching();s.settings.calendarDisplay!.comparison=false;
  s.blocks.push({...s.blocks[1],id:'second-google',externalCalendarId:'work'});
  assert.equal(calendarItems(s,day,{now}).filter(i=>i.provider==='google').length,2);
  s.blocks.pop();s.blocks[1].busyOnly=true;
  assert.equal(calendarItems(s,day,{now}).filter(i=>i.busyOnly).length,1);
});
test('identical events from different Google calendars are not collapsed',()=>{const s=matching();s.blocks.push({...s.blocks[1],id:'other-google',externalCalendarId:'work'});const items=calendarItems(s,day,{now});assert.equal(items.length,3);assert.equal(items.filter(i=>i.provider==='google').length,2);assert.equal(items.find(i=>i.taskId)?.sources?.length,2);});
test('two distinct tasks with the same title and time remain separate',()=>{const s=matching(),t={...s.tasks[0],id:'another-task'};s.tasks.push(t);s.blocks.push({...s.blocks[0],id:'another-plan',taskId:t.id});const items=calendarItems(s,day,{now});assert.equal(items.length,3);assert.equal(items.filter(i=>i.taskId).length,2);assert.equal(items.filter(i=>i.provider==='google').length,1);});
test('identical actual entries share one calendar card while preserving every source record',()=>{
  const s=matching();s.sessions!.push({...s.sessions![0],id:'another-actual'});
  const before=JSON.stringify(s),items=calendarItems(s,day,{now});
  assert.equal(items.length,1);assert.equal(items[0].layer,'actual');
  assert.equal(items[0].sources?.filter(source=>source.label==='Actual time').length,2);
  assert.equal(items[0].detail,'Google · Planned · Actual');
  assert.equal(JSON.stringify(s),before);
});
test('partially overlapping actual entries remain separate when their times differ',()=>{
  const s=matching();s.sessions!.push({...s.sessions![0],id:'later-actual',started:s.sessions![0].started+15*60000,ended:s.sessions![0].ended+15*60000});
  const items=calendarItems(s,day,{now});
  assert.equal(items.length,2);assert.equal(items.filter(i=>i.layer==='actual').length,2);
});
test('identical timeboxes share one visual card while preserving both saved schedules',()=>{
  const s=setup();tracked(s);s.sessions=[];s.blocks.push({...s.blocks[0],id:'second-plan'});
  const before=JSON.stringify(s),items=calendarItems(s,day,{now});
  assert.equal(items.length,1);assert.equal(items[0].sources?.length,2);
  assert.equal(JSON.stringify(s),before);
});
test('unchanged calendar refreshes preserve state and event order across windows',()=>{const s=matching();s.blocks.unshift({...s.blocks[1],id:'yesterday',date:'2026-11-06'});s.blocks.reverse();const before=JSON.stringify(s);applyCalendarSync(s,{from:'2026-11-06',to:'2026-11-09',blocks:s.blocks.filter(b=>b.provider==='google').reverse().map(b=>Object.fromEntries(Object.entries(b).reverse()) as typeof b),calendarIds:['personal'],failures:[],fetchedAt:now,connectionRevision:1});assert.equal(JSON.stringify(s),before);applyCalendarSync(s,{from:day,to:'2026-11-09',blocks:structuredClone(s.blocks.filter(b=>b.provider==='google'&&b.date===day)),calendarIds:['personal'],failures:[],fetchedAt:now+1000,connectionRevision:1});assert.equal(JSON.stringify(s),before);});
