import maps from './track-map-data.json' with {type:'json'};
export const TRACE_PRESETS=maps;
export function defaultMapKey(id=''){
 if(id.startsWith('btn_')){const n=id.match(/(?:cw|ccw)(\d+)(a?)/);return n?`btn${n[1]}${n[2]}`:id==='btn_circuit'?'btn_circuit':'';}
 if(id.startsWith('sow_'))return 'sow';
 if(id.startsWith('chuck_'))return 'chuck';
 if(id.startsWith('thunder_east_'))return id.endsWith('bypass')?'thunder_east_bypass':'thunder_east_cyclone';
 if(id.startsWith('thunder_west_'))return 'thunder_west';
 return {thunder:'thunder_combined',spring_mtn:'spring_ns',tsukuba:'tsukuba_2000',lvms:'lvms'}[id]||id;
}
export function getTrackMap(track){
 if(!track)return null;
 const key=track.map_key??defaultMapKey(track.id),map=maps[key];
 if(track.map_path){const source=safeSource(track.map_source);return source?{path:track.map_path,title:track.variant,source,credit:'Credited reference',scope:track.map_scope||'layout'}:null;}
 if(!map)return null;
 const fallbackScope=/unspecified/.test(track.variant)||['lvms','spring_mtn','tsukuba'].includes(track.id)?'venue':map.scope||'layout';
 return {...map,scope:track.map_scope||fallbackScope,source:safeSource(track.map_source)||map.source};
}
export function safeSource(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
