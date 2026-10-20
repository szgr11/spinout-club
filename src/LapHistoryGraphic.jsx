import React from 'react';
import {lapSeconds,personalBestKey} from './laps.js';
// Compare only the same driver, car, layout and lap type. No mixed-car or mixed-layout trend.
export default function LapHistoryGraphic({laps,tracks}) {
 const groups=new Map();
 for(const lap of laps){if(!lap.date||!Number.isFinite(lapSeconds(lap.time)))continue;const key=personalBestKey(lap)+'|'+lap.type;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(lap);}
 const comparable=[...groups.values()].filter(g=>g.length>=2).map(g=>g.toSorted((a,b)=>a.date.localeCompare(b.date)||(a.submittedAt||0)-(b.submittedAt||0))).sort((a,b)=>b.at(-1).date.localeCompare(a.at(-1).date))[0];
 if(!comparable)return null;
 const rows=comparable.slice(-20),values=rows.map(l=>lapSeconds(l.time)),min=Math.min(...values),max=Math.max(...values),spread=Math.max(max-min,1);
 const points=rows.map((lap,i)=>({x:8+i*584/(rows.length-1),y:12+(lapSeconds(lap.time)-min)*76/spread}));
 const first=rows[0],last=rows.at(-1),track=tracks.find(t=>t.id===last.track);
 return <section className="lap-history-graphic" aria-label="Your comparable lap history"><h3>Your lap history</h3><p>{track?.name||last.track} · {track?.variant} · {last.car} · {last.type==='optimal'?'Optimal':'Recorded'} laps</p>
  <div className="lap-history-values"><span>First shown <strong>{first.time}</strong></span><span>Latest <strong>{last.time}</strong></span></div>
  <svg viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-label={`${rows.length} chronological lap times for ${last.car} at ${track?.name||last.track}. Higher points mean faster laps; first ${first.time}, latest ${last.time}.`}><polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')}/>{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3"/>)}</svg>
  <div className="lap-history-dates"><span>{first.date}</span><span>{last.date}</span></div>
 </section>;
}
