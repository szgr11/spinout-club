import React,{useRef,useState} from 'react';
// Only point geometry is saved. Reference uploads stay in the editor's memory.
export default function TraceEditor({path,onChange}){
 const [points,setPoints]=useState([]),[reference,setReference]=useState(''),[drawing,setDrawing]=useState(false),[error,setError]=useState('');const dragging=useRef(-1),svg=useRef(null),outline=useRef(null);
 const update=next=>{setPoints(next);onChange(next.length>2?`M${next.map(p=>p.join(',')).join('L')}Z`:'');};
 const location=e=>{const r=svg.current.getBoundingClientRect(),scale=Math.min(r.width,r.height),x0=r.left+(r.width-scale)/2,y0=r.top+(r.height-scale)/2;return [Math.round(Math.max(0,Math.min(1000,(e.clientX-x0)/scale*1000))),Math.round(Math.max(0,Math.min(1000,(e.clientY-y0)/scale*1000)))];};
 const upload=e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith('image/')||f.size>8*1024*1024){setError('Choose an image under 8 MB.');return;}const reader=new FileReader();reader.onload=()=>{setReference(reader.result);setError('');setDrawing(true);};reader.readAsDataURL(f);};
 return <div><div className="trace-tools"><label className="trace-upload">Load reference image<input aria-label="Load map reference image" type="file" accept="image/*" onChange={upload}/></label><button type="button" onClick={()=>{setDrawing(true);update([]);}}>Start new trace</button><button type="button" disabled={!path} onClick={()=>{const line=outline.current;if(!line)return;const n=line.getTotalLength();setDrawing(true);update(Array.from({length:100},(_,i)=>{const p=line.getPointAtLength(n*i/100);return [Math.round(p.x),Math.round(p.y)];}));}}>Edit current points</button><button type="button" disabled={!points.length} onClick={()=>update(points.slice(0,-1))}>Undo point</button><button type="button" onClick={()=>{setDrawing(false);setPoints([]);onChange('');setReference('');}}>Clear custom trace</button></div>
 <p className="track-editor-note">Load a credited map, then tap around the circuit to trace it. Drag a point to adjust it. The route closes automatically. The reference image is not published.</p>
 {error&&<p role="alert" className="track-editor-error">{error}</p>}
 <svg ref={svg} viewBox="0 0 1000 1000" className="trace-canvas" aria-label="Circuit outline tracing canvas" onPointerDown={e=>{if(!drawing)return;if(e.target.tagName==='circle')return;svg.current.setPointerCapture(e.pointerId);update([...points,location(e)]);}} onPointerMove={e=>{if(dragging.current<0)return;const next=[...points];next[dragging.current]=location(e);update(next);}} onPointerUp={()=>{dragging.current=-1;}} onPointerCancel={()=>{dragging.current=-1;}}>
 {reference&&<image href={reference} x="0" y="0" width="1000" height="1000" opacity=".6" preserveAspectRatio="xMidYMid meet"/>}
 {path&&<path ref={outline} d={path} stroke="#ffd400" fill="none" strokeWidth="12" strokeLinejoin="round"/>}
 {drawing&&points.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="15" fill="#ffd400" stroke="#111214" strokeWidth="4" onPointerDown={e=>{e.stopPropagation();dragging.current=i;svg.current.setPointerCapture(e.pointerId);}}/>)}
 </svg></div>;
}
