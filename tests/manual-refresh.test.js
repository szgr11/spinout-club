import test from 'node:test';
import assert from 'node:assert/strict';
import {manualRefresh} from '../worker/manual-refresh.js';
import worker from '../worker/index.js';

const counts={active_members:4,saved_event_days:2,going:1,garage_vehicles:3,approved_laps:8,pending_laps:0};
const request=(headers={},method='POST')=>new Request('https://spinoutclub.cc/api/admin/refresh',{method,headers:{origin:'https://spinoutclub.cc',authorization:'Bearer test-jwt',...headers}});
function setup(){
 const values=new Map([['calendar','previous valid snapshot']]);
 let runs=0;
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',EVENTS:{get:async key=>values.get(key)||null,put:async(key,value)=>values.set(key,value)}};
 const deps={now:()=>1000000,fetcher:async(url,options)=>{
  assert.equal(url,'https://test.supabase.co/rest/v1/rpc/spinout_service_counts');
  assert.equal(options.headers.Authorization,'Bearer test-jwt');assert.equal(options.headers.apikey,'sb_publishable_test');
  assert.equal(options.body,'{}');return Response.json(counts);
 },refresh:async(kv,config)=>{
  assert.equal(kv,env.EVENTS);assert.equal(config,env);runs++;
  const calendar={updatedAt:new Date().toISOString(),events:[{date:'2099-01-01'}],sources:[]};
  await kv.put('calendar',JSON.stringify(calendar));return calendar;
 }};
 return {env,deps,values,runs:()=>runs};
}

test('manual refresh rejects public, cross-origin and wrong-method calls before data access',async()=>{
 const forbidden={EVENTS:{get:()=>{throw new Error('must not read');}}};
 for(const [r,status] of [[request({},'GET'),405],[request({origin:'https://other.example'}),403],[request({authorization:''}),401]]){
  const result=await manualRefresh(r,forbidden);assert.equal(result.status,status);assert.equal(result.headers.get('cache-control'),'no-store');
 }
 const routed=await worker.fetch(request({authorization:''}),{},{});assert.equal(routed.status,401);
});
test('invalid tokens and non-admin accounts cannot run a refresh',async()=>{
 for(const status of [400,401,403]){
  const s=setup();s.deps.fetcher=async()=>Response.json({message:'not authorized'},{status});
  assert.equal((await manualRefresh(request(),s.env,s.deps)).status,403);assert.equal(s.runs(),0);assert.equal(s.values.has('manual-refresh-at'),false);
 }
});
test('authorization outages, missing configuration and malformed success responses fail closed',async()=>{
 const s=setup();
 assert.equal((await manualRefresh(request(),{},s.deps)).status,503);
 for(const response of [()=>Response.json({},{status:503}),()=>Response.json({error:'not an admin'}),()=>{throw new Error('network');}]){
  s.deps.fetcher=async()=>response();assert.equal((await manualRefresh(request(),s.env,s.deps)).status,503);
 }
 assert.equal(s.runs(),0);assert.equal(s.values.has('manual-refresh-at'),false);
});
test('verified admin refresh publishes new calendar data and returns fresh health and counts',async()=>{
 const s=setup(),response=await manualRefresh(request(),s.env,s.deps),result=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(s.runs(),1);assert.deepEqual(result.counts,counts);assert.equal(result.health.status,'ok');assert.equal(result.health.eventDays,1);
 assert.equal(JSON.parse(s.values.get('calendar')).updatedAt,result.health.updatedAt);
 assert.equal((await manualRefresh(request(),s.env,s.deps)).status,429);assert.equal(s.runs(),1);
 s.deps.now=()=>1060001;assert.equal((await manualRefresh(request(),s.env,s.deps)).status,200);assert.equal(s.runs(),2);
});
test('failed refresh retains the last valid calendar and never exposes internal errors',async()=>{
 const s=setup();s.deps.refresh=async()=>{throw new Error('private credential detail');};
 const response=await manualRefresh(request(),s.env,s.deps);assert.equal(response.status,503);
 assert.equal(s.values.get('calendar'),'previous valid snapshot');assert.doesNotMatch(await response.text(),/private credential/);
});
