// Disc golf: six holes in the woods on the east side (people really do play a course over that way).  Each hole has a
// tee pad and a chain basket.  E at the tee picks up your disc; hold the action to wind up (the power fills, then fades
// if you hold too long), let go to throw the way you face.  It flies, fades left at the end, clatters off trees, and
// lies where it lands: walk to it, E, and throw again.  Through the chains of the basket and the hole is done.  Par 3.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, sdfAt, trailDistAt, waterDepthAt, WORLD } from './world.js';
import { RUN } from './run.js';

const PAR = 3, NH = 6;
const powerAt = (t) => (t < 1.1 ? t / 1.1 : Math.max(0.35, 1 - (t - 1.1) * 0.6));
const OL = simpleToon('#141210', { side: THREE.BackSide });
const M = (geo, col, par, x, y, z, sx = 1, sy = 1, sz = 1, ol = true) => { const m = new THREE.Mesh(geo, simpleToon(col)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); par.add(m); if (ol) { const o = new THREE.Mesh(geo, OL); o.position.copy(m.position); o.scale.set(sx * 1.08 + 0.01, sy * 1.08 + 0.01, sz * 1.08 + 0.01); par.add(o); } return m; };

export class DiscGolf {
  constructor(scene, camera, colliders, { audio, fx } = {}) {
    this.scene = scene; this.camera = camera; this.colliders = colliders; this.audio = audio; this.fx = fx;
    this.holes = this._layout(); this.state = 'idle'; this.t = 0;
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 14), box = new THREE.BoxGeometry(1, 1, 1);
    for (const [i, h] of this.holes.entries()) {
      const g = new THREE.Group(); g.position.set(h.bx, groundY(h.bx, h.bz), h.bz); scene.add(g);
      M(cyl, '#8a8e94', g, 0, 0.8, 0, 0.03, 1.6, 0.03);                                 // pole
      M(cyl, '#9aa0a6', g, 0, 0.62, 0, 0.32, 0.2, 0.32);                                 // the basket
      M(cyl, '#e8c23a', g, 0, 1.38, 0, 0.33, 0.07, 0.33);                                // the yellow band
      M(cyl, '#8a8e94', g, 0, 1.95, 0, 0.012, 0.7, 0.012, false); M(box, '#ff6a2a', g, 0.14, 2.2, 0, 0.26, 0.17, 0.01);   // a flag, to find it from the tee
      for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283; M(cyl, '#c8ccd0', g, Math.cos(a) * 0.18, 1.06, Math.sin(a) * 0.18, 0.006, 0.6, 0.006, false); }   // chains
      const tg = new THREE.Group(), ty = groundY(h.tx, h.tz); tg.position.set(h.tx, ty, h.tz); tg.rotation.y = Math.atan2(h.bx - h.tx, h.bz - h.tz); scene.add(tg);
      M(box, '#a8a49a', tg, 0, 0.04, 0, 1.3, 0.12, 2.6);                                 // tee pad
      M(box, '#5e4a38', tg, 0.95, 0.6, -1.1, 0.08, 1.2, 0.08); M(box, '#2f5a36', tg, 0.95, 1.15, -1.1, 0.5, 0.4, 0.05);   // the sign
      for (let d = 0; d <= i; d++) M(box, '#f2efe6', tg, 0.95 - 0.16 + d * 0.065, 1.15, -1.07, 0.035, 0.22, 0.02, false);   // the hole number, in tally marks
      h.par = PAR; h.len = Math.round(Math.hypot(h.bx - h.tx, h.bz - h.tz));
    }
    // the disc: in hand (on the camera) and in the world
    const dg = new THREE.CylinderGeometry(0.11, 0.1, 0.022, 18);
    this.hand = new THREE.Mesh(dg, simpleToon('#e8462a')); this.hand.position.set(0.22, -0.22, -0.42); this.hand.rotation.set(0.9, 0, -0.4); this.hand.visible = false; camera.add(this.hand);
    this.disc = new THREE.Mesh(dg, simpleToon('#e8462a')); this.disc.visible = false; scene.add(this.disc);
    const el = document.createElement('div'); el.id = 'discmeter'; el.className = 'hidden'; el.innerHTML = '<div class="sbar"><i></i></div><small>arm</small>'; document.body.appendChild(el); this.el = el; this.bar = el.querySelector('i');
    const S = (RUN.s.disc ||= { hole: 0, strokes: 0, scores: [], lie: null });
    this.S = S;
    if (S.lie) { this.disc.position.set(S.lie.x, groundY(S.lie.x, S.lie.z) + 0.03, S.lie.z); this.disc.visible = true; }
  }
  /** lay out six holes along the woods on the east side: each tee a few steps past the last basket */
  _layout() {
    const out = [], flat = (x, z) => { const g = groundY(x, z); return Math.abs(groundY(x + 3, z) - g) < 1.4 && Math.abs(groundY(x, z + 3) - g) < 1.4; };
    const ok = (x, z) => { const sd = sdfAt(x, z); return sd > 14 && sd < 140 && waterDepthAt(x, z) <= 0 && trailDistAt(x, z) > 3 && flat(x, z) && x < WORLD.maxX - 40; };
    let sx = null, sz = null;
    for (let z = -300; z < 300 && sx === null; z += 9) for (let x = 360; x > 120; x -= 9) if (ok(x, z) && sdfAt(x, z) > 30 && sdfAt(x, z) < 70) { sx = x; sz = z; break; }
    if (sx === null) return out;
    let tx = sx, tz = sz, dir = Math.PI / 2;   // heading south (+z) along the east side
    for (let i = 0; i < NH; i++) {
      let best = null;
      for (let k = 0; k < 40 && !best; k++) { const a = dir + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.12, L = 34 + (i * 7) % 22, bx = tx + Math.sin(a) * L, bz = tz + Math.cos(a) * L; if (ok(bx, bz)) best = { bx, bz, a }; }
      if (!best) break;
      out.push({ tx, tz, bx: best.bx, bz: best.bz }); dir = best.a;
      const nt = [best.bx + Math.sin(dir + 0.5) * 7, best.bz + Math.cos(dir + 0.5) * 7]; tx = nt[0]; tz = nt[1];
    }
    return out;
  }
  get holding() { return this.state === 'hold' || this.state === 'wind'; }
  get hole() { return this.holes[this.S.hole] || null; }
  /** what E would do here: 'tee' (start the hole), 'disc' (pick up your disc where it lies), or null */
  canPick(p) {
    if (this.holding || this.state === 'fly' || !this.hole) return null;
    if (this.S.lie) return Math.hypot(p.x - this.S.lie.x, p.z - this.S.lie.z) < 2.5 ? 'disc' : null;
    return Math.hypot(p.x - this.hole.tx, p.z - this.hole.tz) < 3 ? 'tee' : null;
  }
  pick(p) {
    const what = this.canPick(p); if (!what) return null;
    if (what === 'disc') { this.disc.visible = false; this.S.lie = null; }
    else { this.S.strokes = 0; }
    this.state = 'hold'; this.t = 0; RUN.save?.(); return what;
  }
  press() { if (this.state === 'hold') { this.state = 'wind'; this.t = 0; } }
  release(player) {
    if (this.state !== 'wind') return;
    const pw = powerAt(this.t), D = 3 + 52 * pw, yaw = player.yaw, loft = Math.max(-0.2, Math.min(0.7, player.pitch));
    const dist = D * (1 - Math.max(0, loft - 0.25) * 0.8);   // thrown too high, it stalls
    const c = this.camera.position;
    this.fl = { x0: c.x, z0: c.z, y0: c.y - 0.3, fx: -Math.sin(yaw), fz: -Math.cos(yaw), rx: -Math.cos(yaw), rz: Math.sin(yaw), dist, peak: 1 + 3 * pw + loft * 4, dur: 0.6 + dist / 26, u: 0 };
    this.S.strokes++; this.state = 'fly'; RUN.save?.(); this.audio?.castSwish?.();
  }
  _land(x, z, why) {
    let lx = x, lz = z;
    if (waterDepthAt(x, z) > 0.2) {   // in the water: a penalty stroke, back to where it went in
      this.S.strokes++; why = 'water';
      for (let u = this.fl.u; u > 0; u -= 0.02) { const p = this._at(u); if (waterDepthAt(p.x, p.z) <= 0) { lx = p.x; lz = p.z; break; } }
      this.fx?.splash?.(x, groundY(x, z) + 0.2, z, 8);
    }
    this.S.lie = { x: lx, z: lz }; this.disc.position.set(lx, groundY(lx, lz) + 0.03, lz); this.disc.rotation.set(0, 0, 0); this.disc.visible = true;
    this.state = 'idle'; RUN.save?.(); this.onLie?.(why, Math.round(Math.hypot(lx - this.hole.bx, lz - this.hole.bz)));
  }
  _at(u) { const f = this.fl, d = f.dist * u, side = -0.14 * f.dist * Math.max(0, u - 0.55) ** 2 * 2.2; return { x: f.x0 + f.fx * d + f.rx * side, z: f.z0 + f.fz * d + f.rz * side, y: f.y0 + (f.peak) * 4 * u * (1 - u) * 0.9 - u * 0.4 }; }
  update(dt, { ok = true, cameraMode = false } = {}) {
    this.t += dt;
    if (!ok && this.holding) { this.state = 'idle'; if (!this.S.lie && this.S.strokes > 0) { /* the disc stays in your pocket */ } }
    this.hand.visible = this.holding && !cameraMode; this.el.classList.toggle('hidden', !(this.state === 'wind'));
    if (this.state === 'wind') { const pw = powerAt(this.t); this.bar.style.width = `${Math.round(pw * 100)}%`; this.bar.style.background = pw > 0.9 ? '#8fd06a' : '#ffe29a'; }
    if (this.state !== 'fly') return;
    const f = this.fl, h = this.hole; f.u = Math.min(1, f.u + dt / f.dur);
    const p = this._at(f.u), gy = groundY(p.x, p.z);
    this.disc.visible = true; this.disc.position.set(p.x, Math.max(gy + 0.05, p.y), p.z); this.disc.rotation.set(0.15, this.t * 20, -0.2);
    // the chains: through the basket's catching height, close to the pole
    const bd = Math.hypot(p.x - h.bx, p.z - h.bz), by = groundY(h.bx, h.bz);
    if (bd < 0.38 && p.y > by + 0.55 && p.y < by + 1.45) { this._holed(); return; }
    // a tree in the way
    let hit = null; this.colliders.query(p.x, p.z, 0.5, (c) => { if (!hit && Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.1) hit = c; });
    if (hit && f.u > 0.05) { this.audio?.chop?.(0.3); const back = this._at(Math.max(0, f.u - 0.04)); this._land(back.x, back.z, 'tree'); return; }
    if (p.y <= gy + 0.05 && f.u > 0.2) { this._land(p.x, p.z, 'ground'); return; }
    if (f.u >= 1) this._land(p.x, p.z, 'ground');
  }
  _holed() {
    const S = this.S, n = S.strokes; S.scores[S.hole] = n; this.disc.visible = false; S.lie = null; this.state = 'idle';
    this.audio?.reelTick?.();   // the chains rattle
    const done = S.hole + 1 >= this.holes.length;
    if (done) { const tot = S.scores.reduce((a, b) => a + b, 0), par = PAR * this.holes.length; S.best = Math.min(S.best ?? 99, tot); S.rounds = (S.rounds || 0) + 1; S.hole = 0; S.scores = []; RUN.save?.(); this.onRound?.(tot, par, S.best); }
    else { S.hole++; RUN.save?.(); this.onHoled?.(n, PAR, S.hole); }
  }
}
