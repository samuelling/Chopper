// The rowboat at the boat ramp.  You sit in it facing the bow; the oars swing on their own as if invisible hands were working them.
//   W  both oars pull (row forward)      S  both oars back water      A / D  one oar only, which turns the bow left / right
// Forward is -z in boat space.  Heading h follows the player's convention: forward = (-sin h, -cos h), left turn = h increasing.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { lake, waterDepthAt, sdfAt } from './world.js';

const L = 3.4, HALF = L / 2, SEAT_T = 0.54, LOCK_T = 0.46, LOCK_X = 0.0;
const C = { hull: '#2f5d3a', inside: '#c9a46a', wood: '#8a5a32', seat: '#a87c45', oar: '#d9b982', blade: '#eee6d0', metal: '#8d9498', outline: '#2a1f24' };
const hb = (t) => 0.64 * Math.pow(Math.sin(Math.PI * t * 0.86), 0.62);          // half beam along the boat, t = 0 bow ... 1 stern
const yTop = (t) => 0.46 + 0.16 * Math.pow(1 - t, 2);
const yBot = (t) => -0.13 + 0.2 * Math.pow(1 - t, 2.4);
const zAt = (t) => -HALF + L * t;

function hullGeometry() {
  const NT = 16, NU = 14, pos = [], idx = [];
  const ring = (t) => { const out = []; for (let j = 0; j <= NU; j++) { const u = (j / NU) * 2 - 1, a = Math.abs(u); const y = yBot(t) + (yTop(t) - yBot(t)) * Math.pow(a, 2.3); out.push([hb(t) * u, y, zAt(t)]); } return out; };
  for (let i = 0; i <= NT; i++) for (const v of ring(i / NT)) pos.push(...v);
  for (let i = 0; i < NT; i++) for (let j = 0; j < NU; j++) { const a = i * (NU + 1) + j, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  // transom: fan from a centre point on the stern ring
  const base = pos.length / 3, last = NT * (NU + 1);
  pos.push(0, (yTop(1) + yBot(1)) / 2, zAt(1));
  for (let j = 0; j < NU; j++) idx.push(base, last + j + 1, last + j);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

function buildOar(sign) {                         // sign +1 right, -1 left; shaft runs outboard along sign * x
  const g = new THREE.Group(), m = (geo, col, p, r = [0, 0, 0]) => { const me = new THREE.Mesh(geo, simpleToon(col)); me.position.set(...p); me.rotation.set(...r); const o = new THREE.Mesh(geo, simpleToon(C.outline, { side: THREE.BackSide })); o.scale.setScalar(1.18); me.add(o); g.add(me); return me; };
  const len = 2.15, inb = 0.55;                    // 0.55 m inboard of the lock, 1.6 outboard
  m(new THREE.CylinderGeometry(0.022, 0.026, len, 7), C.oar, [sign * (len / 2 - inb), 0, 0], [0, 0, Math.PI / 2]);
  m(new THREE.BoxGeometry(0.52, 0.012, 0.15), C.blade, [sign * (len - inb - 0.2), 0, 0]);
  m(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 7), '#3a2a1e', [-sign * (inb - 0.1), 0, 0], [0, 0, Math.PI / 2]);
  m(new THREE.CylinderGeometry(0.036, 0.036, 0.1, 7), '#5a4636', [0, 0, 0], [0, 0, Math.PI / 2]);        // the leather
  g.traverse((o) => { o.frustumCulled = false; });
  return g;
}

export class Boat {
  constructor(scene, hooks = {}) {
    this.hooks = hooks;                                     // { splash(x,y,z), creak(), bump(), dip() }
    this.root = new THREE.Group(); scene.add(this.root);
    this.hullGeo = hullGeometry();
    const out = new THREE.Mesh(this.hullGeo, simpleToon(C.hull)), inn = new THREE.Mesh(this.hullGeo, simpleToon(C.inside, { side: THREE.BackSide }));
    const ol = new THREE.Mesh(this.hullGeo, simpleToon(C.outline, { side: THREE.BackSide })); ol.scale.set(1.035, 1.05, 1.02); ol.position.y = -0.01;
    this.root.add(ol, out, inn);
    const wood = (geo, col, p, r) => { const m = new THREE.Mesh(geo, simpleToon(col)); m.position.set(...p); if (r) m.rotation.set(...r); const o = new THREE.Mesh(geo, simpleToon(C.outline, { side: THREE.BackSide })); o.scale.setScalar(1.12); m.add(o); this.root.add(m); return m; };
    wood(new THREE.BoxGeometry(hb(SEAT_T) * 2 - 0.04, 0.05, 0.3), C.seat, [0, 0.27, zAt(SEAT_T)]);                    // the thwart
    wood(new THREE.BoxGeometry(hb(0.9) * 2 - 0.04, 0.045, 0.2), C.seat, [0, 0.22, zAt(0.9)]);                         // stern seat
    wood(new THREE.BoxGeometry(0.1, 0.5, 0.05), C.wood, [0, 0.2, zAt(0.0) + 0.1]);                                    // stem post
    // gunwale rails
    for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector3(s * hb(t), yTop(t) + 0.01, zAt(t))); } wood(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.028, 6), C.wood, [0, 0, 0]); }
    this.locks = [-1, 1].map((s) => { const x = s * (hb(LOCK_T) + 0.02 + LOCK_X), y = yTop(LOCK_T) + 0.07, z = zAt(LOCK_T); wood(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6), C.metal, [x, y - 0.03, z]); return new THREE.Vector3(x, y, z); });
    this.oars = this.locks.map((p, i) => { const s = i ? 1 : -1, o = buildOar(s); o.position.copy(p); o.rotation.order = 'YZX'; this.root.add(o); return { g: o, s, ph: 0, active: false, dir: 1, a: 0.0, th: -0.06, was: 0, splashed: false }; });
    // blade splashes: a few rings on the water
    this.rings = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2f7f4', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.userData.age = 9; scene.add(m); return m; });
    this.x = 0; this.z = 0; this.h = 0; this.v = 0; this.w = 0; this.t = 0; this.dh = 0; this.afloat = true;
    this.input = { row: 0, turn: 0 };
    this.root.traverse((o) => { o.frustumCulled = false; });
  }

  place(x, z, h) { this.x = x; this.z = z; this.h = h; this.v = 0; this.w = 0; this._pose(0); }
  fwd(out = new THREE.Vector3()) { return out.set(-Math.sin(this.h), 0, -Math.cos(this.h)); }
  /** is there enough water under (x, z) for the hull? */
  _wet(x, z) { return waterDepthAt(x, z) > 0.32 && sdfAt(x, z) < 3; }
  _clear(x, z, h) {
    const fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    for (const [a, b] of [[1.7, 0], [-1.5, 0], [0.4, 0.62], [0.4, -0.62], [-0.8, 0.5], [-0.8, -0.5], [0, 0]]) if (!this._wet(x + fx * a + rx * b, z + fz * a + rz * b)) return false;
    return true;
  }

  /** one oar's stroke: returns thrust (positive pushes the boat forward).  want: +1 pull, -1 back water, 0 rest */
  _oar(o, dt, want) {
    const T = 1.5, DRIVE = 0.45, REACH = 0.3, A = 0.55, ease = (u) => u * u * (3 - 2 * u);
    if (!o.active && want) { o.active = true; o.ph = -REACH; o.a0 = o.a; o.dir = want; o.splashed = false; this.hooks.creak?.(); }
    let thrust = 0, thT = -0.06;
    if (o.active) {
      o.ph += dt / T; const p = o.ph;
      if (p < 0) {                                           // blade lifted, swinging from where it rests out to the catch
        const u = ease(1 + p / REACH); o.a = o.a0 + (o.dir * A - o.a0) * u; thT = -0.16;
      } else if (p < DRIVE) {                                // blade in the water, swinging aft (pull) or forward (back water)
        const u = ease(p / DRIVE); o.a = o.dir * (A - 2 * A * u); thT = 0.2;
        thrust = o.dir * 2 * A * 6 * u * (1 - u) / (DRIVE * T);
        if (!o.splashed) { o.splashed = true; this._splash(o, 1); }
      } else {                                               // lifted clear and carried back to the catch
        const u = ease((p - DRIVE) / (1 - DRIVE)); o.a = o.dir * (-A + 2 * A * u); thT = -0.16;
        if (o.splashed) { o.splashed = false; this._splash(o, 0.5); }
      }
      if (o.ph >= 1) { if (want === o.dir) { o.ph -= 1; this.hooks.creak?.(); } else { o.active = false; o.ph = 0; } }
    } else o.a *= Math.exp(-2.2 * dt);
    o.th += (thT - o.th) * (1 - Math.exp(-dt * 9));
    return thrust;
  }
  _splash(o, k) {
    const f = this.fwd(), x = this.x + (Math.cos(this.h) * o.s) * 1.55 + f.x * -0.1, z = this.z + (-Math.sin(this.h) * o.s) * 1.55 + f.z * -0.1;
    this.hooks.splash?.(x, lake.level + 0.03, z, k);
    const r = this.rings.find((m) => m.userData.age >= 1) || this.rings[0]; r.userData.age = 0; r.userData.k = k; r.position.set(x, lake.level + 0.03, z); r.scale.setScalar(0.3); r.visible = true;
  }

  update(dt, active) {
    this.t += dt;
    const inp = active ? this.input : { row: 0, turn: 0 };
    // W: both oars forward.  S: both back.  A: right oar only (bow swings left).  D: left oar only.
    // oars[0] is the left oar, oars[1] the right.  D (turn +1): the left oar pulls and the bow swings right.  A (turn -1): the right oar pulls.
    const tl = this._oar(this.oars[0], dt, inp.row || (inp.turn > 0 ? 1 : 0)), tr = this._oar(this.oars[1], dt, inp.row || (inp.turn < 0 ? 1 : 0));
    this._tl = tl; this._tr = tr;
    const KT = 0.7, KR = 0.85;
    this.v += (tl + tr) * KT * dt; this.w += (tr - tl) * KR * dt;
    this.v *= Math.exp(-0.55 * dt); this.w *= Math.exp(-1.7 * dt);
    this.v = Math.max(-1.3, Math.min(2.4, this.v));
    // move, with the shore as the only obstacle
    const oldH = this.h;
    let h = this.h + this.w * dt, f = { x: -Math.sin(h), z: -Math.cos(h) };
    let nx = this.x + f.x * this.v * dt, nz = this.z + f.z * this.v * dt;
    if (this._clear(nx, nz, h)) { this.x = nx; this.z = nz; this.h = h; }
    else if (this._clear(this.x, this.z, h)) { this.h = h; if (Math.abs(this.v) > 0.5) this.hooks.bump?.(); this.v *= -0.25; }
    else { if (Math.abs(this.v) > 0.5) this.hooks.bump?.(); this.v *= -0.25; this.w *= -0.3; }
    this.dh = this.h - oldH;
    this._pose(dt);
  }

  _pose(dt) {
    const lv = lake.level, bob = Math.sin(this.t * 1.3) * 0.012;
    this.root.position.set(this.x, lv + 0.0 + bob, this.z);
    this._roll = (this._roll || 0) + ((((this._tr || 0) - (this._tl || 0)) * 0.03) - (this._roll || 0)) * (1 - Math.exp(-dt * 5)); const roll = Math.sin(this.t * 1.05 + 1) * 0.012 + this._roll;
    this.root.rotation.set(Math.sin(this.t * 0.8) * 0.006 - this.v * 0.006, this.h, roll, 'YXZ');
    for (const o of this.oars) {
      o.g.rotation.set(0, o.s * o.a, -o.s * o.th, 'YZX');
    }
    this.root.updateMatrixWorld(true);
    for (const m of this.rings) if (m.visible) {
      m.userData.age += dt / 1.1; const a = m.userData.age;
      if (a >= 1) { m.visible = false; m.material.opacity = 0; continue; }
      m.scale.setScalar(0.3 + a * 1.5 * m.userData.k); m.material.opacity = (1 - a) * 0.55;
    }
  }

  /** where the rower sits, in the world (the camera hangs just above it) */
  seatWorld(out = new THREE.Vector3()) { return out.set(0, 0.27, zAt(SEAT_T)).applyMatrix4(this.root.matrixWorld); }
  /** the water surface under the seat */
  get surfaceY() { return lake.level; }
}
