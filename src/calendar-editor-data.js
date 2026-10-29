export function applyCalendarChanges(events,changes,{includeHidden=false,today=''}={}){
 const rows=new Map(events.map(event=>[event.id,{...event,editorState:'visible'}]));
 for(const change of changes){
  if(change.state!=='visible'&&!includeHidden){rows.delete(change.id);continue;}
  if(change.document){
   const source=rows.get(change.id),changedBooking=source&&(source.date!==change.document.date||source.url!==change.document.url);
   rows.set(change.id,{...source,...change.document,...(changedBooking?{prices:[],promotions:[],offerCheckedAt:null}:{}),id:change.id,editorState:change.state});
  }
 }
 return [...rows.values()].filter(e=>!today||e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)||a.track.localeCompare(b.track)||a.id.localeCompare(b.id));
}
export function calendarEntryDocument(input){
 const event={...input};delete event.editorState;delete event._revision;
 for(const field of ['title','track','organizer','url','note'])event[field]=String(event[field]||'').trim();
 const date=String(event.date||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Choose a valid date.');
 if(!event.title||event.title.length>180||!event.track||event.track.length>120||!event.organizer||event.organizer.length>120)throw new Error('Enter a title, track and organizer within the field limits.');
 const url=new URL(event.url);if(url.protocol!=='https:'||event.url.length>2000)throw new Error('Use an HTTPS event link.');
 if(!['SoCal','NorCal','Nevada'].includes(event.region))throw new Error('Choose a region.');
 if(!['Track day','Track day / time trial','Open practice','Autocross','Track event'].includes(event.kind))throw new Error('Choose an event type.');
 if(event.note.length>2000)throw new Error('Keep notes under 2,000 characters.');
 if(!event.sources?.length)event.sources=[{id:'staff-calendar',name:'Staff calendar entry',url:event.url}];
 return event;
}
