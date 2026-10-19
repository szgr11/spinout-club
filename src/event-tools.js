// Calendar exports are all-day Pacific calendar dates, not inferred session times.
const escapeICS=value=>String(value??'').replace(/\\/g,'\\\\').replace(/[\r\n]+/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function nextDay(date) {const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
export function eventICS(event,now=new Date()) {
 const key=event.event_key||event.id;
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Spinout Club//Track days//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${escapeICS(key)}@spinoutclub.cc`,`DTSTAMP:${now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${event.date.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${nextDay(event.date).replace(/-/g,'')}`,`SUMMARY:${escapeICS(event.title)}`,`LOCATION:${escapeICS(event.track)}`,`DESCRIPTION:${escapeICS(`${event.organizer}\nConfirm registration, eligibility and session times with the organizer.\n${event.url}`)}`,'END:VEVENT','END:VCALENDAR'];
 // Fold on UTF-8 byte boundaries as required by RFC 5545.
 return lines.map(line=>{let out='',row='',bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>73){out+=row+'\r\n';row=' ';bytes=1;}row+=c;bytes+=n;}return out+row;}).join('\r\n')+'\r\n';
}
export function downloadCalendar(event) {const url=URL.createObjectURL(new Blob([eventICS(event)],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`spinout-${event.date}.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function googleCalendarURL(event) {const p=new URLSearchParams({action:'TEMPLATE',text:event.title,dates:event.date.replace(/-/g,'')+'/'+nextDay(event.date).replace(/-/g,''),details:`${event.organizer}\nConfirm registration and session times.\n${event.url}`,location:event.track});return 'https://calendar.google.com/calendar/render?'+p;}
export function garageSpecs(form) {
 const car=String(form.car||'').trim(),tire=String(form.tire||'').trim();
 const hp=form.hp===''||form.hp==null?null:Number(form.hp);
 if(!car||car.length>120)throw new Error('Enter a vehicle name (up to 120 characters).');
 if(tire.length>160)throw new Error('Keep the tire description under 160 characters.');
 if(hp!==null&&(!Number.isInteger(hp)||hp<0||hp>5000))throw new Error('Wheel horsepower must be a whole number from 0 to 5000, or blank.');
 return {car,hp,tire};
}
export const applyGarageSpecs=(form,car)=>({...form,car:car.car,hp:car.hp??'',tire:car.tire||''});
export function recordRegistrationClick(){
 if(typeof navigator!=='undefined'&&navigator.doNotTrack==='1')return;
 // An aggregate event only: no username, destination, cookie or visitor ID.
 try{fetch('/api/metrics',{method:'POST',body:'registration_click',credentials:'omit',keepalive:true}).catch(()=>{});}catch{/* Navigation always continues. */}
}
