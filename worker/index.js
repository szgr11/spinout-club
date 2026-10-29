import { refreshEvents, todayPacific, mergeEvents } from './events.js';
import {activeOffers,publishedOffers} from './offers.js';
import {calendarHealth,registrationStatus} from './health.js';
import {manualRefresh} from './manual-refresh.js';
import {calendarSourceStatus} from '../src/calendar-source-status.js';
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(request,env,ctx) {
    const url = new URL(request.url);
    if(url.pathname==='/api/admin/refresh')return manualRefresh(request,env);
    if(url.pathname==='/api/metrics'){
      if(request.method!=='POST')return json({error:'Method not allowed'},405);
      if(request.headers.get('origin')!==url.origin)return json({error:'Not allowed'},403);
      const reader=request.body?.getReader();let bytes=0,text='';
      if(!reader)return json({error:'Invalid metric'},400);
      try{while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>40){await reader.cancel();return json({error:'Invalid metric'},400);}text+=new TextDecoder().decode(r.value);}}
      finally{reader.releaseLock();}
      if(text!=='registration_click')return json({error:'Invalid metric'},400);
      console.info(JSON.stringify({event:'registration_click'}));
      return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
    }
    if(url.pathname==='/api/health'){
      if(request.method!=='GET')return json({error:'Method not allowed'},405);
      const health=calendarHealth(await env.EVENTS.get('calendar','json'));
      return json(health,health.status==='unavailable'?503:200);
    }
    if (url.pathname === '/api/events') {
      if (request.method !== 'GET') return json({error:'Method not allowed'},405);
      const calendar = await env.EVENTS.get('calendar','json');
      // Refreshes are scheduled; public traffic never triggers upstream scraping.
      if (!calendar) return json({events:[],sources:[],error:'The calendar is being prepared. Please try again shortly.'},503);
      const today=todayPacific();
      // Apply current aliases even before the next scheduled snapshot refresh.
      return json({updatedAt:calendar.updatedAt,sources:calendar.sources.map(calendarSourceStatus),refreshHours:calendar.refreshHours,offerCoverage:calendar.offerCoverage,events:mergeEvents(calendar.events,today).map(e=>({...e,registrationStatus:registrationStatus(e),promotions:publishedOffers(e.promotions,today,e.date),prices:activeOffers(e.prices,today,e.date)}))});
    }
    if (url.pathname.startsWith('/api/')) return json({error:'Not found'},404);
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller,env,ctx) { ctx.waitUntil(refreshEvents(env.EVENTS,env)); },
};
