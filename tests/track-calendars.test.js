import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTrack,mergeEvents,fetchSource} from '../worker/events.js';
import {TRACK_SOURCES} from '../worker/track-calendars.js';
const source=id=>TRACK_SOURCES.find(s=>s.id===id);
const ics=blocks=>'BEGIN:VCALENDAR\r\n'+blocks.map(b=>'BEGIN:VEVENT\r\n'+b+'\r\nEND:VEVENT').join('\r\n')+'\r\nEND:VCALENDAR';

test('track ICS uses exclusive end dates, unfolded text and published circuit',()=>{
 const rows=parseTrack(ics(['DTSTART;VALUE=DATE:20270102\r\nDTEND;VALUE=DATE:20270104\r\nRECURRENCE-ID;VALUE=DATE:20270102\r\nSUMMARY:5MI - Hooked on Driv\r\n ing']),source('thunderhill-east-calendar'),'2026-10-17');
 assert.deepEqual(rows.map(e=>e.date),['2027-01-02','2027-01-03']);
 assert.equal(rows[0].track,'Thunderhill · 5 mile');assert.equal(rows[0].organizer,'Hooked on Driving');
 assert.equal(rows[0].url,source('thunderhill-east-calendar').url);assert.equal(rows[0].scheduleOnly,true);
});
test('track ICS filters bookings, motorcycles, races, canceled entries and past dates',()=>{
 const titles=['Available','Private','Tentative','Z2 Track Days','Lucky Dog Racing','Pacific Motorcycle Training','Cars & Coffee|Lakebed','SpeedSF'];
 const blocks=titles.map(title=>`DTSTART;VALUE=DATE:20270102\r\nDTEND;VALUE=DATE:20270103\r\nSUMMARY:${title}`);
 blocks.push('DTSTART;VALUE=DATE:20270102\r\nSUMMARY:OnGrid\r\nSTATUS:CANCELLED','DTSTART;VALUE=DATE:20250102\r\nSUMMARY:OnGrid');
 assert.deepEqual(parseTrack(ics(blocks),source('laguna-calendar'),'2026-10-17').map(e=>e.organizer),['SpeedSF']);
});
test('UTC track events retain Pacific dates and recurring driving events fail visibly',()=>{
 const data=ics(['DTSTART:20270102T020000Z\r\nDTEND:20270102T040000Z\r\nSUMMARY:SpeedSF']);
 assert.equal(parseTrack(data,source('laguna-calendar'),'2026-10-17')[0].date,'2027-01-01');
 assert.throws(()=>parseTrack(ics(['DTSTART;VALUE=DATE:20250102\r\nRRULE:FREQ=YEARLY\r\nSUMMARY:OnGrid']),source('laguna-calendar'),'2026-10-17'),/recurring/);
});
test('Chuckwalla selects confirmed car entries without importing gate fees or members days',()=>{
 const e={start:'2027-01-23T00:00:00',end:'2027-01-23T10:00:00',icon:'racecar.png',gateFee:10};
 const rows=parseTrack([{...e,title:'SCCA SD',description:'<a href="https://msreg.com/sandiego-track-jan-2027">Registration</a>'},{...e,title:'VIP Members - Car'},{...e,title:'RacePace',icon:'motorcycle.png'},{...e,title:'Porsche Owners Club'}],source('chuckwalla-calendar'),'2026-10-17');
 assert.equal(rows.length,1);assert.equal(rows[0].url,'https://msreg.com/sandiego-track-jan-2027');assert.deepEqual(rows[0].prices,[]);assert.equal(rows[0].kind,'Track event');
});
test('speedway calendars safely decode day entries and preserve eligibility notes',()=>{
 const card=(title,day)=>`<a data-name="${title}" data-date="${day}" href="https://example.com/register">${title}</a>`;
 const text=`var sfEvents123 = {\n'01-23-2027' : '${card('Open Track Days - COMPETITION LICENSE PREFERRED','01/23/2027').replaceAll('"','\\"')}','01-24-2027' : '${card('Karting Open Practice','01/24/2027').replaceAll('"','\\"')}'\n};`;
 const rows=parseTrack(text,source('sonoma-calendar'),'2026-10-17');assert.equal(rows.length,1);assert.equal(rows[0].date,'2027-01-23');assert.match(rows[0].note,/Competition license/);
 assert.throws(()=>parseTrack('<html>broken</html>',source('sonoma-calendar')),/Unrecognized/);
 assert.equal(parseTrack('var sfEvents1 = {\n\n};',source('vegas-calendar')).verifiedEmpty,true);
});
test('Willow prices and reserve links belong to the car test day section',()=>{
 const html='<main><div><div><h3>Big Willow Test &amp; Tune Days</h3></div><p>Price: $300 per driver</p><p>Dates: October 23 &amp; November 6, 2026</p><a href="https://trackhero.com/events/create?id=1">Reserve | Oct. 23</a></div><div><div><h3>Karting Open Test Day</h3></div><p>Dates: October 24, 2026</p></div></main>';
 const rows=parseTrack(html,source('willow-calendar'),'2026-10-17');assert.equal(rows.length,2);assert.equal(rows[0].url,'https://trackhero.com/events/create?id=1');assert.equal(rows[0].prices[0].text,'$300 per driver');assert.ok(rows.every(e=>e.kind==='Open practice'));
});
test('track-only generic circuit merges only with an unambiguous organizer circuit; registration wins',()=>{
 const common={date:'2027-01-23',organizer:'SpeedSF',kind:'Track day',sources:[{id:'chuckwalla-calendar'}],track:'Buttonwillow',scheduleOnly:true,trackCalendar:true,url:'https://example.com/calendar'};
 const registered={...common,track:'Buttonwillow · Classic',sources:[{id:'speedsf'}],scheduleOnly:false,trackCalendar:false,url:'https://msreg.com/register'};
 const rows=mergeEvents([common,registered],'2026-10-17');assert.equal(rows.length,1);assert.equal(rows[0].url,registered.url);assert.equal(rows[0].sources.length,2);
 assert.equal(mergeEvents([common,registered,{...registered,track:'Buttonwillow · Circuit'}],'2026-10-17').length,3);
});
test('Chuckwalla checks through next year and Spring Mountain follows all published school pages',async()=>{
 const original=globalThis.fetch;const requested=[];
 globalThis.fetch=async value=>{requested.push(String(value));if(String(value).includes('/calendar/data'))return Response.json([]);return new Response('<div id="eb_docs"></div><a href="/calendar/Page-3">End</a>');};
 try{
  assert.equal((await fetchSource(source('chuckwalla-calendar'),'2026-10-17')).verifiedEmpty,true);
  assert.match(requested[0],/end=2028-01-01/);
  assert.equal((await fetchSource(source('spring-calendar'),'2026-10-17')).verifiedEmpty,true);
  assert.equal(requested.length,4);assert.ok(requested.some(u=>u.endsWith('/Page-3')));
 }finally{globalThis.fetch=original;}
});
