import ClubHeader from './ClubHeader.jsx';
import {ClubHero} from './ClubArtwork.jsx';
import React, { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import OptionalFeature from './OptionalFeature.jsx';
import {recordRegistrationClick} from './event-tools.js';
import './member-tools.css';
const EventPlans=lazy(()=>import('./EventPlans.jsx'));
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, List, MapPin, UsersRound, X } from 'lucide-react';
import './events.css';
import {ORGANIZERS,CALENDAR_TRACKS} from './event-catalog.js';

import {calendarDays, dateKey, pacificDay} from './calendar-dates.js';

export default function EventsCalendar({onMembers}) {
  const [today,setToday]=useState(pacificDay);
  const [showPastWeeks,setShowPastWeeks]=useState(false);
  const [monthDirection,setMonthDirection]=useState(1);
  const trayRef=useRef(null), dayTriggerRef=useRef(null);
  const selectDay=(key,trigger)=>{dayTriggerRef.current=trigger;setSelected(key);};
  const closeTray=()=>{if(trayRef.current?.open)trayRef.current.close();setSelected('');requestAnimationFrame(()=>dayTriggerRef.current?.focus({preventScroll:true}));};
  useEffect(()=>{
    const updateDay=()=>setToday(pacificDay());
    const timer=setInterval(updateDay,60000);
    document.addEventListener('visibilitychange',updateDay);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',updateDay);};
  },[]);
  const [showPlans,setShowPlans]=useState(false),[planning,setPlanning]=useState('');
  const [month,setMonth]=useState(new Date(`${today.slice(0,7)}-01T12:00:00`));
  const [data,setData]=useState(null),[error,setError]=useState(''),[layout,setLayout]=useState('calendar');
  const [region,setRegion]=useState('All regions'),[track,setTrack]=useState('All tracks'),[organizer,setOrganizer]=useState('All organizers'),[kind,setKind]=useState('All types'),[selected,setSelected]=useState(''),[offersOnly,setOffersOnly]=useState(false);
  useEffect(()=>{
    let controller;
    const reload=()=>{controller?.abort();controller=new AbortController();fetch('/api/events',{signal:controller.signal,cache:'no-cache'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load events');setData(j);setError('');}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});};
    const onVisible=()=>{if(document.visibilityState==='visible')reload();};
    reload();const timer=setInterval(onVisible,15*60*1000);document.addEventListener('visibilitychange',onVisible);
    return()=>{clearInterval(timer);controller?.abort();document.removeEventListener('visibilitychange',onVisible);};
  },[]);
  const all=data?.events||[];
  const events=useMemo(()=>all.filter(e=>(region==='All regions'||e.region===region)&&(track==='All tracks'||e.track===track)&&(organizer==='All organizers'||e.organizer===organizer)&&(kind==='All types'||e.kind===kind)&&(!offersOnly||(e.promotions?.length||e.specials?.length))),[all,region,track,organizer,kind,offersOnly]);
  const {days,hiddenWeeks}=calendarDays(month,today,showPastWeeks);
  const isCurrentMonth=dateKey(month).slice(0,7)===today.slice(0,7);
  const monthKey=dateKey(month).slice(0,7);
  const yearKey=String(month.getFullYear());
  const counts=[[events.filter(e=>e.date.startsWith(monthKey)).length,month.toLocaleDateString('en-US',{month:'short',year:'numeric'})],[events.filter(e=>e.date.startsWith(yearKey+'-')).length,yearKey+' upcoming'],[events.length,'All upcoming']];
  const monthEvents=events.filter(e=>e.date.startsWith(monthKey));
  const dayEvents=events.filter(e=>e.date===selected);
  const changeMonth=n=>{setMonthDirection(n);setMonth(new Date(month.getFullYear(),month.getMonth()+n,1,12));setShowPastWeeks(false);setSelected('');};
  const goToday=()=>{
    setMonth(new Date(`${today.slice(0,7)}-01T12:00:00`));setShowPastWeeks(false);setSelected('');
    requestAnimationFrame(()=>document.getElementById(`calendar-day-${today}`)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'}));
  };
  useLayoutEffect(()=>{
    const tray=trayRef.current;
    if(selected && tray && !tray.open){
      tray.showModal();
      tray.querySelector('.calendar-tray-close')?.focus({preventScroll:true});
    } else if(!selected && tray?.open) tray.close();
  },[selected]);
  const eventList=(rows,day='')=><>{!rows.length?<div className="events-message">{day&&day<today?'This date has passed. This calendar lists upcoming track days.':`No published events match these filters for ${day?'this day':'this month'}. Try another month or clear your filters.`}{ORGANIZERS.find(o=>o.name===organizer)&&<p><a href={ORGANIZERS.find(o=>o.name===organizer).url} target="_blank" rel="noopener noreferrer">Organizer site ↗</a></p>}</div>:<div className="events-list club-stack">{rows.map(e=><article className="event-card" key={e.id}><div className="event-date"><span>{new Date(`${e.date}T12:00:00`).toLocaleDateString('en-US',{weekday:'short'})}</span><strong>{Number(e.date.slice(8))}</strong></div><div className="event-card-main"><div className="event-labels"><span>{e.region}</span><span>{e.kind}</span><span className="calendar-status">{e.registrationStatus==='registration_link'?'Registration link':'Date announced'}</span>{!!e.promotions?.length&&<span className="offer-label">{e.promotions.every(p=>p.stale)?'LAST KNOWN OFFER':'PUBLISHED OFFER'}</span>}{!!e.specials?.length&&<span className="offer-label">SPECIAL EVENT</span>}</div><h3>{e.title}</h3><p><MapPin size={13}/> {e.track} <span>· {e.organizer}</span></p>{!!e.prices?.length&&<p className="event-price">{e.prices[0].text}<span> · {e.prices[0].stale?'last known price; ':''}confirm options &amp; fees</span></p>}
          {e.promotions?.map((p,i)=><div className="event-offer" key={p.sourceUrl+i}><strong>{p.stale?'Last known offer: ':''}{p.text}</strong>{p.expiresOn&&<span>Published deadline: {p.expiresOn}</span>}<a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">View offer &amp; conditions ↗</a><small>Checked {new Date(p.checkedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} PT{p.stale?' · refresh delayed':''}</small></div>)}
          {!!e.specials?.length&&<p className="event-special">{e.specials.join(' · ')}</p>}
          {e.note&&!/^(Track calendar listing;|Open testing; check)/.test(e.note)&&<p className="event-note">{e.note}</p>}<div className="event-sources">Source: {e.sources.map((s,i)=><React.Fragment key={s.id}>{i?' + ':''}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></React.Fragment>)}</div><button type="button" className="events-plan-button" aria-expanded={planning===`${day?'day':'month'}:${e.id}`} onClick={()=>setPlanning(planning===`${day?'day':'month'}:${e.id}`?'':`${day?'day':'month'}:${e.id}`)}><UsersRound size={13} aria-hidden="true"/>Plan / who’s going</button>{planning===`${day?'day':'month'}:${e.id}`&&<OptionalFeature key={e.id}><Suspense fallback={<p role="status">Loading plans…</p>}><EventPlans event={e} events={all}/></Suspense></OptionalFeature>}</div><a onClick={recordRegistrationClick} className="event-go" href={e.url} target="_blank" rel="noopener noreferrer">View event <ArrowUpRight size={17}/></a></article>)}</div>}</>;
  return <div className="events-page">
    <ClubHeader view="events" onPlans={()=>setShowPlans(v=>!v)} showPlans={showPlans} onMembers={onMembers}/>
    <main className="events-main">
      <ClubHero eyebrow="THE SPINOUT CLUB // UPCOMING TRACK DAYS" title="Track days" aside={<div className="events-tallies" aria-label="Upcoming event day counts">{counts.map(([count,label])=><div className="events-tally" key={label}><strong>{data?count.toString().padStart(2,'0'):'—'}</strong><span>{label}</span></div>)}</div>}/>

      {showPlans&&<OptionalFeature><Suspense fallback={<p role="status">Loading your track days…</p>}><EventPlans events={all}/></Suspense></OptionalFeature>}
      <section className="events-toolbar" aria-label="Event filters">
        {[[region,setRegion,'Region',['All regions',...new Set([...CALENDAR_TRACKS.map(t=>t.region),...all.map(e=>e.region)])]],[track,setTrack,'Track',['All tracks',...new Set([...CALENDAR_TRACKS.map(t=>t.name),...all.map(e=>e.track)])]],[organizer,setOrganizer,'Organizer',['All organizers',...new Set([...ORGANIZERS.map(o=>o.name),...all.map(e=>e.organizer)])]],[kind,setKind,'Event type',['All types',...new Set(all.map(e=>e.kind))]]].map(([value,setter,label,options])=><label key={label}>{label}<select value={value} onChange={e=>{setter(e.target.value);setSelected('');}}>{options.sort((a,b)=>a.startsWith('All')?-1:b.startsWith('All')?1:a.localeCompare(b)).map(o=><option key={o}>{o}</option>)}</select></label>)}
      </section>
      <label className="events-offer-filter"><input type="checkbox" checked={offersOnly} onChange={e=>setOffersOnly(e.target.checked)}/> Offers &amp; special events only</label>
      {error&&data&&<p className="source-warning" role="status">Latest refresh unavailable. Showing the last loaded calendar.</p>}
      <div className="events-monthbar"><div className="events-monthnav"><button aria-label="Previous month" onClick={()=>changeMonth(-1)}><ChevronLeft size={18}/></button><h2>{month.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h2><button aria-label="Next month" onClick={()=>changeMonth(1)}><ChevronRight size={18}/></button><button className="today-button" onClick={goToday}>Today</button></div><div className="events-layout"><button aria-pressed={layout==='calendar'} onClick={()=>setLayout('calendar')}><CalendarDays size={15}/> Calendar</button><button aria-pressed={layout==='list'} onClick={()=>setLayout('list')}><List size={15}/> List</button></div></div>
      {error&&!data?<div className="events-message" role="alert">{error}</div>:!data?<div className="events-message" role="status">Loading upcoming track days…</div>:<>
        {layout==='calendar'&&<>
        <div className="calendar-context"><span><i className="calendar-today-dot"/>Today · {new Date(`${today}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})} PT{isCurrentMonth&&hiddenWeeks>0&&<small> · {hiddenWeeks} past weeks hidden</small>}</span>{isCurrentMonth&&<button className="events-text" aria-pressed={showPastWeeks} onClick={()=>setShowPastWeeks(v=>!v)}>{showPastWeeks?'Focus on this week':'Show full month'}</button>}</div>
        <div className="events-grid" key={monthKey} style={{'--month-direction':monthDirection}}><div className="events-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d}>{d}</div>)}</div><div className="events-days">{days.map(d=>{const key=dateKey(d),daily=events.filter(e=>e.date===key);return <div id={`calendar-day-${key}`} key={key} className={`events-day ${daily.length?'has-events':''} ${key<today?'is-past':''} ${d.getMonth()!==month.getMonth()?'muted':''} ${key===today?'is-today':''} ${key===selected?'selected':''}`}><button className="day-number" onClick={e=>selectDay(key,e.currentTarget)} aria-current={key===today?'date':undefined} aria-haspopup="dialog" aria-label={`${key===today?'Today, ':''}${key}: ${key<today?'past date, upcoming calendar only':`${daily.length} events`}`}><b>{d.getDate()}</b><span className="day-caption">{key===today?'TODAY':key<today?'PAST':daily.length?`${daily.length} events`:''}</span></button>{daily.slice(0,3).map(e=><a onClick={recordRegistrationClick} className={`calendar-chip region-${e.region}`} key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" title={`${e.title} · ${e.organizer}${e.promotions?.length?' · Published offer':''}${e.specials?.length?' · Special event':''}`}><strong>{e.track}</strong><span>{e.organizer}</span>{!!(e.promotions?.length||e.specials?.length)&&<small className="calendar-offer">{e.promotions?.length?'OFFER':'SPECIAL'}</small>}</a>)}{daily.length>3&&<button className="events-more" aria-haspopup="dialog" onClick={e=>selectDay(key,e.currentTarget)}>+{daily.length-3} more</button>}</div>;})}</div></div></>}
        <section className="calendar-month-list" aria-label="Track days this month">
          <div className="events-list-heading"><h3>Upcoming this month <span>{monthEvents.length}</span></h3></div>
          {eventList(monthEvents)}
        </section>
        <dialog ref={trayRef} className="calendar-tray" aria-labelledby="calendar-tray-heading" onCancel={e=>{e.preventDefault();closeTray();}} onClose={closeTray} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeTray();}}}>
          <div className="events-list-heading"><h3 id="calendar-tray-heading">{selected?new Date(`${selected}T12:00:00`).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}):'Day details'} <span>{dayEvents.length}</span></h3><button type="button" className="calendar-tray-close" aria-label="Close day details" onClick={closeTray}><X size={18}/></button></div>
          {selected&&eventList(dayEvents,selected)}
        </dialog></>}
      <details className="organizer-directory"><summary>Organizers <span>{ORGANIZERS.length}</span></summary><div className="organizer-links">{ORGANIZERS.map(o=>{const count=all.filter(e=>e.organizer===o.name).length;return <div key={o.id}><a href={o.url} target="_blank" rel="noopener noreferrer">{o.name} ↗</a><span>{count?`${count} upcoming days`:o.note||'No upcoming dates listed'}</span></div>;})}</div></details>
      <details className="calendar-health"><summary>Calendar status</summary><p>Sources checked hourly. Prices, eligibility and availability should be confirmed with the organizer.</p>{data?.updatedAt&&Date.now()-Date.parse(data.updatedAt)>150*60000&&<p role="status">Calendar refresh is overdue. Showing the latest saved dates.</p>}<ul>{data?.sources?.map(s=><li key={s.id}>{s.name}: {s.status==='ok'?'schedule checked':s.status==='pending_access'?'API access pending':'refresh delayed'}{s.dropDetected?' · event count needs review':''}</li>)}</ul></details>
      <aside className="events-footnote"><div>{data?.updatedAt&&<p>Updated {new Date(data.updatedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} PT</p>}{data?.sources?.filter(s=>s.status!=='ok').map(s=><p className="source-warning" key={s.id}>{s.name}: {s.status==='pending_access'?'API access pending. Confirm last known dates with the organizer.':'update delayed.'}</p>)}</div><a href="https://www.motorsportreg.com/calendar/" target="_blank" rel="noopener noreferrer">More on MotorsportReg <ArrowUpRight size={15}/></a></aside>
    </main><footer className="events-footer">◆ THE SPINOUT CLUB</footer>
  </div>;
}
