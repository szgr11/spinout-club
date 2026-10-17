import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './supabase.js';
const SITEKEY='0x4AAAAAAFZC5gsfKkYlIdpi';
let scriptPromise;
function loadTurnstile(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=()=>resolve(window.turnstile);s.onerror=()=>{scriptPromise=null;reject(new Error('Could not load bot verification'));};document.head.appendChild(s);});
 return scriptPromise;
}
export function BotCheck({action,onToken,reset=0}){
 const ref=useRef(null),callback=useRef(onToken);callback.current=onToken;
 const [error,setError]=useState('');
 useEffect(()=>{let cancelled=false,id;callback.current('');loadTurnstile().then(t=>{if(cancelled)return;id=t.render(ref.current,{sitekey:SITEKEY,action,theme:'dark',callback:token=>callback.current(token),'expired-callback':()=>callback.current(''),'error-callback':()=>{callback.current('');setError('Bot verification failed. Refresh this page to try again.');}});}).catch(e=>setError(e.message));return()=>{cancelled=true;if(id!==undefined)window.turnstile?.remove(id);};},[action,reset]);
 return <div style={{margin:'16px 0'}}><div ref={ref}/>{error&&<p role="alert" style={{color:'#ff9494',fontSize:12}}>{error}</p>}</div>;
}
export async function authAction(action,body){
 const {data:{session}}=await supabase.auth.getSession();
 const headers={'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY};
 if(session)headers.Authorization='Bearer '+session.access_token;
 const response=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/club-auth',{method:'POST',headers,body:JSON.stringify({action,...body})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to complete request');return data;
}
const box={maxWidth:480,width:'100%',margin:'40px auto',padding:28,border:'1px solid #303229',background:'#141414',color:'#eee'};
const input={display:'block',width:'100%',padding:12,margin:'7px 0 18px',border:'1px solid #444',background:'#0a0a0a',color:'#eee',fontSize:14};
const button={padding:13,background:'#ffd400',border:0,width:'100%',color:'#111',fontWeight:700,marginTop:10};
const muted={color:'#aaa',fontSize:12,lineHeight:1.7};
export function GoogleButton({link=false,onError,disabled=false}){
 const [available,setAvailable]=useState(null);
 useEffect(()=>{let alive=true;fetch(import.meta.env.VITE_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY}}).then(r=>r.json()).then(d=>{if(alive)setAvailable(d.external?.google===true);}).catch(()=>{if(alive)setAvailable(false);});return()=>{alive=false;};},[]);
 const start=async()=>{const options={redirectTo:window.location.origin+'/members'};const {error}=link?await supabase.auth.linkIdentity({provider:'google',options}):await supabase.auth.signInWithOAuth({provider:'google',options});if(error)onError?.(error.message);};
 return <><button style={{...button,background:'#eee'}} disabled={disabled||available!==true} onClick={start}>{link?'Link Google to this membership':'Continue with Google'}</button>{available===false&&<p style={muted}>Google sign-in is being set up. You can use the sign-in options below.</p>}</>;
}
export function SecureAuth({authUser,application,onLogin,onApplied,onLogout}){
 const [mode,setMode]=useState('member'),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[email,setEmail]=useState(''),[nickname,setNickname]=useState(''),[reason,setReason]=useState(''),[website,setWebsite]=useState(''),[captcha,setCaptcha]=useState(''),[reset,setReset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const submit=async e=>{e.preventDefault();setError('');setNotice('');setBusy(true);try{
  if(authUser){await authAction('application',{username,nickname,reason,captcha,website});await onApplied();setNotice('Application received. An admin will review your membership.');}
  else if(mode==='member'){const tokens=await authAction('login',{username,password,captcha,website});const r=await supabase.auth.setSession(tokens);if(r.error)throw r.error;setPassword('');onLogin?.();}
  else{const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+'/members'}});if(error)throw error;setNotice('Check your email for a sign-in link. After verification, you can apply for membership.');}
 }catch(e){setError(e.message);}finally{setBusy(false);setCaptcha('');setReset(n=>n+1);}};
 return <div style={{minHeight:'100vh',background:'#0a0a0a',padding:24,fontFamily:'Inter,system-ui,sans-serif'}}><div style={box}>
  <a href="/events" style={{color:'#ffd400',fontSize:12}}>← Public events calendar</a><h1 style={{color:'#ffd400',fontSize:24,marginTop:30}}>◆ SPINOUT // CLUB</h1>
  {authUser?<><h2>{application?'Application pending':'Join the grid'}</h2><p style={muted}>Signed in as {authUser.email?.endsWith('@members.spinoutclub.cc')?'a club member':authUser.email}.</p>{application?<p style={muted}>Your application for @{application.username} is waiting for admin review. Events remain open to everyone.</p>:<><p style={muted}>Membership is reviewed by a club admin. Already a member? Sign out, use your existing username and password, then link Google from your profile. This keeps your lap history.</p><form onSubmit={submit}><label>Username<input required pattern="[a-z0-9_]{3,24}" maxLength={24} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} style={input}/></label><label>Display name<input required maxLength={60} value={nickname} onChange={e=>setNickname(e.target.value)} style={input}/></label><label>Tell us about your track experience<textarea required minLength={10} maxLength={1000} rows={4} value={reason} onChange={e=>setReason(e.target.value)} style={input}/></label><input aria-hidden="true" tabIndex={-1} autoComplete="off" name="website" value={website} onChange={e=>setWebsite(e.target.value)} style={{position:'absolute',left:-9999}}/><BotCheck action="application" onToken={setCaptcha} reset={reset}/><button style={button} disabled={busy||!captcha}>{busy?'Submitting…':'Apply for membership'}</button></form></>}<button style={{...button,background:'#333',color:'#eee'}} onClick={onLogout}>Sign out</button></>:<>
   <GoogleButton onError={setError} disabled={busy}/><div style={{display:'flex',gap:8,margin:'25px 0 16px'}}><button style={{...button,background:mode==='member'?'#ffd400':'#555'}} onClick={()=>{setMode('member');setError('');}}>Existing member</button><button style={{...button,background:mode==='email'?'#ffd400':'#555'}} onClick={()=>{setMode('email');setError('');}}>Email sign-in / Apply</button></div>
   <form onSubmit={submit}>{mode==='member'?<><label>Username<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} style={input}/></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={input}/></label><BotCheck action="login" onToken={setCaptcha} reset={reset}/></>:<><p style={muted}>Use an email link to sign in without a password. New drivers can apply after verifying their email.</p><label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={input}/></label></>}<button style={button} disabled={busy||(mode==='member'&&!captcha)}>{busy?'Please wait…':mode==='member'?'Sign in':'Send sign-in link'}</button></form>
  </>}
  {error&&<p role="alert" style={{color:'#ff9494',fontSize:13,lineHeight:1.7}}>{error}</p>}{notice&&<p role="status" style={{color:'#a4dda4',fontSize:13,lineHeight:1.7}}>{notice}</p>}
 </div></div>;
}
