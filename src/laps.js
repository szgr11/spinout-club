// The legacy spreadsheet was imported twice. Keep the first identical record for display;
// preserve the raw records and distinct days, layouts, conditions and lap types in storage.
export function deduplicateLaps(laps) {
 const seen=new Set();
 return laps.filter(lap=>{
  const key=JSON.stringify(['track','driver','time','car','hp','tire','temp','date','organizer','type'].map(k=>lap[k]??''));
  if(seen.has(key))return false;seen.add(key);return true;
 });
}
