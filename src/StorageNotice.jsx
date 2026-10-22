import React,{useEffect,useRef,useState} from 'react';
import './storage-notice.css';

const NOTICE_KEY='spinout_storage_notice_v1';
const SHOW_EVENT='spinout-show-storage-notice';
export const showStorageNotice=()=>window.dispatchEvent(new Event(SHOW_EVENT));

export default function StorageNotice(){
 const [visible,setVisible]=useState(()=>{try{return localStorage.getItem(NOTICE_KEY)!=='dismissed';}catch{return true;}});
 const panel=useRef(null),dismissButton=useRef(null),requested=useRef(false);
 useEffect(()=>{const show=()=>{requested.current=true;setVisible(true);};window.addEventListener(SHOW_EVENT,show);return()=>window.removeEventListener(SHOW_EVENT,show);},[]);
 useEffect(()=>{
  if(!visible)return;
  const root=document.documentElement;
  const measure=()=>root.style.setProperty('--storage-notice-height',`${panel.current?.getBoundingClientRect().height||0}px`);
  root.classList.add('storage-notice-open');measure();
  const observer=new ResizeObserver(measure);if(panel.current)observer.observe(panel.current);
  if(requested.current){dismissButton.current?.focus();requested.current=false;}
  return()=>{observer.disconnect();root.classList.remove('storage-notice-open');root.style.removeProperty('--storage-notice-height');};
 },[visible]);
 const dismiss=()=>{try{localStorage.setItem(NOTICE_KEY,'dismissed');}catch{/* Dismiss for this page even when storage is blocked. */}setVisible(false);};
 if(!visible)return null;
 return <aside className="storage-notice" ref={panel} aria-labelledby="storage-notice-title">
  <div className="storage-notice-copy"><h2 id="storage-notice-title">Cookies &amp; storage</h2><p>We use browser storage to keep you signed in. Cloudflare may use essential security cookies to protect the site. We don’t use advertising or analytics cookies.</p></div>
  <div className="storage-notice-actions"><a href="/storage">Details</a><button type="button" ref={dismissButton} onClick={dismiss}>Got it</button></div>
 </aside>;
}
