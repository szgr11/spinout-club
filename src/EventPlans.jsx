import React,{useEffect,useState} from 'react';
import {supabase,publicSupabase} from './supabase.js';
import useMember from './useMember.js';
import {downloadCalendar,googleCalendarURL} from './event-tools.js';
import './member-tools.css';

function CalendarLinks({event}) {return <div className="member-tool-row"><a href={googleCalendarURL(event)} target="_blank" rel="noopener noreferrer">Google Calendar ↗</a><button type="button" onClick={()=>downloadCalendar(event)}>Apple / .ics</button></div>;}
export default function EventPlans({event,events=[]}) {
 const {account,error:accountError,loading:accountLoading}=useMember();
 const [attendees,setAttendees]=useState([]),[plan,setPlan]=useState(null),[plans,setPlans]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const [readyFor,setReadyFor]=useState('');
 const [includePast,setIncludePast]=useState(false);
 useEffect(()=>{
  let active=true;setError('');setPlan(null);setPlans([]);setLoaded(false);setAttendees([]);setReadyFor('');
  (async()=>{
   try{
    if(event){
     if(!publicSupabase)throw new Error();
     const r=await publicSupabase.from('event_attendees').select('username').eq('event_key',event.id).order('username').limit(200);
     if(r.error)throw r.error;if(active)setAttendees(r.data||[]);
    }
    if(account){
     let q=supabase.from('event_plans').select('*').eq('username',account.username);
     if(!event&&!includePast)q=q.gte('date',new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date()));
     const r=event?await q.eq('event_key',event.id).maybeSingle():await q.order('date').order('event_key').limit(256);
     if(r.error)throw r.error;if(active){if(event)setPlan(r.data);else setPlans(r.data||[]);setReadyFor(account.username);}
    }
   }catch{if(active)setError('Could not load track-day plans. The calendar and registration links are still available.');}
   if(active)setLoaded(true);
  })();
  return()=>{active=false;};
 },[event?.id,account?.username,refresh,includePast]);
 const save=async(state,share=false)=>{
  if(!account||busy)return;setBusy(true);setError('');
  try{
   const row={event_key:event.id,username:account.username,date:event.date,title:event.title,track:event.track,organizer:event.organizer,url:event.url,state,share_attendance:state==='going'&&share};
   const r=await supabase.from('event_plans').upsert(row,{onConflict:'event_key,username'});
   if(r.error)throw r.error;setPlan(row);setRefresh(n=>n+1);
  }catch{setError('Could not save your plan. Please try again.');}finally{setBusy(false);}
 };
 const remove=async(row)=>{
  if(!account||busy)return;setBusy(true);setError('');
  try{const r=await supabase.from('event_plans').delete().eq('event_key',row.event_key).eq('username',account.username);if(r.error)throw r.error;setRefresh(n=>n+1);}
  catch{setError('Could not remove the plan. Please try again.');}finally{setBusy(false);}
 };
 const current=new Set(events.map(e=>e.id));
 return <section className="member-tool" aria-label={event?'Track-day plans':'My track days'}>
  <h3>{event?"Who's going?":'My track days'}</h3>
  {event&&<><div className="member-tool-people">{attendees.map(a=><span key={a.username}>@{a.username}</span>)}</div>{!attendees.length&&loaded&&<p className="member-tool-note">No members have shared attendance yet.</p>}{attendees.length===200&&<p className="member-tool-note">Showing the first 200 members.</p>}<CalendarLinks event={event}/></>}
  {(error||accountError)&&<p role="status" className="member-tool-error">{error||accountError}</p>}
  {accountLoading?<p role="status">Checking membership…</p>:!account?<p className="member-tool-note"><a href="/members">Sign in as a club member</a> to save days or share that you’re going.</p>:event?<>
   <div className="member-tool-row" aria-label="My plan">{[['saved','Save'],['interested','Interested'],['going','Going']].map(([state,label])=><button type="button" key={state} disabled={busy||!loaded||readyFor!==account.username} aria-pressed={plan?.state===state} onClick={()=>save(state,plan?.share_attendance)}>{label}</button>)}{plan&&<button type="button" disabled={busy} onClick={()=>remove(plan)}>Remove plan</button>}</div>
   {plan?.state==='going'&&<label><input type="checkbox" checked={!!plan.share_attendance} disabled={busy} onChange={e=>save('going',e.target.checked)}/>Show my username publicly as going</label>}
   <p className="member-tool-note">Saved and interested days are private. Attendance is visible only when you choose to share it. Planning a day does not register you with the organizer.</p>
  </>:<>
   <label><input type="checkbox" checked={includePast} onChange={e=>setIncludePast(e.target.checked)}/>Include past plans</label>
   {!loaded?<p role="status">Loading your plans…</p>:!plans.length?<p>No saved track days yet. Open “Plan / who’s going” on an event to get started.</p>:<ul className="member-tool-list">{plans.map(row=><li key={row.event_key}><h4>{row.date} · {row.track}</h4><p>{row.title} · {row.state}{row.state==='going'?(row.share_attendance?' · Shared':' · Private'):''}</p>{!current.has(row.event_key)&&<p className="member-tool-note">Not in the latest calendar. Confirm the date with the organizer.</p>}<a href={row.url} target="_blank" rel="noopener noreferrer">Organizer listing ↗</a><CalendarLinks event={row}/><button type="button" disabled={busy} onClick={()=>remove(row)}>Remove plan</button></li>)}</ul>}
  </>}
  <button type="button" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Refresh plans</button>
 </section>;
}
