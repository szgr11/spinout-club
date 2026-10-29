const manualSources=new Set(['motorsportreg-api','spring-calendar']);
export const isManualSource=source=>manualSources.has(source.id);
export function calendarSourceStatus(source){
 return isManualSource(source)?{...source,status:'manual',maintenance:'manual',dropDetected:false,error:null}:source;
}
export const sourceStatusLabel=source=>source.status==='manual'?'manually maintained':source.status==='ok'?'schedule checked':source.status==='pending_access'?'API access pending':'refresh delayed';
