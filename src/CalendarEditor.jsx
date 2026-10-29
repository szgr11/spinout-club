import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase.js';
import {applyCalendarChanges,calendarEntryDocument} from './calendar-editor-data.js';
import {CALENDAR_TRACKS} from './event-catalog.js';
import './calendar-editor.css';

const blank=()=>({id:`staff-${crypto.randomUUID()}`,date:'',title:'',track:'',region:'SoCal',organizer:'',kind:'Track day',url:'',note:'',sources:[]});
const states=['All statuses','visible','hidden','removed'];
export default function CalendarEditor(){
 const [events,setEvents]=useState([]),[changes,setChanges]=useState([]),[selected,setSelected]=useState(new Set());
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[form,setForm]=useState(null);
 const [search,setSearch]=useState(''),[track,setTrack]=useState(''),[organizer,setOrganizer]=useState(''),[state,setState]=useState('visible'),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const reload=useCallback(async()=>{
  const [response,result]=await Promise.all([fetch('/api/events',{cache:'no-store'}),supabase.rpc('spinout_calendar_editor')]);
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load calendar entries.');if(result.error)throw result.error;
  setEvents(data.events||[]);setChanges(result.data||[]);setSelected(new Set());
 },[]);
 useEffect(()=>{let active=true;setBusy(true);reload().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[reload]);
 const rows=useMemo(()=>applyCalendarChanges(events,changes,{includeHidden:true}),[events,changes]);
 const filtered=rows.filter(e=>(!search||[e.title,e.track,e.organizer,e.date].join(' ').toLowerCase().includes(search.toLowerCase()))&&(!track||e.track===track)&&(!organizer||e.organizer===organizer)&&(state==='All statuses'||e.editorState===state)&&(!from||e.date>=from)&&(!to||e.date<=to));
 const byId=new Map(changes.map(c=>[c.id,c]));
 const act=async(action,entries)=>{
  if(busy||!entries.length)return;
  if(entries.length>100){setError('Select up to 100 entries per action.');return;}
  if(action==='remove'&&!window.confirm(`Remove ${entries.length} selected calendar ${entries.length===1?'entry':'entries'}? You can restore them using the Removed filter.`))return;
  setBusy(true);setError('');setNotice('');
  try{
   const payload=entries.map(e=>({id:e.id,revision:Object.hasOwn(e,'_revision')?e._revision:byId.get(e.id)?.updated_at||null,document:calendarEntryDocument(e)}));
   const result=await supabase.rpc('spinout_edit_calendar_entries',{p_action:action,p_entries:payload});if(result.error)throw result.error;
   setForm(null);await reload();setNotice(`${entries.length} ${entries.length===1?'entry':'entries'} updated.`);
  }catch(e){setError(e.message||'Could not save calendar entries.');}finally{setBusy(false);}
 };
 const field=(key,value)=>setForm(current=>({...current,[key]:value}));
 const visibleIds=new Set(filtered.map(e=>e.id)),chosen=rows.filter(e=>selected.has(e.id)&&visibleIds.has(e.id));
 const allChecked=filtered.length>0&&filtered.every(e=>selected.has(e.id));
 return <section className="member-tool calendar-editor" aria-busy={busy}>
  <div className="service-health-heading"><h3>Track day entries</h3><div className="member-tool-row"><button disabled={busy} onClick={()=>{setForm(blank());setError('');}}>Add track day</button><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await reload();}catch(e){setError(e.message);}finally{setBusy(false);}}}>Reload entries</button></div></div>
  <p className="member-tool-note">Edit imported dates or add your own. Hidden and removed entries stay off the public calendar after bot updates, and can be restored. Calendar changes do not change anyone’s saved plans or organizer registrations.</p>
  <div className="calendar-editor-filters">
   <label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Title, organizer, track…"/></label>
   <label>Track<select value={track} onChange={e=>setTrack(e.target.value)}><option value="">All tracks</option>{[...new Set(rows.map(e=>e.track))].sort().map(t=><option key={t}>{t}</option>)}</select></label>
   <label>Organizer<select value={organizer} onChange={e=>setOrganizer(e.target.value)}><option value="">All organizers</option>{[...new Set(rows.map(e=>e.organizer))].sort().map(o=><option key={o}>{o}</option>)}</select></label>
   <label>Status<select value={state} onChange={e=>setState(e.target.value)}>{states.map(s=><option key={s}>{s}</option>)}</select></label>
   <label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Through<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
  </div>
  {form&&<form className="calendar-editor-form" onSubmit={e=>{e.preventDefault();void act('save',[form]);}}>
   <h4>{byId.has(form.id)||events.some(e=>e.id===form.id)?'Edit track day':'Add track day'}</h4><div className="calendar-editor-filters">
    <label>Date<input type="date" required value={form.date} onChange={e=>field('date',e.target.value)}/></label>
    <label>Title<input required maxLength={180} value={form.title} onChange={e=>field('title',e.target.value)}/></label>
    <label>Track<input required list="calendar-editor-tracks" maxLength={120} value={form.track} onChange={e=>field('track',e.target.value)}/><datalist id="calendar-editor-tracks">{CALENDAR_TRACKS.map(t=><option key={t.name} value={t.name}/>)}</datalist></label>
    <label>Region<select value={form.region} onChange={e=>field('region',e.target.value)}>{['SoCal','NorCal','Nevada'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Organizer<input required maxLength={120} value={form.organizer} onChange={e=>field('organizer',e.target.value)}/></label>
    <label>Type<select value={form.kind} onChange={e=>field('kind',e.target.value)}>{['Track day','Track day / time trial','Open practice','Autocross','Track event'].map(v=><option key={v}>{v}</option>)}</select></label>
   </div><label>Event / source link<input type="url" required maxLength={2000} value={form.url} onChange={e=>field('url',e.target.value)}/></label><label>Notes<textarea maxLength={2000} rows={3} value={form.note||''} onChange={e=>field('note',e.target.value)}/></label>
   <div className="member-tool-row"><button disabled={busy}>Save entry</button><button type="button" disabled={busy} onClick={()=>setForm(null)}>Cancel</button></div>
  </form>}
  {error&&<p role="alert" className="member-tool-error">{error}</p>}{notice&&<p role="status" className="member-tool-success">{notice}</p>}
  <div className="member-tool-row"><label><input type="checkbox" checked={allChecked} disabled={busy||!filtered.length} onChange={e=>setSelected(current=>{const next=new Set(current);for(const row of filtered)e.target.checked?next.add(row.id):next.delete(row.id);return next;})}/>Select filtered entries</label><span>{filtered.length} shown · {chosen.length} selected</span>
   {['hide','restore','remove'].map(action=><button key={action} disabled={busy||!chosen.length} onClick={()=>act(action,chosen)}>{action==='hide'?'Hide selected':action==='restore'?'Restore selected':'Remove selected'}</button>)}
  </div>
  <div className="calendar-editor-list">{filtered.map(row=><article className="calendar-editor-row" key={row.id}>
   <input type="checkbox" aria-label={`Select ${row.title} on ${row.date}`} disabled={busy} checked={selected.has(row.id)} onChange={e=>setSelected(current=>{const next=new Set(current);e.target.checked?next.add(row.id):next.delete(row.id);return next;})}/>
   <div><strong>{row.date} · {row.title}</strong><p>{row.track} · {row.organizer} · <span>{row.editorState}</span></p></div><button disabled={busy} onClick={()=>{setForm({...row,_revision:byId.get(row.id)?.updated_at||null});setError('');}}>Edit</button>
  </article>)}{!filtered.length&&!busy&&<p>No calendar entries match these filters.</p>}</div>
 </section>;
}
