// White-tailed deer. They graze, freeze and watch you when you come close or move fast, and bolt with the white flag of the tail up.
// If you sit still they relax and drift nearer. Articulated like the squirrels (neck, tail, four legs) in the same toon style.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt } from './world.js';
import { mulberry32 } from './noise.js';
import { SEASON } from './season.js';
import { PRESSURE } from './pressure.js';

const C = (h) => new THREE.Color(h);
const _c = new THREE.Color();
const ball = new THREE.SphereGeometry(1, 9, 7), cyl = new THREE.CylinderGeometry(1, 1, 1, 6);
const COAT = { spring: '#9b7650', summer: '#a97b4a', autumn: '#8d6742', winter: '#8e7d6c' }[SEASON] || '#8d6742';
const COAT_D = '#6e5236', BELLY = '#e6dcc6', NOSE = '#241c17', WHITE = '#f4efe4';

function bodyGeo() {                         // pivot: (0, 1, 0); faces +z
  const b = new GeoBuilder();
  const fc = (c, n) => (n.y < -0.3 ? _c.copy(C(BELLY)) : _c.copy(C(COAT)).lerp(C(COAT_D), n.y > 0.5 ? 0.25 : 0));
  b.add(ball, matrix(0, 0.98, 0, 0, 0, 0, 0.26, 0.27, 0.66), { faceColorFn: fc });
  b.add(ball, matrix(0, 1.0, 0.36, 0, 0, 0, 0.25, 0.27, 0.3), { faceColorFn: fc });      // chest
  b.add(ball, matrix(0, 1.0, -0.4, 0, 0, 0, 0.27, 0.29, 0.3), { faceColorFn: fc });      // haunch
  return b.build();
}
function headGeo() {                         // pivot at the shoulder, (0, 1.1, 0.55): neck rises forward, head at the end
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0.2, 0.17, 0.7, 0, 0, 0.13, 0.13, 0.34), { color: C(COAT) });   // neck
  b.add(ball, matrix(0, 0.43, 0.38, -0.25, 0, 0, 0.1, 0.12, 0.22), { color: C(COAT) }); // skull
  b.add(ball, matrix(0, 0.37, 0.58, -0.3, 0, 0, 0.055, 0.06, 0.1), { color: C('#b79c7a') }); // muzzle
  b.add(ball, matrix(0, 0.37, 0.67, 0, 0, 0, 0.03, 0.025, 0.03), { color: C(NOSE) });
  for (const s of [-1, 1]) {
    b.add(ball, matrix(s * 0.075, 0.5, 0.33, 0, 0, s * 0.8, 0.03, 0.1, 0.045), { color: C(COAT_D) });  // ears
    b.add(ball, matrix(s * 0.085, 0.45, 0.45, 0, 0, 0, 0.014, 0.014, 0.014), { color: C(NOSE) });    // eyes
  }
  return b.build();
}
function antlerGeo() {
  const b = new GeoBuilder(); const col = C('#d8c8a8');
  for (const s of [-1, 1]) {
    b.add(cyl, matrix(s * 0.06, 0.6, 0.3, -0.2, 0, s * 0.35, 0.011, 0.2, 0.011), { color: col });
    b.add(cyl, matrix(s * 0.12, 0.72, 0.26, -0.5, 0, s * 0.1, 0.009, 0.14, 0.009), { color: col });
    b.add(cyl, matrix(s * 0.1, 0.66, 0.34, -0.9, 0, s * 0.5, 0.008, 0.09, 0.008), { color: col });
  }
  return b.build();
}
function legGeo() {                          // pivot at the top; hangs 0.9 m down
  const b = new GeoBuilder();
  b.add(cyl, matrix(0, -0.22, 0, 0, 0, 0, 0.055, 0.46, 0.055), { color: C(COAT) });
  b.add(cyl, matrix(0, -0.65, 0.01, 0, 0, 0, 0.032, 0.5, 0.032), { color: C('#7d6244') });
  b.add(ball, matrix(0, -0.9, 0.025, 0, 0, 0, 0.034, 0.03, 0.05), { color: C(NOSE) });
  return b.build();
}
function tailGeo() {
  const b = new GeoBuilder();
  b.add(ball, matrix(0, -0.07, -0.05, 0.3, 0, 0, 0.05, 0.14, 0.04), { faceColorFn: (c, n) => _c.copy(C(n.z < 0 ? WHITE : COAT_D)) });
  return b.build();
}
const SHOULDER = [new THREE.Vector3(0.12, 0.92, 0.42), new THREE.Vector3(-0.12, 0.92, 0.42)];
const HIPS = [new THREE.Vector3(0.12, 0.92, -0.42), new THREE.Vector3(-0.12, 0.92, -0.42)];
const NECK = new THREE.Vector3(0, 1.1, 0.55), TAIL = new THREE.Vector3(0, 1.12, -0.68);
const ease = (cur, tgt, k, dt) => cur + (tgt - cur) * Math.min(1, dt * k);
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export class Deer {
  constructor(scene, chunks, { mobile = false } = {}) {
    this.chunks = chunks; this.rng = mulberry32(1717); this.t = 0; this.seen = []; this.onMoment = null; this.onSnort = null;
    const cap = 2;
    this.parts = { body: makeInstanced(bodyGeo(), cap), head: makeInstanced(headGeo(), cap), antler: makeInstanced(antlerGeo(), cap), leg: makeInstanced(legGeo(), cap * 4), tail: makeInstanced(tailGeo(), cap) };
    for (const p of Object.values(this.parts)) { scene.add(p.fill); scene.add(p.line); }
    this.list = [];
    for (let i = 0; i < (mobile ? 1 : 2); i++) this.list.push({ active: false, wait: 25 + i * 40, x: 0, z: 0, h: 0, st: 'graze', timer: 0, ph: this.rng() * 6, v: 0, gp: 0, head: 1, headYaw: 0, tailUp: 0, buck: i === 0, calm: 0, tx: 0, tz: 0, sc: 0.95 + this.rng() * 0.15, moment: false, alertT: 0 });
    this._root = new THREE.Matrix4(); this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._one = new THREE.Vector3(1, 1, 1);
  }
  _attach(out, parent, pivot, rx, ry, rz) { this._e.set(rx, ry, rz, 'YXZ'); this._q.setFromEuler(this._e); this._b.compose(pivot, this._q, this._one); return out.multiplyMatrices(parent, this._b); }
  _put(p, i, m) { p.fill.setMatrixAt(i, m); p.line.setMatrixAt(i, m); }
  _spawn(d, player) {
    const fwd = player.yaw;
    for (let k = 0; k < 40; k++) {
      const ang = this.rng() * 6.283, r = 38 + this.rng() * 34, x = player.x + Math.cos(ang) * r, z = player.z + Math.sin(ang) * r;
      if (sdfAt(x, z) < 12 || this.chunks.nearestTree(x, z, 14) === null) continue;
      const gy = groundY(x, z); if (Math.abs(groundY(x + 3, z) - gy) > 1.4) continue;
      Object.assign(d, { x, z, h: this.rng() * 6.283, st: 'graze', timer: 4 + this.rng() * 6, active: true, v: 0, head: 1, headYaw: 0, tailUp: 0, calm: 0, moment: false, alertT: 0 });
      return true;
    }
    return false;
  }
  _toward(d, tx, tz, speed, dt, turn = 5) {
    const want = Math.atan2(tx - d.x, tz - d.z); d.h += angDiff(d.h, want) * Math.min(1, dt * turn);
    // steer round trunks and the lake edge
    const nx = d.x + Math.sin(d.h) * speed * dt, nz = d.z + Math.cos(d.h) * speed * dt;
    const tr = this.chunks.nearestTree(nx, nz, 1.6);
    if (tr && Math.hypot(tr.x - nx, tr.z - nz) < tr.radius + 0.6) { d.h += (angDiff(d.h, Math.atan2(tr.x - d.x, tr.z - d.z)) > 0 ? -1 : 1) * dt * 4; return; }
    if (sdfAt(nx, nz) < 4) { d.h += dt * 3; return; }
    d.x = nx; d.z = nz;
  }
  update(dt, player, still = 0, sitting = false) {
    this.t += dt; this.seen.length = 0; const t = this.t, P = this.parts;
    const keep = Math.ceil(this.list.length * PRESSURE.life - 1e-6);
    let n = 0, di = 0;
    for (const d of this.list) {
      if (di++ >= keep) { d.active = false; continue; }
      if (!d.active) { d.wait -= dt; if (d.wait <= 0 && !this._spawn(d, player)) d.wait = 8; if (!d.active) continue; }
      const dx = d.x - player.x, dz = d.z - player.z, dp = Math.hypot(dx, dz);
      if (dp > 150) { d.active = false; d.wait = 40 + this.rng() * 60; continue; }
      const calm = sitting || still > 3, spd = player.speed || 0;
      const alertR = calm ? 16 : 34, fleeR = calm ? 6 : (spd > 4.5 ? 28 : 13);
      // does it see you? (in front of its head, roughly)
      const seen = dp < alertR || (spd > 4.5 && dp < 45);
      let goal = null, v = 0;
      if (d.st === 'flee') {
        const l = dp || 1; goal = [d.x + dx / l * 30, d.z + dz / l * 30]; v = 9.5; d.timer -= dt; d.tailUp = ease(d.tailUp, 1, 10, dt); d.head = ease(d.head, 0, 6, dt);
        if (d.timer <= 0 || dp > 90) { d.active = false; d.wait = (50 + this.rng() * 80) / Math.max(0.3, PRESSURE.life); continue; }
      } else if (seen && dp < fleeR) {
        d.st = 'flee'; d.timer = 7; this.onSnort?.();
      } else if (seen) {
        if (d.st !== 'alert') { d.st = 'alert'; d.alertT = 0; this.onSnort?.(); }
        d.alertT += dt; d.h += angDiff(d.h, Math.atan2(-dx, -dz)) * Math.min(1, dt * 4);
        d.head = ease(d.head, 0, 5, dt); d.tailUp = ease(d.tailUp, 0.35, 4, dt); d.calm = 0;
        if (d.alertT > 8 && calm) { d.st = 'graze'; d.timer = 5; }
      } else {
        if (d.st === 'alert') { d.st = 'graze'; d.timer = 3; }
        d.tailUp = ease(d.tailUp, 0, 3, dt);
        d.timer -= dt;
        if (d.st === 'graze') {
          d.head = ease(d.head, 1 + 0.0 * Math.sin(t + d.ph), 3, dt);
          if (d.timer <= 0) { // lift the head, look about, then shuffle on
            d.st = 'walk'; d.timer = 3 + this.rng() * 5;
            const stillBias = calm && dp > 14 ? Math.atan2(-dx, -dz) : d.h + (this.rng() - 0.5) * 2;      // a calm watcher draws them nearer
            const a = stillBias + (this.rng() - 0.5) * 0.8; d.tx = d.x + Math.sin(a) * 7; d.tz = d.z + Math.cos(a) * 7;
          }
        } else if (d.st === 'walk') {
          goal = [d.tx, d.tz]; v = 1.1; d.head = ease(d.head, 0.35, 3, dt);
          if (d.timer <= 0) { d.st = 'graze'; d.timer = 6 + this.rng() * 10; }
        }
        if (calm && dp < 24) { d.calm += dt; if (d.calm > 8 && !d.moment) { d.moment = true; this.onMoment?.(); } }
      }
      d.v = ease(d.v, v, 4, dt);
      if (goal) this._toward(d, goal[0], goal[1], d.v, dt, d.st === 'flee' ? 9 : 3);
      d.gp += dt * (2.2 + d.v * 1.5);
      const y = groundY(d.x, d.z), fy = groundY(d.x + Math.sin(d.h) * 0.6, d.z + Math.cos(d.h) * 0.6), by = groundY(d.x - Math.sin(d.h) * 0.6, d.z - Math.cos(d.h) * 0.6);
      const slope = -Math.atan2(fy - by, 1.2), mv = Math.min(1, d.v / 1.4), bound = d.st === 'flee' ? 1 : 0;
      const bob = mv * (bound ? Math.abs(Math.sin(d.gp)) * 0.28 : Math.abs(Math.sin(d.gp)) * 0.025);
      this._e.set(0, d.h, 0, 'YXZ'); this._q.setFromEuler(this._e);
      this._root.compose(this._p.set(d.x, y + bob, d.z), this._q, this._s.set(d.sc, d.sc, d.sc));
      // the body pitches with the ground and (when bounding) with the stride
      this._attach(this._a, this._root, this._p.set(0, 0, 0), slope + bound * 0.12 * Math.sin(d.gp + 1), 0, 0);
      const body = this._a.clone(); this._put(P.body, n, body);
      const grazeP = 1.15 * d.head + 0.05 * Math.sin(t * 0.8 + d.ph);                       // head down to the ground when grazing
      const headP = grazeP - 0.1 * (1 - d.head) - bound * 0.2;
      this._attach(this._a, body, NECK, headP, d.st === 'graze' ? 0.15 * Math.sin(t * 0.5 + d.ph) : 0, 0);
      this._put(P.head, n, this._a); this._put(P.antler, n, this._a);
      this._attach(this._a, body, TAIL, -0.2 - d.tailUp * 1.9, 0, d.tailUp > 0.3 ? 0 : 0.2 * Math.sin(t * 2.2 + d.ph) * (1 - d.tailUp));
      this._put(P.tail, n, this._a);
      for (let s = 0; s < 2; s++) {
        const fore = Math.sin(d.gp + s * Math.PI) * (bound ? 0.9 : 0.45) * mv, hind = Math.sin(d.gp + (1 - s) * Math.PI + 0.3) * (bound ? 1.0 : 0.4) * mv;
        this._attach(this._a, body, SHOULDER[s], bound ? fore + 0.2 : fore, 0, 0); this._put(P.leg, n * 4 + s, this._a);
        this._attach(this._a, body, HIPS[s], bound ? hind - 0.3 : hind, 0, 0); this._put(P.leg, n * 4 + 2 + s, this._a);
      }
      this.seen.push({ kind: 'deer', x: d.x, y: y + 1.0 * d.sc, z: d.z, r: 0.9 });
      n++;
    }
    for (const [k, p] of Object.entries(P)) {
      const c = k === 'leg' ? n * 4 : n;
      p.fill.count = p.line.count = c; p.fill.instanceMatrix.needsUpdate = p.line.instanceMatrix.needsUpdate = true; p.fill.visible = p.line.visible = c > 0;
    }
    // only the first deer (the buck) carries antlers
    P.antler.fill.count = P.antler.line.count = Math.min(P.antler.fill.count, 1);
  }
}
