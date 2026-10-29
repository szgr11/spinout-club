import test from 'node:test';
import assert from 'node:assert/strict';
import {eventICS,googleCalendarURL,garageSpecs,applyGarageSpecs} from '../src/event-tools.js';
import {calendarHealth,sourceCountHealth,registrationStatus} from '../worker/health.js';
import {extractOffers,publishedOffers,offerExpiry} from '../worker/offers.js';
import worker from '../worker/index.js';

test('garage defaults only fill vehicle specs and keep existing results immutable',()=>{
 const lap={time:'1:30.123',date:'2026-10-19',track:'sow_cw',driver:'Driver',car:'Old car',hp:200,tire:'RT660'};
 const saved={car:'GR86',hp:null,tire:'RE71RS'},filled=applyGarageSpecs(lap,saved);
 assert.equal(filled.time,lap.time);assert.equal(filled.driver,lap.driver);assert.equal(filled.date,lap.date);assert.equal(filled.hp,'');assert.equal(filled.tire,'RE71RS');assert.equal(lap.hp,200);
 assert.deepEqual(garageSpecs({...saved,hp:''}),saved);
 assert.throws(()=>garageSpecs({...saved,hp:-1}),/horsepower/);assert.throws(()=>garageSpecs({...saved,hp:2.5}),/whole/);
});
test('calendar exports preserve all-day dates, escape content and fold UTF-8 lines',()=>{
 const event={id:'day|track|club',date:'2026-12-31',title:'Track, day; '+('赛车'.repeat(40))+'\r\nLOCATION:bad',track:'Buttonwillow',organizer:'Club',url:'https://example.com/event'};
 const ics=eventICS(event,new Date('2026-10-19T12:00:00Z'));
 assert.match(ics,/DTSTART;VALUE=DATE:20261231/);assert.match(ics,/DTEND;VALUE=DATE:20270101/);assert.match(ics,/Track\\, day\\;/);assert.ok(!ics.includes('\r\nLOCATION:bad'));
 assert.ok(ics.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));
 assert.equal(new URL(googleCalendarURL(event)).searchParams.get('dates'),'20261231/20270101');
});
test('calendar checks report delays and count drops without changing snapshots',()=>{
 const snapshot={updatedAt:'2026-10-19T10:00:00Z',events:[{date:'2099-01-01'}],sources:[{id:'a',name:'Club',count:2,status:'ok',dropDetected:true}]};
 assert.equal(calendarHealth(snapshot,Date.parse('2026-10-19T13:00:00Z')).status,'attention');assert.equal(snapshot.sources[0].status,'ok');
 assert.deepEqual(sourceCountHealth(2,{count:10}),{expectedCount:10,dropDetected:true});
 assert.deepEqual(sourceCountHealth(0,{count:2}),{expectedCount:0,dropDetected:false});
 assert.equal(registrationStatus({sources:[{id:'buttonwillow'}]}),'announced');assert.equal(registrationStatus({sources:[{id:'buttonwillow'},{id:'speedventures'}]}),'registration_link');
});
test('generic promotions and impossible or expired deadlines are filtered from cached and new offers',()=>{
 const options={today:'2026-10-19',eventDate:'2026-11-21',url:'https://example.com/event'};
 const texts=['Discount Code','Join our membership program for discounts & perks','NASA gear store discounts','Early Bird pricing ends Sept 31st','Early Bird $200 ends September 30','Save $50 through 2026-11-01'];
 const result=extractOffers(texts.map(t=>`<p>${t}</p>`).join(''),options);
 assert.equal(result.promotions.length,1);assert.match(result.promotions[0].text,/Save \$50/);
 assert.equal(publishedOffers(texts.map(text=>({text})),options.today,options.eventDate).length,1);
 assert.equal(offerExpiry('Early bird ends February 30, 2027'),null);assert.equal(offerExpiry('Early bird ends 02/29/27'),null);
 assert.equal(offerExpiry('Early bird ends December 15','2027-01-10'),'2026-12-15');
 assert.equal(offerExpiry('Register more than 45 days ahead for $50 off','2026-11-21'),'2026-10-07');
 assert.equal(offerExpiry('$400 early bird ends three weeks before the event','2026-11-21'),'2026-10-31');
});
test('aggregate click metrics accept only a fixed small same-origin event',async()=>{
 const request=(body,origin='https://spinoutclub.cc')=>new Request('https://spinoutclub.cc/api/metrics',{method:'POST',headers:{origin},body});
 assert.equal((await worker.fetch(request('registration_click'),{},{})).status,204);
 assert.equal((await worker.fetch(request('secret username'),{},{})).status,400);
 assert.equal((await worker.fetch(request('x'.repeat(50)),{},{})).status,400);
 assert.equal((await worker.fetch(request('registration_click','https://other.example'),{},{})).status,403);
});
test('health checks use one snapshot read and no source crawl',async()=>{
 let calls=0;const response=await worker.fetch(new Request('https://spinoutclub.cc/api/health'),{EVENTS:{get:async()=>{calls++;return null;}}},{});
 assert.equal(response.status,503);assert.equal((await response.json()).status,'unavailable');assert.equal(calls,1);
});
test('manual source policy applies to old snapshots while automatic source failures remain visible',async()=>{
 const snapshot={updatedAt:new Date().toISOString(),events:[],sources:[
  {id:'motorsportreg-api',name:'MotorsportReg',status:'pending_access',count:2,lastSuccess:'2026-10-20T12:00:00Z',dropDetected:true},
  {id:'spring-calendar',name:'Spring Mountain',status:'stale',count:1},
  {id:'speedsf',name:'SpeedSF',status:'stale',count:3},
 ]};
 const health=calendarHealth(snapshot);
 assert.deepEqual(health.issues,['SpeedSF: refresh delayed']);
 assert.equal(health.sources[0].status,'manual');assert.equal(health.sources[0].lastSuccess,snapshot.sources[0].lastSuccess);
 assert.equal(snapshot.sources[0].status,'pending_access');
 const response=await worker.fetch(new Request('https://spinoutclub.cc/api/events'),{EVENTS:{get:async()=>snapshot}},{});
 const data=await response.json();assert.equal(data.sources[0].status,'manual');assert.equal(data.sources[1].status,'manual');assert.equal(data.sources[2].status,'stale');
 const manualOnly={...snapshot,sources:snapshot.sources.slice(0,2)};assert.equal(calendarHealth(manualOnly).status,'ok');
});
