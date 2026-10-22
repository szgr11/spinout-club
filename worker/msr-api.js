// First-party schema: https://assets.motorsportreg.com/gec/docs/graphql-api/
// Activation requires issued credentials AND approval/attribution confirmation.
import {calendarDays} from './organizers.js';
export const MSR_SOURCE={id:'motorsportreg-api',name:'MotorsportReg',url:'https://www.motorsportreg.com/',adapter:'msr-api'};
export const MSR_ENDPOINT='https://api-v2.motorsportreg.com/graphql';
export const isMSRPage=value=>{try{const h=new URL(value).hostname.toLowerCase();return h==='msreg.com'||h.endsWith('.msreg.com')||h==='motorsportreg.com'||h.endsWith('.motorsportreg.com');}catch{return false;}};
export const msrConfigured=env=>env?.MSR_API_APPROVED==='true'&&env?.MSR_ATTRIBUTION_CONFIRMED==='true'&&typeof env?.MSR_API_KEY==='string'&&env.MSR_API_KEY.trim().length>0;
export const MSR_QUERY=`query SpinoutEvents($input: EventSearchInput) {
 events(input: $input) {
  data {
   id name {content iso} eventStart eventEnd registrationStart registrationEnd state status url
   organization {id name {content iso} errors {errorCode}}
   primaryVenue {id name {content iso} geoLocation {timeZone} errors {errorCode}}
   disciplines {data {id name {content iso}} errors {errorCode}}
   errors {errorCode}
  }
  nextToken errors {errorCode}
 }
}`;
const localized=values=>{if(!Array.isArray(values))return '';return (values.find(v=>/^en(?:-|$)/i.test(v?.iso||''))||values[0])?.content||'';};
const localDate=(value,zone)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));};
export function parseMSREvents(records,{makeEvent,today,source=MSR_SOURCE}){
 const rows=[];
 for(const event of records){
  if(event?.errors?.length||event?.organization?.errors?.length||event?.primaryVenue?.errors?.length||event?.disciplines?.errors?.length)throw new Error('MotorsportReg API returned incomplete event data');
  if(!event?.id||['CANCELLED','SUSPENDED'].includes(event.state)||['EVENT_CANCELLED','EVENT_ENDED'].includes(event.status))continue;
  const title=localized(event.name),venue=localized(event.primaryVenue?.name),organizer=localized(event.organization?.name);
  const disciplines=(event.disciplines?.data||[]).map(d=>localized(d.name)).join(' ');
  if(!/HPDE|Open Track|Driver.?s? School|Driving School|Time Trial|Track Day/i.test(disciplines)||/\b(?:gift cards?|drift|motorcycle|karting|lunch|rental)\b/i.test(title))continue;
  let dates;
  try{
   const zone=event.primaryVenue?.geoLocation?.timeZone||'America/Los_Angeles';
   const start=localDate(event.eventStart,zone);if(!start)throw new Error();
   // An event ending exactly at local midnight does not add a phantom extra day.
   let end=event.eventEnd||event.eventStart;
   if(event.eventEnd&&new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(end))==='00:00:00')end=new Date(Date.parse(end)-1).toISOString();
   dates=calendarDays(start,localDate(end,zone));if(!dates.length)throw new Error();
  }catch{throw new Error('MotorsportReg API returned an invalid event date');}
  for(const date of dates){
   if(date<today)continue;
   const note={REGISTRATION_WILL_OPEN:'Registration is not open yet; check the organizer.',REGISTRATION_CLOSED:'Registration is closed; check the organizer.'}[event.status]||'';
   const row=makeEvent({title,venue,organizer,date,url:event.url,source,note,kind:/time trial/i.test(disciplines)?'Track day / time trial':'Track day'});
   if(row)rows.push({...row,msrEventId:String(event.id),registrationState:event.status||null,registrationStart:event.registrationStart||null,registrationEnd:event.registrationEnd||null});
  }
 }
 Object.defineProperty(rows,'verifiedEmpty',{value:true});return rows;
}
async function boundedJSON(response){
 const reader=response.body?.getReader();if(!reader)throw new Error('Empty API response');const chunks=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>2500000){await reader.cancel();throw new Error('API response too large');}chunks.push(r.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function fetchMSREvents({env={},today,makeEvent,fetcher=fetch}){
 if(!msrConfigured(env)){const e=new Error('MotorsportReg API approval and key are pending');e.code='msr_access_pending';throw e;}
 const records=[],tokens=new Set();let nextToken;
 for(let page=0;page<25;page++){
  const overlapStart=new Date(Date.parse(today+'T12:00:00Z')-9*86400000).toISOString().slice(0,10);
  const input={countries:['US'],geoLocate:false,geoPoint:{lat:36.2,lon:-119.3,maxRadius:650,unit:'MI'},eventStart:overlapStart,eventEnd:`${Number(today.slice(0,4))+2}-01-01`,eventStateExclude:['CANCELLED','SUSPENDED'],locales:['en-US'],limit:100,...(nextToken?{nextToken}:{})};
  const r=await fetcher(MSR_ENDPOINT,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Accept':'application/json','x-api-key':env.MSR_API_KEY.trim()},body:JSON.stringify({query:MSR_QUERY,variables:{input}}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('MotorsportReg API unavailable');
  const body=await boundedJSON(r),result=body.data?.events;
  if(body.errors?.length||result?.errors?.length||!Array.isArray(result?.data))throw new Error('MotorsportReg API returned errors');
  records.push(...result.data);nextToken=result.nextToken;
  if(!nextToken)return parseMSREvents(records,{makeEvent,today});
  if(typeof nextToken!=='string'||tokens.has(nextToken))throw new Error('MotorsportReg API pagination repeated');tokens.add(nextToken);
 }
 throw new Error('MotorsportReg API exceeded the bounded page limit');
}
