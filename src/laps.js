// The legacy spreadsheet was imported twice. Keep the first identical record for display;
// preserve the raw records and distinct days, layouts, conditions and lap types in storage.
export function deduplicateLaps(laps) {
 const seen=new Set();
 return laps.filter(lap=>{
  const key=JSON.stringify([lap.submittedBy??lap.submitted_by??'',...['track','driver','time','car','hp','tire','temp','date','organizer','type'].map(k=>lap[k]??'')]);
  if(seen.has(key))return false;seen.add(key);return true;
 });
}

// Normalize formatting only: distinct model/trim descriptions remain separate cars.
export const normalizeLapLabel=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export const personalBestKey=lap=>JSON.stringify([lap.track,normalizeLapLabel(lap.driver),normalizeLapLabel(lap.car)]);
export function lapSeconds(time) {
 const m=String(time??'').trim().match(/^(\d+):([0-5]\d)\.(\d{1,3})$/);
 return m?Number(m[1])*60+Number(m[2])+Number('0.'+m[3]):Infinity;
}
const achievementOrder=(a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999'))||String(a.id??a._key??'').localeCompare(String(b.id??b._key??''));
export function personalBests(laps,{track,type='all'}={}) {
 const bests=new Map();
 for(const lap of laps){
  if((track!==undefined&&lap.track!==track)||(type!=='all'&&lap.type!==type)||!Number.isFinite(lapSeconds(lap.time)))continue;
  const key=personalBestKey(lap),previous=bests.get(key);
  if(!previous||lapSeconds(lap.time)<lapSeconds(previous.time)||(lapSeconds(lap.time)===lapSeconds(previous.time)&&achievementOrder(lap,previous)<0))bests.set(key,lap);
 }
 return [...bests.values()].sort((a,b)=>lapSeconds(a.time)-lapSeconds(b.time)||personalBestKey(a).localeCompare(personalBestKey(b)));
}
export function memberLapHistory(laps,username,{track='all',car='all',type='all'}={}) {
 if(!username)return [];
 return laps.filter(lap=>(lap.submittedBy??lap.submitted_by)===username&&(track==='all'||lap.track===track)&&(car==='all'||normalizeLapLabel(lap.car)===car)&&(type==='all'||lap.type===type))
  .sort((a,b)=>String(b.date||String(b.submittedAt??b.submitted_at??'').slice(0,10)).localeCompare(String(a.date||String(a.submittedAt??a.submitted_at??'').slice(0,10)))||String(b.submittedAt??b.submitted_at??'').localeCompare(String(a.submittedAt??a.submitted_at??''))||String(a.id??a._key??'').localeCompare(String(b.id??b._key??'')));
}

// Fetch every approved page so old history and PBs do not disappear at the API row limit.
export async function readLapPages(client,table,columns='*',pageSize=500) {
 const rows=[];
 try {
  for(let offset=0;offset<100000;offset+=pageSize){
   const result=await client.from(table).select(columns).order('id').range(offset,offset+pageSize-1);
   if(result.error)return {data:null,error:result.error};
   if(!Array.isArray(result.data))return {data:null,error:new Error('Unexpected lap response')};
   rows.push(...result.data);
   if(result.data.length<pageSize)return {data:rows,error:null};
  }
  return {data:null,error:new Error('Lap history exceeds the page limit')};
 }catch(error){return {data:null,error};}
}
