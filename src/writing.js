// Your own pages: anything you want to write, filed by the game year and season you wrote it in.  Field notes, poems,
// lists, nothing at all.  Kept on this device, and kept even when you start over (each life's pages stay its own).
import { RUN } from './run.js';
const KEY = 'ashland.writing';
const life = () => { try { return parseInt(localStorage.getItem('ashland.life')) || 1; } catch { return 1; } };
export const WRITING = {
  list: (() => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } })(),
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.list)); } catch {} },
  get life() { return life(); },
  year() { return Math.floor((RUN.n || 0) / 4) + 1; },
  add(text, season) { const p = { text, season, year: this.year(), life: life(), at: Date.now() }; this.list.push(p); this.save(); return p; },
  edit(p, text) { p.text = text; p.edited = Date.now(); this.save(); },
  remove(p) { this.list = this.list.filter((q) => q !== p); this.save(); },
};
