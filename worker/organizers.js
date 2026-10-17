import {load} from 'cheerio/slim';
import {extractOffers} from './offers.js';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const excluded=/\b(?:cancelled|canceled|postponed|rescheduled|gift cards?|lunch|helmet rental|track pass|transfer|cancellation|drift)\b/i;
export function calendarDays(start,end=start) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(end||''))return [];
 const a=new Date(start+'T12:00:00Z'),b=new Date(end+'T12:00:00Z');
 if(Number.isNaN(+a)||Number.isNaN(+b)||a.toISOString().slice(0,10)!==start||b.toISOString().slice(0,10)!==end||b<a||b-a>9*86400000)return [];
 const out=[];for(let d=a;d<=b;d=new Date(+d+86400000))out.push(d.toISOString().slice(0,10));return out;
}
export function parseOrganizerDocument(html,source,{makeEvent,parseDateRange,today}) {
 const $=load(html),out=[];let recognized=false;
 const evidence={...source,url:source.feedUrl||source.url};
 const add=({title,start,end,venue,url,html:description='',prices=[],promotions=[],specials=[],kind})=>{
  if(excluded.test(title))return;
  try{url=new URL(url,source.feedUrl||source.url).href;}catch{return;}
  const offers=extractOffers(description,{url,sourceId:source.id,today});
  for(const date of calendarDays(start,end||start)){
   const e=makeEvent({title,date,venue:venue||title,url,source:evidence,organizer:source.name,kind,promotions:[...promotions,...offers.promotions],prices:[...prices,...offers.prices],specials});if(e)out.push(e);
  }
 };
 const entry=(text,url)=>({text,sourceUrl:url||evidence.url,sourceId:source.id,checkedAt:new Date().toISOString()});
 if(source.adapter==='nasa'){
  const cards=$('.event-card:not(.dummy-event)');recognized=cards.length>0||$('.no-events-message-box').length>0;
  cards.each((_,node)=>{const card=$(node),types=card.find('.info-text').text();if(!/HPDE|Open Track|Time Trial/i.test(types))return;
   const raw=clean(card.find('.display-name').text()),year=Number(raw.match(/20\d{2}/)?.[0]);if(!year)return;
   const dates=parseDateRange(raw.replace(/^#\d+:\s*/,''),year),venue=clean(card.find('.at p').first().text().replace(/^At\s+/,''));
   add({title:`${venue} · NASA`,start:dates[0],end:dates.at(-1),venue,url:card.find('.register a').attr('href'),kind:'Track day / time trial'});
  });
 }else if(source.adapter==='extremespeed'){
  const titles=$('.event-title');recognized=titles.length>0||/no events setup for registration/i.test($.root().text());
  titles.each((_,node)=>{const title=clean($(node).text()),year=Number(title.match(/20\d{2}/)?.[0]),dates=parseDateRange(title,year),card=$(node).closest('.event-content').parent(),url=new URL($(node).find('a').attr('href'),source.url).href;
   const price=clean(card.find('.event-price').text());add({title,start:dates[0],end:dates.at(-1),url,html:card.find('.event-desc').html(),prices:price?[entry('Listed '+price,url)]:[]});
  });
 }else if(source.adapter==='speeddistrict'){
  const cards=$('.sd-event-card');recognized=cards.length>0||/no upcoming events/i.test($('main').text());
  cards.each((_,node)=>{const card=$(node),title=clean(card.find('.sd-event-card__title').text()),label=clean(card.find('.sd-event-card__date').text()),year=Number(label.match(/20\d{2}/)?.[0]),dates=parseDateRange(label,year),url=card.find('.sd-event-card__title a').attr('href'),price=clean(card.find('.sd-event-card__price').text());
   add({title,start:dates[0],end:dates.at(-1),url,prices:price?[entry(price,url)]:[]});
  });
 }else if(source.adapter==='squarespace'){
  const cards=$('.eventlist-event');recognized=cards.length>0||$('.eventlist').length>0;
  cards.each((_,node)=>{const card=$(node),title=clean(card.find('.eventlist-title').text()),dates=card.find('time.event-date').toArray().map(e=>$(e).attr('datetime')?.slice(0,10));
   add({title,start:dates[0],end:dates.at(-1),venue:title+' '+card.find('.eventlist-meta-address').text(),url:card.find('.eventlist-title-link').attr('href'),html:card.find('.eventlist-excerpt').html()||card.find('.eventlist-description').html(),specials:/meetup|festival|\bfest\b/i.test(title)?[title]:[]});
  });
 }else if(source.adapter==='sdc'){
  const cards=$('.product-list-item');recognized=cards.length>0||/no results found/i.test($('main').text());
  cards.each((_,node)=>{const card=$(node),a=card.find('.product-list-item-link'),title=clean(a.attr('aria-label')),m=title.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|\d{2})\b/);if(!m)return;
   const date=`${m[3].length===2?'20'+m[3]:m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`,url=new URL(a.attr('href'),source.url).href,price=clean(card.find('.product-list-item-price').text());
   add({title,start:date,url,prices:price?[entry(price,url)]:[],promotions:card.hasClass('on-sale')?[entry(price?'Published sale: '+price:'Sale pricing available; select driving level.',url)]:[],specials:/special session|s2k|beginner day|pre-gta/i.test(title)?[title]:[]});
  });
 }else if(source.adapter==='msr'){
  const cards=$('[itemtype$="schema.org/Event"]');recognized=cards.length>0||/No upcoming events currently/i.test($.root().text());
  cards.each((_,node)=>{const card=$(node);if(/Cancelled|Postponed/i.test(card.find('[itemprop="eventStatus"]').attr('content')||''))return;
   const title=clean(card.find('h3 [itemprop="name"]').text()),venue=clean(card.find('[itemprop="location"] [itemprop="name"]').first().text()),tags=card.find('.card__event-tags').text();if(!/HPDE|Open Track|Driver School|Time Trial|Track Day/i.test(tags))return;
   add({title,start:card.find('[itemprop="startDate"]').attr('content')?.slice(0,10),end:card.find('[itemprop="endDate"]').attr('content')?.slice(0,10),venue:title+' '+venue,url:card.find('a[itemprop="url"]').attr('href')});
  });
 }else if(source.adapter==='wix'){
  const raw=$('#wix-warmup-data').text();if(raw){const data=JSON.parse(raw),seen=new Set();
   const visit=v=>{if(!v||typeof v!=='object')return;
    if(v.title&&v.slug&&v.scheduling?.config?.startDate){recognized=true;if(seen.has(v.id))return;seen.add(v.id);const schedule=v.scheduling.config,day=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:schedule.timeZoneId||'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
     add({title:v.title,start:day(schedule.startDate),end:day(schedule.endDate||schedule.startDate),venue:v.title+' '+(v.location?.name||''),url:'/event-details/'+v.slug,html:v.description});return;}
    for(const child of Object.values(v))visit(child);
   };visit(data);
  }
 }
 if(!recognized)throw new Error('Unrecognized organizer schedule');
 // Recognized empty schedules are successful: old dates must not be kept forever.
 Object.defineProperty(out,'verifiedEmpty',{value:true});return out;
}
