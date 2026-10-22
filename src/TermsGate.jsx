import React,{useEffect,useRef,useState} from 'react';
import {TERMS,TERMS_HASH,TERMS_WAIT_SECONDS} from './terms.js';
import Header from './ClubHeader.jsx';
import {supabase} from './supabase.js';
import './terms.css';

export function TermsDocument(){
 return <article className="terms-document"><p className="terms-meta">Version {TERMS.version} · Effective {TERMS.effectiveDate}</p>{TERMS.sections.map(section=><section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((p,i)=><p key={i}>{p}</p>)}</section>)}<p><a href="/contact">Report or contact the operator</a></p><p className="terms-end">End of Terms of Use</p></article>;
}

// Review and bottom times are issued by the server. A local clock cannot shorten
// the wait, and a stale document or another account's review cannot be accepted.
export function TermsGate({onAccepted,onDecline,api=supabase}){
 const dialog=useRef(null),scroller=useRef(null),review=useRef(null),bottomPending=useRef(false),epoch=useRef(0);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [ready,setReady]=useState(false),[bottom,setBottom]=useState(false),[remaining,setRemaining]=useState(TERMS_WAIT_SECONDS),[agreed,setAgreed]=useState(false);
 const [deadline,setDeadline]=useState(null);
 useEffect(()=>{if(open&&!dialog.current.open)dialog.current.showModal();if(!open&&dialog.current.open)dialog.current.close();},[open]);
 useEffect(()=>()=>{epoch.current++;},[]);
 useEffect(()=>{
  if(!open||!deadline)return;
  const tick=()=>setRemaining(Math.max(0,Math.ceil((deadline-performance.now())/1000)));
  tick();const timer=setInterval(tick,150);return()=>clearInterval(timer);
 },[open,deadline]);
 const close=()=>{if(busy)return;epoch.current++;review.current=null;setOpen(false);setReady(false);setDeadline(null);setAgreed(false);setBottom(false);setRemaining(TERMS_WAIT_SECONDS);};
 const reachedBottom=async()=>{
  const el=scroller.current,id=review.current,turn=epoch.current;
  if(!el||!id||bottomPending.current||bottom||el.scrollHeight-el.scrollTop-el.clientHeight>4)return;
  bottomPending.current=true;
  try{const r=await api.rpc('spinout_terms_bottom',{p_review_id:id});if(r.error)throw r.error;if(turn!==epoch.current)return;setError('');setBottom(true);setDeadline(performance.now()+TERMS_WAIT_SECONDS*1000);}
  catch{if(turn===epoch.current)setError('Could not start the reading timer. Scroll slightly up and back down to retry.');}
  finally{if(turn===epoch.current)bottomPending.current=false;}
 };
 useEffect(()=>{if(open&&ready)reachedBottom();},[open,ready]);
 const begin=async()=>{
  const turn=++epoch.current;review.current=null;bottomPending.current=false;setError('');setReady(false);setBottom(false);setRemaining(TERMS_WAIT_SECONDS);setAgreed(false);setDeadline(null);setOpen(true);
  try{const r=await api.rpc('spinout_begin_terms_review',{p_version:TERMS.version,p_hash:TERMS_HASH});if(r.error)throw r.error;if(turn!==epoch.current)return;review.current=r.data;setReady(true);if(scroller.current)scroller.current.scrollTop=0;}
  catch{if(turn===epoch.current)setError('Could not open the current Terms for acceptance. Close this tray and try again, or refresh the page.');}
 };
 const accept=async e=>{
  e.preventDefault();if(busy||!ready||!bottom||remaining>0||!agreed)return;setBusy(true);setError('');
  try{const r=await api.rpc('spinout_accept_terms',{p_version:TERMS.version,p_hash:TERMS_HASH,p_review_id:review.current,p_agreed:true});if(r.error)throw r.error;await onAccepted();}
  catch{setError('Acceptance could not be saved. Reopen the Terms and try again. If the Terms changed, refresh this page.');}
  finally{setBusy(false);}
 };
 const unlocked=ready&&bottom&&remaining===0;
 return <div className="club-page terms-page"><Header/><main className="terms-intro"><p className="terms-meta">MEMBER ACCESS</p><h1>Review the Terms of Use</h1><p>Before continuing to your account or membership application, open the Terms and review how the community works.</p><p>Scroll to the bottom of the tray, wait 12 seconds, then check the agreement box and accept.</p><button className="terms-primary" onClick={begin}>Open Terms of Use</button><button className="terms-secondary" onClick={onDecline}>Decline and sign out</button><p className="terms-small"><a href="/terms">Read or print the Terms</a> · <a href="/contact">Report or contact</a></p></main>
  <dialog ref={dialog} className="terms-tray" aria-labelledby="terms-title" aria-describedby="terms-instructions" onCancel={e=>{e.preventDefault();close();}} onClose={()=>{if(open)close();}}>
   <header className="terms-tray-header"><div><p className="terms-meta">SPINOUT CLUB</p><h1 id="terms-title">Terms of Use</h1></div><button className="terms-close" aria-label="Close Terms" disabled={busy} onClick={close}>×</button></header>
   <p id="terms-instructions" className="terms-instructions">Read the Terms below. Scroll to the end, then wait 12 seconds to unlock acceptance.</p>
   <div className="terms-scroll" ref={scroller} tabIndex={0} role="region" aria-label="Scrollable Terms of Use" onScroll={reachedBottom}><TermsDocument/></div>
   <form className="terms-tray-footer" onSubmit={accept}>
    <p className="terms-progress" role="status" aria-live="polite">{!ready?'Preparing review…':!bottom?'Scroll to the bottom to continue.':remaining>0?`You reached the end. Acceptance unlocks in ${remaining}s.`:'Review complete. You can now choose whether to accept.'}</p>
    <label className={`terms-agreement ${unlocked?'':'terms-locked'}`}><input type="checkbox" checked={agreed} disabled={!unlocked||busy} onChange={e=>setAgreed(e.target.checked)}/><span>I am at least 18 years old. I have read and agree to the Spinout Club Terms of Use, version {TERMS.version}.</span></label>
    {error&&<p className="terms-error" role="alert">{error}</p>}
    <div className="terms-actions"><button className="terms-secondary" type="button" disabled={busy} onClick={close}>Back</button><button className="terms-primary" disabled={busy||!unlocked||!agreed}>{busy?'Saving…':'Accept and continue'}</button></div>
   </form>
  </dialog>
 </div>;
}

export default function TermsBoundary({children}){
 const [user,setUser]=useState(undefined),[state,setState]=useState('loading'),[retry,setRetry]=useState(0);
 const [checkedId,setCheckedId]=useState(null);
 useEffect(()=>{
  if(!supabase){setUser(null);return;}
  let active=true,changed=false;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{changed=true;if(active)setUser(session?.user||null);});
  supabase.auth.getSession().then(r=>{if(active&&!changed){if(r.error)setState('error');else setUser(r.data.session?.user||null);}}).catch(()=>{if(active)setState('error');});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 const check=async()=>{
  const r=await supabase.rpc('spinout_terms_status');if(r.error)throw r.error;
  if(r.data?.version!==TERMS.version||r.data?.content_hash!==TERMS_HASH){setState('outdated');return false;}
  setCheckedId(user.id);setState(r.data.accepted?'accepted':'required');return r.data.accepted;
 };
 useEffect(()=>{
  if(user===undefined)return;if(!user){setState('public');return;}
  let active=true;setState('loading');
  const load=async()=>{try{const r=await supabase.rpc('spinout_terms_status');if(!active)return;if(r.error)throw r.error;setCheckedId(user.id);if(r.data?.version!==TERMS.version||r.data?.content_hash!==TERMS_HASH)setState('outdated');else setState(r.data.accepted?'accepted':'required');}catch{if(active)setState('error');}};
  load();const focus=()=>{if(document.visibilityState==='visible')load();};window.addEventListener('focus',focus);
  return()=>{active=false;window.removeEventListener('focus',focus);};
 },[user?.id,user===undefined,retry]);
 const decline=async()=>{const r=await supabase.auth.signOut();if(r.error){setState('error');return;}window.location.assign('/events');};
 if((state==='public'&&!user)||(state==='accepted'&&checkedId===user?.id))return children;
 if(state==='required'&&checkedId===user?.id)return <TermsGate key={user.id} onAccepted={async()=>{if(!await check())throw new Error('Acceptance not confirmed');}} onDecline={decline}/>;
 return <div className="club-page terms-page"><Header/><main className="terms-intro"><h1>{state==='loading'?'Checking account…':state==='outdated'?'The Terms have been updated':'Could not check your agreement'}</h1><p>{state==='loading'?'Please wait.':state==='outdated'?'Refresh to load the current document before continuing.':'Your member tools will stay locked until we can verify your acceptance.'}</p>{state!=='loading'&&<><button className="terms-primary" onClick={()=>state==='outdated'?window.location.reload():setRetry(n=>n+1)}>{state==='outdated'?'Refresh page':'Try again'}</button><button className="terms-secondary" onClick={decline}>Sign out</button><p><a href="/contact">Report or contact</a></p></>}</main></div>;
}
