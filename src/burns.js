// Burned ground: every fire leaves a circle of ash and charred snags.  The list lives in the run (RUN.s.burns) plus the
// fire burning now; the shader reads the newest eight as a uniform (trees inside go black and bare), and the JS side
// answers "how burned is this spot" for the woods count, the planting bonus and fireweed.
import { shared } from './toon.js';
import { RUN } from './run.js';

const N = 8;

export const BURNS = {
  live: null,                                     // { x, z, r } of the fire burning now
  get list() { return [...(RUN.s.burns || []), ...(this.live ? [{ ...this.live, n: RUN.n }] : [])]; },
  /** 0..1: how burned the ground is at (x, z) (1 well inside a burn, fading over its last 6 m) */
  at(x, z) { let b = 0; for (const q of this.list) { const d = Math.hypot(x - q.x, z - q.z); b = Math.max(b, Math.min(1, Math.max(0, (q.r - d) / 6))); } return b; },
  /** the burn at (x, z), if any (for its age) */
  find(x, z) { return this.list.find((q) => Math.hypot(x - q.x, z - q.z) < q.r) || null; },
  sync() { const L = this.list.slice(-N); for (let i = 0; i < N; i++) { const q = L[i]; shared.burns.value[i].set(q ? q.x : 0, q ? q.z : 0, q ? q.r : 0, q ? 1 + Math.max(0, RUN.n - (q.n ?? RUN.n)) : 0); } },   // w: 1 this season, 2 last season, ...
  add(x, z, r) { (RUN.s.burns ||= []).push({ x: Math.round(x), z: Math.round(z), r: Math.round(r), n: RUN.n }); RUN.save?.(); this.sync(); },
};
BURNS.sync();
