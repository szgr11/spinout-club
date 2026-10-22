import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {TERMS} from './terms.js';
import TermsDocument from './TermsDocument.jsx';
import {PUBLIC_TERMS_KEY,readPublicAcceptance,savePublicAcceptance} from './public-terms.js';

function browserStorage(){try{return window.localStorage;}catch{return null;}}

// This browser-local receipt is deliberately separate from authenticated,
// server-verified member acceptance. No account or visitor tracking ID is made.
export default function PublicTermsBoundary({children}){
 const [accepted,setAccepted]=useState(()=>Boolean(readPublicAcceptance(browserStorage())));
 useEffect(()=>{
  const sync=e=>{if(e.key===PUBLIC_TERMS_KEY||e.key===null)setAccepted(Boolean(readPublicAcceptance(browserStorage())));};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[]);
 return <>{children}{!accepted&&<PublicAgreement onAccepted={()=>{savePublicAcceptance(browserStorage());setAccepted(true);}}/>}</>;
}

function PublicAgreement({onAccepted}){
 const notice=useRef(null),reader=useRef(null),readButton=useRef(null),readerScroll=useRef(null);
 const [reading,setReading]=useState(false),[agreed,setAgreed]=useState(false);
 useLayoutEffect(()=>{
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=previous;};
 },[]);
 useLayoutEffect(()=>{
  if(reading){
   if(notice.current.open)notice.current.close();
   if(!reader.current.open)reader.current.showModal();
   if(readerScroll.current)readerScroll.current.scrollTop=0;
  }else{
   if(reader.current.open)reader.current.close();
   if(!notice.current.open)notice.current.showModal();
  }
 },[reading]);
 const back=()=>{setReading(false);requestAnimationFrame(()=>readButton.current?.focus());};
 const leave=e=>{e?.preventDefault();window.location.assign('/terms');};
 return <>
  <dialog ref={notice} className="public-terms-notice" aria-labelledby="public-terms-title" aria-describedby="public-terms-description" onCancel={leave}>
   <p className="terms-meta">SPINOUT CLUB · VERSION {TERMS.version}</p>
   <h1 id="public-terms-title">Before you browse</h1>
   <p id="public-terms-description">The calendar and Spinner boards are covered by our <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use (opens a new tab)</a>, including event accuracy, content rights, limits of liability, and dispute rules. No account is needed.</p>
   <button ref={readButton} type="button" className="public-terms-read" onClick={()=>setReading(true)}>Read the full Terms</button>
   <form onSubmit={e=>{e.preventDefault();if(agreed)onAccepted();}}>
    <label className="terms-agreement"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} required/><span>I agree and have read the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>.</span></label>
    <p className="terms-small">Stored in this browser for this version when browser storage is available. Member access has a separate review.</p>
    <div className="terms-actions"><a className="terms-secondary" href="/terms">Decline</a><button className="terms-primary" disabled={!agreed}>Agree and continue</button></div>
   </form>
   <p className="terms-small public-terms-legal-links"><a href="/contact">Report or contact</a> · <a href="/storage">Cookies &amp; storage</a></p>
  </dialog>
  <dialog ref={reader} className="terms-tray" aria-labelledby="public-reader-title" onCancel={e=>{e.preventDefault();back();}}>
   <header className="terms-tray-header"><div><p className="terms-meta">SPINOUT CLUB</p><h1 id="public-reader-title">Terms of Use</h1></div><button type="button" className="terms-close" aria-label="Back to agreement" onClick={back}>×</button></header>
   <div className="terms-scroll" ref={readerScroll} tabIndex={0} role="region" aria-label="Full Terms of Use"><TermsDocument/></div>
   <footer className="terms-tray-footer"><div className="terms-actions"><a className="terms-secondary" href="/terms" target="_blank" rel="noopener noreferrer">Read or print in a new tab</a><button type="button" className="terms-primary" onClick={back}>Back to agreement</button></div></footer>
  </dialog>
 </>;
}
