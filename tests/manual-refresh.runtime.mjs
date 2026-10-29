import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=wranglerRequire('miniflare');
const {build}=wranglerRequire('esbuild');

test('manual refresh executes in the Workers runtime with synthetic sources and storage',async()=>{
 const bundle=await build({entryPoints:[new URL('../worker/index.js',import.meta.url).pathname],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
 const counts={active_members:4,saved_event_days:2,going:1,garage_vehicles:3,approved_laps:8,pending_laps:0};
 let authCalls=0,sourceCalls=0;
 const mf=new Miniflare(convertV4MiniflareOptions({
  modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-13',kvNamespaces:['EVENTS'],
  bindings:{SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic'},
  outboundService:async request=>{
   if(request.url.includes('/rpc/spinout_service_counts')){authCalls++;return Response.json(counts);}
   sourceCalls++;return new Response('Synthetic unavailable source',{status:503});
  },
 }));
 try{
  const kv=await mf.getKVNamespace('EVENTS');
  await kv.put('calendar',JSON.stringify({updatedAt:new Date().toISOString(),events:[],sources:[],sourceSnapshots:{},detailCache:{}}));
  const response=await mf.dispatchFetch('https://spinoutclub.cc/api/admin/refresh',{method:'POST',headers:{origin:'https://spinoutclub.cc',authorization:'Bearer synthetic-test'}});
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify({body,authCalls,sourceCalls}));
  assert.equal(authCalls,1);assert.ok(sourceCalls>0);assert.deepEqual(body.counts,counts);
  assert.equal(body.health.status,'attention');
 }finally{await mf.dispose();}
});
