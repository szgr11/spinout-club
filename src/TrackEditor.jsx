import React,{useMemo,useState} from 'react';
import {supabase} from './supabase.js';
import {canModerate} from './permissions.js';
import {groupTracks,layoutCounts,layoutLabel} from './tracks.js';
import {defaultMapKey,getTrackMap,TRACE_PRESETS} from './track-maps.js';
import TrackMap,{MapCredit} from './TrackMap.jsx';
import TraceEditor from './TraceEditor.jsx';
import './track-library.css';
const blank={id:null,circuit_id:null,name:'',variant:'',region:'SoCal',active:true,hidden:false,map_key:'',map_path:'',map_source:'',map_scope:'layout'};
const formFor=t=>({...blank,...t,map_key:t.map_key??defaultMapKey(t.id),map_path:t.map_path||'',map_source:t.map_source||getTrackMap(t)?.source||'',map_scope:t.map_scope||getTrackMap(t)?.scope||'layout'});
export default function TrackEditor({tracks,laps=[],account,onSaved}){
 const groups=useMemo(()=>groupTracks(tracks),[tracks]),counts=useMemo(()=>layoutCounts(laps),[laps]);
 const [form,setForm]=useState(()=>tracks[0]?formFor(tracks[0]):blank),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[presets,setPresets]=useState(false);
 if(!canModerate(account))return null;
 const group=groups.find(g=>g.key===form.circuit_id),field=(k,v)=>setForm(f=>({...f,[k]:v}));
 const select=t=>{setForm(formFor(t));setError('');setNotice('');setPresets(false);};
 const newLayout=()=>{setForm({...blank,circuit_id:form.circuit_id,name:form.name,region:form.region});setError('');setNotice('');};
 const save=async e=>{e.preventDefault();if(busy)return;setError('');setNotice('');setBusy(true);try{const r=await supabase.rpc('spinout_save_track_layout',{p_layout:form});if(r.error)throw r.error;await onSaved();setForm(formFor(r.data));setNotice('Saved. Track names, layout settings and maps are updated.');}catch(e){setError(e.message||'Could not save the layout. Your edits are still here.');}finally{setBusy(false);}};
 return <section className="track-editor"><div className="track-editor-top"><div><h2>Tracks & layouts</h2><p className="track-editor-note">Manage circuits, credited outlines, visibility, and archived layouts.</p></div><button className="track-primary" type="button" onClick={()=>{setForm({...blank});setError('');setNotice('');}}>+ New track</button></div>
 <div className="track-editor-grid"><nav className="track-editor-directory" aria-label="Edit a circuit">{groups.map(g=><button key={g.key} type="button" disabled={busy} aria-pressed={form.circuit_id===g.key} onClick={()=>select(g.layouts[0])}>{g.name}<small>{g.region} · {g.layouts.length} layouts · {g.layouts.reduce((n,t)=>n+(counts[t.id]||0),0)} entries{g.layouts.every(t=>t.hidden)?' · hidden':''}</small></button>)}</nav>
 <form className="track-editor-form" onSubmit={save}><h3>{form.id?'Edit layout':form.circuit_id?'Add layout':'Add track and first layout'}</h3>
 <div className="track-editor-layouts" role="group" aria-label="Edit track layouts">{group?.layouts.map(t=><button key={t.id} type="button" disabled={busy} aria-pressed={form.id===t.id} onClick={()=>select(t)}>{layoutLabel(t)}{t.hidden?' · hidden':t.active===false?' · archived':''}</button>)}</div>
 {form.circuit_id&&<button className="track-secondary" type="button" disabled={busy} onClick={newLayout}>+ Add layout to this track</button>}
 <div className="track-editor-fields" style={{marginTop:18}}><label>Track name<input required maxLength={100} value={form.name} onChange={e=>field('name',e.target.value)}/></label><label>Region<input required maxLength={40} value={form.region} onChange={e=>field('region',e.target.value)}/></label><label className="track-editor-wide">Layout name / direction<input required maxLength={120} value={form.variant} onChange={e=>field('variant',e.target.value)} placeholder="e.g. Classic Race #13 · CW"/></label></div>
 <p className="track-editor-note">Changing the track name or region updates all its layouts. Existing lap times keep their layout assignment.</p>
 <div className="track-editor-actions"><label><input type="checkbox" checked={!form.active} onChange={e=>field('active',!e.target.checked)}/> Archived — retire from new submissions</label><label><input type="checkbox" checked={form.hidden} onChange={e=>field('hidden',e.target.checked)}/> Hidden — remove from public picker</label></div>
 <h3 style={{marginTop:24}}>Layout map</h3><TrackMap track={form}/><MapCredit track={form}/>
 <button type="button" className="track-secondary" onClick={()=>setPresets(!presets)}>Choose a credited outline</button>
 {presets&&<div className="trace-presets">{Object.entries(TRACE_PRESETS).map(([key,map])=><button key={key} type="button" aria-pressed={form.map_key===key&&!form.map_path} onClick={()=>{setForm(f=>({...f,map_key:key,map_path:'',map_source:map.source,map_scope:map.scope||'layout'}));setPresets(false);}}><TrackMap track={{...form,map_key:key,map_path:'',map_source:map.source}} compact/>{map.title}</button>)}</div>}
 <TraceEditor key={form.id||`new-${form.circuit_id}`} path={form.map_path||TRACE_PRESETS[form.map_key]?.path||''} onChange={v=>field('map_path',v)}/>
 <label style={{margin:'16px 0'}}>Credited source URL<input type="url" maxLength={1000} value={form.map_source} onChange={e=>field('map_source',e.target.value)} placeholder="https://official-track.example/map"/></label>
 <div className="track-editor-actions" role="group" aria-label="Map scope"><button className="track-secondary" type="button" aria-pressed={form.map_scope==='layout'} onClick={()=>field('map_scope','layout')}>Exact layout</button><button className="track-secondary" type="button" aria-pressed={form.map_scope==='venue'} onClick={()=>field('map_scope','venue')}>Venue overview</button></div>
 <p className="track-editor-note">Use the source’s exact configuration name. CW/CCW describes direction; an A-section or bypass changes the route. Only select “Exact layout” when the credited map matches.</p>
 {error&&<p className="track-editor-error" role="alert">{error}</p>}{notice&&<p className="track-editor-success" role="status">{notice}</p>}
 <button className="track-primary" disabled={busy}>{busy?'Saving…':'Save track / layout'}</button>
 </form></div></section>;
}
