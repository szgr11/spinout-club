import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES,parseOrganizer,mergeEvents,refreshEvents} from '../worker/events.js';
import {calendarDays} from '../worker/organizers.js';
import {ORGANIZERS} from '../src/event-catalog.js';
const parse=(id,html)=>parseOrganizer(html,SOURCES.find(s=>s.id===id),'2026-10-17');

test('catalog retains all 16 organizers without pretending external-only links are feeds',()=>{
 assert.equal(ORGANIZERS.length,16);assert.equal(new Set(ORGANIZERS.map(o=>o.id)).size,16);
 assert.equal(SOURCES.length,15);assert.ok(!SOURCES.some(s=>s.id==='viptrackdays'||s.id==='fastlane'));
});
test('NASA ordinal dates expand correctly and racing-only cards are excluded',()=>{
 const card=types=>`<div class="event-card"><div class="display-name">#5208: Nov 7th - 8th, 2026</div><div class="at"><p>At Sonoma Raceway</p><p class="info-text">${types}</p></div><div class="register"><a href="/events/5208">Register</a></div></div>`;
 const rows=parse('nasa',card('HPDE, Time Trial, Sprint Racing')+card('Sprint Racing'));
 assert.deepEqual(rows.map(e=>e.date),['2026-11-07','2026-11-08']);assert.equal(rows[0].url,'https://members.drivenasa.com/events/5208');
});
test('published event dates override reused registration slugs',()=>{
 const html='<div><div class="event-content"><h3 class="event-title"><a href="/event-registration/may-23-2026/register">Buttonwillow Classic Sunday, December 27, 2026</a></h3></div><span class="event-price">$225</span></div>';
 const rows=parse('extremespeed',html);assert.equal(rows[0].date,'2026-12-27');assert.equal(rows[0].prices[0].text,'Listed $225');
});
test('regional announcements use the heading year and retain registration-pending status',()=>{
 const html='<article><h1 class="entry-title">Schedule</h1><div class="entry"><h6>NASA SoCal 2027 Event Schedule</h6><p>February 27/28 – Chuckwalla Valley Raceway<br>April 17/18 – Buttonwillow Raceway CLASSIC<br>September – Championships (Date to be announced)<br>Nov 6/7 – Podium Club</p></div></article>';
 const rows=parse('nasa-socal-calendar',html);
 assert.deepEqual(rows.map(e=>e.date),['2027-02-27','2027-02-28','2027-04-17','2027-04-18']);
 assert.ok(rows.every(e=>e.organizer==='NASA'&&e.scheduleOnly&&/details pending/.test(e.note)));
 assert.throws(()=>parse('nasa-socal-calendar',html.replace('2027 Event Schedule','Event Schedule')),/Unrecognized/);
});
test('NorCal announcements exclude racing-only days and endurance races despite misleading slugs',()=>{
 const html='<article><h2 class="entry-title"><a rel="bookmark" href="https://nasanorcal.com/2024-2/">NorCal 2027 Calendar</a></h2><div class="entry"><p>All listed events run all race groups and HPDE track days unless otherwise noted.</p><p>May 28-30 Sonoma Raceway</p><p>Nov 6-7 Sonoma Raceway, Saturday racing only! HPDE Intro, 1 and 2 Sunday only</p><p>Dec 11 – 12 Hours of Thunderhill (tentative)</p></div></article>';
 const rows=parse('nasa-norcal-calendar',html);
 assert.deepEqual(rows.map(e=>e.date),['2027-05-28','2027-05-29','2027-05-30','2027-11-07']);
 assert.ok(rows.every(e=>e.kind==='Track day'&&e.url.endsWith('/2024-2/')));
 assert.match(rows.at(-1).note,/Sunday only/);
});
test('regional crossovers merge unambiguous circuits and yield to actual registration',()=>{
 const base={date:'2027-10-16',track:'Buttonwillow',kind:'Track event',organizer:'NASA',scheduleOnly:true,note:'Details pending',sources:[{id:'nasa-norcal-calendar'}]};
 const specific={...base,track:'Buttonwillow · Circuit',sources:[{id:'nasa-socal-calendar'}]};
 const merged=mergeEvents([base,specific],'2026-10-17');assert.equal(merged.length,1);assert.equal(merged[0].track,'Buttonwillow · Circuit');assert.equal(merged[0].sources.length,2);
 const registered={...specific,scheduleOnly:undefined,note:'',url:'https://members.drivenasa.com/events/123',kind:'Track day',sources:[{id:'nasa'}]};
 const upgraded=mergeEvents([base,specific,registered],'2026-10-17');assert.equal(upgraded.length,1);assert.equal(upgraded[0].scheduleOnly,undefined);assert.equal(upgraded[0].note,'');assert.equal(upgraded[0].url,registered.url);
 assert.equal(mergeEvents([base,specific,{...specific,track:'Buttonwillow · Classic'}],'2026-10-17').length,3);
});
test('SDC filters out lunch, passes and rentals while retaining sale pricing',()=>{
 const product=(title,price,cls='')=>`<div class="product-list-item ${cls}"><a class="product-list-item-link" href="/event-registration/p/old-2025-slug" aria-label="${title}"></a><div class="product-list-item-price">${price}</div></div>`;
 const rows=parse('socaldriversclub',product('Chuckwalla CW 12/4/26 [Friday]','Sale Price: $400 Original Price: $475','on-sale')+product('Lunch Ticket - Streets 11/21/26','$24')+product('2027 Track Pass - 4 Pack','$1950'));
 assert.equal(rows.length,1);assert.equal(rows[0].date,'2026-12-04');assert.match(rows[0].promotions[0].text,/\$400/);assert.equal(rows[0].organizer,'SoCal Drivers Club');
});
test('Squarespace uses full dates and drops expired two-digit-year pricing tiers',()=>{
 const html='<div class="eventlist"><article class="eventlist-event"><h1 class="eventlist-title"><a class="eventlist-title-link" href="/event-registration/hill">Thunderhill East &amp; West</a></h1><time class="event-date" datetime="2026-11-28"></time><time class="event-date" datetime="2026-11-29"></time><div class="eventlist-excerpt"><table><tr><td>Early Bird</td><td>$240</td><td>Ends 10/1/26 or 33% sold</td></tr><tr><td>Early Bird registration</td><td>$300</td><td>Ends 10/29/26</td></tr></table></div></article></div>';
 const rows=parse('ongrid',html);assert.equal(rows.length,2);assert.equal(rows[0].track,'Thunderhill · East & West');assert.equal(rows[0].promotions.length,1);assert.equal(rows[0].promotions[0].expiresOn,'2026-10-29');assert.ok(rows[0].prices.every(p=>!p.text.includes('$240')));
});
test('registration profiles exclude cancellations, gift cards and out-of-region venues',()=>{
 const card=(name,status='EventScheduled',venue='Laguna Seca')=>`<div itemtype="http://schema.org/Event"><meta itemprop="eventStatus" content="https://schema.org/${status}"><span itemprop="startDate" content="2026-12-12"></span><meta itemprop="endDate" content="2026-12-13"><h3><a itemprop="url" href="/events/test"><span itemprop="name">${name}</span></a></h3><div itemprop="location"><span itemprop="name">${venue}</span></div><div class="card__event-tags">HPDE</div></div>`;
 const rows=parse('hookedondriving',card('Winter event')+card('Cancelled event','EventCancelled')+card('Gift Cards')+card('East coast event','EventScheduled','Virginia International Raceway'));
 assert.equal(rows.length,2);assert.equal(rows[0].date,'2026-12-12');assert.equal(rows[0].track,'Laguna Seca');
});
test('Wix dates use the event timezone, without phantom UTC days or drift imports',()=>{
 const data=[{id:'a',slug:'sonoma',title:'Sonoma 10/24 & 10/25',location:{name:'Big Willow'},scheduling:{config:{startDate:'2026-10-24T15:00:00Z',endDate:'2026-10-26T01:00:00Z',timeZoneId:'America/Los_Angeles'}}},{id:'b',slug:'drift',title:'Sonoma Drift Event',scheduling:{config:{startDate:'2026-10-24T15:00:00Z'}}}];
 const rows=parse('turn8',`<script id="wix-warmup-data" type="application/json">${JSON.stringify({events:data})}</script>`);assert.deepEqual(rows.map(e=>e.date),['2026-10-24','2026-10-25']);assert.equal(rows[0].track,'Sonoma');
 assert.deepEqual(calendarDays('2026-02-31'),[]);assert.deepEqual(calendarDays('2026-01-01','2026-12-31'),[]);
});
test('aliases merge organizer listings without conflating the two Buttonwillow circuits',()=>{
 const base={date:'2026-12-04',track:'Chuckwalla',kind:'Track day',organizer:'Southern Cal Drivers Club',sources:[{id:'buttonwillow'}]};
 const merged=mergeEvents([base,{...base,organizer:'SoCal Drivers Club',sources:[{id:'socaldriversclub'}]},{...base,track:'Buttonwillow · Classic'},{...base,track:'Buttonwillow · Circuit'}],'2026-10-17');
 assert.equal(merged.length,3);assert.equal(merged.find(e=>e.track==='Chuckwalla').sources.length,2);
});
test('recognized empty schedules clear removed dates, while malformed pages fail',async()=>{
 assert.equal(parse('slipangle','<p>No upcoming events currently.</p>').verifiedEmpty,true);
 assert.throws(()=>parse('speeddistrict','<h1>Maintenance</h1>'),/Unrecognized/);
 const original=globalThis.fetch;globalThis.fetch=async url=>new Response(String(url)==='https://speeddistrict.com/events/'?'<main>No upcoming events</main>':'Unavailable',{status:String(url)==='https://speeddistrict.com/events/'?200:503});
 let saved;const old={events:[],sourceSnapshots:{speeddistrict:[{date:'2099-01-01',track:'Big Willow',organizer:'Speed District',sources:[{id:'speeddistrict'}]}]}};
 try{await refreshEvents({get:async()=>old,put:async(k,v)=>saved=JSON.parse(v)});assert.equal(saved.events.length,0);assert.equal(saved.sources.find(s=>s.id==='speeddistrict').status,'ok');}finally{globalThis.fetch=original;}
});
