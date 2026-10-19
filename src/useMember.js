import {useEffect,useState} from 'react';
import {supabase} from './supabase.js';
export default function useMember() {
 const [user,setUser]=useState(undefined),[account,setAccount]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  if(!supabase){setError('Member tools are temporarily unavailable.');setLoading(false);return;}
  let active=true;
  supabase.auth.getSession().then(({data,error})=>{if(active){if(error)setError('Please sign in again.');setUser(data?.session?.user||null);}}).catch(()=>{if(active){setError('Please sign in again.');setUser(null);}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  if(user===undefined)return;let active=true;setAccount(null);setLoading(true);
  if(!user){setLoading(false);return;}
  supabase.rpc('spinout_account').then(({data,error})=>{if(!active)return;if(error)setError('Member tools are temporarily unavailable.');else if(data&&!data.banned&&['member','admin'].includes(data.role)){setAccount(data);setError('');}setLoading(false);}).catch(()=>{if(active){setError('Member tools are temporarily unavailable.');setLoading(false);}});
  return()=>{active=false;};
 },[user?.id]);
 return {account,error,loading};
}
