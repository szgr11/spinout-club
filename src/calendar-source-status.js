const onDemandSources=new Set(['motorsportreg-api','spring-calendar']);
export const isManualSource=source=>onDemandSources.has(source.id);
export function calendarSourceStatus(source){
 if(!isManualSource(source))return source;
 const lastFetchStatus=source.status==='on_demand'?source.lastFetchStatus:source.lastManualAttemptAt?source.status:'not_requested';
 return {...source,status:'on_demand',fetchMode:'on_demand',lastFetchStatus,dropDetected:lastFetchStatus==='ok'&&!!source.dropDetected};
}
export const sourceStatusLabel=source=>source.status==='on_demand'?`manual trigger${source.lastFetchStatus==='pending_access'?' · API setup required':source.lastFetchStatus==='stale'?' · last fetch failed':''}`:source.status==='ok'?'schedule checked':source.status==='pending_access'?'API access pending':'refresh delayed';
