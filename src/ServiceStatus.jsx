import React,{useCallback,useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {supabase} from './supabase.js';
import './member-tools.css';
export default function ServiceStatus(){
 const [health,setHealth]=useState(null),[counts,setCounts]=useState(null),[error,setError]=useState('');
 const [busy,setBusy]=useState(true),[message,setMessage]=useState('');
 const active=useRef(false),pending=useRef(false);
 const load=useCallback(async(refresh=false)=>{
  if(pending.current)return;
  pending.current=true;setBusy(true);setError('');setMessage('');
  try{
   if(refresh){
    const session=await supabase.auth.getSession();
    if(session.error||!session.data?.session?.access_token)throw new Error('Please sign in again before refreshing.');
    const response=await fetch('/api/admin/refresh',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`},cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Could not refresh data. Please try again shortly.');
    if(active.current){setHealth(result.health);setCounts(result.counts);setMessage(result.health.status==='ok'?'Latest calendar data fetched. Service checks updated.':'Refresh finished. Some sources still need attention; details are shown below.');}
   }else{
    const [h,c]=await Promise.allSettled([
     fetch('/api/health',{cache:'no-store'}).then(async r=>{const data=await r.json();if(!['ok','attention','unavailable'].includes(data.status))throw new Error();return data;}),
     supabase.rpc('spinout_service_counts'),
    ]);
    if(!active.current)return;
    if(h.status==='fulfilled')setHealth(h.value);
    if(c.status==='fulfilled'&&!c.value.error)setCounts(c.value.data);
    if(h.status==='rejected'||c.status==='rejected'||c.value?.error)setError('Some service checks are unavailable. Existing member tools remain available.');
   }
  }catch(e){if(active.current)setError(e.message||'Could not refresh data. Please try again shortly.');}
  finally{pending.current=false;if(active.current)setBusy(false);}
 },[]);
 useEffect(()=>{active.current=true;void load();return()=>{active.current=false;};},[load]);
 return <section className="member-tool" aria-busy={busy}>
  <div className="service-health-heading"><h3>Service health</h3><button type="button" disabled={busy} onClick={()=>load(true)}><RefreshCw size={14} aria-hidden="true"/><span>{busy?'Fetching data…':'Refresh & fetch new data'}</span></button></div>
  {!health&&!counts&&!error&&<p role="status">Loading checks…</p>}
  {message&&<p role="status" className="member-tool-success">{message}</p>}{error&&<p role="alert" className="member-tool-error">{error}</p>}
  {health&&<><p>Calendar: {health.status} · {health.eventDays??'—'} upcoming event days</p>{health.updatedAt&&<p className="member-tool-note">Last calendar update: {new Date(health.updatedAt).toLocaleString()}</p>}<ul>{health.issues?.map(i=><li key={i}>{i}</li>)}</ul></>}
  {counts&&<div className="member-tool-grid">{Object.entries(counts).map(([k,v])=><p key={k}>{k.replaceAll('_',' ')}<br/><strong>{v}</strong></p>)}</div>}
  {health?.sources?.some(s=>s.status==='on_demand')&&<p className="member-tool-note">Fetched only when triggered: {health.sources.filter(s=>s.status==='on_demand').map(s=>s.name).join(', ')}. Use Refresh & fetch new data to run these sources. Hourly updates leave them alone.</p>}
  <p className="member-tool-note">Refresh fetches the latest calendar data from configured sources and updates these checks. Allow a moment to finish. Please wait at least a minute between manual refreshes.</p>
 </section>;
}
