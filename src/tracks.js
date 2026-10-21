// IDs identify exact configurations. Never rewrite old lap.track values.
// Primary references: https://buttonwillowraceway.com/track-info/track-maps/
// https://www.thunderhill.com/track-info/track-maps
// https://www.ongridtrack.com/thunderhill-raceway (operator's direction / bypass guides)
const track=(id,name,variant,region)=>({id,name,variant,region});
export const BUILTIN_TRACKS = [
 track('sow_cw','Streets of Willow','CW','SoCal'),
 track('sow_ccw','Streets of Willow','CCW','SoCal'),
 track('big_willow','Big Willow','CW','SoCal'),
 track('btn_cw13','Buttonwillow','Classic #13 · CW','SoCal'),
 track('btn_ccw13','Buttonwillow','Classic #13 · CCW','SoCal'),
 track('btn_circuit','Buttonwillow','The Circuit','SoCal'),
 track('btn_cw1','Buttonwillow','Classic #1 · CW','SoCal'),
 track('btn_ccw1','Buttonwillow','Classic #1 · CCW','SoCal'),
 ...[2,3,14,15,16,17,18,23,24,25,26,27,28,29].flatMap(n=>['cw','ccw'].map(dir=>track(`btn_${dir}${n}`,'Buttonwillow',`Classic #${n} · ${dir.toUpperCase()}`,'SoCal'))),
 ...[13,25].flatMap(n=>['cw','ccw'].map(dir=>track(`btn_${dir}${n}a`,'Buttonwillow',`Classic #${n}A · ${dir.toUpperCase()}`,'SoCal'))),
 track('chuck_cw','Chuckwalla','CW','SoCal'),
 track('chuck_ccw','Chuckwalla','CCW','SoCal'),
 track('laguna','Laguna Seca','Full course','NorCal'),
 // Existing unspecified configurations remain explicit instead of guessing their route.
 track('sonoma','Sonoma Raceway','Layout unspecified','NorCal'),
 track('thunder','Thunderhill','5 mile · combined','NorCal'),
 track('thunder_east_cyclone','Thunderhill','East 3 mile · Cyclone · CCW','NorCal'),
 track('thunder_east_bypass','Thunderhill','East 3 mile · Bypass · CCW','NorCal'),
 track('thunder_west_ccw','Thunderhill','West 2 mile · CCW','NorCal'),
 track('thunder_west_cw','Thunderhill','West 2 mile · CW','NorCal'),
 track('spring_mtn','Spring Mountain','Layout unspecified','NV'),
 track('lvms','Las Vegas Motor Speedway','CW','NV'),
 track('tsukuba','Tsukuba','Layout unspecified','JP'),
];
export const circuitKey=t=>`${t.region}\u0000${t.name.trim().toLowerCase()}`;
export function groupTracks(tracks){
 const groups=new Map();
 for(const t of tracks){const key=circuitKey(t);if(!groups.has(key))groups.set(key,{key,name:t.name,region:t.region,layouts:[]});groups.get(key).layouts.push(t);}
 return [...groups.values()];
}
export function mergeTracks(custom=[]){
 const ids=new Set();return [...BUILTIN_TRACKS,...custom].filter(t=>{if(ids.has(t.id))return false;ids.add(t.id);return true;});
}
export const layoutLabel=t=>!t?.variant||t.variant==='—'?'Layout unspecified':t.variant;
