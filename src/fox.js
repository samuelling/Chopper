// Red fox.  Articulated like the deer: a three-part torso with a white chest and belly, a neck and wedge head that turn and
// tilt, ears that swivel, a two-part brush of a tail with a white tip, and four two-jointed legs in black "socks".  Gaits blend
// from a four-beat walk to a diagonal trot to a gallop.  It trots the trail edges at dawn, dusk and night, stops to sniff,
// sits with its tail curled round, and hunts mice the way foxes do: a still listen with the head cocked, a crouch, a high
// arcing leap and a nose-first landing.  It notices you, stares with its ears up, and slips away.  Every pose eases.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt, trailDistAt } from './world.js';
import { mulberry32 } from './noise.js';
import { SEASON } from './season.js';
import { PRESSURE } from './pressure.js';

const C = (h) => new THREE.Color(h), _c = new THREE.Color();
const ball = new THREE.SphereGeometry(1, 10, 8), cyl = new THREE.CylinderGeometry(1, 1, 1, 7), cone = new THREE.ConeGeometry(1, 1, 4);
const FUR = SEASON === 'winter' ? '#c4562a' : '#c95e27', FUR_L = '#dd8540', FUR_D = '#9a4220', WHITE = '#f3ede2', BLACK = '#1e1714', DARK = '#3a2a22';

// ---- geometry.  Faces +z, origin on the ground.  A positive x-rotation tips +y toward +z (a hanging foot swings back).
function bodyGeo() {
  const b = new GeoBuilder();
  const fc = (c, n) => (n.y < -0.3 ? _c.copy(C(WHITE)) : _c.copy(C(FUR)).lerp(C(FUR_D), n.y > 0.6 ? 0.35 : 0).lerp(C(FUR_L), Math.abs(n.x) > 0.7 ? 0.3 : 0));
  b.add(ball, matrix(0, 0.37, 0.13, 0, 0, 0, 0.095, 0.115, 0.15), { faceColorFn: (c, n) => (n.z > 0.45 && n.y < 0.3 ? _c.copy(C(WHITE)) : fc(c, n)) });   // chest, white bib
  b.add(ball, matrix(0, 0.37, -0.05, 0, 0, 0, 0.088, 0.095, 0.2), { faceColorFn: fc });                                                              // barrel
  b.add(ball, matrix(0, 0.385, -0.2, 0, 0, 0, 0.095, 0.105, 0.12), { faceColorFn: fc });                                                             // haunch
  return b.build();
}
function headGeo() {   // pivot at the base of the neck; the neck rises forward to the skull
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0.05, 0.03, -0.6, 0, 0, 0.06, 0.065, 0.1), { faceColorFn: (c, n) => _c.copy(C(n.z > 0.3 && n.y < 0.2 ? WHITE : FUR)) });   // neck, white throat
  b.add(ball, matrix(0, 0.13, 0.1, 0, 0, 0, 0.062, 0.058, 0.068), { faceColorFn: (c, n) => _c.copy(C(n.y < -0.35 ? WHITE : FUR)) });               // skull
  b.add(ball, matrix(0, 0.105, 0.2, 0.12, 0, 0, 0.032, 0.03, 0.075), { faceColorFn: (c, n) => _c.copy(C(n.y < -0.1 ? WHITE : FUR)) });            // muzzle
  for (const s of [-1, 1]) b.add(ball, matrix(s * 0.04, 0.1, 0.12, 0, 0, 0, 0.028, 0.03, 0.04), { color: C(WHITE) });                             // cheeks
  b.add(ball, matrix(0, 0.113, 0.272, 0, 0, 0, 0.014, 0.012, 0.012), { color: C(BLACK) });                                                          // nose
  for (const s of [-1, 1]) {
    b.add(ball, matrix(s * 0.032, 0.145, 0.16, 0, 0, 0, 0.013, 0.011, 0.01), { color: C('#d9a43a') });                                             // amber eye
    b.add(ball, matrix(s * 0.036, 0.145, 0.166, 0, 0, 0, 0.007, 0.009, 0.006), { color: C(BLACK) });
  }
  return b.build();
}
function earGeo() {    // pivot at the base, a tall triangle, black on the back
  const b = new GeoBuilder();
  b.add(cone, matrix(0, 0.045, 0, 0, Math.PI / 4, 0, 0.032, 0.09, 0.012), { faceColorFn: (c, n) => _c.copy(C(n.z < 0 ? BLACK : FUR)) });
  b.add(cone, matrix(0, 0.04, 0.006, 0, Math.PI / 4, 0, 0.02, 0.065, 0.006), { color: C('#f0e2cc') });
  return b.build();
}
function tail1Geo() { const b = new GeoBuilder(); b.add(ball, matrix(0, 0, -0.12, 0, 0, 0, 0.06, 0.062, 0.14), { color: C(FUR) }); return b.build(); }
function tail2Geo() {
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0, -0.1, 0, 0, 0, 0.068, 0.068, 0.13), { faceColorFn: (c, n) => _c.copy(C(c.z < -0.17 ? WHITE : c.z < -0.12 ? FUR_D : FUR)) });   // dark band, white tip
  return b.build();
}
const U = 0.17, LW = 0.19;
function upperGeo(hind) { const b = new GeoBuilder(), w = hind ? 1.3 : 1; b.add(ball, matrix(0, -0.075, 0, 0, 0, 0, 0.035 * w, 0.1, 0.04 * w), { color: C(hind ? FUR : FUR_D) }); return b.build(); }
function lowerGeo() {
  const b = new GeoBuilder();
  b.add(cyl, matrix(0, -0.09, 0, 0, 0, 0, 0.016, 0.18, 0.016), { color: C(DARK) });          // black stocking
  b.add(ball, matrix(0, -0.185, 0.015, 0, 0, 0, 0.022, 0.014, 0.03), { color: C(BLACK) });   // paw
  return b.build();
}
const FSH = [new THREE.Vector3(0.055, 0.34, 0.17), new THREE.Vector3(-0.055, 0.34, 0.17)];
const HIP = [new THREE.Vector3(0.06, 0.35, -0.22), new THREE.Vector3(-0.06, 0.35, -0.22)];
const NECK = new THREE.Vector3(0, 0.42, 0.22), TAIL = new THREE.Vector3(0, 0.41, -0.29), TAIL2 = new THREE.Vector3(0, 0, -0.23);
const EAR = [new THREE.Vector3(0.035, 0.17, 0.09), new THREE.Vector3(-0.035, 0.17, 0.09)], KNEE = new THREE.Vector3(0, -U, 0);

const ease = (cur, tgt, k, dt) => cur + (tgt - cur) * Math.min(1, dt * k);
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const TAU = Math.PI * 2;
const PH_WALK = [0.25, 0.75, 0, 0.5], PH_TROT = [0, 0.5, 0.5, 0], PH_GALLOP = [0.5, 0.6, 0, 0.1];

export class Fox {
  constructor(scene, chunks, { mobile = false } = {}) {
    this.chunks = chunks; this.rng = mulberry32(4242); this.t = 0; this.seen = [];
    this.parts = { body: makeInstanced(bodyGeo(), 1), head: makeInstanced(headGeo(), 1), ear: makeInstanced(earGeo(), 2), t1: makeInstanced(tail1Geo(), 1), t2: makeInstanced(tail2Geo(), 1),
      upF: makeInstanced(upperGeo(false), 2), upH: makeInstanced(upperGeo(true), 2), low: makeInstanced(lowerGeo(), 4) };
    for (const p of Object.values(this.parts)) { scene.add(p.fill); scene.add(p.line); }
    this.f = { active: false, wait: 40, x: 0, z: 0, h: 0, v: 0, st: 'trot', timer: 0, gp: 0, gait: 1, amp: 0, side: 1, yb: 0, ph: this.rng() * 6,
      // eased pose: crouch 0..1, sit 0..1, headP (+down), headY, headR (cock), ears (-back..+forward), tailUp, tailCurl, leap height, pitch
      pose: { crouch: 0, sit: 0, headP: 0, headY: 0, headR: 0, ears: 0.6, tailUp: 0.2, tailCurl: 0, lift: 0, pitch: 0 }, leap: null, px: 0, pz: 0, chkT: 0 };
    this._r = new THREE.Matrix4(); this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._u = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._one = new THREE.Vector3(1, 1, 1);
  }
  _attach(out, parent, pivot, rx, ry, rz) { this._e.set(rx, ry, rz, 'YXZ'); this._q.setFromEuler(this._e); this._b.compose(pivot, this._q, this._one); return out.multiplyMatrices(parent, this._b); }
  _put(p, i, m) { p.fill.setMatrixAt(i, m); p.line.setMatrixAt(i, m); }
  _blocked(x, z, r = 0.3) {
    const sd = sdfAt(x, z); if (sd < 3 || sd > 156) return true;
    let hit = false; this.chunks.colliders.query(x, z, r, (c) => { if (!hit && Math.hypot(x - c.x, z - c.z) < c.r + r) hit = true; });
    return hit;
  }
  _steer(f, want, look) {
    const free = (h) => { for (const d of [0.4, 1.0, look]) if (this._blocked(f.x + Math.sin(h) * d, f.z + Math.cos(h) * d)) return false; return true; };
    if (free(want)) return want;
    for (const off of [0.4, 0.8, 1.3, 1.9, 2.6]) for (const s of [f.side, -f.side]) { const h = want + s * off; if (free(h)) { f.side = s; return h; } }
    return null;
  }
  _go(f, want, speed, dt, turnRate) {
    const h = this._steer(f, want, Math.max(1.6, speed * 0.7 + 1));
    if (h === null) { f.h += f.side * turnRate * 0.7 * dt; return; }
    f.h += Math.max(-turnRate * dt, Math.min(turnRate * dt, angDiff(f.h, h)));
    const sp = speed * Math.max(0.3, 1 - Math.abs(angDiff(f.h, h)) / 1.3);
    let nx = f.x + Math.sin(f.h) * sp * dt, nz = f.z + Math.cos(f.h) * sp * dt;
    this.chunks.colliders.query(nx, nz, 1, (c) => { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), min = c.r + 0.25; if (d < min) { const m = d || 1e-4; nx = c.x + dx / m * min; nz = c.z + dz / m * min; } });
    if (sdfAt(nx, nz) < 2.5 || sdfAt(nx, nz) > 158) return;
    f.x = nx; f.z = nz;
  }
  _spawn(f, player) {
    for (let k = 0; k < 50; k++) {
      const a = this.rng() * TAU, r = 30 + this.rng() * 28, x = player.pos.x + Math.cos(a) * r, z = player.pos.z + Math.sin(a) * r;
      if (sdfAt(x, z) < 8 || this._blocked(x, z, 0.6)) continue;
      if (trailDistAt(x, z) > 25 && this.rng() < 0.7) continue;                   // foxes like the edges of trails and clearings
      Object.assign(f, { x, z, h: this.rng() * TAU, active: true, st: 'trot', timer: 5 + this.rng() * 5, v: 0, yb: groundY(x, z), leap: null, chkT: 0, px: x, pz: z });
      return true;
    }
    return false;
  }
  _wanderGoal(f, spread = 1.6, d = 10) { const a = f.h + (this.rng() - 0.5) * spread; f.tx = f.x + Math.sin(a) * d; f.tz = f.z + Math.cos(a) * d; }

  /** mood: 0 day, 1 morning mist, 2 dusk, 3 night */
  update(dt, player, mood) {
    this.t += dt; this.seen.length = 0; const P = this.parts, f = this.f, t = this.t, r = this.rng, po = f.pose;
    const dim = mood >= 1, still = player.stillT > 3 || player.sitting, spd = player.speed || 0;
    let shown = 0;
    if (!f.active) {
      f.wait -= dt;
      if (f.wait <= 0 && PRESSURE.life >= 0.5 && (dim || r() < 0.002) && this._spawn(f, player)) this._wanderGoal(f);
      else if (f.wait <= 0) f.wait = 6;
    }
    if (f.active) {
      const dx = f.x - player.pos.x, dz = f.z - player.pos.z, dp = Math.hypot(dx, dz), toP = Math.atan2(-dx, -dz), away = Math.atan2(dx, dz);
      if (dp > 130) { f.active = false; f.wait = 60; }
      else {
        f.timer -= dt; let v = 0, gait = 1, turn = 3.2, want = null;
        if (f.st !== f.lastSt) { f.lastSt = f.st; f.stT = 0; } f.stT += dt;                          // time in the current state
        let tgt = { crouch: 0, sit: 0, headP: 0.15, headY: 0, headR: 0, ears: 0.5, tailUp: 0.15, tailCurl: 0, pitch: 0 };
        const aware = dp < (still ? 12 : 22) || (spd > 4.5 && dp < 32);
        if (f.st !== 'flee' && f.st !== 'stare' && f.st !== 'leap' && aware) { f.st = 'stare'; f.timer = still ? 5 + r() * 3 : 1.6 + r(); }
        switch (f.st) {
          case 'trot': {
            want = Math.atan2(f.tx - f.x, f.tz - f.z); v = 1.7; gait = 1;
            tgt.headP = 0.25 + 0.06 * Math.sin(t * 0.9 + f.ph); tgt.headY = 0.25 * Math.sin(t * 0.6 + f.ph); tgt.tailUp = 0.05;
            if (Math.hypot(f.tx - f.x, f.tz - f.z) < 1.5) this._wanderGoal(f);
            if (f.timer <= 0) { const k = r(); f.st = k < 0.35 ? 'sniff' : k < 0.6 ? 'listen' : k < 0.78 ? 'sit' : 'walk'; f.timer = { sniff: 2.5, listen: 2.2, sit: 5, walk: 4 }[f.st] + r() * 3; }
            break;
          }
          case 'walk': {
            want = Math.atan2(f.tx - f.x, f.tz - f.z); v = 0.55; gait = 0; tgt.headP = 0.75; tgt.headY = 0.35 * Math.sin(t * 1.3 + f.ph); tgt.tailUp = -0.05;   // nose to the ground, quartering
            if (Math.hypot(f.tx - f.x, f.tz - f.z) < 1.2) this._wanderGoal(f, 2.2, 5);
            if (f.timer <= 0) { f.st = 'trot'; f.timer = 5 + r() * 6; this._wanderGoal(f); }
            break;
          }
          case 'sniff': {
            tgt.headP = 0.95 + 0.06 * Math.sin(t * 7); tgt.headY = 0.2 * Math.sin(t * 2.3); tgt.ears = 0.2; tgt.tailUp = -0.1;
            if (f.timer <= 0) { f.st = 'trot'; f.timer = 4 + r() * 6; this._wanderGoal(f); }
            break;
          }
          case 'listen': {   // a mouse under the grass: still, head cocked, ears forward... then the pounce
            tgt.headP = 0.55; tgt.headR = 0.32 * Math.sin(t * 1.6); tgt.ears = 1; tgt.crouch = Math.max(0, Math.min(1, (f.stT - 0.6) * 0.9)); tgt.tailUp = 0.05;
            if (f.timer <= 0) { f.st = 'leap'; f.leap = { t: 0, x0: f.x, z0: f.z }; }
            break;
          }
          case 'leap': {     // up high, arc over, nose first into the grass
            const L = f.leap; L.t += dt; const k = Math.min(1, L.t / 0.75), d = 1.4 * k;
            f.x = L.x0 + Math.sin(f.h) * d; f.z = L.z0 + Math.cos(f.h) * d;
            po.lift = 0.75 * Math.sin(Math.PI * k); tgt.pitch = lerp(-0.7, 1.1, k); tgt.crouch = 0; tgt.headP = 0.6; tgt.tailUp = 0.6 - k; tgt.ears = 1;
            if (k >= 1) { po.lift = 0; f.st = r() < 0.5 ? 'sniff' : 'sit'; f.timer = 2 + r() * 2; f.leap = null; }
            break;
          }
          case 'sit': {
            tgt.sit = 1; tgt.headP = -0.1 + 0.05 * Math.sin(t * 0.5); tgt.headY = 0.5 * Math.sin(t * 0.3 + f.ph); tgt.tailCurl = 1; tgt.ears = 0.7;
            if (f.timer <= 0) { f.st = 'trot'; f.timer = 5 + r() * 5; this._wanderGoal(f); }
            break;
          }
          case 'stare': {    // it has seen you: stock-still, ears up, head on you
            f.h += Math.max(-2 * dt, Math.min(2 * dt, angDiff(f.h, toP) * (Math.abs(angDiff(f.h, toP)) > 1 ? 1 : 0.3)));
            tgt.headY = Math.max(-1, Math.min(1, angDiff(f.h, toP))); tgt.headP = -0.15; tgt.ears = 1; tgt.tailUp = 0.1;
            if (f.timer <= 0) { if (still && dp > 7) { f.st = 'trot'; f.timer = 4; f.tx = f.x + Math.sin(away + 1) * 10; f.tz = f.z + Math.cos(away + 1) * 10; } else { f.st = 'flee'; f.timer = 6; } }
            break;
          }
          case 'flee': {     // a fast, low gallop with the brush streaming out behind
            want = away; v = 6.5; gait = 2; turn = 6; tgt.headP = 0.25; tgt.ears = -0.6; tgt.tailUp = 0.5;
            if (f.timer <= 0 || dp > 70) { f.active = false; f.wait = 90 + r() * 90; }
            break;
          }
        }
        if (f.active) {
          // move
          f.v = ease(f.v, v, f.st === 'flee' ? 3 : 5, dt);
          if (want !== null && f.v > 0.03) this._go(f, want, f.v, dt, turn);
          if (want !== null && v > 0.2) { f.chkT += dt; if (f.chkT > 1.5) { if (Math.hypot(f.x - f.px, f.z - f.pz) < 0.3) { f.side = -f.side; this._wanderGoal(f, 3); } f.px = f.x; f.pz = f.z; f.chkT = 0; } }
          // pose eases toward its target: nothing snaps
          for (const k of Object.keys(tgt)) if (k !== 'lift') po[k] = ease(po[k], tgt[k], k === 'pitch' ? 9 : k === 'crouch' || k === 'sit' ? 4 : 5, dt);
          // gait
          f.gait = ease(f.gait, gait, 4, dt); const gl = Math.min(1, f.gait), gg = Math.max(0, f.gait - 1);
          const stride = f.gait < 1 ? lerp(0.45, 0.8, f.gait) : lerp(0.8, 1.7, gg);
          f.amp = ease(f.amp, f.v > 0.06 ? 1 : 0, 7, dt); f.gp = (f.gp + dt * f.v / stride) % 1;
          const mv = Math.min(1, f.v / 1.2), bound = gg;
          const y = groundY(f.x, f.z), fy = groundY(f.x + Math.sin(f.h) * 0.3, f.z + Math.cos(f.h) * 0.3), by = groundY(f.x - Math.sin(f.h) * 0.3, f.z - Math.cos(f.h) * 0.3);
          const slope = -Math.atan2(fy - by, 0.6);
          f.yb = ease(f.yb, y, 16, dt);
          const bob = (f.gait < 1 ? 0.008 * Math.sin(TAU * f.gp * 2) * mv : 0.012 * Math.abs(Math.sin(TAU * f.gp)) * (1 - bound)) + bound * 0.09 * Math.abs(Math.sin(TAU * f.gp + 0.5));
          const rock = bound * 0.2 * Math.sin(TAU * f.gp + 1.1), roll = 0.04 * mv * Math.sin(TAU * f.gp) * (1 - bound);
          const sitTilt = -0.55 * po.sit, crouchDrop = 0.1 * po.crouch + 0.13 * po.sit;
          this._e.set(0, f.h, 0, 'YXZ'); this._q.setFromEuler(this._e);
          this._r.compose(this._p.set(f.x, f.yb + bob + po.lift - crouchDrop * 0.6, f.z), this._q, this._one);
          const body = this._attach(this._a, this._r, this._p.set(0, 0, 0), slope + rock + po.pitch + sitTilt, 0, roll).clone();
          this._put(P.body, 0, body);
          // head on its neck: it counters the body's rocking so the eyes stay level, as a hunter's do
          const nod = 0.06 * mv * Math.sin(TAU * f.gp * 2) * (1 - bound);
          const head = this._attach(this._a, body, NECK, po.headP - (rock + po.pitch + sitTilt) * 0.7 + nod, po.headY, po.headR).clone();
          this._put(P.head, 0, head);
          for (let s = 0; s < 2; s++) {
            const sg = s === 0 ? 1 : -1, flick = Math.max(0, Math.sin(t * 0.7 + s * 2 + f.ph) - 0.96) * 12;
            this._attach(this._u, head, EAR[s], -0.15 + 0.35 * po.ears + flick * 0.3, sg * (0.2 - 0.35 * po.ears), sg * 0.18);
            this._put(P.ear, s, this._u);
          }
          // the brush: hangs and sways at a walk, lifts and streams when it runs, wraps round its feet when it sits
          const sway = (0.12 + 0.18 * mv) * Math.sin(TAU * f.gp + 0.6) * (1 - po.sit) + 0.06 * Math.sin(t * 1.3 + f.ph);
          const t1 = this._attach(this._a, body, TAIL, -0.55 + 0.75 * po.tailUp - 0.3 * po.sit, sway + po.tailCurl * 1.1, 0).clone();
          this._put(P.t1, 0, t1);
          this._attach(this._u, t1, TAIL2, 0.3 - 0.4 * po.tailUp + 0.25 * po.sit, sway * 0.8 + po.tailCurl * 1.0, 0); this._put(P.t2, 0, this._u);
          // legs: walk (four-beat), trot (diagonal pairs), gallop; folded under when it sits or crouches
          const ph = [0, 1, 2, 3].map((i) => (f.gait < 1 ? lerp(PH_WALK[i], PH_TROT[i], gl) : lerp(PH_TROT[i], PH_GALLOP[i], gg)));
          const A = lerp(lerp(0.45, 0.6, gl), 1.0, gg), F = lerp(lerp(0.8, 1.0, gl), 1.3, gg), tuck = Math.max(po.sit, po.crouch * 0.6, f.leap ? Math.sin(Math.PI * Math.min(1, f.leap.t / 0.75)) : 0);
          for (let i = 0; i < 4; i++) {
            const hind = i >= 2, s = i & 1, a = TAU * (f.gp + ph[i]), sw = Math.max(0, -Math.cos(a)) * f.amp;
            let a1 = (hind ? -0.35 : 0.05) + A * f.amp * Math.sin(a) * (hind ? 0.9 : 1), a2 = (hind ? 0.7 : 0.1) + F * sw * (hind ? 0.85 : 1);
            if (hind) { a1 = lerp(a1, -1.3, po.sit) + po.crouch * -0.4; a2 = lerp(a2, 2.3, po.sit) + po.crouch * 0.7; }
            else { a1 = lerp(a1, 0.55, po.sit) + po.crouch * 0.35; a2 = lerp(a2, 0.05, po.sit) + po.crouch * 0.5; }   // sitting: forelegs straight down under the raised chest
            if (f.leap) { a1 += hind ? 0.6 * tuck : -0.8 * tuck; a2 += 0.9 * tuck; }
            this._attach(this._u, body, hind ? HIP[s] : FSH[s], a1, 0, 0); this._put(hind ? P.upH : P.upF, s, this._u);
            this._attach(this._a, this._u, KNEE, a2, 0, 0); this._put(P.low, i, this._a);
          }
          this.seen.push({ kind: 'fox', x: f.x, y: y + 0.35 + po.lift, z: f.z, r: 0.45, act: f.leap && po.lift > 0.15 ? 'fox-pounce' : po.sit > 0.7 ? 'fox-sit' : null });
          shown = 1;
        }
      }
    }
    for (const [k, p] of Object.entries(P)) {
      const c = shown * (k === 'low' ? 4 : k === 'ear' || k === 'upF' || k === 'upH' ? 2 : 1);
      p.fill.count = p.line.count = c; p.fill.instanceMatrix.needsUpdate = p.line.instanceMatrix.needsUpdate = true; p.fill.visible = p.line.visible = c > 0;
    }
  }
}
