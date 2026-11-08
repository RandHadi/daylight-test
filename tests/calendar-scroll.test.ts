import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarAnchor,calendarWindow,shiftCalendarDate} from '../lib/calendar-scroll.ts';
test('continuous date windows cross month, year, and DST boundaries',()=>{
 assert.deepEqual(calendarWindow('2026-12-30',4,'three'),['2026-12-30','2026-12-31','2027-01-01','2027-01-02']);
 assert.equal(shiftCalendarDate('2026-11-02',-3,'week'),'2026-10-30');
 assert.equal(calendarAnchor('2026-11-07','week',false),'2026-11-01');
 assert.equal(calendarAnchor('2026-11-07','week',true),'2026-11-02');
});
test('weekday windows skip weekends in either direction and rebase without changing dates',()=>{
 assert.deepEqual(calendarWindow('2026-11-06',3,'weekdays'),['2026-11-06','2026-11-09','2026-11-10']);
 assert.equal(shiftCalendarDate('2026-11-09',-1,'weekdays'),'2026-11-06');
 const anchor='2026-11-06',start=shiftCalendarDate(anchor,-14,'weekdays');assert.equal(calendarWindow(start,33,'weekdays')[14],anchor);
});
test('month scrolling always lands on the first, including leap months',()=>{
 assert.equal(calendarAnchor('2028-02-29','month',true),'2028-02-01');
 assert.deepEqual(calendarWindow('2027-12-01',4,'month'),['2027-12-01','2028-01-01','2028-02-01','2028-03-01']);
 assert.equal(shiftCalendarDate('2028-03-31',-1,'month'),'2028-02-01');
});
