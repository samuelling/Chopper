// White-tailed deer. They graze, freeze and watch you when you come close or move fast, trot off when you press on, and bolt with the white flag of the tail up.
// If you sit still they relax and drift nearer.  Articulated like a real animal: a barrel body, a tapering neck and wedge head with moving ears, and four
// two-jointed legs (shoulder/hip, knee/hock) that walk in a four-beat sequence, trot in diagonal pairs and gallop when bolting.
// They steer round trunks, boulders, walls and the lake edge by looking ahead, and unstick themselves if they ever wedge.
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
const COAT_D = '#6e5236', COAT_L = '#b08a60', BELLY = '#e6dcc6', NOSE = '#241c17', WHITE = '#f4efe4', LOWER = '#7a6046';

// ---- geometry.  Body faces +z, origin on the ground.  A positive x-rotation tips +y toward +z and swings a hanging foot backward.
function bodyGeo() {
  const b = new GeoBuilder();
  const fc = (c, n) => (n.y < -0.25 ? _c.copy(C(BELLY)) : _c.copy(C(COAT)).lerp(C(COAT_D), n.y > 0.55 ? 0.3 : 0).lerp(C(COAT_L), n.y < 0.1 ? 0.18 : 0));
  b.add(ball, matrix(0, 0.88, 0.0, 0, 0, 0, 0.2, 0.21, 0.5), { faceColorFn: fc });        // ribcage and back
  b.add(ball, matrix(0, 0.86, 0.3, 0, 0, 0, 0.19, 0.24, 0.24), { faceColorFn: fc });      // deep chest
  b.add(ball, matrix(0, 0.9, -0.34, 0, 0, 0, 0.21, 0.24, 0.28), { faceColorFn: fc });     // rounded haunch
  b.add(ball, matrix(0, 0.73, 0.0, 0, 0, 0, 0.15, 0.1, 0.42), { color: C(BELLY) });       // pale belly
  b.add(ball, matrix(0, 1.0, 0.1, 0, 0, 0, 0.09, 0.05, 0.4), { color: C(COAT_D) });       // darker back line
  b.add(ball, matrix(0, 0.92, -0.58, 0.3, 0, 0, 0.1, 0.12, 0.06), { color: C('#cdbb9c') }); // pale rump
  return b.build();
}
function headGeo() {   // origin at the base of the neck on the shoulders; neutral pose = neck rising forward, head up
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0.08, 0.1, -0.75, 0, 0, 0.13, 0.14, 0.22), { color: C(COAT) });         // neck base
  b.add(ball, matrix(0, 0.26, 0.24, -1.0, 0, 0, 0.095, 0.095, 0.2), { color: C(COAT) });       // upper neck
  b.add(ball, matrix(0, 0.14, 0.2, -0.9, 0, 0, 0.07, 0.05, 0.12), { color: C(BELLY) });         // pale throat
  b.add(ball, matrix(0, 0.43, 0.34, 0.3, 0, 0, 0.085, 0.095, 0.15), { color: C(COAT) });      // skull
  b.add(ball, matrix(0, 0.385, 0.5, 0.5, 0, 0, 0.05, 0.055, 0.11), { color: C('#b79c7a') }); // muzzle
  b.add(ball, matrix(0, 0.345, 0.52, 0.5, 0, 0, 0.034, 0.022, 0.07), { color: C(WHITE) });   // pale chin
  b.add(ball, matrix(0, 0.345, 0.6, 0, 0, 0, 0.03, 0.026, 0.03), { color: C(NOSE) });         // nose
  for (const s of [-1, 1]) {
    b.add(ball, matrix(s * 0.07, 0.44, 0.4, 0, 0, 0, 0.026, 0.026, 0.026), { color: C('#d8c8a8') }); // eye ring
    b.add(ball, matrix(s * 0.08, 0.44, 0.41, 0, 0, 0, 0.014, 0.015, 0.015), { color: C(NOSE) });    // eye
  }
  return b.build();
}
function earGeo() {    // pivot at the base, points up
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0.1, 0, 0, 0, 0, 0.034, 0.115, 0.05), { color: C(COAT) });
  b.add(ball, matrix(0, 0.1, 0.012, 0, 0, 0, 0.024, 0.095, 0.03), { color: C('#d9c7a6') });
  return b.build();
}
function antlerGeo() { // head-local, drawn once for the buck
  const b = new GeoBuilder(); const col = C('#d8c8a8');
  for (const s of [-1, 1]) {
    b.add(cyl, matrix(s * 0.065, 0.58, 0.29, -0.3, 0, s * 0.3, 0.012, 0.16, 0.012), { color: col });
    b.add(cyl, matrix(s * 0.115, 0.72, 0.27, 0.45, 0, s * 0.2, 0.011, 0.14, 0.011), { color: col });
    b.add(cyl, matrix(s * 0.125, 0.84, 0.35, 0.9, 0, s * 0.05, 0.009, 0.1, 0.009), { color: col });
    b.add(cyl, matrix(s * 0.085, 0.62, 0.37, 1.1, 0, s * 0.3, 0.008, 0.08, 0.008), { color: col });
    b.add(cyl, matrix(s * 0.125, 0.76, 0.24, 0.2, 0, s * 0.6, 0.008, 0.09, 0.008), { color: col });
  }
  return b.build();
}
const L1 = 0.4, L2 = 0.43;   // upper and lower leg length
function upperGeo(hind) {  // hangs from the shoulder/hip pivot; the knee is L1 below
  const b = new GeoBuilder(), w = hind ? 1.25 : 1;
  b.add(ball, matrix(0, -0.17, 0, 0, 0, 0, 0.075 * w, 0.23, 0.08 * w), { color: C(COAT) });
  b.add(cyl, matrix(0, -0.33, 0, 0, 0, 0, 0.04, 0.16, 0.04), { color: C(LOWER) });
  return b.build();
}
function lowerGeo() {    // pivot at the knee/hock; hangs L2
  const b = new GeoBuilder();
  b.add(cyl, matrix(0, -0.2, 0, 0, 0, 0, 0.026, 0.41, 0.026), { color: C(LOWER) });
  b.add(ball, matrix(0, -0.015, 0, 0, 0, 0, 0.034, 0.04, 0.034), { color: C(LOWER) });          // joint
  b.add(ball, matrix(0, -0.425, 0.02, 0.15, 0, 0, 0.032, 0.03, 0.05), { color: C(NOSE) });     // hoof
  return b.build();
}
function tailGeo() {
  const b = new GeoBuilder();
  b.add(ball, matrix(0, -0.1, -0.04, 0.35, 0, 0, 0.045, 0.15, 0.035), { faceColorFn: (c, n) => _c.copy(C(n.z < 0 ? WHITE : COAT_D)) });
  return b.build();
}

// pivots in body space (+x is the animal's left)
const FSH = [new THREE.Vector3(0.115, 0.82, 0.36), new THREE.Vector3(-0.115, 0.82, 0.36)];
const HIP = [new THREE.Vector3(0.12, 0.8, -0.4), new THREE.Vector3(-0.12, 0.8, -0.4)];
const NECK = new THREE.Vector3(0, 0.98, 0.42), TAIL = new THREE.Vector3(0, 1.1, -0.64);
const EAR = [new THREE.Vector3(0.08, 0.47, 0.3), new THREE.Vector3(-0.08, 0.47, 0.3)];
const KNEE = new THREE.Vector3(0, -L1, 0);

const ease = (cur, tgt, k, dt) => cur + (tgt - cur) * Math.min(1, dt * k);
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const TAU = Math.PI * 2;
// leg order: front-left, front-right, hind-left, hind-right.  Walk is a four-beat sequence (HL, FL, HR, FR), trot moves diagonal pairs, gallop strikes in pairs.
const PH_WALK = [0.25, 0.75, 0, 0.5], PH_TROT = [0, 0.5, 0.5, 0], PH_GALLOP = [0.5, 0.58, 0, 0.08];

export class Deer {
  constructor(scene, chunks, { mobile = false } = {}) {
    this.chunks = chunks; this.rng = mulberry32(1717); this.t = 0; this.seen = []; this.onMoment = null; this.onSnort = null;
    const cap = 2;
    this.parts = { body: makeInstanced(bodyGeo(), cap), head: makeInstanced(headGeo(), cap), antler: makeInstanced(antlerGeo(), cap), ear: makeInstanced(earGeo(), cap * 2),
      upF: makeInstanced(upperGeo(false), cap * 2), upH: makeInstanced(upperGeo(true), cap * 2), low: makeInstanced(lowerGeo(), cap * 4), tail: makeInstanced(tailGeo(), cap) };
    for (const p of Object.values(this.parts)) { scene.add(p.fill); scene.add(p.line); }
    this.list = [];
    for (let i = 0; i < (mobile ? 1 : 2); i++) this.list.push({ active: false, wait: 25 + i * 40, x: 0, z: 0, h: 0, st: 'graze', timer: 0, ph: this.rng() * 6, v: 0, gp: this.rng(), head: 1, headYaw: 0, tailUp: 0, buck: i === 0, calm: 0, tx: 0, tz: 0, sc: 0.95 + this.rng() * 0.15, moment: false, alertT: 0,
      gait: 0, amp: 0, ears: 0, earFlick: [0, 0], earT: [2 + this.rng() * 4, 3 + this.rng() * 4], stepT: 0, stepH: 0, nextStep: 3 + this.rng() * 5, side: 1, px: 0, pz: 0, chkT: 0, stuck: 0, yb: 0 });
    this._root = new THREE.Matrix4(); this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._u = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._one = new THREE.Vector3(1, 1, 1);
  }
  _attach(out, parent, pivot, rx, ry, rz) { this._e.set(rx, ry, rz, 'YXZ'); this._q.setFromEuler(this._e); this._b.compose(pivot, this._q, this._one); return out.multiplyMatrices(parent, this._b); }
  _put(p, i, m) { p.fill.setMatrixAt(i, m); p.line.setMatrixAt(i, m); }

  // ---- looking ahead: is a body-sized circle at (x, z) clear of trunks, boulders, walls, the shore, the park edge and steep ground?
  _blocked(x, z, r = 0.55) {
    const sd = sdfAt(x, z); if (sd < 4 || sd > 156) return true;
    let hit = false;
    this.chunks.colliders.query(x, z, r, (c) => { if (!hit && Math.hypot(x - c.x, z - c.z) < c.r + r) hit = true; });
    if (hit) return true;
    const y = groundY(x, z); return Math.abs(groundY(x + 1.4, z) - y) > 1.0 || Math.abs(groundY(x, z + 1.4) - y) > 1.0;
  }
  /** a heading near `want` with open ground ahead (left/right alternatives, preferring the side it last used) */
  _steer(d, want, look) {
    const free = (h) => { for (const f of [0.6, 1.4, look]) if (this._blocked(d.x + Math.sin(h) * f, d.z + Math.cos(h) * f)) return false; return true; };
    if (free(want)) return want;
    for (const off of [0.35, 0.7, 1.1, 1.6, 2.2]) for (const s of [d.side, -d.side]) { const h = want + s * off; if (free(h)) { d.side = s; return h; } }
    return null;
  }
  _spawn(d, player) {
    for (let k = 0; k < 60; k++) {
      const ang = this.rng() * 6.283, r = 38 + this.rng() * 34, x = player.x + Math.cos(ang) * r, z = player.z + Math.sin(ang) * r;
      if (sdfAt(x, z) < 12 || this.chunks.nearestTree(x, z, 14) === null) continue;
      if (this._blocked(x, z, 1.1)) continue;
      const gy = groundY(x, z); if (Math.abs(groundY(x + 3, z) - gy) > 1.4) continue;
      Object.assign(d, { x, z, h: this.rng() * 6.283, st: 'graze', timer: 4 + this.rng() * 6, active: true, v: 0, head: 1, headYaw: 0, tailUp: 0, calm: 0, moment: false, alertT: 0, gait: 0, amp: 0, stepT: 0, px: x, pz: z, chkT: 0, stuck: 0 });
      return true;
    }
    return false;
  }
  /** turn toward `want` at a limited rate, steer round obstacles, move, and resolve any overlap.  Returns true if it could move. */
  _go(d, want, speed, dt, turnRate) {
    const look = Math.max(2.6, speed * 0.9 + 1.4);
    let h = this._steer(d, want, look);
    if (h === null) { d.h += d.side * turnRate * 0.8 * dt; d.v = ease(d.v, 0, 8, dt); return false; }        // boxed in: turn on the spot until a way opens
    d.h += Math.max(-turnRate * dt, Math.min(turnRate * dt, angDiff(d.h, h)));
    const slow = Math.max(0.25, 1 - Math.abs(angDiff(d.h, h)) / 1.4);                                       // slow for sharp turns
    const sp = speed * slow;
    let nx = d.x + Math.sin(d.h) * sp * dt, nz = d.z + Math.cos(d.h) * sp * dt;
    this.chunks.colliders.query(nx, nz, 1.2, (c) => {                                                       // never overlap a trunk
      const dx = nx - c.x, dz = nz - c.z, dd = Math.hypot(dx, dz), min = c.r + 0.42;
      if (dd < min) { const m = dd || 1e-4; nx = c.x + dx / m * min; nz = c.z + dz / m * min; }
    });
    if (sdfAt(nx, nz) < 3.5 || sdfAt(nx, nz) > 158) return false;
    d.x = nx; d.z = nz; return true;
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
      const seen = dp < alertR || (spd > 4.5 && dp < 45);
      let want = null, v = 0, turn = 2.2, gait = 0;
      const away = Math.atan2(dx, dz);
      if (d.st === 'flee') {
        want = away; v = 9.5; turn = 6; gait = 2; d.timer -= dt; d.tailUp = ease(d.tailUp, 1, 10, dt); d.head = ease(d.head, 0, 6, dt); d.ears = ease(d.ears, -0.4, 8, dt);
        if (d.timer <= 0 || dp > 90) { d.active = false; d.wait = (50 + this.rng() * 80) / Math.max(0.3, PRESSURE.life); continue; }
      } else if (d.st === 'trot') {
        want = away + 0.5 * Math.sin(t * 0.3 + d.ph); v = 3.2; turn = 3.2; gait = 1; d.timer -= dt; d.tailUp = ease(d.tailUp, 0.6, 5, dt); d.head = ease(d.head, 0.05, 5, dt); d.ears = ease(d.ears, 0.4, 6, dt);
        if (seen && dp < fleeR) { d.st = 'flee'; d.timer = 7; this.onSnort?.(); }
        else if (d.timer <= 0 || dp > 60) { d.st = 'alert'; d.alertT = 0; }
      } else if (seen && dp < fleeR) {
        d.st = 'flee'; d.timer = 7; this.onSnort?.();
      } else if (seen) {
        if (d.st !== 'alert') { d.st = 'alert'; d.alertT = 0; this.onSnort?.(); }
        d.alertT += dt; d.h += Math.max(-3 * dt, Math.min(3 * dt, angDiff(d.h, Math.atan2(-dx, -dz))));
        d.head = ease(d.head, 0, 5, dt); d.tailUp = ease(d.tailUp, 0.35, 4, dt); d.calm = 0; d.ears = ease(d.ears, 1, 8, dt);
        if (d.alertT > 8 && calm) { d.st = 'graze'; d.timer = 5; }
        else if (d.alertT > 6 && !calm && dp < alertR * 0.75) { d.st = 'trot'; d.timer = 4 + this.rng() * 3; }       // pressed on: it quietly trots off
      } else {
        if (d.st === 'alert') { d.st = 'graze'; d.timer = 3; }
        d.tailUp = ease(d.tailUp, 0, 3, dt); d.ears = ease(d.ears, d.st === 'graze' ? -0.15 : 0.25, 3, dt);
        d.timer -= dt;
        if (d.st === 'graze') {
          const lift = Math.sin(t * 0.5 + d.ph * 2) > 0.86;                                                           // now and then it lifts its head to look about
          d.head = ease(d.head, lift ? 0.1 : 1, lift ? 4 : 2.5, dt);
          d.nextStep -= dt;
          if (d.stepT > 0) { d.stepT -= dt; want = d.stepH; v = 0.35; gait = 0; turn = 1.2; }                       // a few slow steps along the grass
          else if (d.nextStep <= 0) { d.stepT = 1.6 + this.rng() * 1.6; d.nextStep = 5 + this.rng() * 8; d.stepH = calm && dp > 14 ? Math.atan2(-dx, -dz) + (this.rng() - 0.5) * 0.6 : d.h + (this.rng() - 0.5) * 1.6; }
          if (d.timer <= 0) {
            d.st = 'walk'; d.timer = 3 + this.rng() * 5;
            const bias = calm && dp > 14 ? Math.atan2(-dx, -dz) : d.h + (this.rng() - 0.5) * 2;                       // a calm watcher draws them nearer
            const a = bias + (this.rng() - 0.5) * 0.8; d.tx = d.x + Math.sin(a) * 9; d.tz = d.z + Math.cos(a) * 9;
          }
        } else if (d.st === 'walk') {
          want = Math.atan2(d.tx - d.x, d.tz - d.z); v = 1.1; d.head = ease(d.head, 0.35, 3, dt); turn = 1.8;
          if (d.timer <= 0 || Math.hypot(d.tx - d.x, d.tz - d.z) < 1.2) { d.st = 'graze'; d.timer = 6 + this.rng() * 10; }
        }
        if (calm && dp < 24) { d.calm += dt; if (d.calm > 8 && !d.moment) { d.moment = true; this.onMoment?.(); } }
      }
      // move (limited turning, look-ahead steering) and un-stick
      d.v = ease(d.v, v, 4, dt);
      let moved = false;
      if (want !== null && d.v > 0.05) moved = this._go(d, want, d.v, dt, turn);
      if (want !== null && v > 0.2) {
        d.chkT += dt;
        if (d.chkT > 1.5) {
          const gone = Math.hypot(d.x - d.px, d.z - d.pz); d.px = d.x; d.pz = d.z; d.chkT = 0;
          if (gone < Math.min(1.2, v * 1.5 * 0.25)) {
            d.stuck++; d.side = -d.side; d.h += d.side * (1.2 + this.rng());
            if (d.st === 'walk' || d.st === 'graze') { d.st = 'graze'; d.stepT = 0; d.timer = 2; d.tx = d.x; d.tz = d.z; }
            if (d.stuck >= 3 && dp > 22) { d.active = false; d.wait = 20; continue; }                                  // wedged and out of sight: slip away and respawn
            if (d.stuck >= 6) { d.x += Math.sin(d.h) * 1.5; d.z += Math.cos(d.h) * 1.5; d.stuck = 0; }
          } else d.stuck = 0;
        }
      } else { d.chkT = 0; d.px = d.x; d.pz = d.z; }
      // gait: freq in cycles/second from speed and gait, blended smoothly
      d.gait = ease(d.gait, gait, 4, dt);
      const stride = d.gait < 1 ? lerp(1.25, 2.2, d.gait) : lerp(2.2, 3.8, d.gait - 1);
      const mv = Math.min(1, d.v / 1.1);
      d.amp = ease(d.amp, d.v > 0.08 ? 1 : 0, 6, dt);
      d.gp = (d.gp + dt * d.v / stride) % 1;
      const gl = Math.min(1, d.gait), gg = Math.max(0, d.gait - 1), bound = Math.max(0, d.gait - 0.6) / 1.4;
      const y = groundY(d.x, d.z), fy = groundY(d.x + Math.sin(d.h) * 0.7, d.z + Math.cos(d.h) * 0.7), by = groundY(d.x - Math.sin(d.h) * 0.7, d.z - Math.cos(d.h) * 0.7);
      const slope = -Math.atan2(fy - by, 1.4);
      const arc = bound * 0.24 * Math.abs(Math.sin(TAU * d.gp + 0.4));
      const bob = d.gait < 1 ? 0.012 * mv * Math.sin(TAU * d.gp * 2) + 0.02 * gl * Math.abs(Math.sin(TAU * d.gp)) : arc + 0.03;
      const rock = bound * 0.16 * Math.sin(TAU * d.gp + 1.0), roll = 0.03 * mv * Math.sin(TAU * d.gp) * (1 - bound);
      d.yb = ease(d.yb, y, 14, dt);
      this._e.set(0, d.h, 0, 'YXZ'); this._q.setFromEuler(this._e);
      this._root.compose(this._p.set(d.x, d.yb - 0.02 + bob, d.z), this._q, this._s.set(d.sc, d.sc, d.sc));
      this._attach(this._a, this._root, this._p.set(0, 0, 0), slope + rock, 0, roll);
      const body = this._a.clone(); this._put(P.body, n, body);
      // head and neck: down to graze, up to watch, nodding with the stride
      const nod = 0.07 * mv * Math.sin(TAU * d.gp) * (1 - bound) - bound * 0.2;
      const grazeP = 1.2 * d.head + 0.04 * Math.sin(t * 0.8 + d.ph) + (d.st === 'graze' && d.head > 0.7 ? 0.03 * Math.sin(t * 5.5) : 0);   // a little chewing
      const look = d.st === 'alert' ? 0.18 * Math.sin(t * 0.7 + d.ph) : d.st === 'graze' ? 0.3 * Math.sin(t * 0.35 + d.ph) * (1 - d.head * 0.6) : 0;
      this._attach(this._a, body, NECK, grazeP - 0.1 * (1 - d.head) + nod, look, 0);
      const headM = this._a.clone();
      this._put(P.head, n, headM); this._put(P.antler, n, headM);
      for (let s = 0; s < 2; s++) {
        d.earT[s] -= dt; if (d.earT[s] <= 0) { d.earFlick[s] = 1; d.earT[s] = 2 + this.rng() * 5; }
        d.earFlick[s] = Math.max(0, d.earFlick[s] - dt * 5);
        const sgn = s === 0 ? 1 : -1, flick = Math.sin(d.earFlick[s] * Math.PI) * 0.5;
        this._attach(this._u, headM, EAR[s], -0.15 + d.ears * 0.5 - flick, 0, sgn * (0.65 - d.ears * 0.15 + flick * 0.4));
        this._put(P.ear, n * 2 + s, this._u);
      }
      this._attach(this._a, body, TAIL, -0.2 - d.tailUp * 1.9, 0, d.tailUp > 0.3 ? 0 : 0.2 * Math.sin(t * 2.2 + d.ph) * (1 - d.tailUp));
      this._put(P.tail, n, this._a);
      // legs
      const ph = [0, 1, 2, 3].map((i) => (d.gait < 1 ? lerp(PH_WALK[i], PH_TROT[i], gl) : lerp(PH_TROT[i], PH_GALLOP[i], gg)));
      const A = lerp(lerp(0.4, 0.58, gl), 0.95, gg), F = lerp(lerp(0.7, 0.95, gl), 1.15, gg);
      const stomp = d.st === 'alert' ? Math.max(0, Math.sin(Math.PI * ((d.alertT % 3.4) / 0.55))) * ((d.alertT % 3.4) < 0.55 ? 1 : 0) : 0;
      for (let i = 0; i < 4; i++) {
        const hind = i >= 2, s = i & 1, a = TAU * (d.gp + ph[i]), sw = Math.max(0, -Math.cos(a)) * d.amp;
        let a1 = (hind ? -0.3 : 0.03) + A * d.amp * Math.sin(a) * (hind ? 0.9 : 1);
        let a2 = (hind ? 0.55 : 0.12) + F * sw * (hind ? 0.85 : 1);
        if (!hind && i === 0 && stomp > 0) { a1 -= 0.8 * stomp; a2 += 1.3 * stomp; }
        const pivot = hind ? HIP[s] : FSH[s];
        this._attach(this._u, body, pivot, a1, 0, 0); this._put(hind ? P.upH : P.upF, n * 2 + s, this._u);
        this._attach(this._a, this._u, KNEE, a2, 0, 0); this._put(P.low, n * 4 + i, this._a);
      }
      this.seen.push({ kind: 'deer', x: d.x, y: y + 1.0 * d.sc, z: d.z, r: 0.9, act: d.st === 'flee' && d.gait > 1.4 ? 'deer-bound' : d.st === 'alert' && stomp > 0.3 ? 'deer-stomp' : null });
      n++;
    }
    for (const [k, p] of Object.entries(P)) {
      const c = k === 'low' ? n * 4 : (k === 'ear' || k === 'upF' || k === 'upH') ? n * 2 : n;
      p.fill.count = p.line.count = c; p.fill.instanceMatrix.needsUpdate = p.line.instanceMatrix.needsUpdate = true; p.fill.visible = p.line.visible = c > 0;
    }
    // only the first deer (the buck) carries antlers
    P.antler.fill.count = P.antler.line.count = Math.min(P.antler.fill.count, 1);
  }
}
