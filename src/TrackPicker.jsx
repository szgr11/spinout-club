import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Check,ChevronRight,Search,X} from 'lucide-react';
import {groupTracks,layoutLabel,layoutCounts} from './tracks.js';
import TrackMap,{MapCredit} from './TrackMap.jsx';
export default function TrackPicker({tracks,value,laps=[],allowArchived=false,allowHidden=false,onSelect,onClose}){
 const groups=useMemo(()=>groupTracks(tracks.filter(t=>(allowHidden||!t.hidden)&&(allowArchived||t.active!==false))),[tracks,allowArchived,allowHidden]);
 const initial=groups.find(g=>g.layouts.some(t=>t.id===value));
 const [region,setRegion]=useState(initial?.region||'All'),[query,setQuery]=useState(''),[focused,setFocused]=useState(initial?.key||'');
 const [choice,setChoice]=useState(value),[stage,setStage]=useState('tracks');const dialog=useRef(null);
 const counts=useMemo(()=>layoutCounts(laps),[laps]);
 const group=groups.find(g=>g.key===focused),selected=tracks.find(t=>t.id===choice);
 const regions=['All',...new Set(groups.map(g=>g.region))];
 const visible=groups.filter(g=>(region==='All'||g.region===region)&&`${g.name} ${g.region}`.toLowerCase().includes(query.toLowerCase()));
 useEffect(()=>{dialog.current.showModal();return()=>dialog.current?.close();},[]);
 useEffect(()=>{if(dialog.current)dialog.current.scrollTop=0;},[stage,focused]);
 const chooseGroup=g=>{setFocused(g.key);setChoice(g.layouts.some(t=>t.id===value)?value:g.layouts[0].id);setStage('layouts');};
 return <dialog ref={dialog} className="track-picker-tray" aria-labelledby="track-picker-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
  <header className="track-tray-header"><div><small>CIRCUIT DIRECTORY</small><h2 id="track-picker-title">{stage==='layouts'&&group?group.name:'Choose your track'}</h2></div><button type="button" aria-label="Close track selector" onClick={onClose}><X size={20}/></button></header>
  {stage==='tracks'?<>
   <nav className="track-regions" aria-label="Filter tracks by region">{regions.map(r=><button key={r} type="button" aria-pressed={r===region} onClick={()=>setRegion(r)}>{r}</button>)}</nav>
   <label className="track-search"><Search size={15}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a circuit…" aria-label="Find a circuit"/></label>
   <div className="track-directory-grid">{visible.map(g=>{const representative=g.layouts.find(t=>counts[t.id])||g.layouts[0],count=g.layouts.reduce((n,t)=>n+(counts[t.id]||0),0);return <button type="button" className="track-venue-card" key={g.key} onClick={()=>chooseGroup(g)}>
    <div className="track-card-topline"><small>{g.region}</small><span>{g.layouts.length} layouts</span></div><TrackMap track={representative}/><strong>{g.name}</strong><div className="track-card-footer"><span><b>{count}</b> lap entries</span><ChevronRight size={16}/></div>
   </button>;})}</div>{!visible.length&&<p className="track-empty">No circuits match your search.</p>}
  </>:group&&<>
   <div className="track-layout-toolbar"><button type="button" onClick={()=>setStage('tracks')}><ArrowLeft size={14}/> All tracks</button><span>{group.region} · <b>{group.layouts.reduce((n,t)=>n+(counts[t.id]||0),0)}</b> track entries</span></div>
   <div className="track-selected-map"><TrackMap track={selected}/><div><h3>{layoutLabel(selected)}</h3><span><b>{counts[choice]||0}</b> lap entries in this layout</span><MapCredit track={selected}/></div></div>
   <div className="track-layout-options" role="group" aria-label="Track layouts">{group.layouts.map(t=><button type="button" key={t.id} aria-pressed={choice===t.id} onClick={()=>setChoice(t.id)}><TrackMap track={t} compact/><span><strong>{layoutLabel(t)}</strong><small>{t.active===false?'Archived · ':''}{counts[t.id]||0} lap entries</small></span>{choice===t.id&&<Check size={16}/>}</button>)}</div>
   <footer className="track-tray-footer"><span>Counts include approved entries across all dates.</span><button type="button" className="track-primary" onClick={()=>{onSelect(choice);onClose();}}>Use this layout <Check size={14}/></button></footer>
  </>}
 </dialog>;
}
