import {refreshEvents} from './events.js';
import {calendarHealth} from './health.js';

const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const countKeys=['active_members','saved_event_days','going','garage_vehicles','approved_laps','pending_laps'];

export async function manualRefresh(request,env,{fetcher=fetch,refresh=refreshEvents,now=Date.now}={}){
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Not allowed'},403);
 const authorization=request.headers.get('authorization')||'';
 if(authorization.length>8192||!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))return reply({error:'Sign in as an admin to refresh data.'},401);
 if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return reply({error:'Manual refresh is temporarily unavailable.'},503);
 let stage='authorization';
 try{
  // Postgres verifies the JWT and checks live admin, suspension and Terms
  // permissions. Never trust a browser-provided role or editable metadata.
  const check=await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/spinout_service_counts`,{
   method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:authorization,'Content-Type':'application/json'},
   // Workers supports manual/follow, not the standard Fetch "error" mode.
   // Manual also prevents forwarding the bearer token to a redirect target.
   body:'{}',signal:AbortSignal.timeout(12000),redirect:'manual',
  });
  if(!check.ok)return reply({error:check.status>=500?'Could not verify admin access. Try again shortly.':'Current admin access and Terms acceptance are required.'},check.status>=500?503:403);
  const counts=await check.json();
  if(!counts||!countKeys.every(k=>Number.isSafeInteger(counts[k])&&counts[k]>=0))return reply({error:'Service counts are temporarily unavailable.'},503);
  stage='cooldown';
  const startedAt=now(),last=Number(await env.EVENTS.get('manual-refresh-at'))||0;
  const retryAfter=Math.ceil((last+60000-startedAt)/1000);
  if(retryAfter>0)return reply({error:`A refresh was recently requested. Try again in ${retryAfter} seconds.`,retryAfter},429);
  await env.EVENTS.put('manual-refresh-at',String(startedAt),{expirationTtl:120});
  stage='calendar';
  const calendar=await refresh(env.EVENTS,env,{manual:true});
  return reply({health:calendarHealth(calendar),counts:Object.fromEntries(countKeys.map(k=>[k,counts[k]]))});
 }catch(error){
  const type=['TypeError','TimeoutError','AbortError'].includes(error?.name)?error.name:'Error';
  const code=`REFRESH_${stage.toUpperCase()}`;
  // Never log tokens, headers, upstream bodies, or raw exception messages.
  console.error(JSON.stringify({event:'manual_refresh_failed',stage,type,code}));
  return reply({error:'Could not finish the refresh. Existing calendar data is still available; try again shortly.',code},503);
 }
}
