// Small and shy: eastern chipmunks (day), frogs on the shore (warm months, evening), a beaver
// swimming at dusk, and a pair of wood ducks on the water by day.  Each is a few toon parts moved by simple procedural gaits.
import * as THREE from 'three';
import { STEALTH } from './stealth.js';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt, lake } from './world.js';
import { mulberry32 } from './noise.js';
import { SEASON } from './season.js';
import { PRESSURE } from './pressure.js';

const C = (h) => new THREE.Color(h);
const _c = new THREE.Color();
const ball = new THREE.SphereGeometry(1, 8, 6), cyl = new THREE.CylinderGeometry(1, 1, 1, 6);
const ease = (c, t, k, dt) => c + (t - c) * Math.min(1, dt * k);
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function chipGeo() {
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0.07, 0, 0, 0, 0, 0.035, 0.035, 0.08), { faceColorFn: (c, n) => (Math.abs(n.x) < 0.3 && n.y > 0.4 ? _c.copy(C('#35261a')) : n.y < -0.3 ? _c.copy(C('#efe3cf')) : _c.copy(C('#a06f40'))) });
  b.add(ball, matrix(0, 0.1, 0.08, 0, 0, 0, 0.03, 0.03, 0.04), { color: C('#a98152') });
  b.add(ball, matrix(0, 0.095, 0.115, 0, 0, 0, 0.01, 0.01, 0.01), { color: C('#15110d') });
  b.add(ball, matrix(0, 0.13, -0.1, 0.5, 0, 0, 0.012, 0.05, 0.012), { color: C('#6b4a2c') });
  return b.build();
}
function frogGeo() {
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0.035, 0, 0, 0, 0, 0.05, 0.035, 0.065), { faceColorFn: (c, n) => (n.y < -0.2 ? _c.copy(C('#c9d59a')) : _c.copy(C('#5f8a3a'))) });
  for (const s of [-1, 1]) { b.add(ball, matrix(s * 0.028, 0.07, 0.04, 0, 0, 0, 0.014, 0.014, 0.014), { color: C('#b9c46a') }); b.add(ball, matrix(s * 0.028, 0.075, 0.048, 0, 0, 0, 0.006, 0.006, 0.006), { color: C('#15110d') }); b.add(ball, matrix(s * 0.05, 0.022, -0.045, 0, 0.3 * s, 0, 0.02, 0.02, 0.055), { color: C('#4f7432') }); }
  return b.build();
}
function beaverGeo() {
  const b = new GeoBuilder(), f = '#5c3d26';
  b.add(ball, matrix(0, 0.02, 0, 0, 0, 0, 0.16, 0.11, 0.3), { color: C(f) });
  b.add(ball, matrix(0, 0.08, 0.28, 0.2, 0, 0, 0.075, 0.07, 0.09), { color: C('#6b4a2e') });
  b.add(ball, matrix(0, 0.07, 0.35, 0, 0, 0, 0.022, 0.018, 0.02), { color: C('#15110d') });
  for (const s of [-1, 1]) b.add(ball, matrix(s * 0.05, 0.14, 0.25, 0, 0, 0, 0.018, 0.018, 0.012), { color: C('#2a1d16') });
  b.add(ball, matrix(0, 0.0, -0.4, 0, 0, 0, 0.1, 0.012, 0.17), { color: C('#2f2118') });
  return b.build();
}
function wakeGeo() { const b = new GeoBuilder(); for (const s of [-1, 1]) b.add(ball, matrix(s * 0.35, 0.0, -0.9, 0, s * 0.35, 0, 0.035, 0.004, 0.75), { color: C('#e4efee') }); return b.build(); }
function duckGeo(drake) {
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0.045, 0, 0, 0, 0, 0.075, 0.05, 0.14), { faceColorFn: (c, n) => (drake ? (n.y > 0.45 ? _c.copy(C('#26453a')) : n.z > 0.5 ? _c.copy(C('#7a3d2a')) : n.y < -0.1 ? _c.copy(C('#efe6d2')) : _c.copy(C('#9a6a40'))) : _c.copy(C('#7a6a58'))) });
  b.add(ball, matrix(0, 0.1, 0.12, 0, 0, 0, 0.045, 0.045, 0.06), { color: C(drake ? '#1f6a4e' : '#8a7a68') });
  if (drake) b.add(ball, matrix(0, 0.11, 0.06, 0.4, 0, 0, 0.02, 0.03, 0.06), { color: C('#1c4a3a') });
  b.add(ball, matrix(0, 0.095, 0.19, 0, 0, 0, 0.018, 0.012, 0.03), { color: C(drake ? '#e0623a' : '#4a4036') });
  b.add(ball, matrix(0, 0.05, -0.14, 0.2, 0, 0, 0.03, 0.02, 0.05), { color: C('#3a3026') });
  return b.build();
}

export class Critters {
  constructor(scene, chunks, { mobile = false } = {}) {
    this.chunks = chunks; this.rng = mulberry32(777); this.t = 0; this.seen = []; this.onSplash = null; this.onFirst = null;
    const mk = (geo, cap) => { const o = makeInstanced(geo, cap); scene.add(o.fill); scene.add(o.line); return o; };
    this.P = { chip: mk(chipGeo(), 2), frog: mk(frogGeo(), 2), beaver: mk(beaverGeo(), 1), wake: mk(wakeGeo(), 1), drake: mk(duckGeo(true), 1), hen: mk(duckGeo(false), 1) };
    const base = () => ({ active: false, wait: 0, x: 0, z: 0, h: 0, v: 0, st: 'idle', timer: 0, tx: 0, tz: 0, ph: this.rng() * 6, gp: 0, hop: 0 });
    this.chips = [{ ...base(), wait: 12 }, { ...base(), wait: 40 }]; this.frogs = [{ ...base(), wait: 8 }, { ...base(), wait: 30 }];
    this.beaver = [{ ...base(), wait: 25 }]; this.ducks = [{ ...base(), wait: 15 }, { ...base(), wait: 15 }];
    this._r = new THREE.Matrix4(); this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._o = new THREE.Vector3();
  }
  _put(o, i, m) { o.fill.setMatrixAt(i, m); o.line.setMatrixAt(i, m); }
  _fin(o, n) { o.fill.count = o.line.count = n; o.fill.instanceMatrix.needsUpdate = o.line.instanceMatrix.needsUpdate = true; o.fill.visible = o.line.visible = n > 0; }
  _root(x, y, z, h, pitch = 0, roll = 0) { this._e.set(pitch, h, roll, 'YXZ'); this._q.setFromEuler(this._e); return this._r.compose(this._p.set(x, y, z), this._q, this._s); }
  _land(a, px, pz, rmin, rmax, needTree = true, tries = 30) {
    for (let k = 0; k < tries; k++) {
      const ang = this.rng() * 6.283, r = rmin + this.rng() * (rmax - rmin), x = px + Math.cos(ang) * r, z = pz + Math.sin(ang) * r;
      if (sdfAt(x, z) < 8 || (needTree && this.chunks.nearestTree(x, z, 12) === null)) continue;
      a.x = x; a.z = z; a.h = this.rng() * 6.283; return true;
    }
    return false;
  }
  _water(a, px, pz, rmin, rmax, tries = 40) {
    for (let k = 0; k < tries; k++) {
      const ang = this.rng() * 6.283, r = rmin + this.rng() * (rmax - rmin), x = px + Math.cos(ang) * r, z = pz + Math.sin(ang) * r;
      if (sdfAt(x, z) > -6 || groundY(x, z) > lake.level - 0.8 || lake.drained) continue;
      a.x = x; a.z = z; a.h = this.rng() * 6.283; return true;
    }
    return false;
  }
  _swimGoal(a, d = 14) { for (let k = 0; k < 8; k++) { const ang = a.h + (this.rng() - 0.5) * 2.4, x = a.x + Math.sin(ang) * d, z = a.z + Math.cos(ang) * d; if (sdfAt(x, z) < -6 && groundY(x, z) < lake.level - 0.8) { a.tx = x; a.tz = z; return true; } } a.h += 2; return false; }
  _walk(a, v, dt, turn = 5) {
    a.h += angDiff(a.h, Math.atan2(a.tx - a.x, a.tz - a.z)) * Math.min(1, dt * turn);
    const nx = a.x + Math.sin(a.h) * v * dt, nz = a.z + Math.cos(a.h) * v * dt;
    const tr = this.chunks.nearestTree(nx, nz, 1.5);
    if (tr && Math.hypot(tr.x - nx, tr.z - nz) < tr.radius + 0.35) { a.h += dt * 4; return; }
    if (sdfAt(nx, nz) < 4) { a.h += dt * 3; return; }
    a.x = nx; a.z = nz;
  }
  /** mood: 0 golden, 1 mist (morning), 2 dusk, 3 night */
  update(dt, player, mood) {
    this.t += dt; this.seen.length = 0; const t = this.t, px = player.x, pz = player.z, P = this.P, life = PRESSURE.life, spd = player.speed || 0;
    const dim = mood >= 2 || mood === 1, still = player.stillT > 3 || player.sitting;
    // (the red fox lives in fox.js now, fully articulated)
    let n = 0;
    // ---- chipmunks: dart, stop, sit up, tail flick
    for (const c of this.chips) {
      if (!c.active) { c.wait -= dt; if (c.wait > 0 || mood >= 2 || SEASON === 'winter' || life < 0.4) continue; if (!this._land(c, px, pz, 10, 28)) { c.wait = 5; continue; } c.active = true; c.st = 'sit'; c.timer = 1 + this.rng() * 2; c.v = 0; }
      const dp = Math.hypot(c.x - px, c.z - pz); if (dp > 60) { c.active = false; c.wait = 25; continue; }
      c.timer -= dt; let v = 0;
      if (c.st !== 'run' && dp < (still ? 3 : 6) * STEALTH.q) { c.st = 'run'; c.timer = 3; const tr = this.chunks.nearestTree(c.x, c.z, 14); c.tx = tr ? tr.x : c.x + (c.x - px) * 3; c.tz = tr ? tr.z : c.z + (c.z - pz) * 3; }
      if (c.st === 'run') { v = 5.5; this._walk(c, v, dt, 12); if (c.timer <= 0 || Math.hypot(c.tx - c.x, c.tz - c.z) < 0.5) { c.active = false; c.wait = 40 + this.rng() * 40; continue; } }
      else if (c.st === 'sit') { if (c.timer <= 0) { c.st = 'dart'; c.timer = 0.5 + this.rng() * 0.6; const a = this.rng() * 6.283; c.tx = c.x + Math.sin(a) * 3; c.tz = c.z + Math.cos(a) * 3; } }
      else if (c.st === 'dart') { v = 4; this._walk(c, v, dt, 12); if (c.timer <= 0) { c.st = 'sit'; c.timer = 1.5 + this.rng() * 3; } }
      c.v = ease(c.v, v, 10, dt); c.gp += dt * (4 + c.v * 5);
      const y = groundY(c.x, c.z), up = c.st === 'sit' ? 0.7 : 0, hop = Math.abs(Math.sin(c.gp)) * 0.03 * Math.min(1, c.v / 2);
      this._put(P.chip, n, this._root(c.x, y + hop, c.z, c.h, -up));
      this.seen.push({ kind: 'chipmunk', x: c.x, y: y + 0.08, z: c.z, r: 0.15, act: c.st === 'sit' && c.timer > 0.2 ? 'chipmunk-sit' : null }); n++;
    }
    this._fin(P.chip, n);
    // ---- frogs: sit at the water's edge, hop off when you come close
    n = 0;
    for (const f of this.frogs) {
      if (!f.active) { f.wait -= dt; if (f.wait > 0 || SEASON === 'winter' || (SEASON === 'autumn' && this.rng() < 0.7) || life < 0.4) continue; let ok = false; for (let k = 0; k < 30 && !ok; k++) { const a = this.rng() * 6.283, r = 6 + this.rng() * 22, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r, s = sdfAt(x, z); if (s > 0.8 && s < 4 && groundY(x, z) < lake.level + 0.6) { f.x = x; f.z = z; f.h = this.rng() * 6.283; ok = true; } } if (!ok) { f.wait = 6; continue; } f.active = true; f.st = 'sit'; f.hop = 0; f.timer = 3; }
      const dp = Math.hypot(f.x - px, f.z - pz); if (dp > 50) { f.active = false; f.wait = 20; continue; }
      let y = groundY(f.x, f.z);
      if (f.st === 'sit' && dp < (still ? 1.6 : 3.8) * STEALTH.q) { f.st = 'hop'; f.hop = 0; f.timer = 3; f.tx = f.x - (px - f.x) * 0 + Math.sin(f.h) * 0; const l = dp || 1; f.dx = (f.x - px) / l; f.dz = (f.z - pz) / l; }
      let lift = 0;
      if (f.st === 'hop') { f.hop += dt * 2.6; const k = f.hop % 1; lift = Math.sin(k * Math.PI) * 0.3; f.x += f.dx * dt * 1.8; f.z += f.dz * dt * 1.8; f.h = Math.atan2(f.dx, f.dz); if (sdfAt(f.x, f.z) < 0 || f.hop > 3) { if (sdfAt(f.x, f.z) < 0) this.onSplash?.(f.x, f.z); f.active = false; f.wait = 30 + this.rng() * 40; continue; } }
      y = Math.max(groundY(f.x, f.z), lake.level - 0.02) + lift;
      this._put(P.frog, n, this._root(f.x, y, f.z, f.h, -0.1 + (f.st === 'hop' ? -0.5 * Math.cos((f.hop % 1) * Math.PI) : 0)));
      this.seen.push({ kind: 'frog', x: f.x, y: y + 0.05, z: f.z, r: 0.12, act: f.st === 'hop' && lift > 0.12 ? 'frog-hop' : null }); n++;
    }
    this._fin(P.frog, n);
    // ---- beaver: swims slowly out at dusk and in the mist; slaps its tail and dives if you come near
    n = 0; let nw = 0;
    for (const b of this.beaver) {
      if (!b.active) { b.wait -= dt; if (b.wait > 0 || !dim || SEASON === 'winter' || lake.level < lake.floor + 3 || life < 0.4) continue; if (!this._water(b, px, pz, 22, 55)) { b.wait = 8; continue; } b.active = true; b.st = 'swim'; b.v = 0; b.sink = 0; this._swimGoal(b); }
      const dp = Math.hypot(b.x - px, b.z - pz); if (dp > 110) { b.active = false; b.wait = 60; continue; }
      let v = 0;
      if (b.st === 'swim') { v = 0.8; b.timer = (b.timer ?? 0) - dt; b.h += angDiff(b.h, Math.atan2(b.tx - b.x, b.tz - b.z)) * Math.min(1, dt * 1.5); const nx = b.x + Math.sin(b.h) * v * dt, nz = b.z + Math.cos(b.h) * v * dt; if (sdfAt(nx, nz) < -5) { b.x = nx; b.z = nz; } else this._swimGoal(b); if (Math.hypot(b.tx - b.x, b.tz - b.z) < 2) this._swimGoal(b); if (dp < (still ? 9 : 18)) { b.st = 'slap'; b.timer = 0.5; } }
      else if (b.st === 'slap') { b.timer -= dt; if (b.timer <= 0) { this.onSplash?.(b.x - Math.sin(b.h) * 0.4, b.z - Math.cos(b.h) * 0.4, true); b.st = 'dive'; b.sink = 0; } }
      else if (b.st === 'dive') { b.sink += dt; if (b.sink > 1.2) { b.active = false; b.wait = 80 + this.rng() * 60; continue; } }
      b.v = ease(b.v, v, 3, dt);
      const sunk = b.st === 'dive' ? Math.min(1, b.sink / 0.9) * 0.35 : 0, bob = Math.sin(t * 1.6 + b.ph) * 0.012;
      const root = this._root(b.x, lake.level - 0.02 + bob - sunk, b.z, b.h, b.st === 'slap' ? -0.1 : 0).clone();
      this._put(P.beaver, n, root);
      if (b.v > 0.3) { this._put(P.wake, nw++, this._root(b.x, lake.level + 0.015, b.z, b.h)); }
      if (b.st !== 'dive' || b.sink < 0.3) this.seen.push({ kind: 'beaver', x: b.x, y: lake.level + 0.1, z: b.z, r: 0.5, act: b.st === 'slap' || b.st === 'dive' ? 'beaver-slap' : null });
      n++;
    }
    this._fin(P.beaver, n); this._fin(P.wake, nw);
    // ---- wood ducks: a pair afloat by day
    let nd = 0, nh = 0; const pair = this.ducks;
    for (let i = 0; i < 2; i++) {
      const d = pair[i];
      if (!d.active) {
        if (i === 1) { if (pair[0].active) { d.active = true; d.x = pair[0].x + 0.9; d.z = pair[0].z - 0.5; d.h = pair[0].h; d.st = pair[0].st; d.tx = pair[0].tx; d.tz = pair[0].tz; d.timer = pair[0].timer; } continue; }
        d.wait -= dt; if (d.wait > 0 || mood === 3 || SEASON === 'winter' || lake.level < lake.floor + 3 || life < 0.4) continue; if (!this._water(d, px, pz, 25, 60)) { d.wait = 8; continue; } d.active = true; d.st = 'swim'; d.timer = 0; this._swimGoal(d, 12);
      }
      const lead = pair[0], dp = Math.hypot(d.x - px, d.z - pz);
      if (dp > 130 || (i === 0 && lead.st === 'fly' && lead.timer > 3)) { for (const q of pair) { q.active = false; q.wait = 70 + this.rng() * 60; } if (i === 1) continue; break; }
      if (i === 0) {
        if (lead.st === 'swim') { d.timer += dt; if (dp < (still ? 10 : 20) * STEALTH.q) { d.st = 'flee'; d.timer = 0; } if (Math.hypot(d.tx - d.x, d.tz - d.z) < 2) this._swimGoal(d, 12); }
        if (d.st === 'flee') { d.timer += dt; d.tx = d.x + (d.x - px) * 3; d.tz = d.z + (d.z - pz) * 3; if (d.timer > 2) { d.st = 'fly'; d.timer = 0; } }
        if (d.st === 'fly') d.timer += dt;
      } else { d.st = lead.st; d.timer = lead.timer; d.tx = lead.tx + 0.9; d.tz = lead.tz - 0.5; }
      const v = d.st === 'swim' ? 0.45 : d.st === 'flee' ? 2.2 : 3.4;
      d.h += angDiff(d.h, Math.atan2(d.tx - d.x, d.tz - d.z)) * Math.min(1, dt * 1.6);
      const nx = d.x + Math.sin(d.h) * v * dt, nz = d.z + Math.cos(d.h) * v * dt; if (d.st === 'fly' || sdfAt(nx, nz) < -4) { d.x = nx; d.z = nz; } else if (i === 0) this._swimGoal(d, 12);
      const lift = d.st === 'fly' ? Math.min(4, d.timer * 1.6) : 0, bob = Math.sin(t * 1.4 + d.ph) * 0.01, headBob = d.st === 'swim' ? Math.sin(t * 2.2 + d.ph) * 0.12 : 0;
      const m = this._root(d.x, lake.level - 0.005 + bob + lift, d.z, d.h, headBob * 0.3 - lift * 0.08);
      this._put(i === 0 ? P.drake : P.hen, 0, m); if (i === 0) nd = 1; else nh = 1;
      this.seen.push({ kind: 'woodduck', x: d.x, y: lake.level + 0.08 + lift, z: d.z, r: 0.25, act: d.st === 'fly' && lift < 3.5 ? 'woodduck-flight' : null });
    }
    this._fin(P.drake, nd); this._fin(P.hen, nh);
  }
}
