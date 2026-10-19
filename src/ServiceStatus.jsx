import React,{useEffect,useState} from 'react';
import {supabase} from './supabase.js';
import './member-tools.css';
export default function ServiceStatus(){
 const [health,setHealth]=useState(null),[counts,setCounts]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;Promise.allSettled([fetch('/api/health').then(r=>r.json()),supabase.rpc('spinout_service_counts')]).then(([h,c])=>{if(!active)return;if(h.status==='fulfilled')setHealth(h.value);if(c.status==='fulfilled'&&!c.value.error)setCounts(c.value.data);if(h.status==='rejected'||c.status==='rejected'||c.value?.error)setError('Some service checks are unavailable. Existing member tools remain available.');});return()=>{active=false;};},[]);
 return <section className="member-tool"><h3>Service health</h3>{!health&&!counts&&!error&&<p>Loading checks…</p>}{error&&<p role="status">{error}</p>}{health&&<><p>Calendar: {health.status} · {health.eventDays??'—'} upcoming event days</p><ul>{health.issues?.map(i=><li key={i}>{i}</li>)}</ul></>}{counts&&<div className="member-tool-grid">{Object.entries(counts).map(([k,v])=><p key={k}>{k.replaceAll('_',' ')}<br/><strong>{v}</strong></p>)}</div>}<p className="member-tool-note">Checks load when this tab opens. Counts use existing club records. No visitor identities, tracking cookies or extra background polling.</p></section>;
}
