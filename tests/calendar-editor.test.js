import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCalendarChanges,calendarEntryDocument} from '../src/calendar-editor-data.js';
import {parseSpeedSF,fetchSource,SOURCES,refreshEvents} from '../worker/events.js';

const day={id:'source-day',date:'2099-02-01',title:'Track day',track:'Buttonwillow',region:'SoCal',organizer:'Club',kind:'Track day',url:'https://example.com/event',note:''};
test('calendar overrides survive new source data and keep removed/hidden entries off the public list',()=>{
 const source=[day,{...day,id:'hidden'},{...day,id:'removed'}];
 const changes=[{id:day.id,state:'visible',document:{...day,title:'Corrected'}},{id:'hidden',state:'hidden',document:{...day,id:'hidden'}},{id:'removed',state:'removed',document:{...day,id:'removed'}},{id:'staff-new',state:'visible',document:{...day,id:'staff-new'}}];
 const rows=applyCalendarChanges(source,changes,{today:'2099-01-01'});
 assert.equal(rows.length,2);assert.equal(rows.find(e=>e.id===day.id).title,'Corrected');
 assert.equal(applyCalendarChanges(source,changes,{includeHidden:true}).length,4);
 assert.equal(applyCalendarChanges(source,[{id:'hidden',state:'hidden',document:null},{id:'removed',state:'removed',document:null}]).length,1);
 assert.equal(source[0].title,'Track day');assert.equal(applyCalendarChanges(source,changes,{today:'2100-01-01'}).length,0);
});
test('calendar form validates real dates, HTTPS links and required fields',()=>{
 assert.equal(calendarEntryDocument(day).sources[0].id,'staff-calendar');
 for(const patch of [{date:'2027-02-30'},{url:'javascript:bad'},{title:''},{region:'Other'}])assert.throws(()=>calendarEntryDocument({...day,...patch}));
 assert.equal(calendarEntryDocument({...day,_revision:'private',editorState:'hidden'})._revision,undefined);
});
test('SpeedSF combined schedule imports 2027 preliminary cards with real source links and no invented TBA dates',()=>{
 const html=`<div class="ssf-card"><div class="ssf-card-title">Sonoma</div><div class="ssf-card-date">Nov 28–29</div><a class="ssf-reg-btn" href="https://example.com/register">Register</a></div>
 <div class="ssf27-card"><div class="ssf27-title">Thunderhill East</div><div class="ssf27-venue">Thunderhill Raceway Park — East</div><div class="ssf27-date">Jan 9–10 · Sat/Sun</div><div class="ssf27-reg">Registration opens soon</div></div>
 <div class="ssf27-card"><div class="ssf27-title">Laguna Seca</div><div class="ssf27-date">Dates TBA</div></div>`;
 const rows=parseSpeedSF(html,2026);assert.equal(rows.length,4);
 const next=rows.filter(e=>e.date.startsWith('2027'));assert.deepEqual(next.map(e=>e.date),['2027-01-09','2027-01-10']);
 assert.ok(next.every(e=>e.scheduleOnly&&e.url==='https://www.speedsf.com/events2026'));assert.ok(rows.every(e=>!e.url.includes('undefined')));
});
test('legacy MotorsportReg listings run only on a manual trigger, sequentially and without following event pages',async()=>{
 const original=globalThis.fetch,calls=[];let active=0,maxActive=0;
 globalThis.fetch=async url=>{calls.push(String(url));active++;maxActive=Math.max(maxActive,active);await Promise.resolve();active--;
  return new Response('<div itemtype="https://schema.org/Event"><h3><span itemprop="name">Laguna Seca Track Day</span></h3><div itemprop="location"><span itemprop="name">Laguna Seca</span></div><span class="card__event-tags">HPDE</span><meta itemprop="startDate" content="2099-03-04"><meta itemprop="endDate" content="2099-03-04"><a itemprop="url" href="/events/synthetic">Register</a></div>');
 };
 try{const rows=await fetchSource(SOURCES.find(s=>s.id==='motorsportreg-api'),'2026-10-28',{}, {manual:true});assert.equal(rows.length,3);assert.equal(calls.length,3);assert.equal(maxActive,1);assert.ok(calls.every(url=>url.includes('/orgs/')),JSON.stringify(calls));assert.ok(rows.every(e=>e.date==='2099-03-04'));}
 finally{globalThis.fetch=original;}
});
test('SpeedSF keeps legacy cards in their actual year when a combined schedule is reached through a newer URL',()=>{
 const rows=parseSpeedSF('<title>2026 &amp; 2027 Events</title><link rel="canonical" href="https://www.speedsf.com/events2026"><div class="ssf-card"><div class="ssf-card-title">Sonoma</div><div class="ssf-card-date">Nov 28</div></div><div class="ssf27-card"><div class="ssf27-title">Sonoma</div><div class="ssf27-date">Feb 27</div></div>',2027);
 assert.deepEqual(rows.map(e=>e.date),['2026-11-28','2027-02-27']);
 assert.ok(rows.every(e=>e.url==='https://www.speedsf.com/events2026'));
});
