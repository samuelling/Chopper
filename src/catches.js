// Your catch log: every fish you land, with a photo taken while you hold it up, its length and weight, where and when.
// Kept on this device.  Photos are small JPEGs; when storage runs short the oldest ordinary photos go first, never a
// trophy or a species' best.
import { RUN } from './run.js';

const KEY = 'ashland.catches';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };

export const CATCHES = {
  list: load(),
  add(rec) { rec.n = this.list.length ? this.list[this.list.length - 1].n + 1 : 1; this.list.push(rec); this.save(); return rec; },
  setImg(rec, img) { rec.img = img; this.save(); },
  best(id) { return this.list.filter((c) => c.id === id).reduce((a, c) => (!a || c.inches > a.inches ? c : a), null); },
  isBest(rec) { return this.best(rec.id) === rec; },
  save() {
    for (let k = 0; k < 40; k++) {
      try { localStorage.setItem(KEY, JSON.stringify(this.list)); return; } catch {
        const drop = this.list.find((c) => c.img && !c.trophy && !this.isBest(c));   // make room: oldest ordinary photo
        if (!drop) return; drop.img = null;
      }
    }
  },
  reset() { this.list = []; try { localStorage.removeItem(KEY); } catch {} },
  /** totals for the log's header */
  summary() {
    const s = { landed: this.list.length, trophies: this.list.filter((c) => c.trophy).length, species: new Set(this.list.map((c) => c.id)).size, clean: this.list.filter((c) => c.clean).length };
    s.biggest = this.list.reduce((a, c) => (!a || c.lb > a.lb ? c : a), null);
    return s;
  },
};
