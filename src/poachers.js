// Poachers: now and then (from Year Two, a little likelier in autumn) two people with rifles slip into the thick woods
// off the trails for part of a season.  You may hear a shot.  On foot you never catch them (they hear you coming and are
// gone); only the drone's AI spotter, looking down through the canopy gaps, can pick them out.  Then the Environmental
// Police deal with them at once, and the fine goes to the park fund.  Invented; hunting is not allowed in the park.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, sdfAt, WORLD } from './world.js';
import { landcoverAt } from './ashland_landcover.js';
import { RUN } from './run.js';
import { SEASON } from './season.js';

const CHANCE = { spring: 0.25, summer: 0.25, autumn: 0.45, winter: 0.15 };   // per season: middling rare
export const FINE = 2500;
const HEAR = 45;                                                              // on foot this close, they are off

export class Poachers {
  constructor(scene, { force = false } = {}) {
    const S = RUN.s;
    if (!S.poachS || S.poachS.n !== RUN.n || force) {
      const p = force ? 1 : (RUN.phaseTwo && !RUN.dev) ? CHANCE[SEASON] ?? 0.2 : 0;
      const spot = Math.random() < p ? this._spot() : null;
      const t0 = force ? 3 : (0.12 + Math.random() * 0.4) * RUN.len;
      S.poachS = { n: RUN.n, on: !!spot, x: spot?.x ?? 0, z: spot?.z ?? 0, yaw: Math.random() * 6.28, t0, t1: t0 + 0.4 * RUN.len, phase: 'wait' };
      RUN.save?.();
    }
    this.s = S.poachS; this.t = 0; this.shotT = 8 + Math.random() * 20;
    this.model = this._build(); this.model.visible = false; scene.add(this.model);
    if (this.s.on) this.model.position.set(this.s.x, groundY(this.s.x, this.s.z), this.s.z), this.model.rotation.y = this.s.yaw;
  }
  get active() { return this.s.on && this.s.phase === 'active'; }
  get x() { return this.s.x; } get z() { return this.s.z; }
  _spot() {
    for (let i = 0; i < 400; i++) {
      const x = WORLD.minX + 60 + Math.random() * (WORLD.maxX - WORLD.minX - 120), z = WORLD.minZ + 60 + Math.random() * (WORLD.maxZ - WORLD.minZ - 120), sd = sdfAt(x, z);
      if (sd < 40 || sd > 150 || (landcoverAt(x, z)?.dens ?? 0) < 0.5) continue;
      return { x, z };
    }
    return null;
  }
  _build() {
    const g = new THREE.Group(), camo = simpleToon('#4d5a3a'), dark = simpleToon('#3a3328'), skin = simpleToon('#c99a78'), gun = simpleToon('#1e1a16'), ol = simpleToon('#141210', { side: THREE.BackSide });
    const add = (par, geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); par.add(m); const o = new THREE.Mesh(geo, ol); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.setScalar(1.08); par.add(o); return m; };
    const person = (x, z, ry, kneel) => {
      const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
      const hip = kneel ? 0.5 : 0.95;
      for (const sx of [-1, 1]) add(p, new THREE.BoxGeometry(0.16, hip, 0.18), dark, sx * 0.11, hip / 2, kneel && sx > 0 ? 0.25 : 0);
      add(p, new THREE.BoxGeometry(0.46, 0.62, 0.28), camo, 0, hip + 0.31, 0);
      add(p, new THREE.SphereGeometry(0.13, 10, 8), skin, 0, hip + 0.76, 0);
      add(p, new THREE.CylinderGeometry(0.15, 0.15, 0.1, 10), camo, 0, hip + 0.86, 0);
      add(p, new THREE.BoxGeometry(0.06, 0.06, 1.1), gun, 0.2, hip + 0.45, -0.25, kneel ? 0 : -0.6);
      return p;
    };
    person(0, 0, 0, false); person(1.3, 0.6, -0.5, true);
    g.traverse((o) => { o.castShadow = true; });
    return g;
  }
  /** the spotter has them: the Environmental Police are on their way */
  catch() { if (!this.active) return false; this.s.phase = 'caught'; this.s.caughtAt = this.t; RUN.save?.(); return true; }
  /** world time.  `playing`: the season clock runs; `you`: where you are on foot (null while flying) */
  update(dt, playing, you) {
    const s = this.s; this.t += dt;
    if (!s.on) return;
    const clock = RUN.dev ? this.t : RUN.s.played;
    if (s.phase === 'wait' && playing && clock >= s.t0) { s.phase = 'active'; RUN.save?.(); }
    if (s.phase === 'active' && clock >= s.t1) { s.phase = 'gone'; RUN.save?.(); }
    if (s.phase === 'active' && you && Math.hypot(you.x - s.x, you.z - s.z) < HEAR) { s.phase = 'gone'; RUN.save?.(); this.onFled?.(); }
    if (s.phase === 'caught' && this.t - s.caughtAt > 7 && !s.fined) { s.fined = true; RUN.s.fund = (RUN.s.fund || 0) + FINE; RUN.s.poachFines = (RUN.s.poachFines || 0) + FINE; RUN.save?.(); this.onFined?.(FINE); }
    if (s.phase === 'caught' && this.t - s.caughtAt > 25) { s.phase = 'done'; RUN.save?.(); }
    this.model.visible = s.phase === 'active' || s.phase === 'caught';
    if (s.phase === 'active' && playing && (this.shotT -= dt) <= 0) { this.shotT = 50 + Math.random() * 70; this.onShot?.(); }
  }
}
