import React,{useEffect,useState} from 'react';
import {ArrowLeft,Send,RefreshCw} from 'lucide-react';
import {supabase} from './supabase.js';
import useMember from './useMember.js';
import {canModerate} from './permissions.js';
import './mod-messages.css';

function Threads({account,staff=false}){
 const [threads,setThreads]=useState([]),[selected,setSelected]=useState(null),[replies,setReplies]=useState([]);
 const [filter,setFilter]=useState('open'),[subject,setSubject]=useState(''),[body,setBody]=useState(''),[reply,setReply]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[composing,setComposing]=useState(!staff);
 const selectedId=selected?.id;
 useEffect(()=>setReply(''),[selectedId]);
 useEffect(()=>{
  let active=true;setLoading(true);setError('');
  (async()=>{try{
   let q=supabase.from('mod_threads').select('*').order('updated_at',{ascending:false}).order('id',{ascending:false}).limit(100);
   if(!staff)q=q.eq('username',account.username);
   if(staff&&filter!=='all')q=q.eq('status',filter);
   const r=await q;if(r.error)throw r.error;
   if(active){setThreads(r.data||[]);setSelected(current=>current?(r.data||[]).find(t=>t.id===current.id)||null:null);}
  }catch{if(active)setError('Could not load messages. Please try refreshing.');}finally{if(active)setLoading(false);}})();
  return()=>{active=false;};
 },[account.username,staff,filter,refresh]);
 useEffect(()=>{
  if(!selectedId){setReplies([]);return;}
  let active=true;setReplies([]);
  (async()=>{try{const r=await supabase.from('mod_replies').select('*').eq('thread_id',selectedId).order('created_at').order('id');if(r.error)throw r.error;if(active)setReplies(r.data||[]);}catch{if(active)setError('Could not load this conversation. Please refresh.');}})();
  return()=>{active=false;};
 },[selectedId,refresh]);
 useEffect(()=>{const reload=()=>setRefresh(n=>n+1);window.addEventListener('focus',reload);return()=>window.removeEventListener('focus',reload);},[]);
 const perform=async(action,success)=>{if(busy)return;setBusy(true);setError('');try{const r=await action();if(r.error)throw r.error;success?.(r.data);setRefresh(n=>n+1);window.dispatchEvent(new Event('spinout-mod-messages-updated'));}catch(e){setError(e.message||'Could not save your message. Please try again.');}finally{setBusy(false);}};
 const send=e=>{e.preventDefault();if(!subject.trim()||!body.trim())return;perform(()=>supabase.rpc('spinout_contact_mods',{p_subject:subject.trim(),p_body:body.trim(),p_page:window.location.pathname}),()=>{setSubject('');setBody('');setComposing(false);});};
 const respond=e=>{e.preventDefault();if(!reply.trim())return;perform(()=>supabase.rpc('spinout_reply_mod_thread',{p_thread:selectedId,p_body:reply.trim()}),()=>setReply(''));};
 return <div className="mod-messages">
  <div className="mod-toolbar">
   {selected?<button type="button" disabled={busy} onClick={()=>{setSelected(null);setError('');}}><ArrowLeft size={14}/> All messages</button>:staff?<label>Status <select aria-label="Message status filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All messages</option></select></label>:<button type="button" onClick={()=>{setComposing(v=>!v);setError('');}}>{composing?'My messages':'+ New message'}</button>}
   <button type="button" aria-label="Refresh messages" disabled={busy||loading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={14}/><span>Refresh</span></button>
  </div>
  {error&&<p className="mod-error" role="alert">{error}</p>}
  {selected?<div className="mod-thread">
   <div className="mod-thread-title"><div><h3>{selected.subject}</h3><span className="mod-muted">@{selected.username} · {new Date(selected.created_at).toLocaleString()}</span></div><span className="mod-status">{selected.status}</span></div>
   <p className="mod-body">{selected.body}</p><small className="mod-muted">From {selected.page||'/'}</small>
   <div aria-live="polite">{replies.map(m=><article className={`mod-reply ${m.staff?'mod-staff-reply':''}`} key={m.id}><strong>{m.staff?'MOD / ADMIN · ':''}@{m.author}</strong><time className="mod-muted">{new Date(m.created_at).toLocaleString()}</time><p className="mod-body">{m.body}</p></article>)}</div>
   <form onSubmit={respond}><label>Reply<textarea required maxLength={4000} rows={4} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write a reply…"/></label><div className="mod-toolbar"><button className="mod-primary" disabled={busy||!reply.trim()}><Send size={14}/>{busy?'Saving…':'Send reply'}</button>
    {staff&&<button type="button" disabled={busy} onClick={()=>perform(()=>supabase.rpc('spinout_set_mod_thread_status',{p_thread:selectedId,p_status:selected.status==='open'?'resolved':'open'}))}>{selected.status==='open'?'Mark resolved':'Reopen'}</button>}
   </div></form>
  </div>:composing&&!staff?<form onSubmit={send}>
   <p className="mod-muted">Only you and club moderators/admins can read this conversation. Replies appear here.</p>
   <label>Subject<input required maxLength={120} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="What can we help with?"/></label>
   <label>Message<textarea required maxLength={4000} rows={6} value={body} onChange={e=>setBody(e.target.value)} placeholder="Report a problem, suggest a layout, or ask the team…"/></label>
   <button className="mod-primary" disabled={busy||!subject.trim()||!body.trim()}><Send size={14}/>{busy?'Sending…':'Send to mods'}</button>
  </form>:<div className="mod-thread-list" aria-live="polite">
   {loading?<p role="status">Loading messages…</p>:!threads.length?<p className="mod-muted">{staff?'No messages in this view.':'No conversations yet. Choose “New message” to contact the team.'}</p>:threads.map(t=><button type="button" key={t.id} className="mod-thread-item" onClick={()=>{setSelected(t);setError('');}}><span><strong>{t.subject}</strong><small>@{t.username} · {new Date(t.updated_at).toLocaleDateString()}</small></span><span className="mod-status">{t.status}</span></button>)}
   {threads.length===100&&<p className="mod-muted">Showing the 100 most recently updated conversations.</p>}
  </div>}
 </div>;
}
export function ModInbox({account}){if(!canModerate(account))return null;return <section className="mod-inbox"><h2>Messages to mods</h2><p className="mod-muted">Read, reply, and resolve member conversations.</p><Threads key={account.username} account={account} staff/></section>;}
export function MemberContact(){
 const {account,loading,error}=useMember();
 return loading?<p role="status">Loading account…</p>:account?<Threads key={account.username} account={account}/>:<div className="mod-login"><p>{error||'Sign in with your club membership to send a private message and read replies.'}</p><a className="mod-primary" href="/members">Sign in →</a></div>;
}

export function useModOpenCount(account){
 const [count,setCount]=useState(0);const staff=canModerate(account);
 useEffect(()=>{if(!staff){setCount(0);return;}let active=true;
  const load=async()=>{try{const r=await supabase.from('mod_threads').select('id',{count:'exact',head:true}).eq('status','open');if(active&&!r.error)setCount(r.count||0);}catch{/* Optional badge must not interrupt club tools. */}};
  load();const timer=setInterval(load,60000);window.addEventListener('focus',load);window.addEventListener('spinout-mod-messages-updated',load);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('spinout-mod-messages-updated',load);};
 },[staff,account?.username]);return count;
}
