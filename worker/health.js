import {calendarSourceStatus} from '../src/calendar-source-status.js';
// Snapshot-only checks: no extra source requests and no effect on publication.
export function calendarHealth(calendar,now=Date.now()) {
 if(!calendar)return {status:'unavailable',issues:['Calendar snapshot unavailable'],sources:[]};
 const ageMinutes=Math.max(0,Math.round((now-Date.parse(calendar.updatedAt))/60000));
 const sources=(calendar.sources||[]).map(calendarSourceStatus).map(s=>({id:s.id,name:s.name,status:s.status,count:s.count,lastSuccess:s.lastSuccess,dropDetected:!!s.dropDetected}));
 const issues=[];
 if(!Number.isFinite(ageMinutes)||ageMinutes>150)issues.push('Calendar refresh is overdue');
 for(const s of sources){if(!['ok','manual'].includes(s.status))issues.push(`${s.name}: refresh delayed`);if(s.dropDetected)issues.push(`${s.name}: event count dropped unexpectedly`);}
 return {status:issues.length?'attention':'ok',updatedAt:calendar.updatedAt,ageMinutes:Number.isFinite(ageMinutes)?ageMinutes:null,eventDays:calendar.events.filter(e=>e.date>=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(now)).length,sources,issues};
}
export function sourceCountHealth(count,previous) {
 const baseline=previous?.expectedCount??previous?.count??count;
 const dropDetected=baseline>=5&&count<baseline*0.5;
 return {expectedCount:dropDetected?baseline:count,dropDetected};
}
const venueSources=new Set(['buttonwillow','willow-calendar','chuckwalla-calendar','thunderhill-east-calendar','thunderhill-west-calendar','laguna-calendar','sonoma-calendar','vegas-calendar','spring-calendar','nasa-socal-calendar','nasa-norcal-calendar']);
export function registrationStatus(event) {
 return event.scheduleOnly||event.trackCalendar||event.sources?.every(s=>venueSources.has(s.id))?'announced':'registration_link';
}
