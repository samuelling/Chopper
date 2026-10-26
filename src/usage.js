// How the player tells the park about their AI use.  ART EXPERIMENT: coarse on purpose, all consented, all local.
// Three ways in, all producing a per-day level 0..4:
//   1. a tier ("my typical day"),  2. a daily check-in,  3. a Claude Code log the browser totals on this device.
// Only per-day totals/levels are stored (localStorage); log contents never leave the page.
import { PRESSURE } from './pressure.js';

export const LEVELS = [
  { name: 'None', p: 0.0 }, { name: 'Light', p: 0.15 }, { name: 'Medium', p: 0.4 }, { name: 'Heavy', p: 0.75 }, { name: 'Very heavy', p: 1.0 },
];
// tokens/day (input + output + cache writes, not cache reads) -> level.  Invented thresholds, shown to the player.
export const TOKEN_STEPS = [1, 20e3, 200e3, 1e6];
export const levelFromTokens = (t) => (t <= 0 ? 0 : TOKEN_STEPS.reduce((l, s, i) => (t >= s ? i + 1 : l), 0));

const KEY = 'ashland.usage';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let S = { tier: null, days: {}, source: {} };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

export const Usage = {
  today,
  get tier() { return S.tier; },
  get days() { return S.days; },
  get source() { return S.source; },
  todayLevel() { return S.days[today()]; },
  needsCheckin() { return S.days[today()] === undefined; },
  setTier(l) { S.tier = l; save(); this.apply(); },
  checkin(l, src = 'checkin') { S.days[today()] = l; S.source[today()] = src; save(); this.apply(); },
  // pressure target: today's answer if there is one, else the typical-day tier, else a rolling average of recent days
  level() {
    const t = S.days[today()];
    if (t !== undefined) return t;
    if (S.tier !== null) return S.tier;
    const recent = Object.keys(S.days).sort().slice(-3).map((k) => S.days[k]);
    return recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
  },
  apply() { const l = this.level(); if (l !== null) PRESSURE.set(lerpP(l)); },
};
const lerpP = (l) => { const a = Math.floor(l), b = Math.min(4, Math.ceil(l)); return LEVELS[a].p + (LEVELS[b].p - LEVELS[a].p) * (l - a); };

// ---- option 3: Claude Code logs (~/.claude/projects/**/*.jsonl) ---------------------------------------------------
function totalsFromText(text, byReq) {
  for (const line of text.split('\n')) {
    if (line.indexOf('"usage"') < 0) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    const u = d.message?.usage; if (!u || !d.timestamp) continue;
    const tok = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
    byReq.set(d.requestId || d.uuid, { ts: d.timestamp, tok });   // streamed blocks repeat a request: keep the last
  }
}
function finish(byReq) {
  const perDay = {};
  for (const { ts, tok } of byReq.values()) {
    const dt = new Date(ts); if (isNaN(dt)) continue;
    const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    perDay[k] = (perDay[k] || 0) + tok;
  }
  let n = 0;
  for (const [k, t] of Object.entries(perDay)) { S.days[k] = levelFromTokens(t); S.source[k] = `log:${Math.round(t / 1000)}k`; n++; }
  save(); Usage.apply();
  return n;
}
/** files: FileList / array of File (.jsonl).  Returns the number of days found. */
export async function importLogFiles(files) {
  const byReq = new Map();
  for (const f of files) if (/\.jsonl$/i.test(f.name)) totalsFromText(await f.text(), byReq);
  return finish(byReq);
}
async function* walk(dir) {
  for await (const [name, h] of dir.entries()) {
    if (h.kind === 'file' && /\.jsonl$/i.test(name)) yield await h.getFile();
    else if (h.kind === 'directory') yield* walk(h);
  }
}
export async function importLogDir(handle) {
  const byReq = new Map();
  for await (const f of walk(handle)) totalsFromText(await f.text(), byReq);
  return finish(byReq);
}

// remembered folder (Chromium desktop only): ask once, then re-check on later visits after one permission click
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('ashland', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async () => { try { const db = await idb(); return await new Promise((res) => { const q = db.transaction('h').objectStore('h').get('logdir'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch { return null; } };
const idbPut = async (v) => { try { const db = await idb(); db.transaction('h', 'readwrite').objectStore('h').put(v, 'logdir'); } catch {} };
export const canPickFolder = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;
export async function pickLogFolder() { const h = await window.showDirectoryPicker({ id: 'ashland-claude-logs', mode: 'read' }); await idbPut(h); return importLogDir(h); }
export async function recheckLogFolder(interactive) {
  const h = await idbGet(); if (!h) return null;
  let p = await h.queryPermission({ mode: 'read' });
  if (p !== 'granted' && interactive) p = await h.requestPermission({ mode: 'read' });
  return p === 'granted' ? importLogDir(h) : -1;
}
export const hasSavedFolder = async () => !!(await idbGet());
