import React from 'react';
import {groupTracks,layoutLabel} from './tracks.js';
export default function TrackLayoutFields({tracks,value,onChange,style}){
 const groups=groupTracks(tracks),group=groups.find(g=>g.layouts.some(t=>t.id===value));
 return <div className="track-layout-fields">
  <label>TRACK<select aria-label="Track" value={group?.key||''} onChange={e=>onChange(groups.find(g=>g.key===e.target.value).layouts[0].id)} style={style}>
   {!group&&<option value="" disabled>Select a track</option>}
   {groups.map(g=><option key={g.key} value={g.key}>{g.name} ({g.region})</option>)}
  </select></label>
  <label>LAYOUT<select aria-label="Layout" value={value||''} disabled={!group} onChange={e=>onChange(e.target.value)} style={style}>
   {!group&&<option value="">Select a track first</option>}
   {group?.layouts.map(t=><option key={t.id} value={t.id}>{layoutLabel(t)}</option>)}
  </select></label>
 </div>;
}
