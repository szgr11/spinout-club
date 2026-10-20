import React from 'react';
import {CalendarDays,Trophy,Plus,User,Shield,LogOut} from 'lucide-react';
import {canModerate,roleLabel} from './permissions.js';
import './club-graphics.css';
export default function ClubHeader({session,onLogout,view,setView,pendingCount=0,onPlans,showPlans,onMembers}) {
 const tabs=[{id:'events',label:'TRACK DAYS',icon:CalendarDays,href:'/events'},{id:'leaderboards',label:'SPINNER BOARDS',icon:Trophy,href:'/leaderboard'},...(session?[{id:'submit',label:'LOG A TIME',icon:Plus,href:'/members'},{id:'profile',label:'PROFILE',icon:User}]:[])];
 if(canModerate(session))tabs.push({id:'admin',label:'CONTROL',icon:Shield,badge:pendingCount});
 return <header className="club-header"><div className="club-header-inner">
  <a className="club-logo" href="/events">◆ SPINOUT <span>// CLUB</span></a>
  <nav className="club-navigation" aria-label="Club navigation">{tabs.map(t=>{const Tag=t.href?'a':'button',Icon=t.icon;return <Tag key={t.id} href={t.href} type={t.href?undefined:'button'} aria-current={view===t.id?'page':undefined} onClick={t.href?undefined:()=>setView?.(t.id)}><Icon size={13} aria-hidden="true"/><span className="club-nav-label" data-phone-label={{events:'Calendar',leaderboards:'Boards',submit:'Log a time',profile:'Profile',admin:'Control'}[t.id]}>{t.label}</span>{t.badge>0&&<span className="club-nav-count">{t.badge}</span>}</Tag>;})}</nav>
  <div className="club-header-actions">{onPlans&&<button className="club-compact-action" type="button" onClick={onPlans} aria-expanded={showPlans}>MY TRACK DAYS</button>}
   {session?<><div className="club-header-account"><strong>{session.nickname}</strong><span>{roleLabel(session)}</span></div><button type="button" aria-label="Sign out" onClick={onLogout}><LogOut size={14}/></button></>:onMembers?<button className="club-compact-action" type="button" onClick={onMembers}>LOG A TIME →</button>:<a className="club-compact-action" href="/members">LOG A TIME →</a>}
  </div>
 </div></header>;
}
