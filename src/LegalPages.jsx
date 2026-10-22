import React,{useState} from 'react';
import Header from './ClubHeader.jsx';
import {TermsDocument} from './TermsGate.jsx';
import {BotCheck,authAction} from './SecureAuth.jsx';
import './terms.css';

export function LegalFooter(){return <footer className="terms-footer"><a href="/terms">Terms of Use</a><a href="/contact">Report or contact</a></footer>;}
export default function LegalPages({contact=false}){
 return <div className="club-page terms-page"><Header/><main className="terms-public"><h1>{contact?'Report or contact':'Terms of Use'}</h1>{contact?<PublicReport/>:<><p className="terms-small">A personal, volunteer-run community for motorsport enthusiasts.</p><TermsDocument/></>}</main><LegalFooter/></div>;
}
function PublicReport(){
 const [category,setCategory]=useState('community'),[email,setEmail]=useState(''),[subject,setSubject]=useState(''),[body,setBody]=useState(''),[page,setPage]=useState('');
 const [captcha,setCaptcha]=useState(''),[reset,setReset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const submit=async e=>{e.preventDefault();if(busy||!captcha)return;setBusy(true);setError('');try{await authAction('legal_report',{category,email,subject,body,page,captcha});setSent(true);setBody('');}catch(e){setError(e.message);}finally{setBusy(false);setCaptcha('');setReset(n=>n+1);}};
 return <><p>You can contact the site operator about content, copyright, privacy, an account, or a moderation decision. No membership or agreement to the Terms is required to send a report.</p><p className="terms-small">Reports are private to the operator and authorized moderators. Necessary details may be shared with an affected submitter to review a complaint. Statutory copyright notices and counter-notices may need to be forwarded with your contact details. Please avoid unnecessary sensitive information. This is not an emergency service.</p>
 {sent?<div role="status"><h2>Report received</h2><p>The team can review it in the private moderation inbox. If follow-up is needed, use the contact address you supplied. No response deadline is guaranteed.</p><button className="terms-secondary" onClick={()=>setSent(false)}>Send another report</button></div>:<form className="terms-report" onSubmit={submit}>
  <label>Topic<select value={category} onChange={e=>setCategory(e.target.value)}><option value="community">Community or content</option><option value="copyright">Copyright notice</option><option value="counter_notice">Copyright counter-notice</option><option value="privacy">Privacy or removal request</option><option value="appeal">Moderation appeal</option><option value="other">Other question</option></select></label>
  <label>Your contact email<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label>Subject<input required maxLength={120} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
  <label>Relevant page or record<input type="url" maxLength={500} placeholder="https://spinoutclub.cc/…" value={page} onChange={e=>setPage(e.target.value)}/></label>
  {['copyright','counter_notice'].includes(category)&&<p className="terms-small">Include the required statements, contact details, and signature described in <a href="/terms" target="_blank" rel="noopener noreferrer">section 8 of the Terms (opens a new tab)</a>. This form does not represent that a DMCA agent has been registered.</p>}
  <label>Message<textarea required minLength={10} maxLength={4000} rows={9} value={body} onChange={e=>setBody(e.target.value)} placeholder="Describe the issue and the result you are requesting. Include enough information to locate the content."/></label>
  <BotCheck action="legal_report" onToken={setCaptcha} reset={reset}/>
  {error&&<p role="alert" className="terms-error">{error}</p>}
  <button className="terms-primary" disabled={busy||!captcha}>{busy?'Sending…':'Send privately'}</button>
 </form>}</>;
}

export function RightsInbox(){
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const load=async()=>{setBusy(true);setError('');try{const {supabase}=await import('./supabase.js');const r=await supabase.from('legal_reports').select('*').order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;setRows(r.data||[]);setLoaded(true);}catch{setError('Could not load public reports.');}finally{setBusy(false);}};
 const toggle=async row=>{setBusy(true);try{const {supabase}=await import('./supabase.js');const r=await supabase.from('legal_reports').update({status:row.status==='open'?'resolved':'open'}).eq('id',row.id).select('id');if(r.error||!r.data?.length)throw new Error();await load();}catch{setError('Could not update this report.');}finally{setBusy(false);}};
 return <section className="terms-report"><h2>Public reports and rights requests</h2><p className="mod-muted">Private submissions from the public contact form. Contact details are for handling the request; they are not a mailing list. Review copyright counter-notices promptly for applicable deadlines.</p><button type="button" disabled={busy} onClick={load}>{busy?'Loading…':loaded?'Refresh public reports':'Open public reports'}</button>{error&&<p role="alert" className="terms-error">{error}</p>}{loaded&&!rows.length&&<p>No reports yet.</p>}{rows.map(row=><article className="mod-reply" key={row.id}><h3>{row.subject}</h3><p className="mod-muted">{row.category} · {row.status} · {new Date(row.created_at).toLocaleString()}</p><p>Contact: {row.email}</p>{row.page&&<p className="mod-body">Page: {row.page}</p>}<p className="mod-body">{row.body}</p><button type="button" disabled={busy} onClick={()=>toggle(row)}>{row.status==='open'?'Mark resolved':'Reopen'}</button></article>)}</section>;
}
