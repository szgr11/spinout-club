import {load} from 'cheerio/slim';
import {calendarDays} from './organizers.js';
import {canonicalOrganizer} from '../src/event-catalog.js';

export const TRACK_SOURCES = [
 {id:'willow-calendar',name:'Willow Springs calendar',url:'https://willowspringsraceway.com/events-experiences/',track:'Big Willow',adapter:'willow-track'},
 {id:'chuckwalla-calendar',name:'Chuckwalla calendar',url:'https://app.chuckwalla.com/calendar',track:'Chuckwalla',adapter:'chuckwalla-track'},
 {id:'thunderhill-east-calendar',name:'Thunderhill East calendar',url:'https://www.thunderhill.com/event-schedule',track:'Thunderhill · East',adapter:'ical-track',feedUrl:'https://calendar.google.com/calendar/ical/o9l58emnihnrsqc37iddnjtvt4%40group.calendar.google.com/public/basic.ics'},
 {id:'thunderhill-west-calendar',name:'Thunderhill West calendar',url:'https://www.thunderhill.com/event-schedule',track:'Thunderhill · West',adapter:'ical-track',feedUrl:'https://calendar.google.com/calendar/ical/5sprchii50s1c2hn9gc53e282k%40group.calendar.google.com/public/basic.ics'},
 {id:'laguna-calendar',name:'Laguna Seca calendar',url:'https://weathertechraceway.com/pages/calendar',track:'Laguna Seca',adapter:'ical-track',feedUrl:'https://airtable.com/appVcrbzVS5Ci2bYn/shrEcO4Bw99rPwfFs/iCal?timeZone=America%2FLos_Angeles&userLocale=en'},
 {id:'sonoma-calendar',name:'Sonoma experiences calendar',url:'https://www.sonomaraceway.com/experiences/?view=calendar',track:'Sonoma',adapter:'speedway-track'},
 {id:'vegas-calendar',name:'Las Vegas experiences calendar',url:'https://www.lvms.com/experiences/?view=calendar',track:'Las Vegas Motor Speedway',adapter:'speedway-track'},
 {id:'spring-calendar',name:'Spring Mountain advanced track days',url:'https://calendar.springmountainmotorsports.com/',track:'Spring Mountain',adapter:'spring-track'}
];
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const excluded=/\b(?:private|available|tentative|cancelled|canceled|closed|members?|motorcycle|motorbike|sportbike|superbike|karting|karts?|drift|drag|spectator|nascar|indycar|imsa|turkey trot|cars\s*(?:&|and)\s*coffee|lakebed)\b|\b(?:Z2|CVMA|CCKRA)\b|fun track dayz|lucky dog|lemons|classic sports? racing|\bCSRG\b|race series|season finale/i;
const driving=/HPDE|track\s*days?|open track|open test|test\s*(?:&|and)\s*tune|open practice|time trial|speed\s*sf|speed ventures|hooked on driving|ongrid|turn\s*8|turn\s*2 drivers|lightspeed|trackmasters|track time|drivers club|car control|instructors clinic/i;
const knownOrganizer=title=>canonicalOrganizer(clean(title).replace(/^Track Day Providers\s*[-–]\s*/i,'').replace(/^Turn 8 Racing$/i,'Turn8').replace(/^NASA\s*[-–].*/i,'NASA').replace(/^Speed SF$/i,'SpeedSF'));
const verified=rows=>{Object.defineProperty(rows,'verifiedEmpty',{value:true});return rows;};
const unescapeICS=s=>String(s||'').replace(/\\([nN,;\\"])/g,(_,c)=>/[nN]/.test(c)?'\n':c);
function icsDay(raw,end=false) {
 const m=raw?.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);if(!m)return null;
 const iso=`${m[1]}-${m[2]}-${m[3]}`;
 if(!m[4])return end?new Date(Date.parse(iso+'T12:00:00Z')-86400000).toISOString().slice(0,10):iso;
 if(m[7]){const instant=new Date(`${iso}T${m[4]}:${m[5]}:${m[6]}Z`);return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(+instant-(end?1:0)));}
 return end&&m[4]+m[5]+m[6]==='000000'?new Date(Date.parse(iso+'T12:00:00Z')-86400000).toISOString().slice(0,10):iso;
}
export function parseTrackCalendar(input,source,{makeEvent,parseDateRange,today}) {
 const rows=[];
 const add=({title,start,end=start,url=source.url,organizer,kind,note,track=source.track,prices=[]})=>{
  if(excluded.test(title))return;
   const isDriving=driving.test(title);
  for(const date of calendarDays(start,end)){
   if(date<today||Number(date.slice(0,4))>Number(today.slice(0,4))+1)continue;
   const event=makeEvent({title:`${title} · ${track}`,date,venue:track,organizer:organizer||knownOrganizer(title),url,source,kind:kind||(/open test|test\s*(?:&|and)\s*tune|open practice/i.test(title)?'Open practice':isDriving?'Track day':'Track event'),prices,
    note:note||'Published track schedule; confirm driving eligibility and registration with the organizer.'});
   if(event){event.track=track;event.scheduleOnly=true;event.trackCalendar=true;rows.push(event);}
  }
 };
 if(source.adapter==='ical-track'){
  const text=String(input).replace(/\r?\n[ \t]/g,'');
  if(!/^BEGIN:VCALENDAR\r?$/m.test(text)||!/^END:VCALENDAR\r?$/m.test(text))throw new Error('Unrecognized track calendar');
  const blocks=text.match(/BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT/g)||[];
  for(const block of blocks){
   const fields={};for(const line of block.split(/\r?\n/)){const m=line.match(/^([A-Z-]+)(?:;[^:]*)?:(.*)$/);if(m)fields[m[1]]=m[2];}
   const title=clean(unescapeICS(fields.SUMMARY)).replace(/^\dMI\s*[-–]\s*/i,'');
   if(excluded.test(title)||/CANCELLED|TENTATIVE/.test(fields.STATUS||''))continue;
   // Recurrence must be expanded deliberately; fail visibly rather than invent dates.
   if(fields.RRULE||fields.RDATE){const until=icsDay(fields.RRULE?.match(/UNTIL=([^;]+)/)?.[1]);if(driving.test(title)&&(!until||until>=today))throw new Error('Unsupported recurring track event');continue;}
   const start=icsDay(fields.DTSTART),end=fields.DTEND?icsDay(fields.DTEND,true):start;
   if(!start||end<today)continue;
   if(/SFR SCCA|one lap of america|\bSuper D\b|fast sideways/i.test(title)&&!driving.test(title))continue;
   const track=/^5MI/i.test(unescapeICS(fields.SUMMARY))?'Thunderhill · 5 mile':source.track;
   const description=unescapeICS(fields.DESCRIPTION);
   const $=load(description);const link=fields.URL||$('a[href]').first().attr('href');
   add({title,start,end,track,url:link&&/^https?:\/\//.test(link)?link:source.url});
  }
 }else if(source.adapter==='chuckwalla-track'){
  if(!Array.isArray(input))throw new Error('Unrecognized Chuckwalla calendar');
  for(const e of input){
   if(e.icon!=='racecar.png'||excluded.test(e.title)||/race only|race weekend|Porsche Owners Club/i.test(e.title))continue;
   const $=load(e.description||'');const link=$('a[href]').first().attr('href')||e.domain;
   add({title:e.title,start:e.start?.slice(0,10),end:e.end?.slice(0,10)||e.start?.slice(0,10),url:link&&/^https?:\/\//.test(link)?link:source.url});
  }
 }else if(source.adapter==='speedway-track'){
  // Read quoted HTML data only; never evaluate a source's JavaScript.
  const raw=String(input).match(/var\s+sfEvents\d+\s*=\s*\{([\s\S]*?)\n\s*\};/);
  if(!raw)throw new Error('Unrecognized experiences calendar');
  const entry=/'(\d{2})-(\d{2})-(\d{4})'\s*:\s*'((?:[^'\\]|\\.)*)'/g;let m;
  while((m=entry.exec(raw[1]))){
   const html=m[4].replace(/\\(?:["'\\/]|r|n|t)/g,s=>({'\\r':'\r','\\n':'\n','\\t':'\t'}[s]||s.slice(1)));const $=load(html);
   $('a[data-name]').each((_,node)=>{const a=$(node),title=a.attr('data-name');
    if(excluded.test(title)||!driving.test(title)||/Xtreme Xperience/i.test(title))return;
    const organizer=/^Open Track Days/i.test(title)?source.track+' Raceway':knownOrganizer(title);
    add({title,start:`${m[3]}-${m[1]}-${m[2]}`,url:a.attr('href')||source.url,organizer,kind:/Open Track Days/i.test(title)?'Open practice':undefined,note:/COMPETITION LICENSE/i.test(title)?'Competition license preferred; confirm vehicle and driver requirements with Sonoma.':undefined});
   });
  }
 }else if(source.adapter==='willow-track'){
  const $=load(input);let recognized=false;
  $('main h2,main h3').each((_,node)=>{
   const title=clean($(node).text());if(!/^(?:Big Willow|Streets of Willow).*Test.*Tune/i.test(title))return;recognized=true;
   const card=$(node).parent().parent();const text=clean(card.text());const label=text.match(/Dates:\s*(.*?)(?:Reserve|$)/i)?.[1];
   const year=Number(label?.match(/20\d{2}/)?.[0]);if(!year)return;
   const dates=[...label.matchAll(/([A-Za-z]+)\s+(\d{1,2})/g)].flatMap(m=>parseDateRange(m[0],year));
   for(const start of dates){const links=card.find('a[href]').toArray();
    const link=links.find(a=>{const m=clean($(a).text()).replace(/\./g,'').match(/([A-Za-z]+)\s+(\d+)/);return m&&parseDateRange(m[0],year).includes(start);});
    const price=text.match(/Price:\s*(\$[\d,]+\s+per driver)/i)?.[1];
    add({title,start,url:link?new URL($(link).attr('href'),source.url).href:source.url,organizer:'Willow Springs Raceway',track:/Streets/i.test(title)?'Streets of Willow':'Big Willow',kind:'Open practice',prices:price?[{text:price,sourceUrl:source.url,sourceId:source.id,checkedAt:new Date().toISOString()}]:[],note:'Test & tune; confirm vehicle preparation and driver requirements with Willow Springs.'});
   }
  });
  if(!recognized)throw new Error('Unrecognized Willow test schedule');
 }else if(source.adapter==='spring-track'){
  const $=load(input);if(!$('#eb_docs').length)throw new Error('Unrecognized Spring Mountain schedule');
  $('#eb_docs > .row').each((_,node)=>{const card=$(node),title=clean(card.find('.title').text());if(!/advanced track days/i.test(title))return;
   const label=clean(card.find('.date').text()),year=Number(label.match(/20\d{2}/)?.[0]);if(!year)return;const dates=parseDateRange(label,year);
   add({title,start:dates[0],end:dates.at(-1),url:new URL(card.find('.title a').attr('href'),source.url).href,organizer:'Spring Mountain',kind:'Advanced driving program',note:'Advanced school program; prerequisites, vehicle eligibility and availability must be confirmed with Spring Mountain.'});
  });
 }else throw new Error('Unknown track adapter');
 return verified(rows);
}
