// Small pastimes: stacking your own cairn at the skipping shores, swimming out to the little island, and a chain of
// geocaches that starts from the first one you find.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, sdfAt, trailDistAt, lake } from './world.js';
import { unproject } from './ashland.js';
import { RUN } from './run.js';

const STONE = ['#8d8a82', '#777469', '#9a968a', '#6f6c62', '#a07a5a', '#7d7f86'];
const OL = simpleToon('#141210', { side: THREE.BackSide });

// ---- cairns: E adds a stone; it sways more the higher it gets, so wait for it to stand still.  Seven is a photo.
export class Cairns {
  constructor(scene, spots) {
    this.scene = scene; this.list = []; this.seen = [];
    const S = (RUN.s.cairns ||= {});
    for (const sp of spots) {
      if (!sp.stack) continue;
      const x = sp.stack.x + sp.oz * 1.4, z = sp.stack.z - sp.ox * 1.4, g = new THREE.Group(); g.position.set(x, groundY(x, z), z); scene.add(g);
      const c = { id: sp.id, x, z, g, h: 0, t: Math.random() * 10, fall: 0, stones: [] };
      this.list.push(c); for (let i = 0; i < (S[sp.id] || 0); i++) this._stone(c);
    }
  }
  _stone(c) {
    const k = c.stones.length, w = Math.max(0.07, 0.2 - k * 0.013) * (0.9 + Math.random() * 0.2), t = 0.05 + Math.random() * 0.03, y = c.stones.reduce((s, m) => s + m.userData.t * 2, 0) + t;
    const geo = new THREE.SphereGeometry(1, 9, 6), m = new THREE.Mesh(geo, simpleToon(STONE[(k * 5 + 1) % STONE.length]));
    m.scale.set(w, t, w * 0.85); m.position.set((Math.random() - 0.5) * 0.02, y, (Math.random() - 0.5) * 0.02); m.rotation.y = Math.random() * 6; m.userData.t = t;
    const o = new THREE.Mesh(geo, OL); o.scale.set(1.12, 1.25, 1.12); m.add(o);
    c.g.add(m); c.stones.push(m); c.h = c.stones.length;
  }
  near(p) { return this.list.find((c) => Math.hypot(p.x - c.x, p.z - c.z) < 2.2) || null; }
  /** the sway right now: 0 upright, 1 at its widest */
  sway(c) { return c.h < 2 ? 0 : Math.abs(Math.sin(c.t * (1.3 + c.h * 0.18))); }
  /** add a stone; returns { ok, h } or { fell, h } */
  add(c) {
    if (c.fall > 0) return { busy: true };
    const tol = Math.max(0.12, 0.62 - c.h * 0.055);
    if (c.h >= 2 && this.sway(c) > tol) { const h = c.h; c.fall = 0.001; return { fell: true, h }; }
    if (c.h >= 10) return { full: true, h: c.h };
    this._stone(c); (RUN.s.cairns ||= {})[c.id] = c.h; RUN.save?.(); return { ok: true, h: c.h };
  }
  update(dt) {
    this.seen.length = 0;
    for (const c of this.list) {
      c.t += dt; const sw = this.sway(c) * Math.sign(Math.sin(c.t * (1.3 + c.h * 0.18))) * Math.min(0.06, c.h * 0.006);
      c.g.rotation.z = sw; c.g.rotation.x = sw * 0.4;
      if (c.fall > 0) {   // tumbling down, then gone (two stones stay as a base)
        c.fall += dt; c.stones.forEach((m, i) => { if (i < 2) return; m.position.x += (i % 2 ? 1 : -1) * dt * (0.4 + i * 0.05); m.position.y = Math.max(m.userData.t, m.position.y - dt * (1 + c.fall * 6)); m.rotation.z += dt * 3; });
        if (c.fall > 1.2) { for (const m of c.stones.splice(2)) c.g.remove(m); c.h = c.stones.length; c.fall = 0; (RUN.s.cairns ||= {})[c.id] = c.h; RUN.save?.(); }
      }
      if (c.h >= 7 && !c.fall) this.seen.push({ kind: 'cairn', act: 'my-cairn', x: c.x, y: c.g.position.y + c.h * 0.08, z: c.z, r: 0.4 });
    }
  }
}

// ---- a chain of geocaches: each logbook gives the coordinates of the next
export class Caches {
  constructor(scene, explore) {
    this.scene = scene; this.explore = explore; this.list = [];
    const pick = (kind, i = 0) => explore.list.filter((q) => q.kind === kind)[i];
    const anchors = [pick('dam'), pick('teepee') || pick('leanto'), pick('skip', 1) || pick('point'), pick('hill')].filter(Boolean);
    for (const [i, a] of anchors.entries()) {
      let spot = null;
      for (let r = 6; r < 40 && !spot; r += 2) for (let k = 0; k < 12 && !spot; k++) {
        const an = k / 12 * 6.283 + i, x = a.x + Math.cos(an) * r, z = a.z + Math.sin(an) * r, g = groundY(x, z);
        if (sdfAt(x, z) < 3 || trailDistAt(x, z) < 3 || Math.abs(groundY(x + 1, z) - g) > 0.5 || g < lake.originalLevel + 0.3) continue;
        spot = { x, z };
      }
      if (spot) this.list.push({ n: i + 2, ...spot, near: a.name });
    }
    this.mesh = null; this._build();
  }
  get step() { return RUN.s.cacheStep || 0; }   // 0: not started; k: looking for cache k+1 in the chain (list[k-1])
  /** the cache you are looking for now */
  get target() { const k = this.step; return k > 0 ? this.list[k - 1] || null : null; }
  coords(c) { const [lat, lon] = unproject(c.x, c.z); return `${lat.toFixed(5)} N, ${Math.abs(lon).toFixed(5)} W`; }
  start() { if (this.step === 0 && this.list.length) { RUN.s.cacheStep = 1; RUN.save?.(); this._build(); return this.list[0]; } return null; }
  _build() {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh = null; }
    const c = this.target; if (!c) return;
    const g = new THREE.Group(), y = groundY(c.x, c.z);
    const rock = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), simpleToon('#8a8780')); rock.scale.set(0.7, 0.4, 0.6); rock.position.y = 0.25; g.add(rock);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.15), simpleToon('#4a5a32')); box.position.set(0.6, 0.09, 0); g.add(box);
    g.position.set(c.x, y, c.z); this.scene.add(g); this.mesh = g;
  }
  /** returns the cache you just reached (and moves the chain on), or null */
  update(p) {
    const c = this.target; if (!c || Math.hypot(p.x - c.x, p.z - c.z) > 3.2) return null;
    RUN.s.cacheStep = this.step + 1; RUN.save?.(); this._build();
    return { found: c, next: this.target, last: !this.target };
  }
}
