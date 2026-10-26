// Your own places (named on your phone, never official) and a journal of what you find.  Both live in the browser.
import { SEASON } from './season.js';

const PK = 'ashland.places', JK = 'ashland.journal';
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const PLACES = {
  list: load(PK),
  add(name, x, z) { name = name.trim().slice(0, 28); if (!name) return null; const p = { name, x: Math.round(x), z: Math.round(z), season: SEASON }; this.list.push(p); save(PK, this.list); JOURNAL.add(`You named a place "${name}".`, x, z); return p; },
  remove(p) { this.list = this.list.filter((q) => q !== p); save(PK, this.list); },
  rename(p, name) { name = name.trim().slice(0, 28); if (name) { p.name = name; save(PK, this.list); } },
  reset() { this.list = []; try { localStorage.removeItem(PK); } catch {} },
  /** the nearest named place within r metres, or null */
  near(x, z, r = 70) { let b = null, bd = r; for (const p of this.list) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = p; } } return b; },
};

export const JOURNAL = {
  list: load(JK),
  add(text, x, z) {
    const p = x == null ? null : PLACES.near(x, z);
    this.list.push({ at: Date.now(), season: SEASON, text: p ? `${text} Near "${p.name}".` : text });
    if (this.list.length > 300) this.list.shift();
    save(JK, this.list);
  },
  reset() { this.list = []; try { localStorage.removeItem(JK); } catch {} },
};
