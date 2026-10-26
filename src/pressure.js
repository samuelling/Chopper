// "Pressure": a single 0..1 number standing in for how much the player's AI / data-center use is leaning on the park.
// This is an ART EXPERIMENT, not a measurement: the mapping from usage to effects is invented and deliberately exaggerated
// so the cost is visible.  Phase one: set by hand (pause menu slider or ?pressure=0.4).  Later: coarse, consented usage input.
const q = typeof location !== 'undefined' ? parseFloat(new URLSearchParams(location.search).get('pressure')) : NaN;
let saved = NaN;
try { saved = parseFloat(localStorage.getItem('ashland.pressure')); } catch {}
const start = Number.isFinite(q) ? q : Number.isFinite(saved) ? saved : 0;

export const PRESSURE = {
  target: Math.min(1, Math.max(0, start)),
  shown: Math.min(1, Math.max(0, start)),   // eased toward target so the world changes gradually
  set(v) { this.target = Math.min(1, Math.max(0, v)); try { localStorage.setItem('ashland.pressure', String(this.target)); } catch {} },
  update(dt) { this.shown += (this.target - this.shown) * Math.min(1, dt * 0.6); },
  // the effects (all exaggerated on purpose)
  get life() { return 1 - 0.9 * this.shown; },            // share of wildlife that still shows up
  get drop() { return 0.55 * this.shown; },                // fraction of the reservoir's depth held back
  get saturate() { return 1 - 0.55 * this.shown; },        // colour vibrancy
  get bright() { return 1 - 0.08 * this.shown; },
};
