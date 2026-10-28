// Skipping stones, at the three skipping shores (explore.js finds them: a bank of flat stones with a long run of open
// water straight out).  E picks up a stone.  Hold the action, and two things move on the gauge: the arm's power fills
// and then fades if you hold too long, and a needle swings the stone's angle to the water up and down.  Let go when
// the needle is near 20 degrees with the power full.  (About 20 degrees is the real magic angle: Clanet, Hersen and
// Bocquet, "Secrets of successful stone-skipping", Nature, 2004.)  Each touch leaves a ring on the water; ten skips or
// more leaves a chain of rings worth a photo before it fades.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { lake, waterDepthAt, groundY } from './world.js';
import { RUN } from './run.js';

const PERIOD = 1.6, IDEAL = 20, SIGMA = 7, NR = 32;
const angleAt = (t) => 22.5 * (1 - Math.cos((2 * Math.PI * t) / PERIOD));            // 0..45 degrees, up and back down
const powerAt = (t) => (t < 0.95 ? t / 0.95 : Math.max(0.4, 1 - (t - 0.95) * 0.55)); // fills, then the arm tires

export class Skipping {
  constructor(scene, camera, player, { audio, fx, spots }) {
    this.scene = scene; this.camera = camera; this.player = player; this.audio = audio; this.fx = fx; this.spots = spots || [];
    this.state = 'idle'; this.t = 0; this.seen = []; this.rings = [];
    const stoneGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.016, 10), mat = simpleToon('#7d7f86');
    this.hand = new THREE.Mesh(stoneGeo, mat); this.hand.position.set(0.2, -0.2, -0.45); this.hand.rotation.set(0.4, 0, -0.3); this.hand.visible = false; camera.add(this.hand);
    this.stone = new THREE.Mesh(stoneGeo, mat); this.stone.visible = false; this.stone.frustumCulled = false; scene.add(this.stone);
    const ringGeo = new THREE.RingGeometry(0.5, 0.58, 28).rotateX(-Math.PI / 2);
    for (let i = 0; i < NR; i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#f2f7f4', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 4; scene.add(m); this.rings.push({ m, t: 9 }); }
    this._ri = 0;
    // the gauge: a quarter dial for the angle (the sweet spot shaded) and a bar for the power
    const el = document.createElement('div'); el.id = 'skipmeter'; el.className = 'hidden';
    const arc = (a0, a1, r) => { const p = (a) => [60 - r * Math.cos((a * Math.PI) / 180), 66 - r * Math.sin((a * Math.PI) / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    el.innerHTML = `<svg viewBox="0 0 120 76" width="150" height="95"><path d="${arc(0, 45, 50)}" stroke="rgba(244,230,200,.35)" stroke-width="12" fill="none"/><path d="${arc(IDEAL - 5, IDEAL + 5, 50)}" stroke="#8fd06a" stroke-width="12" fill="none"/><line data-needle x1="60" y1="66" x2="10" y2="66" stroke="#ffe29a" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="66" r="4" fill="#ffe29a"/><text x="4" y="74" font-size="8" fill="#f4e6c8">0°</text><text x="22" y="22" font-size="8" fill="#f4e6c8">45°</text></svg><div class="sbar"><i data-power></i></div><small>angle &middot; arm</small>`;
    document.body.appendChild(el); this.el = el;
    this.needle = el.querySelector('[data-needle]'); this.bar = el.querySelector('[data-power]');
    RUN.s.skip ||= { best: 0, throws: 0 };
  }
  get holding() { return this.state === 'hold' || this.state === 'wind'; }
  /** the skipping shore you are standing at, if any */
  near(p) { return this.spots.find((s) => Math.hypot(p.x - s.x, p.z - s.z) < 7) || null; }
  pickUp() { if (this.state === 'fly') return false; this.state = 'hold'; this.t = 0; this.audio?.thud?.(); return true; }
  drop() { if (this.holding) this.state = 'idle'; }
  press() { if (this.state !== 'hold') return; this.state = 'wind'; this.t = 0; }
  release() {
    if (this.state !== 'wind') return;
    const p = this.player, a = angleAt(this.t), pw = powerAt(this.t), q = Math.exp(-(((a - IDEAL) / SIGMA) ** 2));
    let n = Math.round(1 + 21 * pw ** 1.4 * q + (Math.random() - 0.5) * 1.6); n = Math.max(0, Math.min(22, a > 38 ? 0 : n));
    // the path: out the way you face, each hop shorter and lower
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), cam = this.camera.position, y0 = lake.level;
    const pts = []; let x = cam.x + fx * 0.5, z = cam.z + fz * 0.5, d = 4 + 11 * pw, landed = null;
    pts.push({ x, z, y: cam.y - 0.3 });
    for (let k = 0; k <= n; k++) {
      x += fx * d; z += fz * d;
      const wet = waterDepthAt(x, z) > 0.15;
      pts.push({ x, z, y: wet ? y0 : groundY(x, z), wet, last: k === n || !wet, d });
      if (!wet) { landed = k === 0 ? 'bank' : 'shore'; break; }
      d = (k === 0 ? d * 0.5 : d * 0.86) * (0.8 + 0.2 * q);
    }
    this.path = pts; this.seg = 0; this.st = 0; this.state = 'fly'; this.n = 0; this.landed = landed;
    this.info = { a, pw, q, planned: n };
    this.audio?.castSwish?.();
  }
  _ring(x, z, k) { const r = this.rings[this._ri++ % NR]; r.m.position.set(x, lake.level + 0.03, z); r.t = 0; r.k = k; r.m.visible = true; }
  /** each frame (real time) */
  update(dt, { ok = true, cameraMode = false } = {}) {
    this.t += dt; this.clock = (this.clock || 0) + dt; this.seen.length = 0;
    if (!ok && this.holding) this.state = 'idle';
    this.hand.visible = this.holding && !cameraMode;
    this.el.classList.toggle('hidden', !(this.holding && !cameraMode));
    if (this.holding) {
      const w = this.state === 'wind', a = w ? angleAt(this.t) : 0, pw = w ? powerAt(this.t) : 0, r = (a * Math.PI) / 180;
      this.needle.setAttribute('x2', (60 - 50 * Math.cos(r)).toFixed(1)); this.needle.setAttribute('y2', (66 - 50 * Math.sin(r)).toFixed(1));
      this.bar.style.width = `${Math.round(pw * 100)}%`; this.bar.style.background = pw > 0.9 ? '#8fd06a' : '#ffe29a';
      this.hand.position.set(0.2 - pw * 0.08, -0.2 + pw * 0.04, -0.45 + pw * 0.1);
    }
    if (this.state === 'fly') {
      const A = this.path[this.seg], B = this.path[this.seg + 1];
      if (!B) { this._end(); }
      else {
        const dur = this.seg === 0 ? 0.32 + B.d * 0.025 : 0.1 + B.d * 0.045; this.st += dt;
        const u = Math.min(1, this.st / dur), hop = this.seg === 0 ? 0 : B.d * 0.09;
        this.stone.visible = true; this.stone.position.set(A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u + hop * 4 * u * (1 - u) + (this.seg === 0 ? 0.6 * Math.sin(Math.PI * u) : 0) + 0.02, A.z + (B.z - A.z) * u);
        this.stone.rotation.y += dt * 30;
        if (u >= 1) {
          if (B.wet && !B.last) { this.n++; this._ring(B.x, B.z, 1); this.audio?.plop?.(); this.fx?.splash?.(B.x, lake.level + 0.05, B.z, 3); }
          else if (B.wet) { this._ring(B.x, B.z, 1.4); this.audio?.dip?.(0.7); this.fx?.splash?.(B.x, lake.level + 0.05, B.z, 8); }
          else this.audio?.thud?.();
          this.seg++; this.st = 0;
        }
      }
    }
    // the rings spread and fade over several seconds; a long chain is a photo
    let cx = 0, cz = 0, cn = 0, x0 = null, x1 = null;
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt; const s = 1 + r.t * 1.6 * r.k, o = Math.max(0, 0.75 * (1 - r.t / 7));
      r.m.scale.setScalar(s); r.m.material.opacity = o; if (o <= 0) { r.m.visible = false; continue; }
      if (r.t < 6) { cx += r.m.position.x; cz += r.m.position.z; cn++; x0 ||= r.m.position; x1 = r.m.position; }
    }
    if (this.lastN >= 10 && this.clock - this.lastAt < 6 && cn >= 6) this.seen.push({ kind: 'skiprings', act: 'skip-rings', x: cx / cn, y: lake.level + 0.3, z: cz / cn, r: Math.max(3, x0.distanceTo(x1) / 2) });
  }
  _end() {
    this.stone.visible = false; this.state = 'idle';
    const S = RUN.s.skip, n = this.n, prev = S.best; S.throws++; if (n > S.best) S.best = n; RUN.save?.();
    this.lastN = n; this.lastAt = this.clock;
    this.onDone?.(n, { ...this.info, landed: this.landed, prev, best: S.best });
  }
}
