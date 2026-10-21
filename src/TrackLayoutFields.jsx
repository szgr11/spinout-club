import React,{lazy,Suspense,useMemo,useRef,useState} from 'react';
import {MapPin,ChevronRight} from 'lucide-react';
import {layoutLabel,layoutCounts} from './tracks.js';
import './track-library.css';
const TrackPicker=lazy(()=>import('./TrackPicker.jsx'));
export default function TrackLayoutFields({tracks,value,onChange,laps=[],allowArchived=false,allowHidden=false}){
 const counts=useMemo(()=>layoutCounts(laps),[laps]);
 const [open,setOpen]=useState(false);const trigger=useRef(null);const selected=tracks.find(t=>t.id===value);
 return <div className="track-layout-fields"><button ref={trigger} type="button" className="track-selection-trigger" aria-label="Choose track and layout" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>
  <MapPin size={20}/><span className="track-selection-copy"><small>{selected?.region||'TRACK / LAYOUT'}</small><strong>{selected?.name||'Choose a track'}</strong><span>{selected?layoutLabel(selected):'Browse circuit maps'}{selected?` · ${counts[selected.id]||0} ${(counts[selected.id]||0)===1?'entry':'entries'}`:''}{selected?.active===false?' · Archived':''}</span></span><span className="track-selection-action">Explore <ChevronRight size={15}/></span>
 </button>{open&&<Suspense fallback={<p role="status">Loading circuits…</p>}><TrackPicker tracks={tracks} value={value} laps={laps} allowArchived={allowArchived} allowHidden={allowHidden} onSelect={onChange} onClose={()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));}}/></Suspense>}</div>;
}
