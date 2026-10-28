// Forest fire: rare, likelier as the woods die.  Once a season there is a small chance of a fire (none in winter, none
// before Clyde's year); the odds rise steeply with the share of the woods standing dead.  You smell smoke and see the
// column, but finding the fire takes the drone's AI spotter or a lookout crew paid from the Park Fund.  Once it is
// located the fire service puts it out (off screen), and it leaves a circle of ash and charred snags: fallow ground that
// heals over a few seasons, and fertile ground where planted trees grow fast and fireweed comes up.
// Drawn in the same cel style: flat-coloured flame cones flickering along the burning front, toon-shaded smoke puffs.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, sdfAt, WORLD } from './world.js';
import { landcoverAt } from './ashland_landcover.js';
import { RUN } from './run.js';
import { SEASON } from './season.js';
import { BURNS } from './burns.js';
import { woodsDead } from './woods.js';

const BASE = { spring: 0.03, summer: 0.07, autumn: 0.05, winter: 0 };      // chance of a fire in a season, healthy woods
const GROW = 0.2, R0 = 6, RMAX = 75, CREW_ARRIVE = 20, OUT_AFTER = 50;       // metres per second, start, cap; seconds after it is found
// a fire nobody finds is called in anyway once its smoke can be seen from town: at SEEN metres across in healthy woods,
// but where the woods are dying (dead trees are kindling) it runs much further first
const SEEN = 30;
const NF = 56, NS = 72;

export class Fire {
  constructor(scene, { force = false } = {}) {
    this.scene = scene; this.t = 0;
    const S = RUN.s;
    if (!S.fireS || S.fireS.n !== RUN.n || force) {
      const live = RUN.phaseTwo || (RUN.dev && force);
      const p = force ? 1 : live && !RUN.dev ? Math.min(0.6, (BASE[SEASON] ?? 0) * (1 + 6 * woodsDead())) : 0;
      const start = Math.random() < p, spot = start ? this._spot() : null;
      S.fireS = { n: RUN.n, start: start && !!spot, t0: force ? 6 : (0.15 + Math.random() * 0.4) * RUN.len, x: spot?.x ?? 0, z: spot?.z ?? 0, phase: 'wait', r: R0, age: 0, located: null, foundAt: 0 };
      RUN.save?.();
    }
    this.s = S.fireS;
    // flames: orange outer cones and yellow inner ones, unlit flat colour (they are the light)
    const cone = new THREE.ConeGeometry(0.6, 1, 6); cone.translate(0, 0.5, 0);
    this.flame = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: '#ff7a1a' }), NF);
    this.core = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: '#ffd84a' }), NF);
    const puff = new THREE.IcosahedronGeometry(1, 1);
    this.smoke = new THREE.InstancedMesh(puff, Object.assign(simpleToon('#8e8a84'), { transparent: true, opacity: 0.86, depthWrite: false }), NS);
    for (const m of [this.flame, this.core, this.smoke]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._sc = new THREE.Vector3();
    // ash: one mesh per burn, fading back to green over four seasons
    this.ash = new THREE.Group(); scene.add(this.ash);
    for (const b of RUN.s.burns || []) this._ashFor(b);
    if (this.s.phase === 'burning' || this.s.phase === 'located') { BURNS.live = { x: this.s.x, z: this.s.z, r: this.s.r }; BURNS.sync(); }
  }
  get burning() { return this.s.phase === 'burning'; }
  /** how far it can run before the whole town sees it (bigger where the woods are dead and dry) */
  get seenAt() { return Math.min(RMAX, SEEN + 45 * (this.s.kindle || 0)); }
  get x() { return this.s.x; } get z() { return this.s.z; }
  /** somewhere thickly wooded, away from the water and not already burned */
  _spot() {
    for (let i = 0; i < 400; i++) {
      const x = WORLD.minX + 60 + Math.random() * (WORLD.maxX - WORLD.minX - 120), z = WORLD.minZ + 60 + Math.random() * (WORLD.maxZ - WORLD.minZ - 120), sd = sdfAt(x, z);
      if (sd < 25 || sd > 150 || (landcoverAt(x, z)?.dens ?? 0) < 0.55 || BURNS.at(x, z) > 0) continue;
      return { x, z };
    }
    return null;
  }
  /** start a fire now (the secret code): in thick woods a little way off from (near.x, near.z), so you see the smoke */
  ignite(near) {
    if (this.s.phase === 'burning' || this.s.phase === 'located') return false;
    let spot = null;
    for (let i = 0; i < 300 && !spot; i++) { const q = this._spot(); if (q && (!near || Math.hypot(q.x - near.x, q.z - near.z) > 90 && Math.hypot(q.x - near.x, q.z - near.z) < 260 - i * 0.4)) spot = q; }
    spot ||= this._spot(); if (!spot) return false;
    Object.assign(this.s, { start: true, x: spot.x, z: spot.z, phase: 'burning', r: R0, age: 0, located: null, foundAt: 0, kindle: this.kindleDev ? 1 : Math.min(1, woodsDead() * 4) });
    this._slowSaid = false; this.slow = 1; RUN.save?.(); this.onStart?.(); return true;
  }
  /** someone has found it: the fire service is on the way */
  locate(how) {
    if (this.s.phase !== 'burning') return false;
    this.s.phase = 'located'; this.s.located = how; this.s.foundAt = this.s.age; RUN.save?.();
    this.onLocated?.(how); return true;
  }
  /** the season ends with the fire still going: it burns out on its own, bigger */
  endSeason() {
    if (this.s.phase !== 'burning' && this.s.phase !== 'located') return;
    const unfound = this.s.phase === 'burning';
    this.s.r = unfound ? Math.max(this.s.r, this.seenAt) : this.s.r; this._out(unfound);
  }
  _out(unfound) {
    this.s.phase = 'out'; BURNS.live = null; BURNS.add(this.s.x, this.s.z, this.s.r); this._ashFor(RUN.s.burns[RUN.s.burns.length - 1]);
    if (this._liveAsh) { this.ash.remove(this._liveAsh); this._liveAsh.geometry.dispose(); this._liveAsh = null; }
    RUN.save?.(); this.onOut?.(this.s.r, unfound);
  }
  /** a smooth grid of soft charcoal greys, browner and fading out toward a ragged edge */
  _ashGeo(x, z, r) {
    const step = 1.6, n = Math.ceil((r + 4) / step), W = 2 * n + 1, pos = [], col = [], idx = [], c = new THREE.Color(), dark = new THREE.Color('#231f1c'), mid = new THREE.Color('#38312b'), brown = new THREE.Color('#4e3f30');
    const hash = (a, b) => Math.abs(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1;
    const vnoise = (u, v) => { const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv, sx = fu * fu * (3 - 2 * fu), sz = fv * fv * (3 - 2 * fv);
      return (hash(iu, iv) * (1 - sx) + hash(iu + 1, iv) * sx) * (1 - sz) + (hash(iu, iv + 1) * (1 - sx) + hash(iu + 1, iv + 1) * sx) * sz; };
    const seed = (x * 0.37 + z * 0.11) % 100;
    for (let iz = -n; iz <= n; iz++) for (let ix = -n; ix <= n; ix++) {
      const gx = ix * step, gz = iz * step, d = Math.hypot(gx, gz), ang = Math.atan2(gz, gx);
      const edge = r * (0.88 + 0.12 * vnoise(ang * 3 + seed, seed) + 0.05 * Math.sin(ang * 11 + seed)), k = Math.max(0, Math.min(1, (edge - d) / 5));
      const wx = x + gx, wz = z + gz; pos.push(wx, groundY(wx, wz) + 0.2, wz);
      const t = vnoise(wx * 0.18, wz * 0.18) * 0.7 + vnoise(wx * 0.6, wz * 0.6) * 0.3;
      c.copy(dark).lerp(mid, t).lerp(brown, Math.max(0, 1 - (edge - d) / 9) * 0.8);
      col.push(c.r, c.g, c.b, k * (0.9 + 0.1 * t));
    }
    for (let iz = 0; iz < W - 1; iz++) for (let ix = 0; ix < W - 1; ix++) {
      const a = iz * W + ix, b = a + 1, c2 = a + W, d2 = c2 + 1;
      if (col[a * 4 + 3] + col[b * 4 + 3] + col[c2 * 4 + 3] + col[d2 * 4 + 3] <= 0) continue;
      idx.push(a, c2, b, b, c2, d2);                                     // wound to face up
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  _ashFor(b) {
    const age = RUN.n - (b.n ?? RUN.n); if (age >= 4) return;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: [0.95, 0.7, 0.42, 0.18][age], depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.Mesh(this._ashGeo(b.x, b.z, b.r), mat); m.renderOrder = 1; this.ash.add(m);
  }

  /** world time; returns nothing.  `playing`: the season clock is running */
  update(dt, playing) {
    const s = this.s; this.t += dt;
    if (!s.start || s.phase === 'out') { this._hide(); return; }
    if (s.phase === 'wait') { if (playing && (RUN.dev ? this.t : RUN.s.played) >= s.t0) { s.phase = 'burning'; s.age = 0; s.r = R0; s.kindle = this.kindleDev ? 1 : Math.min(1, woodsDead() * 4); RUN.save?.(); this.onStart?.(); } else { this._hide(); return; } }
    if (playing) s.age += dt;
    // it spreads until the crew is there; a ring of trees cut down around it (a firebreak) slows it
    if (playing && (s.phase === 'burning' || (s.phase === 'located' && s.age - s.foundAt < CREW_ARRIVE))) s.r = Math.min(RMAX, s.r + GROW * (1 + (s.kindle || 0)) * (this.slow ?? 1) * dt);
    if (s.phase === 'burning' && s.r >= this.seenAt) this.locate(s.kindle > 0.3 ? 'kindling' : 'seen');
    if (s.phase === 'located' && s.age - s.foundAt > OUT_AFTER) { this._out(false); this._hide(); return; }
    BURNS.live = { x: s.x, z: s.z, r: s.r * 0.85 };
    if ((this._syncT = (this._syncT || 0) - dt) <= 0) {
      this._syncT = 1.5; BURNS.sync(); RUN.save?.();
      this.slow = this.slowFn?.() ?? 1; if (this.slow < 0.7 && !this._slowSaid && s.phase === 'burning') { this._slowSaid = true; this.onSlow?.(); }
      // the ash spreads behind the front
      if (this._liveAsh) { this.ash.remove(this._liveAsh); this._liveAsh.geometry.dispose(); }
      this._liveAsh = new THREE.Mesh(this._ashGeo(s.x, s.z, s.r * 0.85), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      this.ash.add(this._liveAsh);
    }
    // how fierce: full while it burns, dying down once the crew is on it
    const fierce = this.fierce = s.phase === 'burning' ? 1 : Math.max(0, 1 - Math.max(0, s.age - s.foundAt - CREW_ARRIVE) / (OUT_AFTER - CREW_ARRIVE));
    const t = this.t, nf = Math.round(NF * Math.min(1, 0.3 + s.r / 40) * (fierce > 0.02 ? 1 : 0));
    for (let i = 0; i < nf; i++) {
      const a = i * 2.39996, rr = s.r * (0.72 + 0.28 * ((i * 0.618) % 1)), x = s.x + Math.cos(a) * rr, z = s.z + Math.sin(a) * rr, y = groundY(x, z);
      const h = (1.6 + 2.4 * ((i * 0.37) % 1)) * (0.7 + 0.3 * Math.sin(t * 9 + i * 1.7)) * fierce, w = 0.8 + 0.6 * ((i * 0.53) % 1);
      this._q.setFromAxisAngle(this._p.set(0, 1, 0), t * 0.5 + i);
      this._m.compose(this._p.set(x, y - 0.1, z), this._q, this._sc.set(w * (0.6 + 0.4 * fierce), h, w * (0.6 + 0.4 * fierce))); this.flame.setMatrixAt(i, this._m);
      this._m.compose(this._p.set(x, y - 0.1, z), this._q, this._sc.set(w * 0.5, h * 0.6, w * 0.5)); this.core.setMatrixAt(i, this._m);
    }
    this.flame.count = this.core.count = nf; this.flame.instanceMatrix.needsUpdate = this.core.instanceMatrix.needsUpdate = true;
    // smoke: puffs rising from the front, leaning downwind and swelling as they go
    const ns = Math.round(NS * Math.max(0.15, fierce));
    for (let i = 0; i < ns; i++) {
      const ph = (t * 0.045 + i / NS) % 1, a = i * 2.39996, rr = s.r * 0.8, x0 = s.x + Math.cos(a) * rr * 0.7, z0 = s.z + Math.sin(a) * rr * 0.7;
      const y = groundY(x0, z0) + 2 + ph * (35 + s.r * 0.5), sc = (1.5 + ph * 9) * (0.6 + 0.4 * fierce) * (ph > 0.85 ? (1 - ph) / 0.15 : 1);
      this._m.compose(this._p.set(x0 + ph * 28 + Math.sin(t * 0.3 + i) * 2, y, z0 + ph * 10), this._q.identity(), this._sc.set(sc, sc * 0.85, sc)); this.smoke.setMatrixAt(i, this._m);
    }
    this.smoke.count = ns; this.smoke.instanceMatrix.needsUpdate = true;
  }
  _hide() { this.fierce = 0; this.flame.count = this.core.count = this.smoke.count = 0; }
}
