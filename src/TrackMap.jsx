import React from 'react';
import {getTrackMap,safeSource} from './track-maps.js';
export default function TrackMap({track,compact=false}){
 const map=getTrackMap(track);
 return <div className={`track-map ${compact?'track-map-compact':''}`}>
  {map?<svg viewBox="0 0 1000 1000" role="img" aria-label={`${track?.name||''} ${map.title} outline`}><path d={map.path} fill="none" stroke="currentColor" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"/></svg>:<span className="track-map-missing">Map awaiting<br/>source verification</span>}
 </div>;
}
export function MapCredit({track}){const map=getTrackMap(track),source=safeSource(track?.map_source)||(track?.id==='lvms'?'https://www.lvms.com/tracks/road-courses/':null);return map?<p className="track-map-credit">{map.scope==='venue'?'Venue reference · configuration may differ. ':'Traced layout · '}{map.title} <a href={map.source} target="_blank" rel="noopener noreferrer">{map.credit||'Map source'} ↗</a>{map.assetSource&&<a href={map.assetSource} target="_blank" rel="noopener noreferrer">Reference map ↗</a>}</p>:<p className="track-map-credit">A verified trace has not been published for this configuration.{source&&<a href={source} target="_blank" rel="noopener noreferrer">Circuit source ↗</a>}</p>;}
