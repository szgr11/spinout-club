import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSource,enrichEvents,SOURCES,refreshEvents} from '../worker/events.js';
import {MSR_SOURCE,MSR_ENDPOINT,isMSRPage} from '../worker/msr-api.js';
const env={MSR_API_KEY:'synthetic-key-not-a-credential',MSR_API_APPROVED:'true',MSR_ATTRIBUTION_CONFIRMED:'true'};
const name=content=>[{iso:'en-US',content}];
const event=(overrides={})=>({id:'synthetic-event',name:name('HPDE weekend'),eventStart:'2026-11-07T16:00:00Z',eventEnd:'2026-11-09T01:00:00Z',state:'SCHEDULED',status:'REGISTRATION_OPEN',url:'https://www.motorsportreg.com/events/synthetic',organization:{id:'synthetic-org',name:name('Hooked on Driving')},primaryVenue:{id:'synthetic-venue',name:name('Laguna Seca'),geoLocation:{timeZone:'America/Los_Angeles'}},disciplines:{data:[{name:name('HPDE')}]},...overrides});
test('MotorsportReg API is disabled without approval, attribution confirmation and an issued key',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw new Error('No outbound request permitted');};
 try{for(const config of [{},{...env,MSR_API_APPROVED:'false'},{...env,MSR_API_KEY:''},{...env,MSR_ATTRIBUTION_CONFIRMED:'false'}])await assert.rejects(fetchSource(MSR_SOURCE,'2026-10-21',config),e=>e.code==='msr_access_pending');}
 finally{globalThis.fetch=original;}
 assert.ok(!SOURCES.some(s=>['hookedondriving','slipangle','fasttoys'].includes(s.id)));
});
test('approved calendar requests use the documented GraphQL endpoint, secret header, pagination and next-year horizon',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});const input=JSON.parse(options.body).variables.input;
  return Response.json({data:{events:{data:[event({id:input.nextToken?'second':'first'})],errors:[],nextToken:input.nextToken?null:'synthetic-next'}}});
 };
 try{
  const rows=await fetchSource(MSR_SOURCE,'2026-10-21',env);assert.equal(rows.length,4);assert.equal(calls.length,2);
  for(const call of calls){assert.equal(call.url,MSR_ENDPOINT);assert.equal(call.options.headers['x-api-key'],env.MSR_API_KEY);assert.equal(call.options.redirect,'manual');const body=JSON.parse(call.options.body);assert.equal(body.variables.input.eventEnd,'2028-01-01');assert.equal(body.variables.input.geoLocate,false);assert.ok(!/attendee|email|vehicle|payment/i.test(body.query));}
  assert.equal(rows[0].registrationState,'REGISTRATION_OPEN');assert.equal(rows[0].msrEventId,'first');assert.deepEqual(rows.slice(0,2).map(r=>r.date),['2026-11-07','2026-11-08']);
 }finally{globalThis.fetch=original;}
});
test('API mapping excludes canceled, suspended, non-driving and out-of-scope events without inventing prices',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({data:{events:{data:[event({status:'REGISTRATION_CLOSED'}),event({state:'CANCELLED'}),event({state:'SUSPENDED'}),event({disciplines:{data:[{name:name('Social')}]}}),event({primaryVenue:{id:'far',name:name('Virginia International Raceway')}})],nextToken:null,errors:[]}}});
 try{const rows=await fetchSource(MSR_SOURCE,'2026-10-21',env);assert.equal(rows.length,2);assert.match(rows[0].note,/closed/);assert.deepEqual(rows[0].prices,[]);}finally{globalThis.fetch=original;}
});
test('GraphQL partial failures and repeating page tokens never publish a truncated successful snapshot',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({data:{events:{data:[event()],errors:[{errorCode:'partial'}]}}});
  await assert.rejects(fetchSource(MSR_SOURCE,'2026-10-21',env),/returned errors/);
  globalThis.fetch=async()=>Response.json({data:{events:{data:[event()],errors:[],nextToken:'repeated'}}});
  await assert.rejects(fetchSource(MSR_SOURCE,'2026-10-21',env),/pagination repeated/);
 }finally{globalThis.fetch=original;}
});
test('MotorsportReg pages and redirects are never fetched for prices or discounts',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(url);return new Response('',{status:302,headers:{location:'https://www.motorsportreg.com/events/no-html'}});};
 try{
  const urls=['https://www.motorsportreg.com/events/a','https://speedsf.motorsportreg.com/events/a','https://msreg.com/a'];
  for(const url of urls)assert.equal(isMSRPage(url),true);
  await enrichEvents(urls.map(url=>({url,date:'2099-01-01',sources:[MSR_SOURCE]})));assert.equal(calls.length,0);
  await enrichEvents([{url:'https://www.speedventures.com/events/Detail.aspx?id=1',date:'2099-01-01',sources:[{id:'speedventures'}]}]);
  assert.equal(calls.length,1);assert.ok(calls.every(url=>!isMSRPage(url)));
 }finally{globalThis.fetch=original;}
});
test('manual sources retain saved dates without automated fetches or delay warnings',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(url);return new Response('',{status:503});};
 const previous={events:[],sources:[],sourceSnapshots:{hookedondriving:[{title:'Old published date',date:'2099-01-01',track:'Laguna Seca',region:'NorCal',organizer:'Hooked on Driving',url:'https://www.motorsportreg.com/events/synthetic',kind:'Track day',sources:[{id:'hookedondriving'}]}]}};
 const kv={get:async()=>previous,put:async()=>{}};
 try{const r=await refreshEvents(kv);assert.equal(r.events.length,1);assert.notEqual(r.events[0].sourceStale,true);assert.equal(r.sources.find(s=>s.id===MSR_SOURCE.id).status,'on_demand');assert.equal(r.sources.find(s=>s.id==='spring-calendar').status,'on_demand');assert.ok(calls.every(url=>!isMSRPage(url)&&!String(url).includes('calendar.springmountainmotorsports.com')));}finally{globalThis.fetch=original;}
});
