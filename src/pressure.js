// "Pressure": a 0..1 dial standing in for how much the player's AI / data-center use is leaning on the park.
// ART EXPERIMENT, not a measurement: the mapping from usage to effects is invented and deliberately exaggerated
// so the cost is visible.  Phase one: set by hand (pause menu slider or ?pressure=0.4).  Later: coarse, consented usage input.
//
// The dial itself is reversible, but the harm it causes is not.  Pressure builds up "damage" over time; turning the dial
// back down only lets the park recover slowly (about 15x slower than it was harmed).  Every effect reads `harm`
// (= the lasting damage), never the dial, so there is no instant feel-good reset.
const P = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const num = (v) => (v == null || v === '' ? NaN : parseFloat(v));
const stored = (k) => { try { return parseFloat(localStorage.getItem(k)); } catch { return NaN; } };
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const pick = (...a) => a.find(Number.isFinite) ?? 0;

import { RUN } from './run.js';
const UP = RUN.dev ? 1 / 240 : 1 / 800;   // full pressure: wrecks the park in 4 min (dev) / about two seasons of play (run)
const DOWN = 1 / 3600;  // seconds of zero pressure to heal it (1 h)

export const PRESSURE = {
  target: clamp01(pick(num(P.get('pressure')), stored('ashland.pressure'))),
  damage: (RUN.dev || RUN.phaseTwo) ? clamp01(pick(num(P.get('damage')), stored('ashland.damage'))) : 0,
  get live() { return RUN.dev || RUN.phaseTwo; },
  shield: 0,     // early-warning benefits slow new harm (never undo old harm)
  _save: 0,
  set(v) { this.target = clamp01(v); try { localStorage.setItem('ashland.pressure', String(this.target)); } catch {} },
  bump(x) { if (!this.live) return; this.damage = clamp01(this.damage + x); try { localStorage.setItem('ashland.damage', this.damage.toFixed(4)); } catch {} },
  update(dt) {
    if (!this.live || RUN.s.end) return;
    this.damage = clamp01(this.damage + (this.target * UP * (1 - this.shield) - (1 - this.target) * DOWN * (1 + (RUN.s.recover || 0))) * dt);
    if ((this._save += dt) > 3) { this._save = 0; try { localStorage.setItem('ashland.damage', this.damage.toFixed(4)); } catch {} }
  },
  heal(x) { this.damage = clamp01(this.damage - x); try { localStorage.setItem('ashland.damage', this.damage.toFixed(4)); } catch {} },
  // what shows on the land: lasting damage, softened by the upkeep you have paid for (never below 60% of the damage)
  get harm() { return this.damage * (1 - Math.min(0.4, RUN.s.buffer || 0)); },
  // the effects (all exaggerated on purpose)
  get life() { return 1 - 0.9 * this.harm; },            // share of wildlife that still shows up
  get drop() { return 0.55 * this.harm; },                // fraction of the reservoir's depth held back
  get saturate() { return 1 - 0.55 * this.harm; },        // colour vibrancy
  get bright() { return 1 - 0.08 * this.harm; },
};

// Per-tree luck in 0..1: low numbers suffer first.  Identical maths in JS and GLSL (see toon.js) so a tree that has
// browned on screen is also the one that is gone from the collision/chopping lists.
export function treeLuck(x, z) {
  const f = Math.fround;
  let a = f(x * 0.1031); a -= Math.floor(a); let b = f(z * 0.1031); b -= Math.floor(b);
  let c = a;                                   // p3 = fract(vec3(x, z, x) * .1031)
  const d = f(f(a * (b + 33.33)) + f(b * (c + 33.33)) + f(c * (a + 33.33)));   // dot(p3, p3.yzx + 33.33)
  a = f(a + d); b = f(b + d); c = f(c + d);
  const r = f(f(a + b) * c);
  return r - Math.floor(r);
}
// Dieback starts at the shore and spreads inland: a tree's turn comes mostly from its distance to the water (sdf, metres),
// with a little luck.  Same maths as dieAt() in toon.js.  Dead trees stay standing as bare snags, so nothing is removed.
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function dieAt(sdf, luck, harm) { const th = 0.06 + 0.9 * Math.min(1, Math.max(0, sdf / 350)) + 0.3 * (luck - 0.5); return sstep(th, th + 0.18, harm); }
export const treeGone = () => false;
