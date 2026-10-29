import { load } from 'cheerio/slim';
import {extractOffers,activeOffers,publishedOffers,combineOffers} from './offers.js';
import {ORGANIZERS,canonicalOrganizer} from '../src/event-catalog.js';
import {parseOrganizerDocument} from './organizers.js';
import {TRACK_SOURCES,parseTrackCalendar} from './track-calendars.js';
import {sourceCountHealth,calendarHealth} from './health.js';
import {MSR_SOURCE,fetchMSREvents,isMSRPage} from './msr-api.js';
import {isManualSource,calendarSourceStatus} from '../src/calendar-source-status.js';

export const SOURCES = [
  { id: 'speedventures', name: 'Speed Ventures', url: 'https://www.speedventures.com/events/Default.aspx' },
  { id: 'speedsf', name: 'SpeedSF', url: 'https://www.speedsf.com/events-registration/' },
  { id: 'buttonwillow', name: 'Buttonwillow Raceway', url: 'https://buttonwillowraceway.com/events/' },
  ...ORGANIZERS.filter(s=>s.adapter&&!['speedventures','speedsf'].includes(s.id)&&s.adapter!=='msr-api'),
  MSR_SOURCE,
  {id:'nasa-socal-calendar',name:'NASA SoCal schedule',url:'https://nasasocal.com/find-an-event/',adapter:'nasa-calendar',regionLabel:'SoCal'},
  {id:'nasa-norcal-calendar',name:'NASA NorCal schedule',url:'https://nasanorcal.com/tag/sonoma/',adapter:'nasa-calendar',regionLabel:'NorCal'},
  ...TRACK_SOURCES,
];
const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
export const todayPacific = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export function safeURL(value, base) {
  try { const u = new URL(value, base); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
function trackInfo(text) {
  const t = text.toLowerCase();
  if (/buttonwillow/.test(t)) return { track: /circuit/.test(t) ? 'Buttonwillow · Circuit' : /classic|13\s*(?:cw|ccw)|(?:cw|ccw)\s*#?\s*13/.test(t) ? 'Buttonwillow · Classic' : 'Buttonwillow', region: 'SoCal' };
  if (/chuckwalla/.test(t)) return { track: 'Chuckwalla', region: 'SoCal' };
  if (/streets/.test(t)) return { track: 'Streets of Willow', region: 'SoCal' };
  if (/willow/.test(t)) return { track: 'Big Willow', region: 'SoCal' };
  if (/laguna|weathertech/.test(t)) return { track: 'Laguna Seca', region: 'NorCal' };
  if (/sonoma/.test(t)) return { track: 'Sonoma', region: 'NorCal' };
  if (/thunderhill/.test(t)) return { track: /east.*west|west.*east/.test(t) ? 'Thunderhill · East & West' : /3\s*(?:&|and)\s*5/.test(t) ? 'Thunderhill · 3 & 5 mile' : /5.?mile|5mi/.test(t) ? 'Thunderhill · 5 mile' : /west/.test(t) ? 'Thunderhill · West' : /east|3.?mile/.test(t) ? 'Thunderhill · East' : 'Thunderhill', region: 'NorCal' };
  if (/spring mountain/.test(t)) return { track: 'Spring Mountain', region: 'Nevada' };
  if (/las vegas/.test(t)) return { track: 'Las Vegas Motor Speedway', region: 'Nevada' };
  return null;
}
export function parseDateRange(label, year) {
  const m = clean(label).replace(/(\d)(st|nd|rd|th)\b/gi,'$1').match(/([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–—&]\s*(?:([A-Za-z]+)\s*)?(\d{1,2}))?/);
  if (!m) return [];
  const startMonth = months.indexOf(m[1].toLowerCase().slice(0,3));
  const endMonth = m[3] ? months.indexOf(m[3].toLowerCase().slice(0,3)) : startMonth;
  if (startMonth < 0 || endMonth < 0) return [];
  const start = new Date(Date.UTC(year, startMonth, Number(m[2])));
  const end = new Date(Date.UTC(year + (endMonth < startMonth ? 1 : 0), endMonth, Number(m[4] || m[2])));
  if (start.getUTCMonth() !== startMonth || end.getUTCMonth() !== endMonth) return [];
  const dates = [];
  for (let d = start; d <= end && dates.length < 10; d = new Date(+d + 86400000)) dates.push(d.toISOString().slice(0,10));
  return dates;
}
const kindOf = (text) => /open test|test.?and.?tune|test & tune|open practice/i.test(text) ? 'Open practice' : /autox|autocross/i.test(text) ? 'Autocross' : /time attack|time trial|challenge/i.test(text) ? 'Track day / time trial' : 'Track day';
function makeEvent({ title, date, venue, organizer, url, source, kind, note, promotions=[],prices=[],specials=[] }) {
  // Explicit current event titles take priority over reused venue metadata.
  const info = trackInfo(title) || trackInfo(venue);
  if (!info || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !safeURL(url)) return null;
  return { title: clean(title).slice(0,180), date, ...info, organizer: canonicalOrganizer(organizer), url: safeURL(url), kind: kind || kindOf(title), note: clean(note).slice(0,220),promotions,prices,specials, sources: [{ id: source.id, name: source.name, url: source.url }], checkedAt: new Date().toISOString() };
}
export const parseOrganizer=(html,source,today=todayPacific())=>parseOrganizerDocument(html,source,{makeEvent,parseDateRange,today});
export const parseTrack=(input,source,today=todayPacific())=>parseTrackCalendar(input,source,{makeEvent,parseDateRange,today});
export function parseSpeedVentures(html) {
  const $ = load(html); const events = []; const source = SOURCES[0];
  $('#getonthetrack a.absolutelink').each((_, a) => {
    const card = $(a).parent(); const title = clean(card.find('h4').text());
    const dateText = clean(card.find('span').filter((_, e) => /\b20\d{2}\b/.test($(e).text())).first().text());
    const year = Number(dateText.match(/20\d{2}/)?.[0]);
    const url=safeURL($(a).attr('href'),source.url);
    const offers=extractOffers(card.html(),{url:source.url,sourceId:source.id,today:todayPacific()});
    const listingPrice=clean(card.find('span').filter((_,e)=>/^\$\s*\d/.test(clean($(e).text()))).first().text());
    if(listingPrice)offers.prices=[{text:'Listed '+listingPrice,sourceUrl:source.url,sourceId:source.id,checkedAt:new Date().toISOString()}];
    const note=clean(card.find('small').text());
    for (const date of parseDateRange(dateText, year)) events.push(makeEvent({ title: `${title} · Speed Ventures`, date, venue: title, organizer: 'Speed Ventures', url, source,...offers,note,specials:/black friday|holiday|festival|special event|\bmeet\b/i.test(title)?[title]:[] }));
  });
  return events.filter(Boolean);
}
export function parseSpeedSF(html, year, pageURL=`https://www.speedsf.com/events${year}`) {
  const $ = load(html); const events = []; const source = SOURCES[1];
  const canonical=$('link[rel="canonical"]').attr('href');
  const pageYear=Number(canonical?.match(/\/events(20\d{2})/)?.[1]||$('title').text().match(/20\d{2}/)?.[0])||year;
  if(canonical&&safeURL(canonical)&&new URL(canonical).hostname==='www.speedsf.com')pageURL=canonical;
  $('.ssf-card,[class*="-card"]').each((_, a) => {
    const card = $(a),nextClass=(card.attr('class')||'').split(/\s+/).find(c=>/^ssf\d{2}-card$/.test(c));
    if(!card.hasClass('ssf-card')&&!nextClass)return;
    const prefix=nextClass?.replace('-card',''),eventYear=prefix?2000+Number(prefix.slice(3)):pageYear;
    const title = clean(card.find(prefix?`.${prefix}-title`:'.ssf-card-title').text());
    const venue = clean(card.find(prefix?`.${prefix}-venue`:'.ssf-card-venue').text()) || title;
    if (/drift|slip happens/i.test(title)) return;
    const registrations = card.find(prefix?`.${prefix}-reg a`:'.ssf-reg-btn');
    const hpde = registrations.filter((_, a) => /hpde|register/i.test($(a).text())).first();
    const link = hpde.length ? hpde : registrations.first();
    const href=link.attr('href'),url=href?safeURL(href,pageURL):pageURL;
    if (!url) return;
    const offers=extractOffers(card.html(),{url:source.url,sourceId:source.id,today:todayPacific()});
    const components=card.find('.ssf-comp-row').toArray().filter(e=>/special/i.test($(e).find('.ssf-badge').text())).map(e=>clean($(e).find('.ssf-comp-name').text()));
    if(/special|fest|meet/i.test(title))components.push(title);
    for (const date of parseDateRange(card.find(prefix?`.${prefix}-date`:'.ssf-card-date').text(), eventYear)) {
      const specials=components.filter(text=>{const explicit=parseDateRange(text,eventYear);return !explicit.length||explicit.includes(date);});
      const event=makeEvent({ title: `${title} · SpeedSF`, date, venue, organizer: 'SpeedSF', url, source, kind: hpde.length ? 'Track day' : kindOf(card.text()),...offers,specials,note:!href?'Preliminary published schedule; registration opens later and dates may change.':'' });
      if(event){if(!href)event.scheduleOnly=true;events.push(event);}
    }
  });
  return events.filter(Boolean);
}
export function parseButtonwillow(data) {
  const source = SOURCES[2];
  if (!Array.isArray(data.events)) throw new Error('Unexpected track feed format');
  return data.events.flatMap(e => {
    const title = load(`<span>${e.title || ''}</span>`)('span').text();
    const venue = load(`<span>${e.venue?.venue || ''}</span>`)('span').text();
    const rawOrganizer = load(`<span>${e.organizer?.[0]?.organizer || title}</span>`)('span').text();
    const description = load(`<span>${e.description || ''}</span>`)('span').text();
    if (/moto|motorcycle|kart|private|closed|drift|superbike|road.?race association|\bcra\b|cckra|2 wheel|track daz|let[’']?s ride|fastrack riders/i.test(`${title} ${rawOrganizer} ${description}`)) return [];
    const organizer = /^(speed\s*sf)(\.com)?$/i.test(rawOrganizer) ? 'SpeedSF' : /pca\s*\/\s*sd|porsche club of america.*san diego/i.test(rawOrganizer) ? 'PCA · San Diego' : /pca\s*\/\s*ccr|porsche club of america.*central coast/i.test(rawOrganizer) ? 'PCA · Central Coast' : rawOrganizer;
    const start = e.start_date?.slice(0,10), end = e.end_date?.slice(0,10);
    const events = [];
    if (!start || !end) return events;
    for (let d = new Date(`${start}T12:00:00Z`); d <= new Date(`${end}T12:00:00Z`) && events.length < 10; d = new Date(+d + 86400000)) {
      events.push(makeEvent({ title, date: d.toISOString().slice(0,10), venue, organizer, url: e.url, source,
        kind: /open test/i.test(title) ? 'Open practice' : /speed|drivers club|pca|porsche|audi|lotus|compact octane|ongrid|extreme/i.test(`${title} ${organizer}`) ? 'Track day' : 'Track event',
        ...extractOffers(e.description,{url:e.url,sourceId:source.id,today:todayPacific()}),
        specials:/special event|festival|\bmeet\b/i.test(title)?[title]:[],
        note: /open test/i.test(title) ? 'Open testing; check vehicle eligibility, sessions and fees with the track.' : 'Track calendar listing; confirm participation and registration with the organizer.' }));
    }
    return events.filter(Boolean);
  });
}
const organizerKey = (s) => canonicalOrganizer(s).toLowerCase().replace(/[^a-z0-9]/g,'');
export function mergeEvents(events, today = todayPacific()) {
  const merged = new Map();
  const upcoming=events.filter(e=>e?.date>=today);
  // A crossover announcement may omit the circuit named by its hosting region.
  // Resolve it only when exactly one specific configuration agrees.
  const nasaConfigurations=new Map();
  for(const e of upcoming)if(/^(Buttonwillow|Thunderhill) · /.test(e.track)){
    const key=organizerKey(e.organizer)+'|'+e.date+'|'+e.track.split(' · ')[0];
    if(!nasaConfigurations.has(key))nasaConfigurations.set(key,new Set());
    nasaConfigurations.get(key).add(e.track);
  }
  for (const raw of upcoming) {
    const matches=raw.scheduleOnly?nasaConfigurations.get(organizerKey(raw.organizer)+'|'+raw.date+'|'+raw.track):null;
    // Normalize retained snapshots too, so old source labels cannot split filters.
    const e={...raw,organizer:canonicalOrganizer(raw.organizer),...(matches?.size===1?{track:[...matches][0]}:{})};
    const key = `${e.date}|${e.track}|${organizerKey(e.organizer)}|${e.kind === 'Autocross' ? 'autox' : 'track'}`;
    const previous = merged.get(key);
    if (previous) {
      previous.promotions=combineOffers(previous.promotions,e.promotions);
      previous.prices=combineOffers(previous.prices,e.prices);
      previous.specials=[...new Set([...(previous.specials||[]),...(e.specials||[])])];
      previous.sources = [...new Map([...previous.sources,...e.sources].map(s=>[s.id,s])).values()];
      if (previous.scheduleOnly&&!e.scheduleOnly) { previous.url=e.url;previous.title=e.title;previous.note=e.note;previous.kind=e.kind;delete previous.scheduleOnly;delete previous.trackCalendar; }
      else if (previous.sources[0].id === 'buttonwillow' && e.sources[0].id !== 'buttonwillow') { previous.url=e.url; previous.title=e.title; }
      if(previous.scheduleOnly&&previous.kind==='Track event'&&e.kind==='Track day')previous.kind=e.kind;
    } else merged.set(key, { ...e, id: key });
  }
  return [...merged.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.track.localeCompare(b.track));
}
async function boundedText(response) {
  const limit=2500000;
  if(Number(response.headers.get('content-length')||0)>limit)throw new Error('Source too large');
  const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
  try {
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();throw new Error('Source too large');}text+=decoder.decode(value,{stream:true});}
    return text+decoder.decode();
  } finally {reader.releaseLock();}
}
const manualMSRListings=new Set(ORGANIZERS.filter(s=>s.adapter==='msr-api').map(s=>s.feedUrl||s.url));
const allowedMSRListing=url=>{try{const u=new URL(url);u.pathname=u.pathname.replace(/\/$/,'');return manualMSRListings.has(u.href);}catch{return false;}};
async function get(url, asJSON = false, manualListing = false) {
  let r;
  for(let n=0;n<4;n++){
   if(isMSRPage(url)&&!(manualListing&&allowedMSRListing(url)))throw new Error('MotorsportReg page is outside the manual listing allowlist');
   r=await fetch(url,{redirect:'manual',headers:{'User-Agent':'SpinoutClub-EventCalendar/1.0 (+https://spinoutclub.cc/events)',Accept:asJSON?'application/json':'text/html'},signal:AbortSignal.timeout(20000)});
   if(r.status>=300&&r.status<400){url=new URL(r.headers.get('location'),url).href;continue;}break;
  }
  if (!r.ok) throw new Error(`Source returned HTTP ${r.status}`);
  const body = await boundedText(r);
  return asJSON ? JSON.parse(body) : body;
}
export async function fetchSource(source, today = todayPacific(),env={},options={}) {
  if(source.id===MSR_SOURCE.id){
   if(!options.manual)return fetchMSREvents({env,today,makeEvent});
   const rows=[];
   // A user-triggered pass over the three existing organizer listings only.
   // No event-page crawling, pagination discovery or parallel MSR requests.
   for(const organizer of ORGANIZERS.filter(s=>s.adapter==='msr-api')){
    rows.push(...parseOrganizer(await get(organizer.feedUrl||organizer.url,false,true),{...organizer,id:MSR_SOURCE.id,adapter:'msr'},today));
   }
   Object.defineProperty(rows,'verifiedEmpty',{value:true});return rows;
  }
  if(TRACK_SOURCES.some(s=>s.id===source.id)){
    if(source.adapter==='chuckwalla-track')return parseTrack(await get(`${source.url}/data?status=2&start=${today}&end=${Number(today.slice(0,4))+2}-01-01`,true),source,today);
    if(source.adapter==='spring-track'){
      const first=await get(source.url),$=load(first);
      const pages=Math.max(1,...$('a[href]').toArray().map(a=>Number($(a).attr('href').match(/^\/calendar\/Page-(\d+)$/)?.[1]||1)));
      if(pages>30)throw new Error('Spring Mountain calendar exceeds page limit');
      const rows=[...parseTrack(first,source,today)];
      for(let i=2;i<=pages;i++)rows.push(...parseTrack(await get(new URL(`/calendar/Page-${i}`,source.url).href),source,today));
      Object.defineProperty(rows,'verifiedEmpty',{value:true});return rows;
    }
    return parseTrack(await get(source.feedUrl||source.url),source,today);
  }
  if (source.id === 'speedventures') return parseSpeedVentures(await get(source.url));
  if (source.id === 'speedsf') {
    const year=Number(today.slice(0,4));
    const years=await Promise.allSettled([year,year+1].map(async y=>{const html=await get(`https://www.speedsf.com/events${y}`);if(!load(html)('title,h1').text().includes(String(y)))throw new Error('Schedule year not confirmed');return parseSpeedSF(html,y);}));
    const rows=years.flatMap(r=>r.status==='fulfilled'?r.value:[]);
    if(!rows.length){try{const html=await get(`https://www.speedsf.com/events${year-1}`);if(load(html)('title,h1').text().includes(String(year)))rows.push(...parseSpeedSF(html,year-1));}catch{/* Keep the previous snapshot if no published year is recognizable. */}}
    if(!rows.length)throw new Error('No recognized schedule cards');return rows;
  }
  if (source.id === 'buttonwillow') {
    const all = [],end=`${Number(today.slice(0,4))+1}-12-31`;
    for (let page = 1; page <= 10; page++) {
      const data = await get(`https://buttonwillowraceway.com/wp-json/tribe/events/v1/events?start_date=${today}&end_date=${end}&per_page=100&page=${page}`, true);
      all.push(...parseButtonwillow(data));
      if(page>=Number(data.total_pages||1)){Object.defineProperty(all,'verifiedEmpty',{value:true});return all;}
    }
    throw new Error('Track calendar exceeds the bounded page limit');
  }
  if(source.adapter)return parseOrganizer(await get(source.feedUrl||source.url),source,today);
  throw new Error('Unknown source');
}
const DETAIL_HOSTS=new Set(['speedventures.com','www.speedventures.com','speedsf.com','www.speedsf.com','buttonwillowraceway.com','www.buttonwillowraceway.com','www.motorsportreg.com','speedsf.motorsportreg.com','hookedondriving.motorsportreg.com','turn8.motorsportreg.com','msreg.com',...ORGANIZERS.filter(s=>s.adapter).flatMap(s=>[new URL(s.url).hostname,s.feedUrl?new URL(s.feedUrl).hostname:undefined]).filter(Boolean)]);
const detailAllowed=url=>{try{const u=new URL(url);return !isMSRPage(url)&&u.protocol==='https:'&&DETAIL_HOSTS.has(u.hostname);}catch{return false;}};
async function detailHTML(url) {
 for(let redirects=0;redirects<4;redirects++){
  if(!detailAllowed(url))throw new Error('Unsupported event host');
  const r=await fetch(url,{headers:{'User-Agent':'SpinoutClub-EventCalendar/1.1 (+https://spinoutclub.cc/events)'},redirect:'manual',signal:AbortSignal.timeout(12000)});
  if(r.status>=300&&r.status<400){url=new URL(r.headers.get('location'),url).href;continue;}
  if(!r.ok)throw new Error('Event page unavailable');
  return boundedText(r);
 }throw new Error('Too many redirects');
}
export async function enrichEvents(events,previous={},today=todayPacific()) {
 const now=new Date().toISOString(),cache={};
 const urls=[...new Set(events.map(e=>e.url).filter(detailAllowed))];
 for(const url of urls)if(previous[url])cache[url]=previous[url];
 const due=urls.filter(url=>!cache[url]?.checkedAt||Date.now()-Date.parse(cache[url].checkedAt)>=50*60000)
  .sort((a,b)=>(Date.parse(cache[a]?.checkedAt)||0)-(Date.parse(cache[b]?.checkedAt)||0)).slice(0,24);
 // Bound requests and concurrency. Unchecked URLs rotate ahead of recently checked URLs.
 for(let i=0;i<due.length;i+=4)await Promise.all(due.slice(i,i+4).map(async url=>{
  const sourceId=events.find(e=>e.url===url)?.sources?.[0]?.id;
  try{const html=await detailHTML(url);const offers=extractOffers(html,{url,sourceId,today,eventDate:events.find(e=>e.url===url)?.date,checkedAt:now});if(sourceId==='turn8')offers.prices=offers.prices.filter(p=>/HPDE|registration|entry|track.?day/i.test(p.text));cache[url]={...offers,checkedAt:now,status:'ok'};}
  catch{cache[url]={...(cache[url]||{}),checkedAt:now,status:'stale'};}
 }));
 const enriched=events.map(e=>{
  const detail=cache[e.url];const stale=detail?.status!=='ok'||Date.now()-Date.parse(detail.checkedAt)>2*3600000;
  const mark=a=>activeOffers(a,today).map(x=>({...x,stale:stale||x.stale}));
  const isTurn8=e.sources?.some(s=>s.id==='turn8');
  const detailPrices=(detail?.prices||[]).filter(p=>!isTurn8||/HPDE|registration|entry|track.?day/i.test(p.text));
  return {...e,promotions:combineOffers(publishedOffers(e.promotions,today),mark(publishedOffers(detail?.promotions,today))),prices:combineOffers(activeOffers(e.prices,today),mark(detailPrices)),offerCheckedAt:detail?.checkedAt||null,offerStatus:detail?.status||'not_checked'};
 });
 return {events:enriched,detailCache:cache,offerCoverage:{total:urls.length,checked:urls.filter(u=>cache[u]?.status==='ok').length,checkedThisRefresh:due.length}};
}
export async function refreshEvents(kv,env={},options={}) {
 const today=todayPacific(),previous=await kv.get('calendar','json');
 const results=await Promise.allSettled(SOURCES.map(s=>isManualSource(s)&&!options.manual?Promise.resolve(null):fetchSource(s,today,env,options)));
 const events=[],sources=[],sourceSnapshots={};
 results.forEach((result,i)=>{
  const source=SOURCES[i],old=previous?.sources?.find(s=>s.id===source.id);
  if(result.status==='fulfilled'&&result.value&&(result.value.length||result.value.verifiedEmpty)){
   sourceSnapshots[source.id]=result.value;events.push(...result.value);sources.push(calendarSourceStatus({...source,status:'ok',lastSuccess:new Date().toISOString(),...(isManualSource(source)?{lastManualAttemptAt:new Date().toISOString()}:{}),count:result.value.length,...sourceCountHealth(result.value.length,old)}));
  }else{
   const legacyMSR=source.id===MSR_SOURCE.id?['hookedondriving','slipangle','fasttoys']:[];
   const legacyRows=legacyMSR.flatMap(id=>previous?.sourceSnapshots?.[id]||[]).map(e=>({...e,sources:[{id:source.id,name:source.name,url:source.url}]}));
   const prior=previous?.sourceSnapshots?.[source.id]||(legacyRows.length?legacyRows:(previous?.events||[]).filter(e=>e.sources.some(s=>[source.id,...legacyMSR].includes(s.id))).map(e=>({...e,sources:[{id:source.id,name:source.name,url:source.url}],promotions:(e.promotions||[]).filter(x=>[source.id,...legacyMSR].includes(x.sourceId)),prices:(e.prices||[]).filter(x=>[source.id,...legacyMSR].includes(x.sourceId))})));
   sourceSnapshots[source.id]=prior;
   if(isManualSource(source)&&!options.manual){
    events.push(...prior);
    sources.push(calendarSourceStatus({...old,...source,status:old?.status||'not_requested',lastSuccess:old?.lastSuccess||null,count:prior.length}));
    return;
   }
   events.push(...prior.map(e=>({...e,sourceStale:true,promotions:(e.promotions||[]).map(x=>({...x,stale:true})),prices:(e.prices||[]).map(x=>({...x,stale:true}))})));
   const pending=result.status==='rejected'&&result.reason?.code==='msr_access_pending';
   sources.push(calendarSourceStatus({...source,status:pending?'pending_access':'stale',...(isManualSource(source)?{lastManualAttemptAt:new Date().toISOString()}:{}),lastSuccess:old?.lastSuccess||null,count:prior.length,error:pending?'API access is pending; confirm last known dates with the organizer.':'Could not refresh this source; verify dates on the organizer’s website.'}));
  }
 });
 const enriched=await enrichEvents(mergeEvents(events,today),previous?.detailCache,today);
 const calendar={updatedAt:new Date().toISOString(),...enriched,sources,sourceSnapshots,refreshHours:1};
 await kv.put('calendar',JSON.stringify(calendar));
 const health=calendarHealth(calendar);console.info(JSON.stringify({event:'calendar_refresh',status:health.status,eventDays:health.eventDays,issues:health.issues}));
 return calendar;
}
