import { supabase } from './supabase'
import { deduplicateLaps } from './laps.js';
import { SecureAuth, GoogleButton } from './SecureAuth.jsx';
import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Clock, User, LogOut, Plus, Check, X, Shield, Flag, Thermometer, Calendar, Zap, ChevronRight, AlertCircle, Edit2, Ban, MapPin, Megaphone, Lock, Settings, Pin } from 'lucide-react';

// ============ BUILT-IN TRACK DEFINITIONS ============
// Admin can add custom tracks via the Control panel — they merge into this list.
const BUILTIN_TRACKS = [
  { id: 'sow_cw', name: 'Streets of Willow', variant: 'CW', region: 'SoCal' },
  { id: 'sow_ccw', name: 'Streets of Willow', variant: 'CCW', region: 'SoCal' },
  { id: 'big_willow', name: 'Big Willow', variant: 'CW', region: 'SoCal' },
  { id: 'btn_cw13', name: 'Buttonwillow', variant: 'CW13', region: 'SoCal' },
  { id: 'btn_ccw13', name: 'Buttonwillow', variant: 'CCW13', region: 'SoCal' },
  { id: 'btn_circuit', name: 'Buttonwillow', variant: 'The Circuit', region: 'SoCal' },
  { id: 'btn_cw1', name: 'Buttonwillow', variant: 'CW1', region: 'SoCal' },
  { id: 'chuck_cw', name: 'Chuckwalla', variant: 'CW', region: 'SoCal' },
  { id: 'chuck_ccw', name: 'Chuckwalla', variant: 'CCW', region: 'SoCal' },
  { id: 'laguna', name: 'Laguna Seca', variant: '—', region: 'NorCal' },
  { id: 'sonoma', name: 'Sonoma Raceway', variant: '—', region: 'NorCal' },
  { id: 'thunder', name: 'Thunderhill', variant: '5mi', region: 'NorCal' },
  { id: 'spring_mtn', name: 'Spring Mountain', variant: '—', region: 'NV' },
  { id: 'lvms', name: 'Las Vegas Motor Speedway', variant: 'CW', region: 'NV' },
  { id: 'tsukuba', name: 'Tsukuba', variant: '—', region: 'JP' },
];

// ============ SEED DATA from existing spreadsheet ============
const SEED_LAPS = [];

// ============ STORAGE HELPERS ============
// Legacy helpers kept as safe no-ops so old app_kv code cannot slow production.
// All live reads/writes now go directly to categorized Supabase tables.
const safeGet = async () => null;
const safeSet = async () => true;
const safeDelete = async () => true;
const safeList = async () => [];

// ============ TIME PARSING ============
const parseTime = (t) => {
  if (!t) return Infinity;
  const m = String(t).match(/^(\d+):(\d+)\.(\d+)$/);
  if (!m) return Infinity;
  return parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / Math.pow(10, m[3].length);
};
const validateTimeFormat = (t) => /^\d+:\d{2}\.\d{1,3}$/.test(String(t).trim());

// ============ DESIGN TOKENS ============
const C = {
  bg: '#0a0a0a',
  panel: '#141414',
  panel2: '#1a1a1a',
  border: '#262626',
  borderLight: '#333',
  text: '#e8e8e8',
  textDim: '#888',
  textFaint: '#555',
  accent: '#FFD400',
  accentDim: '#8a7300',
  green: '#5eff8a',
  red: '#ff5e5e',
  blue: '#6ec5ff',
};

const mono = '"JetBrains Mono", "Menlo", "Consolas", monospace';
const sans = '"Inter", system-ui, -apple-system, sans-serif';
const inputStyle = {
  width: '100%', background: C.bg, border: `1px solid ${C.border}`,
  color: C.text, padding: '10px 12px', fontFamily: mono, fontSize: 13,
  transition: 'border-color 0.15s'
};

// ============ IMAGE COMPRESSION ============
// Resize an image File to max 1200px on longest edge, JPEG quality 0.7
// Returns a base64 data URI string (typically 50-300KB).
const compressImage = (file) => new Promise((resolve, reject) => {
  if (!file) return resolve(null);
  if (file.size > 10 * 1024 * 1024) return reject(new Error('Image too large (max 10MB)'));
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height);
        width *= scale; height *= scale;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUri = canvas.toDataURL('image/jpeg', 0.7);
      // Reject if still too big after compression (>2MB)
      if (dataUri.length > 2 * 1024 * 1024) {
        return reject(new Error('Image too large after compression — try a smaller one'));
      }
      resolve(dataUri);
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = e.target.result;
  };
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.readAsDataURL(file);
});

// ============ CSV EXPORT ============
const exportCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // Quote if contains comma, quote, or newline
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ============ APP ============
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);
  const [view, setView] = useState('leaderboards');
  const [activeTrack, setActiveTrack] = useState('sow_cw');
  const [laps, setLaps] = useState([]);
  const [pendingLaps, setPendingLaps] = useState([]);
  const [users, setUsers] = useState({});
  const [pending, setPending] = useState({});
  const [customTracks, setCustomTracks] = useState([]);
  const [billboards, setBillboards] = useState([]);
  const [reports, setReports] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [application, setApplication] = useState(null);
  const [toast, setToast] = useState(null);

  // Merged track list, used everywhere
  const allTracks = useMemo(() => [...BUILTIN_TRACKS, ...customTracks], [customTracks]);

  // Supabase verifies signed sessions. Retired browser-only sessions are discarded.
  useEffect(() => {
    let active = true;
    localStorage.removeItem('spinout_session');
    supabase.auth.getSession().then(({data,error}) => {
      if (!active) return;
      setAuthUser(error ? null : data.session?.user || null);
      setAuthReady(true);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, authSession) => {
      setAuthUser(authSession?.user || null);
    });
    return () => { active=false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let active=true;
    (async () => {
      setLoaded(false);
      setSession(null);
      setApplication(null);
      setLaps([]); setUsers({}); setPending({}); setPendingLaps([]); setReports([]); setBillboards([]);
      if (authUser) {
        const {data:profile,error} = await supabase.rpc('spinout_account');
        if (!active) return;
        if (error) showToast('Member sign-in is temporarily unavailable. Please try again shortly.', 'error');
        else if (profile && !profile.banned) {
          setSession(profile);
          await refreshData();
        } else if (profile?.banned) showToast('This membership is suspended. Contact a club admin.', 'error');
        else {
          const {data:p} = await supabase.from('pending_users').select('username,nickname,submitted_at').eq('auth_user_id',authUser.id).maybeSingle();
          if(active)setApplication(p);
        }
      }
      if(active)setLoaded(true);
    })();
    return () => {active=false;};
  }, [authUser?.id,authReady]);

  const refreshData = async () => {
    const [lapsRes, pendingLapsRes, usersRes, pendingUsersRes, tracksRes, billboardsRes, reportsRes] = await Promise.all([
      supabase.from('laps').select('id,track,driver,time,car,hp,tire,temp,date,organizer,type,submitted_by,submitted_at,approved_by,approved_at,history'),
      supabase.from('pending_laps').select('id,track,driver,time,car,hp,tire,temp,date,organizer,type,image,submitted_by,submitted_at'),
      supabase.from('profiles').select('username,nickname,role,banned,joined_at'),
      supabase.from('pending_users').select('username,nickname,reason,submitted_at'),
      supabase.from('tracks').select('id,name,variant,region,added_by,created_at'),
      supabase.from('billboards').select('id,title,body,pinned,posted_by,posted_at'),
      supabase.from('reports').select('id,lap_id,reason,reporter,reported_at')
    ]);

    if (lapsRes.error || pendingLapsRes.error || usersRes.error || pendingUsersRes.error || tracksRes.error || billboardsRes.error || reportsRes.error) {
      console.error('Supabase refresh error', {
        laps: lapsRes.error,
        pendingLaps: pendingLapsRes.error,
        users: usersRes.error,
        pendingUsers: pendingUsersRes.error,
        tracks: tracksRes.error,
        billboards: billboardsRes.error,
        reports: reportsRes.error
      });
      showToast('Database refresh failed. Check Supabase tables/RLS.', 'error');
    }

    setLaps(deduplicateLaps(lapsRes.data || []).map(l => ({
      ...l,
      submittedBy: l.submitted_by,
      submittedAt: l.submitted_at,
      approvedBy: l.approved_by,
      approvedAt: l.approved_at,
      _key: l.id
    })));

    setPendingLaps((pendingLapsRes.data || []).map(l => ({
      ...l,
      imageData: l.image || null,
      submittedBy: l.submitted_by,
      submittedAt: l.submitted_at,
      _key: l.id
    })));

    const userData = {};
    (usersRes.data || []).forEach(u => {
      userData[u.username] = {
        username: u.username,
        nickname: u.nickname,
        role: u.role,
        banned: u.banned,
        joinedAt: u.joined_at
      };
    });
    setUsers(userData);

    const pendingData = {};
    (pendingUsersRes.data || []).forEach(p => {
      pendingData[p.username] = {
        username: p.username,
        nickname: p.nickname,
        reason: p.reason,
        submittedAt: p.submitted_at
      };
    });
    setPending(pendingData);

    setCustomTracks((tracksRes.data || []).map(t => ({
      id: t.id,
      name: t.name,
      variant: t.variant,
      region: t.region,
      addedBy: t.added_by,
      createdAt: t.created_at
    })));

    setBillboards((billboardsRes.data || []).filter(b => b.title !== 'Duplicate lap time entry noted').map(b => ({
      id: b.id,
      title: b.title,
      body: b.body,
      pinned: b.pinned,
      postedBy: b.posted_by,
      postedAt: b.posted_at,
      _key: b.id
    })).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.postedAt || 0) - (a.postedAt || 0);
    }));

    setReports((reportsRes.data || []).map(r => ({
      id: r.id,
      lapKey: r.lap_id,
      reason: r.reason,
      reporter: r.reporter,
      reporterName: userData[r.reporter]?.nickname || r.reporter,
      reportedAt: r.reported_at,
      _key: r.id
    })).sort((a, b) => (b.reportedAt || 0) - (a.reportedAt || 0)));
  };


  const showToast = (msg, kind = 'info') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  // ----- VERIFIED AUTH / ACCOUNT MANAGEMENT -----
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setView('leaderboards');
  };
  const handleChangePassword = async (oldPw,newPw) => {
    const {data,error} = await supabase.rpc('spinout_change_password',{p_old:oldPw,p_new:newPw});
    if(error||data?.error){showToast(error?.message||data.error,'error');return false;}
    showToast('Password updated','success');return true;
  };
  const approveUser = async username => {
    const {error} = await supabase.rpc('spinout_approve_user',{p_username:username});
    if(error){showToast(error.message,'error');return;}
    await refreshData();showToast('Membership approved','success');
  };

  const rejectUser = async (username) => {
    const { error } = await supabase.from('pending_users').delete().eq('username', username);
    if (error) {
      console.error('reject user error', error);
      showToast('Could not reject application', 'error');
      return;
    }
    setPending(prev => {
      const next = { ...prev };
      delete next[username];
      return next;
    });
    showToast('Application rejected', 'info');
  };


  const banUser = async (username) => {
    const u = users[username];
    if (!u) return;
    if (u.role === 'admin') { showToast('Cannot ban an admin', 'error'); return; }

    const { error } = await supabase.from('profiles').update({ banned: true }).eq('username', username);
    if (error) {
      console.error('ban user error', error);
      showToast('Could not ban user', 'error');
      return;
    }

    setUsers(prev => ({ ...prev, [username]: { ...u, banned: true } }));
    showToast(`${u.nickname} has been banned`, 'warn');
  };


  const unbanUser = async (username) => {
    const u = users[username];
    if (!u) return;

    const { error } = await supabase.from('profiles').update({ banned: false }).eq('username', username);
    if (error) {
      console.error('unban user error', error);
      showToast('Could not unban user', 'error');
      return;
    }

    setUsers(prev => ({ ...prev, [username]: { ...u, banned: false } }));
    showToast(`${u.nickname} has been unbanned`, 'success');
  };


  // ----- LAP ADMIN -----
  const deleteLap = async (key) => {
    const { error } = await supabase.from('laps').delete().eq('id', key);
    if (error) {
      console.error('delete lap error', error);
      showToast('Could not remove lap', 'error');
      return;
    }
    setLaps(prev => prev.filter(l => l._key !== key));
    setReports(prev => prev.filter(r => r.lapKey !== key));
    showToast('Lap removed', 'info');
  };


  const editLap = async (key, updates) => {
    const lap = laps.find(l => l._key === key);
    if (!lap) { showToast('Lap not found', 'error'); return; }
    if (updates.time && !validateTimeFormat(updates.time)) {
      showToast('Invalid time format', 'error'); return;
    }

    const trackedFields = ['driver', 'time', 'track', 'type', 'car', 'hp', 'tire', 'temp', 'date', 'organizer'];
    const history = Array.isArray(lap.history) ? [...lap.history] : [];
    for (const field of trackedFields) {
      if (field in updates && updates[field] !== lap[field]) {
        history.push({
          field,
          oldValue: lap[field],
          newValue: updates[field],
          by: session.username,
          at: Date.now()
        });
      }
    }

    const dbUpdates = { ...updates, history };
    if ('hp' in dbUpdates) dbUpdates.hp = Number.isFinite(Number(dbUpdates.hp)) ? Number(dbUpdates.hp) : null;

    const { error } = await supabase.from('laps').update(dbUpdates).eq('id', key);
    if (error) {
      console.error('edit lap error', error);
      showToast('Could not update lap', 'error');
      return;
    }

    setLaps(prev => prev.map(l => l._key === key ? { ...l, ...updates, hp: dbUpdates.hp ?? updates.hp, history } : l));
    showToast('Lap updated', 'success');
  };


  // ----- REPORT MGMT -----
  const reportLap = async ({ lapKey, lapSnapshot, reason }) => {
    const existing = reports.find(r => r.lapKey === lapKey && r.reporter === session.username);
    if (existing) {
      showToast('You have already reported this lap', 'warn');
      return;
    }

    const id = `report_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const row = {
      id,
      lap_id: lapKey,
      reason,
      reporter: session.username,
      reported_at: Date.now()
    };

    const { error } = await supabase.from('reports').insert(row);
    if (error) {
      console.error('report lap error', error);
      showToast('Could not submit report', 'error');
      return;
    }

    setReports(prev => [{
      id,
      _key: id,
      lapKey,
      lapSnapshot,
      reason,
      reporter: session.username,
      reporterName: session.nickname,
      reportedAt: row.reported_at
    }, ...prev]);
    showToast('Report submitted — admin will review', 'success');
  };


  const resolveReportRemoveLap = async (reportKey, lapKey) => {
    const { error: lapError } = await supabase.from('laps').delete().eq('id', lapKey);
    const { error: reportsError } = await supabase.from('reports').delete().eq('lap_id', lapKey);
    if (lapError || reportsError) {
      console.error('resolve report error', { lapError, reportsError });
      showToast('Could not resolve report', 'error');
      return;
    }

    setLaps(prev => prev.filter(l => l._key !== lapKey));
    setReports(prev => prev.filter(r => r.lapKey !== lapKey));
    showToast('Lap removed; all related reports closed', 'warn');
  };


  const dismissReport = async (reportKey) => {
    const { error } = await supabase.from('reports').delete().eq('id', reportKey);
    if (error) {
      console.error('dismiss report error', error);
      showToast('Could not dismiss report', 'error');
      return;
    }
    setReports(prev => prev.filter(r => r._key !== reportKey));
    showToast('Report dismissed', 'info');
  };


  const approvePendingLap = async (key) => {
    const pl = pendingLaps.find(l => l._key === key);
    if (!pl) return;

    const id = `lap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const approvedAt = Date.now();
    const row = {
      id,
      track: pl.track,
      driver: pl.driver,
      time: pl.time,
      car: pl.car,
      hp: Number.isFinite(Number(pl.hp)) ? Number(pl.hp) : null,
      tire: pl.tire,
      temp: pl.temp,
      date: pl.date,
      organizer: pl.organizer,
      type: pl.type || 'real',
      image: pl.imageData || pl.image || null,
      submitted_by: pl.submittedBy || pl.submitted_by || '',
      submitted_at: pl.submittedAt || pl.submitted_at || Date.now(),
      approved_by: session.username,
      approved_at: approvedAt,
      history: []
    };

    const { error: insertError } = await supabase.from('laps').insert(row);
    const { error: deleteError } = await supabase.from('pending_laps').delete().eq('id', key);
    if (insertError || deleteError) {
      console.error('approve pending lap error', { insertError, deleteError });
      showToast('Could not approve lap', 'error');
      return;
    }

    setPendingLaps(prev => prev.filter(l => l._key !== key));
    setLaps(prev => [{
      id,
      _key: id,
      track: row.track,
      driver: row.driver,
      time: row.time,
      car: row.car,
      hp: row.hp,
      tire: row.tire,
      temp: row.temp,
      date: row.date,
      organizer: row.organizer,
      type: row.type,
      submittedBy: row.submitted_by,
      submittedAt: row.submitted_at,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      history: []
    }, ...prev]);
    showToast(`Approved lap by ${pl.driver}`, 'success');
  };


  const rejectPendingLap = async (key) => {
    const { error } = await supabase.from('pending_laps').delete().eq('id', key);
    if (error) {
      console.error('reject pending lap error', error);
      showToast('Could not reject lap', 'error');
      return;
    }
    setPendingLaps(prev => prev.filter(l => l._key !== key));
    showToast('Pending lap rejected', 'info');
  };


  // ----- SUBMIT LAP (now goes to pending) -----
  const submitLap = async (lapData) => {
    const id = `pendinglap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const submittedAt = Date.now();
    const row = {
      id,
      track: lapData.track,
      driver: lapData.driver,
      time: lapData.time,
      car: lapData.car,
      hp: Number.isFinite(Number(lapData.hp)) ? Number(lapData.hp) : null,
      tire: lapData.tire,
      temp: lapData.temp,
      date: lapData.date,
      organizer: lapData.organizer,
      type: lapData.type || 'real',
      image: lapData.imageData || null,
      submitted_by: session.username,
      submitted_at: submittedAt
    };

    const { error } = await supabase.from('pending_laps').insert(row);
    if (error) {
      console.error('submit lap error', error);
      showToast('Could not submit lap', 'error');
      return;
    }

    setPendingLaps(prev => [{
      ...lapData,
      hp: row.hp,
      imageData: row.image,
      submittedBy: session.username,
      submittedAt,
      _key: id,
      id
    }, ...prev]);
    showToast('Lap submitted — awaiting admin review', 'success');
    setView('profile');
  };


  // ----- TRACK MGMT -----
  const addTrack = async ({ name, variant, region }) => {
    if (!name || !region) { showToast('Name and region required', 'error'); return; }
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${(variant || 'main').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36).slice(-4)}`;
    const row = {
      id,
      name,
      variant: variant || '—',
      region,
      added_by: session.username,
      created_at: Date.now()
    };

    const { error } = await supabase.from('tracks').insert(row);
    if (error) {
      console.error('add track error', error);
      showToast('Could not add track', 'error');
      return;
    }

    setCustomTracks(prev => [...prev, {
      id: row.id,
      name: row.name,
      variant: row.variant,
      region: row.region,
      addedBy: row.added_by,
      createdAt: row.created_at
    }]);
    showToast(`Added ${name} ${variant || ''}`, 'success');
  };


  const deleteTrack = async (id) => {
    if (BUILTIN_TRACKS.find(t => t.id === id)) {
      showToast('Cannot delete built-in tracks', 'error');
      return;
    }

    const { error } = await supabase.from('tracks').delete().eq('id', id);
    if (error) {
      console.error('delete track error', error);
      showToast('Could not remove track', 'error');
      return;
    }

    setCustomTracks(prev => prev.filter(t => t.id !== id));
    showToast('Track removed', 'info');
  };


  // ----- BILLBOARD MGMT -----
  const postBillboard = async ({ title, body, pinned }) => {
    if (!title || !body) { showToast('Title and body required', 'error'); return; }
    const id = `bb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const row = {
      id,
      title,
      body,
      pinned: !!pinned,
      posted_by: session.username,
      posted_at: Date.now()
    };

    const { error } = await supabase.from('billboards').insert(row);
    if (error) {
      console.error('post billboard error', error);
      showToast('Could not post announcement', 'error');
      return;
    }

    setBillboards(prev => [{
      id,
      _key: id,
      title,
      body,
      pinned: !!pinned,
      postedBy: session.username,
      postedAt: row.posted_at
    }, ...prev].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.postedAt || 0) - (a.postedAt || 0);
    }));
    showToast('Announcement posted', 'success');
  };


  const deleteBillboard = async (key) => {
    const { error } = await supabase.from('billboards').delete().eq('id', key);
    if (error) {
      console.error('delete billboard error', error);
      showToast('Could not remove announcement', 'error');
      return;
    }
    setBillboards(prev => prev.filter(b => b._key !== key));
    showToast('Announcement removed', 'info');
  };


  // ----- RENDER -----
  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: mono, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BootScreen />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: sans }}>
      <GlobalStyle />
      {toast && <Toast {...toast} />}
      {!session ? (
        <SecureAuth authUser={authUser} application={application} onLogin={() => setView('leaderboards')}
          onLogout={handleLogout} onApplied={async () => {
            const {data:p} = await supabase.from('pending_users').select('username,nickname,submitted_at').eq('auth_user_id',authUser.id).maybeSingle();
            setApplication(p);
          }} />
      ) : (
        <>
          <Header session={session} onLogout={handleLogout} view={view} setView={setView}
            pendingCount={Object.keys(pending).length + pendingLaps.length + reports.length}
          />
          <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
            {view === 'leaderboards' && (
              <LeaderboardView
                laps={laps}
                activeTrack={activeTrack}
                setActiveTrack={setActiveTrack}
                allTracks={allTracks}
                billboards={billboards}
                session={session}
                onDeleteBillboard={deleteBillboard}
                onReportLap={reportLap}
                reports={reports}
              />
            )}
            {view === 'submit' && (
              <SubmitView
                onSubmit={submitLap}
                initialTrack={activeTrack}
                session={session}
                allTracks={allTracks}
              />
            )}
            {view === 'admin' && session.role === 'admin' && (
              <AdminView
                pending={pending}
                pendingLaps={pendingLaps}
                approveUser={approveUser}
                rejectUser={rejectUser}
                banUser={banUser}
                unbanUser={unbanUser}
                approvePendingLap={approvePendingLap}
                rejectPendingLap={rejectPendingLap}
                users={users}
                laps={laps}
                deleteLap={deleteLap}
                editLap={editLap}
                allTracks={allTracks}
                customTracks={customTracks}
                addTrack={addTrack}
                deleteTrack={deleteTrack}
                billboards={billboards}
                postBillboard={postBillboard}
                deleteBillboard={deleteBillboard}
                reports={reports}
                resolveReportRemoveLap={resolveReportRemoveLap}
                dismissReport={dismissReport}
              />
            )}
            {view === 'profile' && (
              <ProfileView
                session={session}
                laps={laps}
                pendingLaps={pendingLaps}
                users={users}
                allTracks={allTracks}
                onChangePassword={handleChangePassword}
              />
            )}
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; background: ${C.bg}; }
      ::selection { background: ${C.accent}; color: ${C.bg}; }
      input, select, textarea { outline: none; }
      input:focus, select:focus, textarea:focus { border-color: ${C.accent} !important; }
      .scanline { position: relative; overflow: hidden; }
      .scanline::after {
        content: ''; position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px);
      }
      @keyframes blink { 50% { opacity: 0; } }
      @keyframes slideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      .blink { animation: blink 1.2s infinite; }
      button { font-family: inherit; cursor: pointer; }
      button:active { transform: translateY(1px); }
      button:disabled { opacity: 0.4; cursor: not-allowed; }
    `}</style>
  );
}

function BootScreen() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, letterSpacing: 4, color: C.accent, marginBottom: 8 }}>
        THE SPINOUT CLUB
      </div>
      <div style={{ fontSize: 11, color: C.textDim, fontFamily: mono }}>
        <span className="blink">▮</span> INITIALIZING
      </div>
    </div>
  );
}

function Toast({ msg, kind }) {
  const colors = { info: C.text, success: C.green, error: C.red, warn: C.accent };
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 1000,
      background: C.panel, border: `1px solid ${colors[kind] || C.border}`,
      padding: '12px 18px', fontFamily: mono, fontSize: 12,
      color: colors[kind] || C.text, animation: 'slideIn 0.2s ease',
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      maxWidth: 380
    }}>
      <span style={{ color: C.textFaint, marginRight: 8 }}>[{new Date().toTimeString().slice(0,8)}]</span>
      {msg}
    </div>
  );
}

function Logo({ size = 'normal' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: size === 'big' ? 12 : 8 }}>
      <div style={{
        fontFamily: mono, fontWeight: 700,
        fontSize: size === 'big' ? 28 : 16,
        color: C.accent, letterSpacing: 2,
      }}>
        ◆ SPINOUT
      </div>
      <div style={{
        fontFamily: mono, fontSize: size === 'big' ? 14 : 10,
        color: C.textFaint, letterSpacing: 3
      }}>
        // CLUB
      </div>
    </div>
  );
}

function Header({ session, onLogout, view, setView, pendingCount }) {
  const tabs = [
    { id: 'leaderboards', label: 'BOARDS', icon: Trophy },
    { id: 'submit', label: 'SUBMIT', icon: Plus },
    { id: 'profile', label: 'PROFILE', icon: User },
  ];
  if (session.role === 'admin') tabs.push({ id: 'admin', label: 'CONTROL', icon: Shield, badge: pendingCount });

  return (
    <header style={{
      borderBottom: `1px solid ${C.border}`,
      background: C.bg, position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 32 }}>
        <Logo />
        <a href="/events" style={{color:C.accent,fontFamily:mono,fontSize:11,textDecoration:'none'}}>EVENTS ↗</a>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 24, flex: 1 }}>
          {tabs.map(t => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button key={t.id} onClick={() => setView(t.id)}
                style={{
                  background: active ? C.panel : 'transparent',
                  border: `1px solid ${active ? C.borderLight : 'transparent'}`,
                  color: active ? C.accent : C.textDim,
                  padding: '8px 14px', fontFamily: mono, fontSize: 11,
                  letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 8,
                  position: 'relative',
                  transition: 'all 0.15s'
                }}>
                <Icon size={12} strokeWidth={2.5} />
                {t.label}
                {t.badge > 0 && (
                  <span style={{
                    background: C.accent, color: C.bg, fontSize: 9,
                    padding: '1px 6px', marginLeft: 2, fontWeight: 700
                  }}>{t.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontFamily: mono, color: C.text }}>{session.nickname}</div>
            <div style={{ fontSize: 9, fontFamily: mono, color: session.role === 'admin' ? C.accent : C.textFaint, letterSpacing: 1.5 }}>
              {session.role === 'admin' ? '◆ ADMIN' : '◇ MEMBER'}
            </div>
          </div>
          <button onClick={onLogout} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.textDim, padding: 8, display: 'flex'
          }}>
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, marginTop: 64, padding: '20px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 10, color: C.textFaint, letterSpacing: 1 }}>
        <div>◆ THE SPINOUT CLUB // EST. 2024</div>
        <div>SEND IT — BUT BRING IT BACK</div>
      </div>
    </footer>
  );
}

// ============ AUTH SCREEN ============

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontFamily: mono, fontSize: 10, color: C.textDim, letterSpacing: 2, marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// ============ LEADERBOARD VIEW ============

function LeaderboardView({ laps, activeTrack, setActiveTrack, allTracks, billboards, session, onDeleteBillboard, onReportLap, reports }) {
  const [filterType, setFilterType] = useState('all');
  const [lightbox, setLightbox] = useState(null);   // {imageData, driver, time}
  const [reportTarget, setReportTarget] = useState(null); // lap object
  const trackLaps = useMemo(() => {
    let filtered = laps.filter(l => l.track === activeTrack);
    if (filterType !== 'all') filtered = filtered.filter(l => l.type === filterType);
    const byDriver = {};
    filtered.forEach(l => {
      const key = l.driver.toLowerCase();
      if (!byDriver[key] || parseTime(l.time) < parseTime(byDriver[key].time)) {
        byDriver[key] = l;
      }
    });
    return Object.values(byDriver).sort((a, b) => parseTime(a.time) - parseTime(b.time));
  }, [laps, activeTrack, filterType]);

  const trackInfo = allTracks.find(t => t.id === activeTrack) || allTracks[0];
  const regions = [...new Set(allTracks.map(t => t.region))];

  return (
    <div>
      {/* Billboards */}
      {billboards.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: C.textDim, letterSpacing: 2, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Megaphone size={11} strokeWidth={2.5} /> // ANNOUNCEMENTS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {billboards.slice(0, 3).map(b => (
              <div key={b._key} style={{
                background: b.pinned ? `linear-gradient(90deg, rgba(255,212,0,0.06), transparent)` : C.panel,
                border: `1px solid ${b.pinned ? C.accentDim : C.border}`,
                borderLeft: `3px solid ${b.pinned ? C.accent : C.borderLight}`,
                padding: '14px 18px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  {b.pinned && <Pin size={11} color={C.accent} strokeWidth={2.5} />}
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.text }}>
                    {b.title}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, marginLeft: 'auto' }}>
                    {new Date(b.postedAt).toLocaleDateString()} · @{b.postedBy}
                  </div>
                  {session.role === 'admin' && (
                    <button onClick={() => onDeleteBillboard(b._key)} style={{
                      background: 'transparent', border: 'none', color: C.textFaint,
                      padding: 0, marginLeft: 6
                    }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div style={{ fontFamily: sans, fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
                  {b.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Track selector */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.textDim, letterSpacing: 2, marginBottom: 12 }}>
          // SELECT CIRCUIT
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {regions.map(region => (
            <div key={region}>
              <div style={{ fontFamily: mono, fontSize: 9, color: C.textFaint, letterSpacing: 3, marginBottom: 8 }}>
                {region.toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allTracks.filter(t => t.region === region).map(t => {
                  const active = t.id === activeTrack;
                  const count = laps.filter(l => l.track === t.id).length;
                  return (
                    <button key={t.id} onClick={() => setActiveTrack(t.id)} style={{
                      background: active ? C.accent : C.panel,
                      color: active ? C.bg : C.text,
                      border: `1px solid ${active ? C.accent : C.border}`,
                      padding: '8px 12px', fontFamily: mono, fontSize: 11,
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'all 0.15s'
                    }}>
                      <span>{t.name}</span>
                      <span style={{ fontSize: 9, color: active ? C.bg : C.textFaint, letterSpacing: 1 }}>
                        {t.variant}
                      </span>
                      {count > 0 && (
                        <span style={{
                          background: active ? 'rgba(0,0,0,0.2)' : C.borderLight,
                          color: active ? C.bg : C.textDim,
                          padding: '1px 6px', fontSize: 9, marginLeft: 4
                        }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="scanline" style={{
        background: C.panel, border: `1px solid ${C.border}`,
        padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, letterSpacing: 3, marginBottom: 4 }}>
            LEADERBOARD // {trackInfo.region.toUpperCase()}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <h1 style={{ margin: 0, fontFamily: mono, fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: 1 }}>
              {trackInfo.name}
            </h1>
            <span style={{ fontFamily: mono, fontSize: 14, color: C.accent, letterSpacing: 2 }}>
              {trackInfo.variant}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { v: 'all', label: 'ALL' },
            { v: 'real', label: 'REAL' },
            { v: 'optimal', label: 'OPTIMAL' }
          ].map(o => (
            <button key={o.v} onClick={() => setFilterType(o.v)} style={{
              background: filterType === o.v ? C.bg : 'transparent',
              border: `1px solid ${filterType === o.v ? C.accent : C.border}`,
              color: filterType === o.v ? C.accent : C.textDim,
              padding: '6px 10px', fontFamily: mono, fontSize: 10, letterSpacing: 1.5
            }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {trackLaps.length === 0 ? (
        <div style={{
          border: `1px solid ${C.border}`, borderTop: 'none',
          padding: 60, textAlign: 'center', fontFamily: mono, fontSize: 12, color: C.textFaint
        }}>
          <AlertCircle size={24} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div>NO LAP TIMES SUBMITTED FOR THIS CONFIG</div>
          <div style={{ marginTop: 4, color: C.textFaint, fontSize: 10 }}>Be the first to set a benchmark.</div>
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
                <Th>POS</Th>
                <Th>DRIVER</Th>
                <Th>TIME</Th>
                <Th>GAP</Th>
                <Th>VEHICLE</Th>
                <Th>HP</Th>
                <Th>TIRE</Th>
                <Th>TEMP</Th>
                <Th>EVENT</Th>
                <Th>DATE</Th>
                <Th>TYPE</Th>
                <Th>PROOF</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {trackLaps.map((l, i) => {
                const lead = trackLaps[0];
                const gap = parseTime(l.time) - parseTime(lead.time);
                const userAlreadyReported = (reports || []).some(r => r.lapKey === l._key && r.reporter === session.username);
                const reportCount = (reports || []).filter(r => r.lapKey === l._key).length;
                return (
                  <tr key={l._key} style={{
                    borderBottom: `1px solid ${C.border}`,
                    background: i === 0 ? 'rgba(255,212,0,0.04)' : 'transparent'
                  }}>
                    <Td>
                      <span style={{
                        color: i === 0 ? C.accent : i < 3 ? C.text : C.textDim,
                        fontWeight: i === 0 ? 700 : 400
                      }}>
                        {i === 0 ? 'P1' : `P${i + 1}`}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ color: i === 0 ? C.accent : C.text, fontWeight: i === 0 ? 700 : 500 }}>
                        {l.driver}
                      </span>
                    </Td>
                    <Td>
                      <span style={{
                        fontWeight: 700,
                        color: i === 0 ? C.accent : C.text,
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {l.time}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ color: i === 0 ? C.textFaint : C.textDim, fontVariantNumeric: 'tabular-nums' }}>
                        {i === 0 ? '—' : `+${gap.toFixed(3)}`}
                      </span>
                    </Td>
                    <Td><span style={{ color: C.textDim }}>{l.car}</span></Td>
                    <Td><span style={{ color: C.textDim, fontVariantNumeric: 'tabular-nums' }}>{l.hp || '—'}</span></Td>
                    <Td><span style={{ color: C.textDim }}>{l.tire}</span></Td>
                    <Td><span style={{ color: C.textDim }}>{l.temp}</span></Td>
                    <Td><span style={{ color: C.textFaint, fontSize: 11 }}>{l.organizer || '—'}</span></Td>
                    <Td><span style={{ color: C.textFaint, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{l.date || '—'}</span></Td>
                    <Td>
                      <span style={{
                        fontSize: 9, padding: '2px 6px', letterSpacing: 1,
                        border: `1px solid ${l.type === 'optimal' ? C.accent : C.borderLight}`,
                        color: l.type === 'optimal' ? C.accent : C.textDim
                      }}>
                        {l.type === 'optimal' ? 'OPT' : 'REAL'}
                      </span>
                    </Td>
                    <Td>
                      {l.imageData ? (
                        <button onClick={() => setLightbox({ imageData: l.imageData, driver: l.driver, time: l.time })} style={{
                          background: 'transparent', border: `1px solid ${C.border}`,
                          padding: 2, cursor: 'pointer', display: 'block'
                        }}>
                          <img src={l.imageData} alt="proof"
                            style={{ height: 32, width: 'auto', maxWidth: 56, display: 'block', objectFit: 'cover' }} />
                        </button>
                      ) : (
                        <span style={{ color: C.textFaint, fontSize: 10 }}>—</span>
                      )}
                    </Td>
                    <Td>
                      {l.submittedBy !== session.username && (
                        <button onClick={() => setReportTarget(l)} disabled={userAlreadyReported} title={userAlreadyReported ? 'Already reported' : 'Report suspicious time'} style={{
                          background: 'transparent', border: `1px solid ${userAlreadyReported ? C.borderLight : C.border}`,
                          color: userAlreadyReported ? C.textFaint : C.red, padding: '3px 7px', fontFamily: mono, fontSize: 9,
                          letterSpacing: 1, display: 'inline-flex', alignItems: 'center', gap: 3
                        }}>
                          <Flag size={9} /> {userAlreadyReported ? 'REPORTED' : 'REPORT'}
                          {reportCount > 0 && session.role === 'admin' && (
                            <span style={{ color: C.accent, marginLeft: 3 }}>({reportCount})</span>
                          )}
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {trackLaps.length > 0 && (
        <div style={{ display: 'flex', gap: 24, marginTop: 20, fontFamily: mono, fontSize: 11, color: C.textFaint, flexWrap: 'wrap' }}>
          <Stat label="ENTRIES" value={trackLaps.length} />
          <Stat label="POLE" value={trackLaps[0].time} accent />
          <Stat label="HOLDER" value={trackLaps[0].driver} />
          <Stat label="FIELD SPREAD" value={`+${(parseTime(trackLaps[trackLaps.length - 1].time) - parseTime(trackLaps[0].time)).toFixed(2)}s`} />
        </div>
      )}

      {lightbox && <ImageLightbox {...lightbox} onClose={() => setLightbox(null)} />}
      {reportTarget && (
        <ReportLapModal
          lap={reportTarget}
          allTracks={allTracks}
          onClose={() => setReportTarget(null)}
          onSubmit={(reason) => {
            onReportLap({
              lapKey: reportTarget._key,
              lapSnapshot: {
                driver: reportTarget.driver,
                time: reportTarget.time,
                track: reportTarget.track,
                car: reportTarget.car,
                tire: reportTarget.tire,
                date: reportTarget.date,
                submittedBy: reportTarget.submittedBy
              },
              reason
            });
            setReportTarget(null);
          }}
        />
      )}
    </div>
  );
}

function ImageLightbox({ imageData, driver, time, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 40, cursor: 'zoom-out'
    }}>
      <div style={{ maxWidth: '100%', maxHeight: '100%', position: 'relative' }}>
        <img src={imageData} alt="lap proof" style={{
          maxWidth: '100%', maxHeight: '85vh', display: 'block',
          border: `1px solid ${C.borderLight}`
        }} />
        <div style={{
          position: 'absolute', bottom: -32, left: 0, right: 0,
          textAlign: 'center', fontFamily: mono, fontSize: 11, color: C.textDim, letterSpacing: 2
        }}>
          {driver} · <span style={{ color: C.accent }}>{time}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{
          position: 'absolute', top: -36, right: 0,
          background: 'transparent', border: `1px solid ${C.borderLight}`,
          color: C.text, padding: '4px 10px', fontFamily: mono, fontSize: 10, letterSpacing: 1.5
        }}>CLOSE ✕</button>
      </div>
    </div>
  );
}

function ReportLapModal({ lap, allTracks, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const t = allTracks.find(x => x.id === lap.track);

  const submit = () => {
    if (!reason.trim() || reason.trim().length < 10) return;
    onSubmit(reason.trim());
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 150, padding: 20
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.panel, border: `1px solid ${C.red}`,
        maxWidth: 520, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
      }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: C.red, letterSpacing: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flag size={11} /> // REPORT SUSPICIOUS TIME
          </div>
          <div style={{ fontFamily: mono, fontSize: 16, color: C.text, marginTop: 6 }}>
            {lap.driver} · <span style={{ color: C.accent }}>{lap.time}</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.textDim, marginTop: 2 }}>
            {t?.name} {t?.variant} · {lap.car}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <Field label="REASON FOR REPORT" hint="min 10 characters — what makes this lap look suspicious?">
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={5}
              placeholder="e.g. impossible time for this car/tire combo; conflicts with their other published times; appears to skip a sector based on data..."
              style={{ ...inputStyle, resize: 'vertical' }} autoFocus />
          </Field>
          <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, lineHeight: 1.6, marginTop: 8 }}>
            Reports are reviewed by admin. False reports may affect your account standing.
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 18px', background: 'transparent', border: `1px solid ${C.border}`,
            color: C.textDim, fontFamily: mono, fontSize: 11, letterSpacing: 1.5
          }}>CANCEL</button>
          <button onClick={submit} disabled={reason.trim().length < 10} style={{
            padding: '10px 18px', background: reason.trim().length < 10 ? C.borderLight : C.red,
            color: reason.trim().length < 10 ? C.textFaint : '#fff', border: 'none',
            fontFamily: mono, fontSize: 11, letterSpacing: 1.5, fontWeight: 700
          }}>SUBMIT REPORT →</button>
        </div>
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th style={{
      textAlign: 'left', padding: '12px 14px',
      fontFamily: mono, fontSize: 10, letterSpacing: 2,
      color: C.textDim, fontWeight: 500
    }}>
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td style={{ padding: '12px 14px' }}>{children}</td>;
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ color: C.textFaint, letterSpacing: 1.5 }}>{label}</span>
      <span style={{ color: accent ? C.accent : C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

// ============ SUBMIT VIEW ============

function SubmitView({ onSubmit, initialTrack, session, allTracks }) {
  const [form, setForm] = useState({
    track: initialTrack,
    driver: session.nickname,
    car: '',
    hp: '',
    time: '',
    tire: '',
    temp: '',
    date: new Date().toISOString().slice(0, 10),
    organizer: '',
    type: 'real',
    imageData: null,
  });
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageProcessing, setImageProcessing] = useState(false);

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleImage = async (file) => {
    setImageError('');
    if (!file) { setF('imageData', null); return; }
    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file');
      return;
    }
    setImageProcessing(true);
    try {
      const dataUri = await compressImage(file);
      setF('imageData', dataUri);
    } catch (e) {
      setImageError(e.message);
    } finally {
      setImageProcessing(false);
    }
  };

  const submit = () => {
    if (!validateTimeFormat(form.time)) {
      setError('Time format must be M:SS.xx — e.g. 1:18.67 or 1:18.674');
      return;
    }
    if (!form.car || !form.tire) {
      setError('Vehicle and tire are required.');
      return;
    }
    setError('');
    onSubmit({
      ...form,
      hp: parseInt(form.hp) || 0,
      time: form.time.trim()
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, letterSpacing: 3, marginBottom: 4 }}>
          // SUBMIT LAP TIME
        </div>
        <h1 style={{ margin: 0, fontFamily: mono, fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: 1 }}>
          Submit Entry
        </h1>
        <div style={{
          marginTop: 12, padding: '10px 14px', background: 'rgba(255,212,0,0.06)',
          border: `1px solid ${C.accentDim}`, fontFamily: mono, fontSize: 11, color: C.accent
        }}>
          ⓘ Submissions are reviewed by admin before appearing on the leaderboard.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 24 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 2, marginBottom: 16 }}>
            ▸ CIRCUIT & TIME
          </div>
          <Field label="TRACK + DIRECTION">
            <select value={form.track} onChange={e => setF('track', e.target.value)} style={inputStyle}>
              {allTracks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.variant} ({t.region})
                </option>
              ))}
            </select>
          </Field>
          <Field label="LAP TIME" hint="format: M:SS.xx (e.g. 1:18.67)">
            <input value={form.time} onChange={e => setF('time', e.target.value)}
              placeholder="1:23.45"
              style={{ ...inputStyle, fontSize: 18, fontWeight: 700, letterSpacing: 2 }} />
          </Field>
          <Field label="LAP TYPE">
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'real', label: 'REAL LAP', desc: 'actual recorded clean lap' },
                { v: 'optimal', label: 'OPTIMAL', desc: 'best theoretical lap' }
              ].map(o => (
                <button key={o.v} type="button" onClick={() => setF('type', o.v)} style={{
                  flex: 1, padding: 12,
                  background: form.type === o.v ? C.bg : 'transparent',
                  border: `1px solid ${form.type === o.v ? C.accent : C.border}`,
                  color: form.type === o.v ? C.accent : C.textDim,
                  fontFamily: mono, fontSize: 11, letterSpacing: 1.5, textAlign: 'left'
                }}>
                  <div style={{ fontWeight: 700 }}>{o.label}</div>
                  <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2 }}>{o.desc}</div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="DATE">
            <input type="date" value={form.date} onChange={e => setF('date', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="ORGANIZER / EVENT" hint="e.g. Speed Ventures, OnGrid, SCCA, HOD">
            <input value={form.organizer} onChange={e => setF('organizer', e.target.value)}
              placeholder="trackday provider" style={inputStyle} />
          </Field>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 24 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 2, marginBottom: 16 }}>
            ▸ DRIVER & VEHICLE
          </div>
          <Field label="DRIVER NICKNAME">
            <input value={form.driver} onChange={e => setF('driver', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="VEHICLE (YEAR + MODEL)" hint="e.g. 2022 Corvette C8">
            <input value={form.car} onChange={e => setF('car', e.target.value)}
              placeholder="2023 GR86" style={inputStyle} />
          </Field>
          <Field label="WHEEL HORSEPOWER">
            <input value={form.hp} onChange={e => setF('hp', e.target.value)}
              placeholder="200" type="number" style={inputStyle} />
          </Field>
          <Field label="TIRE MODEL" hint="e.g. Nankang AR-1, RT660, RE71RS, V730">
            <input value={form.tire} onChange={e => setF('tire', e.target.value)}
              placeholder="brand + compound" style={inputStyle} />
          </Field>
          <Field label="AMBIENT TEMPERATURE" hint="any format — 72F, 22C, etc.">
            <input value={form.temp} onChange={e => setF('temp', e.target.value)}
              placeholder="72F" style={inputStyle} />
          </Field>
        </div>
      </div>

      {/* Image upload — full width */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 24, marginTop: 24 }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 2, marginBottom: 16 }}>
          ▸ PROOF OF LAP (OPTIONAL)
        </div>
        <Field label="UPLOAD IMAGE" hint="screenshot of timing display, in-car footage, dashboard, etc. — auto-compressed to ~1200px JPEG">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <label style={{
              flex: form.imageData ? '0 0 auto' : 1,
              padding: 14, background: C.bg, border: `1px dashed ${C.border}`,
              fontFamily: mono, fontSize: 11, color: C.textDim, letterSpacing: 1.5,
              cursor: 'pointer', textAlign: 'center', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
              <input type="file" accept="image/*" onChange={e => handleImage(e.target.files[0])}
                style={{ display: 'none' }} disabled={imageProcessing} />
              {imageProcessing ? 'PROCESSING…' : (form.imageData ? 'REPLACE IMAGE' : '+ SELECT IMAGE')}
            </label>
            {form.imageData && (
              <div style={{ position: 'relative', flex: 1 }}>
                <img src={form.imageData} alt="proof"
                  style={{ maxHeight: 200, maxWidth: '100%', border: `1px solid ${C.border}`, display: 'block' }} />
                <button type="button" onClick={() => setF('imageData', null)} style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'rgba(0,0,0,0.8)', border: `1px solid ${C.red}`,
                  color: C.red, padding: '4px 8px', fontFamily: mono, fontSize: 10
                }}>REMOVE</button>
              </div>
            )}
          </div>
          {imageError && (
            <div style={{ fontFamily: mono, fontSize: 10, color: C.red, marginTop: 6 }}>✕ {imageError}</div>
          )}
        </Field>
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: 14, border: `1px solid ${C.red}`,
          background: 'rgba(255,94,94,0.08)', fontFamily: mono, fontSize: 12, color: C.red
        }}>
          ✕ {error}
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button onClick={submit} disabled={imageProcessing} style={{
          flex: 1, padding: '16px', background: C.accent, color: C.bg, border: 'none',
          fontFamily: mono, fontSize: 12, letterSpacing: 3, fontWeight: 700
        }}>
          ⏱ SUBMIT FOR REVIEW →
        </button>
      </div>
    </div>
  );
}

// ============ ADMIN VIEW ============

function AdminView({
  pending, pendingLaps,
  approveUser, rejectUser, banUser, unbanUser,
  approvePendingLap, rejectPendingLap,
  users, laps, deleteLap, editLap,
  allTracks, customTracks, addTrack, deleteTrack,
  billboards, postBillboard, deleteBillboard,
  reports, resolveReportRemoveLap, dismissReport
}) {
  const [section, setSection] = useState('pending_laps');
  const [editingLap, setEditingLap] = useState(null);
  const [historyLap, setHistoryLap] = useState(null);

  const pendingUserList = Object.values(pending);
  const userList = Object.values(users);

  const sections = [
    { id: 'pending_laps', label: `LAP APPROVALS`, count: pendingLaps.length, hot: pendingLaps.length > 0 },
    { id: 'pending_users', label: `MEMBER APPLICATIONS`, count: pendingUserList.length, hot: pendingUserList.length > 0 },
    { id: 'reports', label: `REPORTS`, count: reports.length, hot: reports.length > 0 },
    { id: 'members', label: `MEMBERS`, count: userList.length },
    { id: 'laps', label: `ALL LAPS`, count: laps.length },
    { id: 'tracks', label: `TRACKS`, count: allTracks.length },
    { id: 'billboards', label: `BILLBOARDS`, count: billboards.length },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.accent, letterSpacing: 3, marginBottom: 4 }}>
          // RACE CONTROL
        </div>
        <h1 style={{ margin: 0, fontFamily: mono, fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: 1 }}>
          Admin Dashboard
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            padding: '10px 14px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${section === s.id ? C.accent : 'transparent'}`,
            color: section === s.id ? C.accent : C.textDim,
            fontFamily: mono, fontSize: 11, letterSpacing: 1.5,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            {s.label}
            <span style={{
              background: s.hot ? C.accent : C.borderLight,
              color: s.hot ? C.bg : C.textDim,
              padding: '1px 6px', fontSize: 9, fontWeight: s.hot ? 700 : 400
            }}>{s.count}</span>
          </button>
        ))}
      </div>

      {section === 'pending_laps' && (
        <PendingLapsPanel
          pendingLaps={pendingLaps}
          allTracks={allTracks}
          onApprove={approvePendingLap}
          onReject={rejectPendingLap}
        />
      )}

      {section === 'pending_users' && (
        <PendingUsersPanel
          pending={pendingUserList}
          onApprove={approveUser}
          onReject={rejectUser}
        />
      )}

      {section === 'reports' && (
        <ReportsPanel
          reports={reports}
          laps={laps}
          users={users}
          allTracks={allTracks}
          onResolveRemove={resolveReportRemoveLap}
          onDismiss={dismissReport}
        />
      )}

      {section === 'members' && (
        <MembersPanel
          users={userList}
          laps={laps}
          onBan={banUser}
          onUnban={unbanUser}
        />
      )}

      {section === 'laps' && (
        <AllLapsPanel
          laps={laps}
          allTracks={allTracks}
          onDelete={deleteLap}
          onEdit={(lap) => setEditingLap(lap)}
          onViewHistory={(lap) => setHistoryLap(lap)}
        />
      )}

      {section === 'tracks' && (
        <TracksPanel
          allTracks={allTracks}
          customTracks={customTracks}
          laps={laps}
          onAdd={addTrack}
          onDelete={deleteTrack}
        />
      )}

      {section === 'billboards' && (
        <BillboardsPanel
          billboards={billboards}
          onPost={postBillboard}
          onDelete={deleteBillboard}
        />
      )}

      {editingLap && (
        <EditLapModal
          lap={editingLap}
          allTracks={allTracks}
          onClose={() => setEditingLap(null)}
          onSave={(updates) => {
            editLap(editingLap._key, updates);
            setEditingLap(null);
          }}
        />
      )}

      {historyLap && (
        <HistoryModal
          lap={historyLap}
          allTracks={allTracks}
          onClose={() => setHistoryLap(null)}
        />
      )}
    </div>
  );
}

function PendingLapsPanel({ pendingLaps, allTracks, onApprove, onReject }) {
  if (pendingLaps.length === 0) {
    return <Empty message="NO LAP SUBMISSIONS AWAITING REVIEW" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pendingLaps.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)).map(l => {
        const t = allTracks.find(x => x.id === l.track);
        return (
          <div key={l._key} style={{
            background: C.panel, border: `1px solid ${C.border}`, padding: 18,
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>
                  {l.time}
                </div>
                <div style={{ fontFamily: mono, fontSize: 14, color: C.text }}>{l.driver}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.textDim }}>
                  {t?.name} {t?.variant}
                </div>
                <div style={{
                  fontFamily: mono, fontSize: 9, padding: '2px 6px', letterSpacing: 1,
                  border: `1px solid ${l.type === 'optimal' ? C.accent : C.borderLight}`,
                  color: l.type === 'optimal' ? C.accent : C.textDim
                }}>
                  {l.type === 'optimal' ? 'OPT' : 'REAL'}
                </div>
                <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, marginLeft: 'auto' }}>
                  submitted @{l.submittedBy} · {new Date(l.submittedAt).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, fontFamily: mono, fontSize: 11 }}>
                <LapInfo label="VEHICLE" value={l.car} />
                <LapInfo label="HP" value={l.hp || '—'} />
                <LapInfo label="TIRE" value={l.tire} />
                <LapInfo label="TEMP" value={l.temp} />
                <LapInfo label="DATE" value={l.date || '—'} />
                <LapInfo label="EVENT" value={l.organizer || '—'} />
              </div>
              {l.imageData && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, letterSpacing: 1.5, marginBottom: 6 }}>PROOF</div>
                  <a href={l.imageData} target="_blank" rel="noreferrer">
                    <img src={l.imageData} alt="proof"
                      style={{ maxHeight: 160, maxWidth: '100%', border: `1px solid ${C.border}`, display: 'block' }} />
                  </a>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => onApprove(l._key)} style={{
                padding: '10px 18px', background: C.accent, color: C.bg, border: 'none',
                fontFamily: mono, fontSize: 11, letterSpacing: 1.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <Check size={12} strokeWidth={3} /> APPROVE
              </button>
              <button onClick={() => onReject(l._key)} style={{
                padding: '10px 18px', background: 'transparent', color: C.red,
                border: `1px solid ${C.red}`, fontFamily: mono, fontSize: 11, letterSpacing: 1.5,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <X size={12} strokeWidth={3} /> REJECT
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LapInfo({ label, value }) {
  return (
    <div>
      <div style={{ color: C.textFaint, letterSpacing: 1.5, marginBottom: 2 }}>{label}</div>
      <div style={{ color: C.textDim }}>{value}</div>
    </div>
  );
}

function PendingUsersPanel({ pending, onApprove, onReject }) {
  if (pending.length === 0) return <Empty message="NO PENDING APPLICATIONS" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pending.map(p => (
        <div key={p.username} style={{
          background: C.panel, border: `1px solid ${C.border}`,
          padding: 20, display: 'flex', alignItems: 'flex-start', gap: 20
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
              <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: C.text }}>
                {p.nickname}
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: C.textDim }}>@{p.username}</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, marginLeft: 'auto' }}>
                {new Date(p.submittedAt).toLocaleString()}
              </div>
            </div>
            {p.reason && (
              <div style={{ fontFamily: mono, fontSize: 12, color: C.textDim, padding: 12, background: C.bg, border: `1px solid ${C.border}`, lineHeight: 1.5 }}>
                "{p.reason}"
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => onApprove(p.username)} style={{
              padding: '10px 16px', background: C.accent, color: C.bg, border: 'none',
              fontFamily: mono, fontSize: 11, letterSpacing: 1.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <Check size={12} strokeWidth={3} /> APPROVE
            </button>
            <button onClick={() => onReject(p.username)} style={{
              padding: '10px 16px', background: 'transparent', color: C.red,
              border: `1px solid ${C.red}`, fontFamily: mono, fontSize: 11, letterSpacing: 1.5,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <X size={12} strokeWidth={3} /> REJECT
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MembersPanel({ users, laps, onBan, onUnban }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
        <thead>
          <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
            <Th>USERNAME</Th>
            <Th>NICKNAME</Th>
            <Th>ROLE</Th>
            <Th>STATUS</Th>
            <Th>LAPS</Th>
            <Th>JOINED</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.username} style={{ borderBottom: `1px solid ${C.border}` }}>
              <Td>@{u.username}</Td>
              <Td>{u.nickname}</Td>
              <Td>
                <span style={{ color: u.role === 'admin' ? C.accent : C.textDim, fontSize: 10, letterSpacing: 1.5 }}>
                  {u.role === 'admin' ? '◆ ADMIN' : '◇ MEMBER'}
                </span>
              </Td>
              <Td>
                {u.banned
                  ? <span style={{ color: C.red, fontSize: 10, letterSpacing: 1.5 }}>✕ BANNED</span>
                  : <span style={{ color: C.green, fontSize: 10, letterSpacing: 1.5 }}>● ACTIVE</span>}
              </Td>
              <Td>{laps.filter(l => l.submittedBy === u.username).length}</Td>
              <Td><span style={{ color: C.textFaint }}>{u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : '—'}</span></Td>
              <Td>
                {u.role !== 'admin' && (
                  u.banned
                    ? <button onClick={() => onUnban(u.username)} style={{
                        background: 'transparent', border: `1px solid ${C.green}`,
                        color: C.green, padding: '4px 10px', fontFamily: mono, fontSize: 10, letterSpacing: 1
                      }}>UNBAN</button>
                    : <button onClick={() => { if (confirm(`Ban ${u.nickname}? They won't be able to log in.`)) onBan(u.username); }} style={{
                        background: 'transparent', border: `1px solid ${C.red}`,
                        color: C.red, padding: '4px 10px', fontFamily: mono, fontSize: 10, letterSpacing: 1,
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}><Ban size={10} /> BAN</button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllLapsPanel({ laps, allTracks, onDelete, onEdit, onViewHistory }) {
  const [trackFilter, setTrackFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let f = laps;
    if (trackFilter !== 'all') f = f.filter(l => l.track === trackFilter);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(l => l.driver.toLowerCase().includes(q) || l.car.toLowerCase().includes(q));
    }
    return f.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  }, [laps, trackFilter, search]);

  const handleExport = () => {
    // Flatten laps for CSV (exclude binary imageData, include track name)
    const rows = filtered.map(l => {
      const t = allTracks.find(x => x.id === l.track);
      return {
        driver: l.driver,
        track: t ? t.name : l.track,
        variant: t ? t.variant : '',
        region: t ? t.region : '',
        time: l.time,
        type: l.type,
        car: l.car,
        hp: l.hp || '',
        tire: l.tire,
        temp: l.temp,
        date: l.date || '',
        organizer: l.organizer || '',
        submittedBy: l.submittedBy || '',
        submittedAt: l.submittedAt ? new Date(l.submittedAt).toISOString() : '',
        approvedBy: l.approvedBy || '',
        approvedAt: l.approvedAt ? new Date(l.approvedAt).toISOString() : '',
        editedBy: l.editedBy || '',
        editedAt: l.editedAt ? new Date(l.editedAt).toISOString() : '',
        editCount: Array.isArray(l.history) ? l.history.length : 0,
        hasImage: l.imageData ? 'yes' : 'no',
      };
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = trackFilter === 'all' ? 'all' : (allTracks.find(t => t.id === trackFilter)?.name || 'filtered').toLowerCase().replace(/\W+/g, '_');
    exportCSV(rows, `spinout_laps_${scope}_${stamp}.csv`);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="search driver or car…"
          style={{ ...inputStyle, maxWidth: 300 }} />
        <select value={trackFilter} onChange={e => setTrackFilter(e.target.value)}
          style={{ ...inputStyle, maxWidth: 280 }}>
          <option value="all">All tracks ({laps.length})</option>
          {allTracks.map(t => {
            const n = laps.filter(l => l.track === t.id).length;
            return <option key={t.id} value={t.id}>{t.name} {t.variant} ({n})</option>;
          })}
        </select>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.textFaint }}>
          {filtered.length} results
        </span>
        <button onClick={handleExport} disabled={filtered.length === 0} style={{
          marginLeft: 'auto', padding: '8px 14px', background: 'transparent',
          border: `1px solid ${C.accent}`, color: C.accent,
          fontFamily: mono, fontSize: 11, letterSpacing: 1.5, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 6
        }}>
          ↓ EXPORT CSV
        </button>
      </div>

      <div style={{ border: `1px solid ${C.border}`, overflow: 'auto', maxHeight: 640 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 11 }}>
          <thead>
            <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 1 }}>
              <Th>DRIVER</Th>
              <Th>TRACK</Th>
              <Th>TIME</Th>
              <Th>CAR</Th>
              <Th>TIRE</Th>
              <Th>DATE</Th>
              <Th>TYPE</Th>
              <Th>BY</Th>
              <Th>EDITS</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const t = allTracks.find(x => x.id === l.track);
              const editCount = Array.isArray(l.history) ? l.history.length : 0;
              return (
                <tr key={l._key} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <Td>{l.driver}</Td>
                  <Td><span style={{ color: C.textDim }}>{t?.name} {t?.variant}</span></Td>
                  <Td><span style={{ color: C.accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{l.time}</span></Td>
                  <Td><span style={{ color: C.textDim }}>{l.car}</span></Td>
                  <Td><span style={{ color: C.textFaint }}>{l.tire}</span></Td>
                  <Td><span style={{ color: C.textFaint }}>{l.date || '—'}</span></Td>
                  <Td>
                    <span style={{
                      fontSize: 9, padding: '1px 5px',
                      border: `1px solid ${l.type === 'optimal' ? C.accent : C.borderLight}`,
                      color: l.type === 'optimal' ? C.accent : C.textDim
                    }}>{l.type === 'optimal' ? 'OPT' : 'REAL'}</span>
                  </Td>
                  <Td><span style={{ color: C.textFaint }}>@{l.submittedBy}</span></Td>
                  <Td>
                    {editCount > 0 ? (
                      <button onClick={() => onViewHistory(l)} style={{
                        background: 'transparent', border: `1px solid ${C.accentDim}`,
                        color: C.accent, padding: '2px 6px', fontFamily: mono, fontSize: 9,
                        fontVariantNumeric: 'tabular-nums'
                      }}>{editCount}× ▸</button>
                    ) : (
                      <span style={{ color: C.textFaint }}>—</span>
                    )}
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => onEdit(l)} style={{
                        background: 'transparent', border: `1px solid ${C.border}`,
                        color: C.blue, padding: '3px 7px', fontFamily: mono, fontSize: 9,
                        display: 'inline-flex', alignItems: 'center', gap: 3
                      }}><Edit2 size={9} /> EDIT</button>
                      <button onClick={() => { if (confirm(`Delete ${l.driver}'s ${l.time} lap?`)) onDelete(l._key); }} style={{
                        background: 'transparent', border: `1px solid ${C.border}`,
                        color: C.red, padding: '3px 7px', fontFamily: mono, fontSize: 9
                      }}>DEL</button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsPanel({ reports, laps, users, allTracks, onResolveRemove, onDismiss }) {
  if (reports.length === 0) {
    return <Empty message="NO PENDING REPORTS" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {reports.map(r => {
        const lap = laps.find(l => l._key === r.lapKey);
        const snap = r.lapSnapshot || {};
        const t = allTracks.find(x => x.id === (lap?.track || snap.track));
        const reporterInfo = users[r.reporter];
        const lapStillExists = !!lap;
        return (
          <div key={r._key} style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.red}`, padding: 18,
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 18
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                <Flag size={14} color={C.red} strokeWidth={2.5} />
                <div style={{ fontFamily: mono, fontSize: 13, color: C.text, fontWeight: 700 }}>
                  Reported lap
                </div>
                <div style={{
                  fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.accent, fontVariantNumeric: 'tabular-nums'
                }}>
                  {lap?.time || snap.time}
                </div>
                <div style={{ fontFamily: mono, fontSize: 12, color: C.text }}>
                  {lap?.driver || snap.driver}
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.textDim }}>
                  {t?.name} {t?.variant}
                </div>
                <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, marginLeft: 'auto' }}>
                  {new Date(r.reportedAt).toLocaleString()}
                </div>
              </div>
              <div style={{
                background: C.bg, border: `1px solid ${C.border}`, padding: 12, marginBottom: 10,
                fontFamily: mono, fontSize: 12, color: C.textDim, lineHeight: 1.5
              }}>
                "{r.reason}"
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, display: 'flex', gap: 16 }}>
                <span>REPORTED BY: <span style={{ color: C.textDim }}>{r.reporterName} (@{r.reporter})</span></span>
                <span>SUBMITTED BY: <span style={{ color: C.textDim }}>@{lap?.submittedBy || snap.submittedBy || '—'}</span></span>
                {lap && <span>CAR: <span style={{ color: C.textDim }}>{lap.car}</span></span>}
                {!lapStillExists && <span style={{ color: C.red }}>● LAP ALREADY DELETED</span>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lapStillExists && (
                <button onClick={() => { if (confirm(`Delete this lap and resolve all reports on it?`)) onResolveRemove(r._key, r.lapKey); }} style={{
                  padding: '10px 16px', background: C.red, color: '#fff', border: 'none',
                  fontFamily: mono, fontSize: 11, letterSpacing: 1.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <X size={12} strokeWidth={3} /> REMOVE LAP
                </button>
              )}
              <button onClick={() => onDismiss(r._key)} style={{
                padding: '10px 16px', background: 'transparent', color: C.textDim,
                border: `1px solid ${C.border}`, fontFamily: mono, fontSize: 11, letterSpacing: 1.5,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <Check size={12} strokeWidth={3} /> DISMISS
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryModal({ lap, allTracks, onClose }) {
  const history = Array.isArray(lap.history) ? [...lap.history].reverse() : [];
  const t = allTracks.find(x => x.id === lap.track);

  const fmtValue = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…';
    return String(v);
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.panel, border: `1px solid ${C.border}`,
        maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto'
      }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, color: C.accent, letterSpacing: 3 }}>// EDIT HISTORY</div>
            <div style={{ fontFamily: mono, fontSize: 16, color: C.text, marginTop: 4 }}>
              {lap.driver} · <span style={{ color: C.accent }}>{lap.time}</span> · {t?.name} {t?.variant}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: C.textDim, padding: 4
          }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24 }}>
          {history.length === 0 ? (
            <Empty message="NO EDITS RECORDED" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {history.map((h, idx) => (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14,
                  padding: '12px 0', borderBottom: idx < history.length - 1 ? `1px solid ${C.border}` : 'none',
                  alignItems: 'baseline'
                }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, letterSpacing: 1.5, minWidth: 80 }}>
                    {h.field.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 12 }}>
                    <span style={{ color: C.red, textDecoration: 'line-through' }}>{fmtValue(h.oldValue)}</span>
                    <span style={{ color: C.textFaint, margin: '0 8px' }}>→</span>
                    <span style={{ color: C.green }}>{fmtValue(h.newValue)}</span>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, textAlign: 'right' }}>
                    <div>@{h.by}</div>
                    <div>{new Date(h.at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`,
          fontFamily: mono, fontSize: 10, color: C.textFaint, letterSpacing: 1.5 }}>
          {history.length} edit{history.length === 1 ? '' : 's'} · originally submitted by @{lap.submittedBy} on {lap.submittedAt ? new Date(lap.submittedAt).toLocaleString() : '—'}
        </div>
      </div>
    </div>
  );
}

function EditLapModal({ lap, allTracks, onClose, onSave }) {
  const [form, setForm] = useState({ ...lap });
  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.panel, border: `1px solid ${C.accent}`,
        maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
      }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, color: C.accent, letterSpacing: 3 }}>// EDIT LAP</div>
            <div style={{ fontFamily: mono, fontSize: 16, color: C.text, marginTop: 4 }}>{lap.driver} · {lap.time}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: C.textDim, padding: 4
          }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="DRIVER"><input value={form.driver || ''} onChange={e => setF('driver', e.target.value)} style={inputStyle} /></Field>
          <Field label="TIME (M:SS.xx)"><input value={form.time || ''} onChange={e => setF('time', e.target.value)} style={inputStyle} /></Field>
          <Field label="TRACK">
            <select value={form.track} onChange={e => setF('track', e.target.value)} style={inputStyle}>
              {allTracks.map(t => <option key={t.id} value={t.id}>{t.name} — {t.variant}</option>)}
            </select>
          </Field>
          <Field label="TYPE">
            <select value={form.type} onChange={e => setF('type', e.target.value)} style={inputStyle}>
              <option value="real">REAL LAP</option>
              <option value="optimal">OPTIMAL</option>
            </select>
          </Field>
          <Field label="VEHICLE"><input value={form.car || ''} onChange={e => setF('car', e.target.value)} style={inputStyle} /></Field>
          <Field label="HP"><input type="number" value={form.hp || ''} onChange={e => setF('hp', parseInt(e.target.value) || 0)} style={inputStyle} /></Field>
          <Field label="TIRE"><input value={form.tire || ''} onChange={e => setF('tire', e.target.value)} style={inputStyle} /></Field>
          <Field label="TEMP"><input value={form.temp || ''} onChange={e => setF('temp', e.target.value)} style={inputStyle} /></Field>
          <Field label="DATE (YYYY-MM-DD)"><input value={form.date || ''} onChange={e => setF('date', e.target.value)} style={inputStyle} /></Field>
          <Field label="ORGANIZER"><input value={form.organizer || ''} onChange={e => setF('organizer', e.target.value)} style={inputStyle} /></Field>
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 18px', background: 'transparent', border: `1px solid ${C.border}`,
            color: C.textDim, fontFamily: mono, fontSize: 11, letterSpacing: 1.5
          }}>CANCEL</button>
          <button onClick={() => onSave(form)} style={{
            padding: '10px 18px', background: C.accent, color: C.bg, border: 'none',
            fontFamily: mono, fontSize: 11, letterSpacing: 1.5, fontWeight: 700
          }}>SAVE CHANGES</button>
        </div>
      </div>
    </div>
  );
}

function TracksPanel({ allTracks, customTracks, laps, onAdd, onDelete }) {
  const [name, setName] = useState('');
  const [variant, setVariant] = useState('');
  const [region, setRegion] = useState('SoCal');

  const submit = () => {
    if (!name.trim() || !region.trim()) return;
    onAdd({ name: name.trim(), variant: variant.trim(), region: region.trim() });
    setName(''); setVariant('');
  };

  const customIds = new Set(customTracks.map(t => t.id));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 20, height: 'fit-content' }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 2, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={12} strokeWidth={2.5} /> ▸ ADD NEW TRACK
        </div>
        <Field label="TRACK NAME">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Willow Springs" style={inputStyle} />
        </Field>
        <Field label="VARIANT / DIRECTION" hint="optional — e.g. CW, CCW, Short Course">
          <input value={variant} onChange={e => setVariant(e.target.value)} placeholder="—" style={inputStyle} />
        </Field>
        <Field label="REGION">
          <input value={region} onChange={e => setRegion(e.target.value)} placeholder="SoCal" style={inputStyle} />
        </Field>
        <button onClick={submit} style={{
          width: '100%', padding: '12px', background: C.accent, color: C.bg, border: 'none',
          fontFamily: mono, fontSize: 11, letterSpacing: 2, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
          <Plus size={12} strokeWidth={3} /> ADD TRACK
        </button>
      </div>

      <div style={{ border: `1px solid ${C.border}`, overflow: 'auto', maxHeight: 600 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
              <Th>TRACK</Th>
              <Th>VARIANT</Th>
              <Th>REGION</Th>
              <Th>LAPS</Th>
              <Th>SOURCE</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {allTracks.map(t => (
              <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <Td>{t.name}</Td>
                <Td><span style={{ color: C.textDim }}>{t.variant}</span></Td>
                <Td><span style={{ color: C.textFaint }}>{t.region}</span></Td>
                <Td><span style={{ fontVariantNumeric: 'tabular-nums' }}>{laps.filter(l => l.track === t.id).length}</span></Td>
                <Td>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', letterSpacing: 1,
                    border: `1px solid ${customIds.has(t.id) ? C.green : C.borderLight}`,
                    color: customIds.has(t.id) ? C.green : C.textFaint
                  }}>
                    {customIds.has(t.id) ? 'CUSTOM' : 'BUILT-IN'}
                  </span>
                </Td>
                <Td>
                  {customIds.has(t.id) && (
                    <button onClick={() => { if (confirm(`Delete ${t.name} ${t.variant}?`)) onDelete(t.id); }} style={{
                      background: 'transparent', border: `1px solid ${C.border}`,
                      color: C.red, padding: '3px 7px', fontFamily: mono, fontSize: 9
                    }}>DEL</button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BillboardsPanel({ billboards, onPost, onDelete }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);

  const submit = () => {
    if (!title.trim() || !body.trim()) return;
    onPost({ title: title.trim(), body: body.trim(), pinned });
    setTitle(''); setBody(''); setPinned(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 20, height: 'fit-content' }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 2, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 6 }}>
          <Megaphone size={12} strokeWidth={2.5} /> ▸ NEW ANNOUNCEMENT
        </div>
        <Field label="TITLE">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Next event details" style={inputStyle} />
        </Field>
        <Field label="MESSAGE">
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
            placeholder="Announcement body, links, instructions…"
            style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer',
          fontFamily: mono, fontSize: 11, color: C.textDim, letterSpacing: 1.5
        }}>
          <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)}
            style={{ accentColor: C.accent }} />
          <Pin size={11} strokeWidth={2.5} color={pinned ? C.accent : C.textFaint} />
          PIN TO TOP
        </label>
        <button onClick={submit} style={{
          width: '100%', padding: '12px', background: C.accent, color: C.bg, border: 'none',
          fontFamily: mono, fontSize: 11, letterSpacing: 2, fontWeight: 700
        }}>
          POST ANNOUNCEMENT →
        </button>
      </div>

      <div>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.textDim, letterSpacing: 2, marginBottom: 10 }}>
          // POSTED ({billboards.length})
        </div>
        {billboards.length === 0 ? (
          <Empty message="NO ANNOUNCEMENTS YET" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {billboards.map(b => (
              <div key={b._key} style={{
                background: C.panel, border: `1px solid ${b.pinned ? C.accentDim : C.border}`,
                borderLeft: `3px solid ${b.pinned ? C.accent : C.borderLight}`,
                padding: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  {b.pinned && <Pin size={11} color={C.accent} strokeWidth={2.5} />}
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.text }}>
                    {b.title}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, marginLeft: 'auto' }}>
                    {new Date(b.postedAt).toLocaleString()} · @{b.postedBy}
                  </div>
                  <button onClick={() => { if (confirm('Delete this announcement?')) onDelete(b._key); }} style={{
                    background: 'transparent', border: `1px solid ${C.border}`,
                    color: C.red, padding: '3px 7px', fontFamily: mono, fontSize: 9
                  }}>DEL</button>
                </div>
                <div style={{ fontFamily: sans, fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
                  {b.body}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ message }) {
  return (
    <div style={{
      border: `1px dashed ${C.border}`, padding: 60, textAlign: 'center',
      fontFamily: mono, fontSize: 11, color: C.textFaint, letterSpacing: 2
    }}>
      ◇ {message}
    </div>
  );
}

// ============ PROFILE VIEW ============

function ProfileView({ session, laps, pendingLaps, users, allTracks, onChangePassword }) {
  const [tab, setTab] = useState('bests');
  const myLaps = laps.filter(l => l.submittedBy === session.username);
  const myPending = pendingLaps.filter(l => l.submittedBy === session.username);

  const lapsByTrack = {};
  myLaps.forEach(l => {
    if (!lapsByTrack[l.track] || parseTime(l.time) < parseTime(lapsByTrack[l.track].time)) {
      lapsByTrack[l.track] = l;
    }
  });
  const personalBests = Object.values(lapsByTrack);

  const podiums = { p1: 0, p2: 0, p3: 0 };
  Object.entries(lapsByTrack).forEach(([trackId, lap]) => {
    const allOnTrack = laps.filter(l => l.track === trackId);
    const byDriver = {};
    allOnTrack.forEach(l => {
      const k = l.driver.toLowerCase();
      if (!byDriver[k] || parseTime(l.time) < parseTime(byDriver[k].time)) byDriver[k] = l;
    });
    const sorted = Object.values(byDriver).sort((a, b) => parseTime(a.time) - parseTime(b.time));
    const myIdx = sorted.findIndex(l => l.driver.toLowerCase() === lap.driver.toLowerCase());
    if (myIdx === 0) podiums.p1++;
    else if (myIdx === 1) podiums.p2++;
    else if (myIdx === 2) podiums.p3++;
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, letterSpacing: 3, marginBottom: 4 }}>
          // DRIVER PROFILE
        </div>
        <h1 style={{ margin: 0, fontFamily: mono, fontSize: 32, fontWeight: 700, color: C.text, letterSpacing: 1 }}>
          {session.nickname}
        </h1>
        <div style={{ fontFamily: mono, fontSize: 12, color: C.textDim, marginTop: 4 }}>
          @{session.username}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        <StatBlock label="TOTAL LAPS" value={myLaps.length} />
        <StatBlock label="POLES" value={podiums.p1} accent />
        <StatBlock label="P2 FINISHES" value={podiums.p2} />
        <StatBlock label="P3 FINISHES" value={podiums.p3} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {[
          { id: 'bests', label: 'PERSONAL BESTS' },
          { id: 'pending', label: `MY PENDING (${myPending.length})` },
          { id: 'settings', label: 'SETTINGS' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`,
            color: tab === t.id ? C.accent : C.textDim,
            fontFamily: mono, fontSize: 11, letterSpacing: 2
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bests' && (
        personalBests.length === 0 ? (
          <Empty message="NO APPROVED LAPS YET — HIT THE TRACK" />
        ) : (
          <div style={{ border: `1px solid ${C.border}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
                  <Th>CIRCUIT</Th>
                  <Th>BEST TIME</Th>
                  <Th>VEHICLE</Th>
                  <Th>TIRE</Th>
                  <Th>DATE</Th>
                  <Th>POS</Th>
                </tr>
              </thead>
              <tbody>
                {personalBests.map(lap => {
                  const t = allTracks.find(x => x.id === lap.track);
                  const all = laps.filter(l => l.track === lap.track);
                  const byDriver = {};
                  all.forEach(l => {
                    const k = l.driver.toLowerCase();
                    if (!byDriver[k] || parseTime(l.time) < parseTime(byDriver[k].time)) byDriver[k] = l;
                  });
                  const sorted = Object.values(byDriver).sort((a, b) => parseTime(a.time) - parseTime(b.time));
                  const idx = sorted.findIndex(l => l.driver.toLowerCase() === lap.driver.toLowerCase()) + 1;
                  return (
                    <tr key={lap._key} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <Td>{t?.name} <span style={{ color: C.textFaint }}>{t?.variant}</span></Td>
                      <Td><span style={{ color: C.accent, fontWeight: 700 }}>{lap.time}</span></Td>
                      <Td><span style={{ color: C.textDim }}>{lap.car}</span></Td>
                      <Td><span style={{ color: C.textDim }}>{lap.tire}</span></Td>
                      <Td><span style={{ color: C.textFaint }}>{lap.date || '—'}</span></Td>
                      <Td>
                        <span style={{ color: idx === 1 ? C.accent : idx <= 3 ? C.text : C.textDim, fontWeight: idx === 1 ? 700 : 400 }}>
                          P{idx} / {sorted.length}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'pending' && (
        myPending.length === 0 ? (
          <Empty message="NO PENDING SUBMISSIONS" />
        ) : (
          <div style={{ border: `1px solid ${C.border}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
                  <Th>CIRCUIT</Th>
                  <Th>TIME</Th>
                  <Th>VEHICLE</Th>
                  <Th>SUBMITTED</Th>
                  <Th>STATUS</Th>
                </tr>
              </thead>
              <tbody>
                {myPending.map(lap => {
                  const t = allTracks.find(x => x.id === lap.track);
                  return (
                    <tr key={lap._key} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <Td>{t?.name} <span style={{ color: C.textFaint }}>{t?.variant}</span></Td>
                      <Td><span style={{ color: C.accent, fontWeight: 700 }}>{lap.time}</span></Td>
                      <Td><span style={{ color: C.textDim }}>{lap.car}</span></Td>
                      <Td><span style={{ color: C.textFaint }}>{new Date(lap.submittedAt).toLocaleString()}</span></Td>
                      <Td>
                        <span style={{
                          fontSize: 10, padding: '2px 6px', letterSpacing: 1.5,
                          border: `1px solid ${C.accent}`, color: C.accent
                        }}>⏳ AWAITING REVIEW</span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'settings' && (
        <SettingsPanel onChangePassword={onChangePassword} hasPassword={session.has_password} />
      )}
    </div>
  );
}

function SettingsPanel({ onChangePassword, hasPassword }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!oldPw || !newPw || !confirmPw) {
      setError('All fields required');
      return;
    }
    if (newPw !== confirmPw) {
      setError('New passwords do not match');
      return;
    }
    if (newPw.length < 12) {
      setError('New password must be at least 12 characters');
      return;
    }
    const ok = await onChangePassword(oldPw, newPw);
    if (ok) {
      setOldPw(''); setNewPw(''); setConfirmPw('');
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{marginBottom:24,padding:24,border:`1px solid ${C.border}`}}>
        <h3 style={{fontSize:14}}>Sign in with Google</h3>
        <p style={{fontSize:12,color:C.textDim,lineHeight:1.7}}>Link Google while signed in to keep this membership and all your lap history.</p>
        <GoogleButton link onError={setError} />
      </div>
      {hasPassword && <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 24 }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 2, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={12} strokeWidth={2.5} /> ▸ CHANGE PASSWORD
        </div>
        <div onKeyDown={(e) => e.key === 'Enter' && submit()}>
          <Field label="CURRENT PASSWORD">
            <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="NEW PASSWORD" hint="at least 12 characters">
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="CONFIRM NEW PASSWORD">
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inputStyle} />
          </Field>
          {error && (
            <div style={{
              marginBottom: 16, padding: 12, border: `1px solid ${C.red}`,
              background: 'rgba(255,94,94,0.08)', fontFamily: mono, fontSize: 11, color: C.red
            }}>
              ✕ {error}
            </div>
          )}
          <button onClick={submit} style={{
            width: '100%', padding: '12px', background: C.accent, color: C.bg, border: 'none',
            fontFamily: mono, fontSize: 11, letterSpacing: 2, fontWeight: 700
          }}>
            UPDATE PASSWORD →
          </button>
        </div>
      </div>}
      {!hasPassword && <p style={{color:C.textDim,fontSize:12}}>Use your verified Google account or email sign-in link. No club password is required.</p>}
    </div>
  );
}

function StatBlock({ label, value, accent }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 20 }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: C.textDim, letterSpacing: 2, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontFamily: mono, fontSize: 32, fontWeight: 700,
        color: accent ? C.accent : C.text, fontVariantNumeric: 'tabular-nums'
      }}>
        {value}
      </div>
    </div>
  );
}
