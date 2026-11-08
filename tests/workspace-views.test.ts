import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,task} from '../lib/planner-model.ts';
import {analyticsRows,analyticsCsv,viewDays} from '../lib/workspace-views.ts';
test('calendar week, weekdays and leap month align to user week start',()=>{
 assert.deepEqual(viewDays('2026-11-07','weekdays',false),['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06']);
 assert.equal(viewDays('2026-11-07','week',false)[0],'2026-11-01');
 assert.equal(viewDays('2026-11-07','week',true)[0],'2026-11-02');
 assert.ok(viewDays('2028-02-10','month').includes('2028-02-29'));
 assert.equal(viewDays('2026-12-31','three')[2],'2027-01-02');
});
test('analytics counts sessions on their actual days without double-counting task totals',()=>{
 const s=initialState('2026-11-07');s.tasks=[];s.sessions=[];
 const t=task('A','2026-11-07','personal',60);t.id='a';t.actual=90;t.done=true;t.completedOn='2026-11-07';s.tasks.push(t);
 s.sessions.push({id:'s1',taskId:'a',title:'A',channel:'personal',day:'2026-11-06',seconds:1800,started:0,ended:1800000,kind:'manual'},{id:'s2',taskId:'a',title:'A',channel:'personal',day:'2026-11-07',seconds:3600,started:0,ended:3600000,kind:'manual'});
 const legacy={...t,id:'b',title:'Legacy',actual:20,minutes:25};s.tasks.push(legacy);
 const rows=analyticsRows(s,['2026-11-06','2026-11-07']);assert.equal(rows[0].actual,30);assert.equal(rows[1].actual,80);assert.equal(rows[1].planned,85);assert.equal(rows[1].completed,2);
 s.tasks[0].archived=true;assert.equal(analyticsRows(s,['2026-11-06'])[0].actual,30);
 s.tasks[0].deleted='2026-11-07';assert.equal(analyticsRows(s,['2026-11-06'])[0].actual,0);
});
test('analytics filters contexts, excludes orphan demo history and escapes CSV channel names',()=>{
 const s=initialState('2026-11-07');s.tasks=[];s.channels=[{id:'c',name:'Work, "Research"',context:'Work',color:'#aaaaaa'}];s.sessions=[{id:'x',taskId:'missing',title:'History',channel:'c',day:'2026-11-07',seconds:90,started:0,ended:90000,kind:'legacy'}];
 assert.equal(analyticsRows(s,['2026-11-07'],'Work')[0].actual,0);const historical=task('History','2026-11-07','c',0);historical.id='missing';historical.archived=true;s.tasks.push(historical);const rows=analyticsRows(s,['2026-11-07'],'Work');assert.equal(rows[0].actual,1.5);assert.equal(analyticsRows(s,['2026-11-07'],'Personal')[0].actual,0);assert.ok(analyticsCsv(rows,s).includes('"Work, ""Research""",1.50'));
});
