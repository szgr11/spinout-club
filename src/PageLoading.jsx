import React,{createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import Header from './ClubHeader.jsx';
import './page-loading.css';

const LoadingContext=createContext(null);
const MESSAGES=[
 'Adding blinker fluid…',
 'Torquing wheels to spec…',
 'Wiggling jack stands…',
 'Looking for the 10 mm socket…',
 'Checking cold tire pressures…',
 'Bleeding the brakes…',
 'Warming up the tires…',
 'Arguing about the racing line…',
 'Applying another horsepower sticker…',
 'Removing unnecessary weight…',
 'Remembering where we parked…',
 'Packing too many spare wheels…',
 'Explaining the new car parts…',
 'Recalibrating the butt dyno…',
 'Giving the hood a reassuring pat…',
 'Looking for that mystery rattle…',
 'Negotiating with the check engine light…',
 'Checking the torque wrench twice…',
 'Zip-tying something important…',
 'Convincing the tires they have one more session…',
 'Debating another alignment…',
 'Remembering to remove the tow hook cover…',
 'Calling it a warm-up lap…',
 'Making room for one more tool…',
];

// Persist across account, lazy-import and data-loading stages without flashing
// an intermediate page or restarting the message and animation.
export function PageLoadingProvider({children}){
 const tasks=useRef(new Set()),settle=useRef(null);
 const [pending,setPending]=useState(false),[visible,setVisible]=useState(false);
 const [message,setMessage]=useState(()=>Math.floor(Math.random()*MESSAGES.length));
 const register=useCallback(()=>{
  const token=Symbol();tasks.current.add(token);clearTimeout(settle.current);setPending(true);
  return()=>{
   tasks.current.delete(token);
   if(!tasks.current.size)settle.current=setTimeout(()=>{if(!tasks.current.size)setPending(false);},60);
  };
 },[]);
 useEffect(()=>()=>clearTimeout(settle.current),[]);
 useEffect(()=>{
  if(!pending){setVisible(false);return;}
  const timer=setTimeout(()=>setVisible(true),140);
  return()=>clearTimeout(timer);
 },[pending]);
 useEffect(()=>{
  if(!visible)return;
  const timer=setInterval(()=>setMessage(i=>(i+1)%MESSAGES.length),2800);
  return()=>clearInterval(timer);
 },[visible]);
 return <LoadingContext.Provider value={register}>
  <div aria-busy={pending} inert={pending} className={pending?'club-content-pending':undefined}>{children}</div>
  <div className={`club-page club-loading-screen ${visible?'is-visible':''}`} inert={!visible} aria-hidden={!visible}>
   <Header/>
   <main className="club-loading-main">
    <div className="club-loading-copy" role="status" aria-live="polite" aria-atomic="true">
     <div className="club-loading-marks" aria-hidden="true"><i/><i/><i/></div>
     <p className="club-loading-brand">SPINOUT <span>// CLUB</span></p>
     <p className="club-loading-message">{MESSAGES[message]}</p>
     <span className="club-loading-accessible">Loading the page.</span>
    </div>
   </main>
  </div>
 </LoadingContext.Provider>;
}

export default function PageLoading(){
 const register=useContext(LoadingContext);
 useLayoutEffect(()=>register?.(),[register]);
 return null;
}
