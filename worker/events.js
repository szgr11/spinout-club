import { load } from 'cheerio/slim';

export const SOURCES = [
  { id: 'speedventures', name: 'Speed Ventures', url: 'https://www.speedventures.com/events/Default.aspx' },
  { id: 'speedsf', name: 'SpeedSF', url: 'https://www.speedsf.com/events-registration/' },
  { id: 'buttonwillow', name: 'Buttonwillow Raceway', url: 'https://buttonwillowraceway.com/events/' },
];
const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
export const todayPacific = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export function safeURL(value, base) {
  try { const u = new URL(value, base); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
function trackInfo(text) {
  const t = text.toLowerCase();
  if (/buttonwillow/.test(t)) return { track: /circuit/.test(t) ? 'Buttonwillow · Circuit' : /classic/.test(t) ? 'Buttonwillow · Classic' : 'Buttonwillow', region: 'SoCal' };
  if (/chuckwalla/.test(t)) return { track: 'Chuckwalla', region: 'SoCal' };
  if (/streets/.test(t)) return { track: 'Streets of Willow', region: 'SoCal' };
  if (/willow/.test(t)) return { track: 'Big Willow', region: 'SoCal' };
  if (/laguna|weathertech/.test(t)) return { track: 'Laguna Seca', region: 'NorCal' };
  if (/sonoma/.test(t)) return { track: 'Sonoma', region: 'NorCal' };
  if (/thunderhill/.test(t)) return { track: 'Thunderhill', region: 'NorCal' };
  if (/spring mountain/.test(t)) return { track: 'Spring Mountain', region: 'Nevada' };
  if (/las vegas/.test(t)) return { track: 'Las Vegas Motor Speedway', region: 'Nevada' };
  return null;
}
export function parseDateRange(label, year) {
  const m = clean(label).match(/([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–—&]\s*(?:([A-Za-z]+)\s*)?(\d{1,2}))?/);
  if (!m) return [];
  const startMonth = months.indexOf(m[1].toLowerCase().slice(0,3));
  const endMonth = m[3] ? months.indexOf(m[3].toLowerCase().slice(0,3)) : startMonth;
  if (startMonth < 0 || endMonth < 0) return [];
  const start = new Date(Date.UTC(year, startMonth, Number(m[2])));
  const end = new Date(Date.UTC(year + (endMonth < startMonth ? 1 : 0), endMonth, Number(m[4] || m[2])));
  if (start.getUTCMonth() !== startMonth || end.getUTCMonth() !== endMonth) return [];
  const dates = [];
  for (let d = start; d <= end && dates.length < 10; d = new Date(+d + 86400000)) dates.push(d.toISOString().slice(0,10));
  return dates;
}
const kindOf = (text) => /open test|test.?and.?tune|test & tune|open practice/i.test(text) ? 'Open practice' : /autox|autocross/i.test(text) ? 'Autocross' : /time attack|time trial|challenge/i.test(text) ? 'Track day / time trial' : 'Track day';
function makeEvent({ title, date, venue, organizer, url, source, kind, note }) {
  const info = trackInfo(venue);
  if (!info || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !safeURL(url)) return null;
  return { title: clean(title).slice(0,180), date, ...info, organizer: clean(organizer), url: safeURL(url), kind: kind || kindOf(title), note: clean(note).slice(0,220), sources: [{ id: source.id, name: source.name, url: source.url }], checkedAt: new Date().toISOString() };
}
export function parseSpeedVentures(html) {
  const $ = load(html); const events = []; const source = SOURCES[0];
  $('#getonthetrack a.absolutelink').each((_, a) => {
    const card = $(a).parent(); const title = clean(card.find('h4').text());
    const dateText = clean(card.find('span').filter((_, e) => /\b20\d{2}\b/.test($(e).text())).first().text());
    const year = Number(dateText.match(/20\d{2}/)?.[0]);
    for (const date of parseDateRange(dateText, year)) events.push(makeEvent({ title: `${title} · Speed Ventures`, date, venue: title, organizer: 'Speed Ventures', url: safeURL($(a).attr('href'), source.url), source }));
  });
  return events.filter(Boolean);
}
export function parseSpeedSF(html, year) {
  const $ = load(html); const events = []; const source = SOURCES[1];
  $('.ssf-card').each((_, a) => {
    const card = $(a); const title = clean(card.find('.ssf-card-title').text());
    const venue = clean(card.find('.ssf-card-venue').text()) || title;
    if (/drift|slip happens/i.test(title)) return;
    const registrations = card.find('.ssf-reg-btn');
    const hpde = registrations.filter((_, a) => /hpde|register/i.test($(a).text())).first();
    const link = hpde.length ? hpde : registrations.first();
    const url = safeURL(link.attr('href'), source.url);
    if (!url) return;
    for (const date of parseDateRange(card.find('.ssf-card-date').text(), year)) events.push(makeEvent({ title: `${title} · SpeedSF`, date, venue, organizer: 'SpeedSF', url, source, kind: hpde.length ? 'Track day' : kindOf(card.text()) }));
  });
  return events.filter(Boolean);
}
export function parseButtonwillow(data) {
  const source = SOURCES[2];
  if (!Array.isArray(data.events)) throw new Error('Unexpected track feed format');
  return data.events.flatMap(e => {
    const title = load(`<span>${e.title || ''}</span>`)('span').text();
    if (/moto|motorcycle|kart|private|closed|drift|superbike|road.?race association|\bcra\b/i.test(title)) return [];
    const venue = load(`<span>${e.venue?.venue || ''}</span>`)('span').text();
    const organizer = load(`<span>${e.organizer?.[0]?.organizer || title}</span>`)('span').text();
    const start = e.start_date?.slice(0,10), end = e.end_date?.slice(0,10);
    const events = [];
    if (!start || !end) return events;
    for (let d = new Date(`${start}T12:00:00Z`); d <= new Date(`${end}T12:00:00Z`) && events.length < 10; d = new Date(+d + 86400000)) {
      events.push(makeEvent({ title, date: d.toISOString().slice(0,10), venue, organizer, url: e.url, source,
        kind: /open test/i.test(title) ? 'Open practice' : /race|cal club/i.test(title) ? 'Track event' : 'Track day',
        note: /open test/i.test(title) ? 'Open testing; check vehicle eligibility, sessions and fees with the track.' : 'Track calendar listing; confirm participation and registration with the organizer.' }));
    }
    return events.filter(Boolean);
  });
}
const organizerKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g,'').replace('speedventuresoperationsllc','speedventures');
export function mergeEvents(events, today = todayPacific()) {
  const merged = new Map();
  for (const e of events.filter(e => e?.date >= today)) {
    const key = `${e.date}|${e.track}|${organizerKey(e.organizer)}|${e.kind === 'Autocross' ? 'autox' : 'track'}`;
    const previous = merged.get(key);
    if (previous) {
      previous.sources = [...new Map([...previous.sources,...e.sources].map(s=>[s.id,s])).values()];
      if (previous.sources[0].id === 'buttonwillow' && e.sources[0].id !== 'buttonwillow') { previous.url=e.url; previous.title=e.title; }
    } else merged.set(key, { ...e, id: key });
  }
  return [...merged.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.track.localeCompare(b.track));
}
async function get(url, asJSON = false) {
  const r = await fetch(url, { headers: { 'User-Agent': 'SpinoutClub-EventCalendar/1.0 (+https://spinoutclub.cc/events)', Accept: asJSON ? 'application/json' : 'text/html' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Source returned HTTP ${r.status}`);
  if (Number(r.headers.get('content-length') || 0) > 2500000) throw new Error('Source too large');
  const body = await r.text();
  if (body.length > 2500000) throw new Error('Source too large');
  return asJSON ? JSON.parse(body) : body;
}
export async function fetchSource(source, today = todayPacific()) {
  if (source.id === 'speedventures') return parseSpeedVentures(await get(source.url));
  if (source.id === 'speedsf') return parseSpeedSF(await get(`https://www.speedsf.com/events${today.slice(0,4)}`), Number(today.slice(0,4)));
  if (source.id === 'buttonwillow') {
    const all = []; const end = new Date(`${today}T12:00:00Z`); end.setUTCMonth(end.getUTCMonth()+12);
    for (let page = 1; page <= 4; page++) {
      const data = await get(`https://buttonwillowraceway.com/wp-json/tribe/events/v1/events?start_date=${today}&end_date=${end.toISOString().slice(0,10)}&per_page=50&page=${page}`, true);
      all.push(...parseButtonwillow(data)); if (page >= data.total_pages) break;
    }
    return all;
  }
  throw new Error('Unknown source');
}
export async function refreshEvents(kv) {
  const today = todayPacific(); const previous = await kv.get('calendar','json');
  const results = await Promise.allSettled(SOURCES.map(s=>fetchSource(s,today)));
  const events = []; const sources = [];
  results.forEach((result,i) => {
    const source = SOURCES[i]; const old = previous?.sources?.find(s=>s.id===source.id);
    if (result.status === 'fulfilled' && result.value.length) {
      events.push(...result.value); sources.push({...source,status:'ok',lastSuccess:new Date().toISOString(),count:result.value.length});
    } else {
      // A missing/changed parser must never erase previously verified future dates.
      events.push(...(previous?.events || []).filter(e=>e.sources.some(s=>s.id===source.id)));
      sources.push({...source,status:'stale',lastSuccess:old?.lastSuccess || null,count:old?.count || 0,error:'Could not refresh this source; verify dates on the organizer’s website.'});
    }
  });
  const calendar = { updatedAt: new Date().toISOString(), events: mergeEvents(events,today), sources, refreshHours:6 };
  await kv.put('calendar',JSON.stringify(calendar)); return calendar;
}
