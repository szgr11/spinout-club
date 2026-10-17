import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './SpinoutClub.jsx';
import { isSupabaseConfigured } from './supabase.js';

function ConfigurationNotice() {
  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px', boxSizing: 'border-box', background: '#0a0a0a', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ color: '#FFD400' }}>The Spinout Club</h1>
        <h2>Database configuration needed</h2>
        <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your local .env file or hosting build settings, then restart or rebuild the app.</p>
        <p>See README.md for setup instructions.</p>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  isSupabaseConfigured ? <App /> : <ConfigurationNotice />
);
