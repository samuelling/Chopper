// Cel-shaded gray squirrels.  Each one is a small articulated rig (body, head, two-segment tail, four legs) so it
// can bound along the ground, sit up and nibble with its paws at its mouth, look about, flick its tail, and
// scramble up a trunk.  Same toon fill + outline as the trees.
import * as THREE from 'three';
import { STEALTH } from './stealth.js';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt } from './world.js';
import { mulberry32 } from './noise.js';
import { WILDLIFE } from './season.js';

const C = (h) => new THREE.Color(h);
const _c = new THREE.Color();
const ball = new THREE.SphereGeometry(1, 8, 6);
const FUR = '#857c6e', FUR_D = '#6d6559', FUR_WARM = '#a2866a', BELLY = '#ddd3bf', TAIL_L = '#cfc7b6', TAIL_D = '#8d8576', DARK = '#171310';

// ---- parts, each modelled around its own pivot so it can be rotated independently ----
function bodyGeo() {                       // pivot: the hips, (0, 0.13, -0.1)
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0.14, 0.05, 0.12, 0, 0, 0.095, 0.095, 0.19), {
    faceColorFn: (c, n) => (n.y < -0.25 ? _c.copy(C(BELLY)) : _c.copy(C(FUR)).lerp(C(FUR_WARM), n.y > 0.4 ? 0.4 : 0)),
  });
  b.add(ball, matrix(0, 0.14, -0.07, 0, 0, 0, 0.1, 0.1, 0.12), { color: C(FUR) });                 // rump
  return b.build();
}
function headGeo() {                       // pivot: the neck, (0, 0, 0)
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0.03, 0.06, 0, 0, 0, 0.07, 0.065, 0.085), { color: C('#8f8678') });       // skull
  b.add(ball, matrix(0, 0.0, 0.135, 0, 0, 0, 0.04, 0.035, 0.05), { color: C('#a89d8c') });         // muzzle
  b.add(ball, matrix(0, 0.012, 0.18, 0, 0, 0, 0.014, 0.012, 0.014), { color: C('#2a211b') });      // nose
  b.add(ball, matrix(0.052, 0.058, 0.09, 0, 0, 0, 0.016, 0.016, 0.014), { color: C(DARK) });       // eyes
  b.add(ball, matrix(-0.052, 0.058, 0.09, 0, 0, 0, 0.016, 0.016, 0.014), { color: C(DARK) });
  b.add(ball, matrix(0.04, 0.1, 0.03, 0, 0, 0.3, 0.02, 0.04, 0.016), { color: C(FUR_D) });         // ears
  b.add(ball, matrix(-0.04, 0.1, 0.03, 0, 0, -0.3, 0.02, 0.04, 0.016), { color: C(FUR_D) });
  return b.build();
}
function tailGeo(seg) {                    // seg 0: base, rising backward; seg 1: the plume, pivot at the base segment's end
  const b = new GeoBuilder();
  const puffs = seg === 0
    ? [[0, 0.025, -0.06, 0.065, 0.075, 0.09], [0, 0.085, -0.12, 0.075, 0.095, 0.1], [0, 0.15, -0.17, 0.085, 0.1, 0.1]]
    : [[0, 0.07, -0.01, 0.09, 0.1, 0.1], [0, 0.15, 0.02, 0.095, 0.1, 0.095], [0, 0.22, 0.07, 0.085, 0.085, 0.085], [0, 0.265, 0.13, 0.06, 0.06, 0.06]];
  for (const [x, y, z, sx, sy, sz] of puffs) {
    b.add(ball, matrix(x, y, z, 0, 0, 0, sx, sy, sz), {
      faceColorFn: (c, n) => _c.copy(C(TAIL_D)).lerp(C(TAIL_L), n.z < -0.2 || n.y > 0.5 ? 0.55 : 0.12),
    });
  }
  return b.build();
}
function foreLegGeo() {                    // pivot: shoulder; hangs down, paw at the end
  const b = new GeoBuilder();
  b.add(ball, matrix(0, -0.04, 0.01, 0, 0, 0, 0.028, 0.06, 0.03), { color: C('#7d7568') });
  b.add(ball, matrix(0, -0.095, 0.025, 0, 0, 0, 0.026, 0.02, 0.04), { color: C('#a89d8c') });
  return b.build();
}
function hindLegGeo() {                    // pivot: hip; thigh down-back, long foot forward
  const b = new GeoBuilder();
  b.add(ball, matrix(0, -0.04, -0.01, 0.2, 0, 0, 0.045, 0.075, 0.085), { color: C('#746c5f') });
  b.add(ball, matrix(0, -0.1, 0.05, 0, 0, 0, 0.026, 0.02, 0.075), { color: C('#a89d8c') });
  return b.build();
}

const HIP = new THREE.Vector3(0, 0.13, -0.1);
const NECK = new THREE.Vector3(0, 0.17, 0.2);
const TAIL0 = new THREE.Vector3(0, 0.14, -0.17);
const TAIL1 = new THREE.Vector3(0, 0.12, -0.14);   // in tail-base space: where the plume attaches (the end of the base puffs)
const SHOULDER = [new THREE.Vector3(0.05, 0.09, 0.16), new THREE.Vector3(-0.05, 0.09, 0.16)];
const HIPJ = [new THREE.Vector3(0.065, 0.1, -0.12), new THREE.Vector3(-0.065, 0.1, -0.12)];

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (cur, tgt, k, dt) => cur + (tgt - cur) * Math.min(1, dt * k);

export class Squirrels {
  constructor(scene, chunks, { mobile = false } = {}) {
    this.chunks = chunks;
    this.rng = mulberry32(8080);
    this.t = 0;
    this.spookR = 7;
    const cap = 3;
    this.parts = {
      body: makeInstanced(bodyGeo(), cap), head: makeInstanced(headGeo(), cap),
      tail0: makeInstanced(tailGeo(0), cap), tail1: makeInstanced(tailGeo(1), cap),
      fore: makeInstanced(foreLegGeo(), cap * 2), hind: makeInstanced(hindLegGeo(), cap * 2),
    };
    for (const p of Object.values(this.parts)) { scene.add(p.fill); scene.add(p.line); }
    this.list = [];
    this.seen = [];
    const n = mobile ? 1 : 2;
    for (let i = 0; i < n; i++) {
      this.list.push({
        active: false, wait: 10 + i * 18, x: 0, z: 0, h: 0, st: 'sit', timer: 0, ph: this.rng() * 6, tx: 0, tz: 0, tree: null, climb: 0,
        sc: 0.95 + this.rng() * 0.25, v: 0, gp: 0, up: 1, cl: 0, headYaw: 0, headPitch: 0, tailSway: 0, tailPitch: 0, bodyPitch: 0, flick: 0, nextFlick: 2 + this.rng() * 4,
        nibble: 0, look: 0, lookT: 0, hop: 0,
      });
    }
    this._m = new THREE.Matrix4(); this._root = new THREE.Matrix4(); this._body = new THREE.Matrix4(); this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4();
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._pos = new THREE.Vector3(); this._sc = new THREE.Vector3(); this._one = new THREE.Vector3(1, 1, 1);
  }

  _spawn(a, px, pz) {
    for (let k = 0; k < 30; k++) {
      const ang = this.rng() * 6.283, r = 14 + this.rng() * 26;
      const x = px + Math.cos(ang) * r, z = pz + Math.sin(ang) * r;
      if (sdfAt(x, z) < 8) continue;
      if (this.chunks.nearestTree(x, z, 12) === null) continue;       // squirrels stay near trees
      a.x = x; a.z = z; a.h = this.rng() * 6.283; a.st = 'sit'; a.timer = 2 + this.rng() * 4; a.active = true; a.climb = 0; a.tree = null;
      a.v = 0; a.up = 1; a.cl = 0; a.gp = 0; a.headYaw = 0; a.look = 0; a.lookT = 1 + this.rng() * 2;
      return true;
    }
    return false;
  }

  // compose a * T(pivot) * R(rx, ry, rz) * T(-pivot) into out
  _pivot(out, a, pivot, rx, ry, rz) {
    this._e.set(rx, ry, rz, 'YXZ'); this._q.setFromEuler(this._e);
    this._b.compose(this._v.set(0, 0, 0), this._q, this._one);
    this._b.setPosition(pivot.x - (this._b.elements[0] * pivot.x + this._b.elements[4] * pivot.y + this._b.elements[8] * pivot.z),
      pivot.y - (this._b.elements[1] * pivot.x + this._b.elements[5] * pivot.y + this._b.elements[9] * pivot.z),
      pivot.z - (this._b.elements[2] * pivot.x + this._b.elements[6] * pivot.y + this._b.elements[10] * pivot.z));
    return out.multiplyMatrices(a, this._b);
  }
  // out = parent * T(pivot) * R(rx, ry, rz): a part modelled around its own pivot, hung from its parent
  _attach(out, parent, pivot, rx, ry, rz) {
    this._e.set(rx, ry, rz, 'YXZ'); this._q.setFromEuler(this._e);
    this._b.compose(pivot, this._q, this._one);
    return out.multiplyMatrices(parent, this._b);
  }
  _put(part, i, m) { part.fill.setMatrixAt(i, m); part.line.setMatrixAt(i, m); }

  update(dt, player) {
    this.t += dt;
    this.seen.length = 0;
    const t = this.t, px = player.x, pz = player.z;
    const P = this.parts;
    let n = 0;
    for (const a of this.list) {
      if (a.active) this.seen.push({ kind: 'squirrel', x: a.x, y: groundY(a.x, a.z) + (a.climb || 0) + 0.2, z: a.z, r: 0.3 });
      if (!a.active) {
        a.wait -= dt;
        if (a.wait <= 0 && !this._spawn(a, px, pz)) a.wait = 6;
        if (!a.active) continue;
      }
      const dp = Math.hypot(a.x - px, a.z - pz);
      if (dp > 70) { a.active = false; a.wait = 20 * WILDLIFE.squirrelRate; continue; }
      let y = groundY(a.x, a.z);
      let vTarget = 0, nowSit = a.st === 'sit';

      if (a.st !== 'flee' && a.st !== 'climb' && dp < this.spookR * STEALTH.k) {
        // spooked: bolt for the nearest trunk, or just away from the player
        a.tree = this.chunks.nearestTree(a.x, a.z, 14);
        if (a.tree) { a.tx = a.tree.x; a.tz = a.tree.z; } else { const l = dp || 1; a.tx = a.x + (a.x - px) / l * 14; a.tz = a.z + (a.z - pz) / l * 14; }
        a.st = 'flee'; a.timer = 5; nowSit = false;
      }

      if (a.st === 'sit') {
        a.timer -= dt;
        // glance about in slow turns of the head, with the body following if it looks far
        a.lookT -= dt;
        if (a.lookT <= 0) { a.look = (this.rng() - 0.5) * 1.5; a.lookT = 1.2 + this.rng() * 3; }
        a.headYaw = ease(a.headYaw, a.look, 5, dt);
        if (Math.abs(a.look) > 0.65) { a.h += a.look * 0.5 * dt; }
        if (a.timer <= 0) {
          const ang = a.h + a.headYaw + (this.rng() - 0.5) * 1.6, d = 2.5 + this.rng() * 4.5;
          a.tx = a.x + Math.sin(ang) * d; a.tz = a.z + Math.cos(ang) * d;
          if (sdfAt(a.tx, a.tz) < 6) { a.timer = 0.5; a.h += 2; } else { a.st = 'dash'; a.timer = 6; }
        }
      } else if (a.st === 'dash' || a.st === 'flee') {
        const fast = a.st === 'flee';
        const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz); let dh = want - a.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        a.h += dh * Math.min(1, dt * (fast ? 12 : 7));
        a.headYaw = ease(a.headYaw, 0, 8, dt);
        vTarget = fast ? 5.4 : 2.7;
        a.timer -= dt;
        const reach = a.tree ? a.tree.radius + 0.25 : 0.4;
        if (d < reach || a.timer <= 0) {
          if (fast && a.tree) { a.st = 'climb'; a.climb = 0; a.h = Math.atan2(a.tree.x - a.x, a.tree.z - a.z); }
          else if (fast) { a.active = false; a.wait = (25 + this.rng() * 30) * WILDLIFE.squirrelRate; continue; }
          else { a.st = 'sit'; a.timer = 3 + this.rng() * 6; a.lookT = 0.5; }
        }
        // ease off as the target nears
        if (!fast) vTarget *= Math.min(1, 0.35 + d * 0.5);
      } else if (a.st === 'climb') {
        a.climb += dt * (2.4 + 0.5 * Math.sin(t * 9));
        a.headYaw = ease(a.headYaw, 0, 8, dt);
        const tr = a.tree;
        const top = Math.min(tr.H * 0.75, 7);
        y = groundY(tr.x, tr.z) + 0.05 + a.climb;
        a.x = tr.x - Math.sin(a.h) * (tr.radius + 0.06); a.z = tr.z - Math.cos(a.h) * (tr.radius + 0.06);
        if (a.climb > top || !tr.alive) { a.active = false; a.wait = (30 + this.rng() * 40) * WILDLIFE.squirrelRate; continue; }
      }

      // ---- motion state ----
      a.v = ease(a.v, vTarget, vTarget > a.v ? 7 : 5, dt);
      if (a.st === 'dash' || a.st === 'flee') {
        const nx = a.x + Math.sin(a.h) * a.v * dt, nz = a.z + Math.cos(a.h) * a.v * dt;
        if (sdfAt(nx, nz) > 5) { a.x = nx; a.z = nz; } else a.timer = 0;
      }
      const moving = Math.min(1, a.v / 1.2);
      const climbing = a.st === 'climb' ? 1 : 0;
      a.up = ease(a.up, a.st === 'sit' ? 1 : 0, 6, dt);                // upright sitting pose
      a.cl = ease(a.cl, climbing, 8, dt);
      a.gp += dt * (a.st === 'climb' ? 10 : 3.5 + a.v * 2.1);             // gait phase
      const gp = a.gp;
      y = a.st === 'climb' ? y : groundY(a.x, a.z);

      // ---- pose ----
      const sinG = Math.sin(gp), cosG = Math.cos(gp);
      // ground slope under the body, so it follows hills
      const fy = groundY(a.x + Math.sin(a.h) * 0.3, a.z + Math.cos(a.h) * 0.3), by = groundY(a.x - Math.sin(a.h) * 0.3, a.z - Math.cos(a.h) * 0.3);
      const slope = a.st === 'climb' ? 0 : Math.atan2(fy - by, 0.6);
      // a bounding gait: spine arches and stretches, whole body lifts between bounds
      const hopY = moving * Math.max(0, sinG) * (a.v > 4 ? 0.14 : 0.08);
      const arch = moving * 0.2 * sinG;
      const sitPitch = -1.0 + 0.03 * Math.sin(t * 1.6 + a.ph);          // breathing
      const nib = a.st === 'sit' && Math.sin(t * 0.55 + a.ph) > 0.15 && Math.abs(a.look) < 0.65 ? 1 : 0;   // nibbling spells
      a.nibble = ease(a.nibble, nib, 6, dt);
      a.bodyPitch = lerp(lerp(-slope + arch, sitPitch + 0.25 * a.nibble, a.up), -1.52 + 0.06 * Math.sin(gp), a.cl);
      const bodyYawWobble = a.cl > 0.5 ? 0 : 0;
      this._e.set(0, a.h + bodyYawWobble, 0, 'YXZ'); this._q.setFromEuler(this._e);
      this._root.compose(this._pos.set(a.x, y + hopY * (1 - a.up), a.z), this._q, this._sc.set(a.sc, a.sc, a.sc));
      this._pivot(this._body, this._root, HIP, a.bodyPitch, 0, 0);
      this._put(P.body, n, this._body);

      // head: counter-rotates to keep looking ahead, bobs with the gait, nibbles and looks about when sitting
      let headP = -a.bodyPitch * 0.7 * (1 - a.cl) + (-0.4) * a.cl;
      headP += moving * 0.08 * Math.sin(gp + 0.6);
      headP += a.nibble * (0.28 + 0.1 * Math.sin(t * 17 + a.ph));
      this._attach(this._a, this._body, NECK, headP, a.headYaw, 0);
      this._put(P.head, n, this._a);

      // tail: streams behind when running, curls up over the back when sitting, flicks now and then
      a.nextFlick -= dt;
      if (a.nextFlick <= 0) { a.flick = 1; a.nextFlick = 2.5 + this.rng() * 5; }
      a.flick = Math.max(0, a.flick - dt * 2.4);
      const flickK = Math.sin((1 - a.flick) * Math.PI * 3) * a.flick;
      const sway = (Math.sin(t * 1.3 + a.ph) * 0.12 + Math.sin(t * 3.1 + a.ph) * 0.04) * a.up + Math.sin(gp - 0.6) * 0.25 * moving;
      const t0p = lerp(lerp(-0.25 - 0.1 * arch, 1.9, a.up), -0.35, a.cl) + 0.08 * Math.sin(gp - 0.5) * moving;
      const t1p = lerp(lerp(-0.45 + 0.3 * Math.sin(gp - 1.0) * moving, 0.6 + 0.3 * flickK, a.up), -0.4, a.cl);
      this._attach(this._a, this._body, TAIL0, t0p, 0, sway);
      this._put(P.tail0, n, this._a);
      this._attach(this._m, this._a, TAIL1, t1p, sway * 1.4, 0);
      this._put(P.tail1, n, this._m);

      // legs: fore pair and hind pair work in opposition; upright, the hands go to the mouth and the haunches fold
      for (let s = 0; s < 2; s++) {
        const off = s * 0.25;
        const climbSwing = Math.sin(gp + s * Math.PI) * 0.8;
        const runF = Math.sin(gp + 0.2 + off) * 0.95 * moving;
        const upF = -1.55 + 0.12 * Math.sin(t * 17 + a.ph + s) * a.nibble - 0.12 * a.nibble;
        const foreRot = lerp(lerp(runF, upF, a.up), -1.8 + climbSwing, a.cl);
        this._attach(this._a, this._body, SHOULDER[s], foreRot, 0, 0);
        this._put(P.fore, n * 2 + s, this._a);
        const runH = Math.sin(gp + 2.6 + off) * 0.9 * moving - 0.15 * moving;
        const upH = -a.bodyPitch * 0.9 - 0.05;
        const hindRot = lerp(lerp(runH, upH, a.up), -1.1 - climbSwing * 0.7, a.cl);
        this._attach(this._a, this._body, HIPJ[s], hindRot, 0, 0);
        this._put(P.hind, n * 2 + s, this._a);
      }
      n++;
    }
    for (const [k, p] of Object.entries(P)) {
      const c = k === 'fore' || k === 'hind' ? n * 2 : n;
      p.fill.count = p.line.count = c;
      p.fill.instanceMatrix.needsUpdate = p.line.instanceMatrix.needsUpdate = true;
      p.fill.visible = p.line.visible = c > 0;
    }
  }
}
