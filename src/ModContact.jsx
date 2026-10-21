import React,{lazy,Suspense,useEffect,useRef,useState} from 'react';
import {MessageSquare,X} from 'lucide-react';
import './mod-messages.css';
const MemberContact=lazy(()=>import('./ModMessages.jsx').then(m=>({default:m.MemberContact})));
export default function ModContact(){
 const [open,setOpen]=useState(false);const dialog=useRef(null);
 useEffect(()=>{if(open&&!dialog.current.open)dialog.current.showModal();if(!open&&dialog.current.open)dialog.current.close();},[open]);
 return <><button className="mod-float" type="button" aria-label="Message moderators" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><MessageSquare size={18}/><span>MESSAGE MODS</span></button>
  <dialog ref={dialog} className="mod-dialog" onClose={()=>setOpen(false)} onClick={e=>{if(e.target===dialog.current){const b=dialog.current.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)setOpen(false);}}} aria-labelledby="mod-contact-title">
   <div className="mod-dialog-header"><h2 id="mod-contact-title">Message mods</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Close messages"><X size={20}/></button></div>
   {open&&<Suspense fallback={<p role="status">Loading messages…</p>}><MemberContact/></Suspense>}
  </dialog></>;
}
