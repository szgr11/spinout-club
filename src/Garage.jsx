import React,{useEffect,useState} from 'react';
import {supabase} from './supabase.js';
import {garageSpecs} from './event-tools.js';
import './member-tools.css';
export default function Garage({username,form,onApply}) {
 const [cars,setCars]=useState([]),[selected,setSelected]=useState(''),[draft,setDraft]=useState({car:'',hp:'',tire:''}),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const reload=async()=>{const r=await supabase.from('member_garage').select('id,car,hp,tire').eq('username',username).order('created_at').limit(30);if(r.error)throw r.error;setCars(r.data||[]);setLoaded(true);};
 useEffect(()=>{let active=true;setCars([]);setSelected('');setLoaded(false);setError('');supabase.from('member_garage').select('id,car,hp,tire').eq('username',username).order('created_at').limit(30).then(r=>{if(!active)return;if(r.error)setError('Garage unavailable. You can still enter specs manually.');else{setCars(r.data||[]);setLoaded(true);}}).catch(()=>{if(active)setError('Garage unavailable. You can still enter specs manually.');});return()=>{active=false;};},[username]);
 const choose=id=>{setSelected(id);setError('');setMessage('');const car=cars.find(c=>c.id===id);if(car){setDraft({car:car.car,hp:car.hp??'',tire:car.tire||''});onApply?.(car);}};
 const save=async(asNew=false)=>{
  if(busy)return;setError('');setMessage('');let specs;try{specs=garageSpecs(form||draft);}catch(e){setError(e.message);return;}
  setBusy(true);
  try{const id=asNew?'':selected;const q=id?supabase.from('member_garage').update(specs).eq('id',id).eq('username',username):supabase.from('member_garage').insert({...specs,username});const r=await q.select('id').single();if(r.error)throw r.error;setSelected(r.data.id);await reload();setMessage('Garage defaults saved. Existing laps keep their recorded specs.');}
  catch{setError('Could not save garage defaults. Your lap form has not changed.');}finally{setBusy(false);}
 };
 const remove=async()=>{if(!selected||busy)return;setBusy(true);setError('');try{const r=await supabase.from('member_garage').delete().eq('id',selected).eq('username',username);if(r.error)throw r.error;setSelected('');setDraft({car:'',hp:'',tire:''});await reload();setMessage('Removed from your garage. Lap history is unchanged.');}catch{setError('Could not remove this garage entry.');}finally{setBusy(false);}};
 return <section className="member-tool" aria-label="My garage"><h3>My garage</h3>
  <label>Saved vehicle <select aria-label="Saved garage vehicle" value={selected} disabled={busy||!loaded} onChange={e=>choose(e.target.value)}><option value="">{loaded?'Enter a vehicle / save a new one':'Loading garage…'}</option>{cars.map(c=><option key={c.id} value={c.id}>{c.car}{c.hp!=null?` · ${c.hp} whp`:''}{c.tire?` · ${c.tire}`:''}</option>)}</select></label>
  {!!(form||draft).car&&<dl key={selected} className="garage-setup club-stack" aria-label="Current vehicle setup"><div><dt>Vehicle</dt><dd>{(form||draft).car}</dd></div><div><dt>Wheel horsepower</dt><dd>{(form||draft).hp!==''&&(form||draft).hp!=null?`${(form||draft).hp} whp`:'Not recorded'}</dd></div><div><dt>Tires</dt><dd>{(form||draft).tire||'Not recorded'}</dd></div></dl>}

  {!form&&<div className="member-tool-grid">{[['car','Vehicle'],['hp','Wheel horsepower'],['tire','Tires']].map(([key,label])=><label key={key}>{label}<input aria-label={`Garage ${label}`} type={key==='hp'?'number':'text'} value={draft[key]} maxLength={key==='car'?120:160} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/></label>)}</div>}
  <p className="member-tool-note">{form?'Choose a car to fill the fields below. Edit tires, power or vehicle for this lap, then save defaults here only if you want to reuse them.':'Save the specs you use most often. You can override them every time you log a lap.'}</p>
  <div className="member-tool-row"><button type="button" disabled={busy||!loaded} onClick={()=>save()}>{selected?'Update garage defaults':'Save vehicle to garage'}</button>{selected&&<><button type="button" disabled={busy} onClick={()=>save(true)}>Save as another vehicle</button>{!form&&<button type="button" disabled={busy} onClick={remove}>Remove from garage</button>}</>}</div>
  {error&&<p role="status" className="member-tool-error">{error}</p>}{message&&<p role="status" className="member-tool-success">{message}</p>}
 </section>;
}
