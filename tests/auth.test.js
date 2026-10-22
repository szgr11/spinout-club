import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,validChallenge} from '../supabase/functions/club-auth/handler.js';
const request=body=>new Request('https://example.com/functions/v1/club-auth',{method:'POST',headers:{Origin:'https://spinoutclub.cc','Content-Type':'application/json'},body:JSON.stringify(body)});
test('challenge proof requires exact production hostname, action and boolean success',()=>{
 assert.equal(validChallenge({success:true,action:'application',hostname:'spinoutclub.cc'},'application'),true);
 for(const v of [{success:true,action:'login',hostname:'spinoutclub.cc'},{success:true,action:'application',hostname:'localhost'},{success:'true',action:'application',hostname:'spinoutclub.cc'},{success:true,action:'application',hostname:'spinoutclub.cc.evil.test'}])assert.equal(validChallenge(v,'application'),false);
});
test('anonymous application never reaches the database',async()=>{
 const handler=createHandler({admin:{rpc:()=>{throw new Error('must not run');}},client:{}});
 assert.equal((await handler(request({action:'application',captcha:'token'}))).status,401);
});
test('forged application JWT is rejected before challenge or writes',async()=>{
 const handler=createHandler({admin:{auth:{getUser:async()=>({data:{user:null},error:{message:'bad token'}})},rpc:()=>{throw new Error('must not run');}},client:{}});
 const r=request({action:'application',captcha:'token'});r.headers.set('Authorization','Bearer forged');assert.equal((await handler(r)).status,401);
});
test('missing and replayed bot tokens cannot issue sessions',async()=>{
 let writes=0;
 const handler=createHandler({admin:{rpc:async name=>name==='spinout_security_config'?{data:{turnstile_secret:'test-only'}}:name==='spinout_rate_limit'?{data:true}:(writes++,{data:null})},client:{},fetcher:async()=>Response.json({success:false,'error-codes':['timeout-or-duplicate']})});
 assert.equal((await handler(request({action:'login',username:'admin',password:'wrong'}))).status,403);
 assert.equal((await handler(request({action:'login',username:'admin',password:'wrong',captcha:'used'}))).status,403);assert.equal(writes,0);
});
test('rate limit failure fails closed before password lookup',async()=>{
 const handler=createHandler({admin:{rpc:async name=>name==='spinout_security_config'?{data:{turnstile_secret:'test-only'}}:{data:false}},client:{},fetcher:()=>{throw new Error('must not verify');}});
 assert.equal((await handler(request({action:'login',username:'admin',password:'wrong',captcha:'token'}))).status,429);
});
test('untrusted origin and oversized requests are rejected',async()=>{
 const handler=createHandler({admin:{},client:{}}),r=request({});r.headers.set('Origin','https://evil.test');assert.equal((await handler(r)).status,403);
 assert.equal((await handler(request({action:'login',padding:'a'.repeat(9000)}))).status,413);
});
const verified=(action)=>async()=>Response.json({success:true,action,hostname:'spinoutclub.cc'});
test('a valid legacy login returns signed tokens from Auth, never a browser-created identity',async()=>{
 const calls=[];
 const handler=createHandler({admin:{rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='spinout_security_config'?{turnstile_secret:'test-only'}:name==='spinout_verify_legacy'?{username:'member',auth_user_id:'member-auth-id'}:true};},auth:{admin:{getUserById:async()=>({data:{user:{email:'member@members.spinoutclub.cc'}}}),generateLink:async()=>({data:{properties:{hashed_token:'single-use-test-proof'}}})}}},client:{auth:{verifyOtp:async args=>{assert.deepEqual(args,{token_hash:'single-use-test-proof',type:'email'});return {data:{session:{access_token:'signed-test-access',refresh_token:'signed-test-refresh'}}};}}},fetcher:verified('login')});
 const r=await handler(request({action:'login',username:'MEMBER',password:'test-password',captcha:'fresh'}));
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{access_token:'signed-test-access',refresh_token:'signed-test-refresh'});
 assert.equal(calls.find(([name])=>name==='spinout_verify_legacy')[1].p_username,'member');
});
test('verified applications bind to the server-verified identity and enforce identity quotas',async()=>{
 let writes=0,allow=true;
 const handler=createHandler({admin:{auth:{getUser:async()=>({data:{user:{id:'verified-id',email_confirmed_at:'2026-10-17'}}})},rpc:async(name,args)=>{
  if(name==='spinout_security_config')return {data:{turnstile_secret:'test-only'}};
  if(name==='spinout_rate_limit')return {data:args.p_key.startsWith('application-user:')?allow:true};
  assert.equal(name,'spinout_submit_application');assert.equal(args.p_auth_id,'verified-id');writes++;return {};
 }},client:{},fetcher:verified('application')});
 const make=()=>{const r=request({action:'application',username:'driver',nickname:'Driver',reason:'I enjoy track days',captcha:'fresh',auth_user_id:'forged-id'});r.headers.set('Authorization','Bearer verified-token');return r;};
 assert.equal((await handler(make())).status,200);allow=false;assert.equal((await handler(make())).status,429);assert.equal(writes,1);
});
test('email sign-in requires bot proof and always uses the production member redirect',async()=>{
 let sent=0;
 const handler=createHandler({admin:{rpc:async name=>({data:name==='spinout_security_config'?{turnstile_secret:'test-only'}:true})},client:{auth:{signInWithOtp:async args=>{sent++;assert.deepEqual(args,{email:'driver@example.com',options:{emailRedirectTo:'https://spinoutclub.cc/members'}});return {};}}},fetcher:verified('email')});
 assert.equal((await handler(request({action:'email',email:'driver@example.com'}))).status,403);
 assert.equal((await handler(request({action:'email',email:'driver@example.com',captcha:'fresh',redirectTo:'https://evil.test'}))).status,200);assert.equal(sent,1);
 assert.equal((await handler(request({action:'email',email:'fake@members.spinoutclub.cc',captcha:'fresh'}))).status,400);
});
test('unverified email and successful proofs for the wrong action cannot submit',async()=>{
 const handler=createHandler({admin:{auth:{getUser:async()=>({data:{user:{id:'unverified'}}})}},client:{}});
 const r=request({action:'application',captcha:'fresh'});r.headers.set('Authorization','Bearer test');assert.equal((await handler(r)).status,401);
 const wrong=createHandler({admin:{rpc:async name=>({data:name==='spinout_security_config'?{turnstile_secret:'test-only'}:true})},client:{},fetcher:verified('email')});
 assert.equal((await wrong(request({action:'login',username:'member',password:'wrong',captcha:'fresh'}))).status,403);
});
test('public complaints require bot proof and quotas, ignore forged staff fields, and expose no record data',async()=>{
 let writes=0,allowed=true;
 const handler=createHandler({admin:{rpc:async name=>({data:name==='spinout_security_config'?{turnstile_secret:'test-only'}:allowed}),from:name=>{assert.equal(name,'legal_reports');return {insert:async row=>{writes++;assert.deepEqual(row,{email:'owner@example.com',subject:'Rights request',body:'Please review this uploaded photo.',page:'https://spinoutclub.cc/leaderboard',category:'copyright'});return {};}};}},client:{},fetcher:verified('legal_report')});
 const body={action:'legal_report',category:'copyright',email:'OWNER@example.com',subject:'Rights request',body:'Please review this uploaded photo.',page:'https://spinoutclub.cc/leaderboard',status:'resolved',id:'forged',auth_user_id:'forged'};
 assert.equal((await handler(request(body))).status,403);assert.equal(writes,0);
 const r=await handler(request({...body,captcha:'fresh'}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});assert.equal(writes,1);
 allowed=false;assert.equal((await handler(request({...body,captcha:'fresh'}))).status,429);assert.equal(writes,1);
});
