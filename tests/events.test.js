import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES,fetchSource,parseDateRange,parseSpeedSF,parseSpeedVentures,parseButtonwillow,mergeEvents,refreshEvents,safeURL } from '../worker/events.js';
import worker from '../worker/index.js';

test('ranges expand into local calendar days, including month and year boundaries',()=>{
 assert.deepEqual(parseDateRange('October 24 - 25, 2026',2026),['2026-10-24','2026-10-25']);
 assert.deepEqual(parseDateRange('Oct 31 – Nov 1',2026),['2026-10-31','2026-11-01']);
 assert.deepEqual(parseDateRange('Dec 31 - Jan 1',2026),['2026-12-31','2027-01-01']);
 assert.deepEqual(parseDateRange('Feb 31',2026),[]);
});
test('organizer adapters retain registration links and expand weekends',()=>{
 const sv=parseSpeedVentures('<section id="getonthetrack"><div><h4>Buttonwillow Raceway Classic</h4><span>October 24 - 25, 2026</span><a class="absolutelink" href="Detail.aspx?id=1034"></a></div></section>');
 assert.equal(sv.length,2);assert.equal(sv[0].url,'https://www.speedventures.com/events/Detail.aspx?id=1034');
 const sf=parseSpeedSF('<div class="ssf-card"><div class="ssf-card-title">Sonoma Raceway</div><div class="ssf-card-date">Oct 31 · Sat</div><a class="ssf-reg-btn" href="https://msreg.com/hpde">HPDE</a><a class="ssf-reg-btn" href="https://msreg.com/autox">AutoX</a></div>',2026);
 assert.equal(sf[0].kind,'Track day');assert.equal(sf[0].url,'https://msreg.com/hpde');
});
test('track feed labels open practice without representing a gate fee as entry price',()=>{
 const result=parseButtonwillow({events:[{title:'Open Test (25ccw)',start_date:'2026-11-01 09:00:00',end_date:'2026-11-01 17:00:00',venue:{venue:'Buttonwillow Raceway Park &#8211; Classic'},organizer:[{organizer:'Buttonwillow Raceway'}],url:'https://buttonwillowraceway.com/event/test/'}]});
 assert.equal(result[0].kind,'Open practice');assert.equal(result[0].track,'Buttonwillow · Classic');assert.equal(result[0].price,undefined);
});
test('track updates include the full next calendar year and follow published pagination',async()=>{
 const original=globalThis.fetch,requested=[];
 globalThis.fetch=async value=>{
  const url=new URL(value);requested.push(url);
  const date=url.searchParams.get('page')==='1'?'2027-01-16':'2027-11-13';
  return Response.json({total_pages:2,events:[{title:'Speed Ventures',start_date:date+' 09:00:00',end_date:date+' 17:00:00',venue:{venue:'Buttonwillow Classic'},url:'https://buttonwillowraceway.com/event/'+date}]});
 };
 try{
  const rows=await fetchSource(SOURCES.find(s=>s.id==='buttonwillow'),'2026-10-17');
  assert.deepEqual(rows.map(e=>e.date),['2027-01-16','2027-11-13']);assert.equal(requested.length,2);
  assert.ok(requested.every(u=>u.searchParams.get('end_date')==='2027-12-31'&&u.searchParams.get('per_page')==='100'));
 }finally{globalThis.fetch=original;}
});
test('SpeedSF checks next-year schedules automatically without accepting a redirected old year',async()=>{
 const original=globalThis.fetch;let published=true;
 globalThis.fetch=async url=>{
  const year=String(url).endsWith('2027')&&published?2027:2026;
  return new Response(`<title>${year} Events</title><div class="ssf-card"><div class="ssf-card-title">Sonoma Raceway</div><div class="ssf-card-date">Jan 16</div><a class="ssf-reg-btn" href="https://msreg.com/hpde">HPDE</a></div>`);
 };
 try{
  const source=SOURCES.find(s=>s.id==='speedsf');
  assert.ok((await fetchSource(source,'2026-10-17')).some(e=>e.date==='2027-01-16'));
  published=false;assert.ok((await fetchSource(source,'2026-10-17')).every(e=>e.date.startsWith('2026')));
 }finally{globalThis.fetch=original;}
});
test('same organizer, track and day merges sources; distinct organizers remain separate',()=>{
 const e={date:'2026-11-01',track:'Buttonwillow · Classic',organizer:'Speed Ventures',kind:'Track day',url:'https://example.com/a',sources:[{id:'speedventures'}]};
 const data=mergeEvents([e,{...e,url:'https://example.com/b',sources:[{id:'buttonwillow'}]},{...e,organizer:'PCA'}],'2026-10-01');
 assert.equal(data.length,2);assert.equal(data[0].sources.length,2);assert.equal(data[0].url,e.url);
 assert.equal(mergeEvents([e],'2027-01-01').length,0);
});
test('Canyon Run aliases share a canonical organizer while distinct days and layouts remain',()=>{
 const old=parseButtonwillow({events:[{title:'Canyon Run',start_date:'2026-11-21 08:00:00',end_date:'2026-11-21 17:00:00',venue:{venue:'Buttonwillow Circuit'},organizer:[{organizer:'Canyon Run Racing'}],url:'https://buttonwillowraceway.com/event/canyon-run/'}]})[0];
 assert.equal(old.organizer,'Canyon Run Sundays');
 const venue={...old,organizer:'Canyon Run Racing'};
 const registration={...old,organizer:'Canyon Run Sundays',sources:[{id:'canyonrunsundays'}],url:'https://www.canyonrunsundays.com/events/buttonwillow-the-circuit'};
 for(const rows of [[venue,registration],[registration,venue]]){
  const merged=mergeEvents([...rows,{...venue,date:'2026-11-22'},{...venue,track:'Buttonwillow · Classic'},{...venue,kind:'Autocross'}],'2026-10-19');
  assert.equal(merged.length,4);assert.ok(merged.every(e=>e.organizer==='Canyon Run Sundays'));
  const event=merged.find(e=>e.date==='2026-11-21'&&e.track===old.track&&e.kind!=='Autocross');
  assert.equal(event.sources.length,2);assert.equal(event.url,registration.url);
 }
 assert.equal(venue.organizer,'Canyon Run Racing');
});
test('public API immediately canonicalizes and merges cached organizer aliases without scraping',async()=>{
 const event={date:'2099-11-21',track:'Buttonwillow · Circuit',organizer:'Canyon Run Racing',kind:'Track day',sources:[{id:'buttonwillow'}],url:'https://buttonwillowraceway.com/event/canyon-run/'};
 const calendar={updatedAt:'2026-10-19T17:02:00Z',sources:[{id:'buttonwillow',status:'ok'}],events:[event,{...event,organizer:'Canyon Run Sunday',sources:[{id:'chuckwalla-calendar'}]}]};
 const response=await worker.fetch(new Request('https://spinoutclub.cc/api/events'),{EVENTS:{get:async()=>calendar}},{});
 assert.equal(response.status,200);const result=await response.json();
 assert.equal(result.events.length,1);assert.equal(result.events[0].organizer,'Canyon Run Sundays');assert.equal(result.events[0].sources.length,2);
 assert.equal(result.updatedAt,calendar.updatedAt);assert.deepEqual(result.sources,calendar.sources);
 assert.equal(calendar.events[0].organizer,'Canyon Run Racing');
});
test('unsafe registration URLs are rejected',()=>{assert.equal(safeURL('javascript:alert(1)'),null);assert.equal(safeURL('data:text/html,no'),null);});
test('abbreviated motorcycle/kart listings are excluded using organizer metadata',()=>{
 const base={start_date:'2026-11-01 09:00:00',end_date:'2026-11-01 17:00:00',venue:{venue:'Buttonwillow Classic'},url:'https://buttonwillowraceway.com/event/test/'};
 assert.equal(parseButtonwillow({events:[{...base,title:'CCKRA',organizer:[{organizer:'Central California Kart Racing Association'}]},{...base,title:'2 Wheel Track Days'},{...base,title:'Track Daz'}]}).length,0);
});
test('upstream failures retain previously verified dates and mark affected sources stale',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('unavailable',{status:503});
 let saved;const previous={sources:[{id:'speedventures',lastSuccess:'2026-10-01T00:00:00Z',count:1}],events:[{date:'2099-01-01',track:'Sonoma',organizer:'Speed Ventures',kind:'Track day',sources:[{id:'speedventures'}]}]};
 try{await refreshEvents({get:async()=>previous,put:async(k,v)=>saved=JSON.parse(v)});assert.equal(saved.events.length,1);assert.ok(saved.sources.every(s=>s.status==='stale'));assert.equal(saved.sources[0].lastSuccess,previous.sources[0].lastSuccess);}finally{globalThis.fetch=original;}
});
