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
  _save: 0,
  set(v) { this.target = clamp01(v); try { localStorage.setItem('ashland.pressure', String(this.target)); } catch {} },
  bump(x) { if (!this.live) return; this.damage = clamp01(this.damage + x); try { localStorage.setItem('ashland.damage', this.damage.toFixed(4)); } catch {} },
  update(dt) {
    if (!this.live) return;
    this.damage = clamp01(this.damage + (this.target * UP - (1 - this.target) * DOWN) * dt);
    if ((this._save += dt) > 3) { this._save = 0; try { localStorage.setItem('ashland.damage', this.damage.toFixed(4)); } catch {} }
  },
  get harm() { return this.damage; },
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
export const GONE_FRAC = 0.30;                       // share of trees that are gone at full harm
export const treeGone = (r, harm) => r < GONE_FRAC * harm;
