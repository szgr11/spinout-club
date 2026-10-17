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
