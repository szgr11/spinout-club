import { refreshEvents, todayPacific } from './events.js';
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(request,env,ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/events') {
      if (request.method !== 'GET') return json({error:'Method not allowed'},405);
      const calendar = await env.EVENTS.get('calendar','json');
      // Refreshes are scheduled; public traffic never triggers upstream scraping.
      if (!calendar) return json({events:[],sources:[],error:'The calendar is being prepared. Please try again shortly.'},503);
      return json({...calendar,events:calendar.events.filter(e=>e.date>=todayPacific())});
    }
    if (url.pathname.startsWith('/api/')) return json({error:'Not found'},404);
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller,env,ctx) { ctx.waitUntil(refreshEvents(env.EVENTS)); },
};
