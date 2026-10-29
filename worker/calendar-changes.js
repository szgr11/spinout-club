export async function readCalendarChanges(env){
 if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)throw new Error('Calendar configuration unavailable');
 const response=await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/spinout_calendar_changes`,{
  method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:'{}',redirect:'manual',signal:AbortSignal.timeout(12000),
 });
 if(!response.ok)throw new Error('Calendar edits unavailable');
 const changes=await response.json();
 if(!Array.isArray(changes)||changes.some(c=>typeof c.id!=='string'||!['visible','hidden','removed'].includes(c.state)))throw new Error('Calendar edits unavailable');
 return changes;
}
