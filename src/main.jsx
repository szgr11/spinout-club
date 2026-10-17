import '@fontsource-variable/jetbrains-mono';
import './global.css';
import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import EventsCalendar from './EventsCalendar.jsx';
const App = lazy(() => import('./SpinoutClub.jsx'));
const isSupabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL?.trim() && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()));

function ConfigurationNotice() {
  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px', boxSizing: 'border-box', background: '#0a0a0a', color: '#e8e8e8', fontFamily: 'var(--font-club)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ color: '#FFD400' }}>The Spinout Club</h1>
        <h2>Club services are temporarily unavailable</h2>
        <p>Please try again shortly, or <a href="/events">browse upcoming track days</a>.</p>
      </div>
    </main>
  );
}

const publicBoards = /^\/leaderboards?(?:\/|$)/.test(window.location.pathname);
createRoot(document.getElementById('root')).render(
  (window.location.pathname.startsWith('/members') || publicBoards)
    ? (isSupabaseConfigured ? <Suspense fallback={<div style={{background:'#0a0a0a',color:'#ffd400',padding:40}}>Loading Spinout Club…</div>}><App publicView={publicBoards} /></Suspense> : <ConfigurationNotice />)
    : <EventsCalendar onMembers={() => window.location.assign('/members')} />
);
