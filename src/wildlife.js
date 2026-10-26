// Cel-shaded pond life: schools of sunfish and bass, painted turtles that surface now and then.
// Everything is built with the same toon fill + inverted-hull outline as the trees, so it belongs to the world.
// Creatures live just under the water surface (the water is semi-transparent in the shallows, so they read as
// shapes through it), keep to water that is deep enough, and leave when the lake is drawn down.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { fillMaterial, outlineMaterial } from './toon.js';
import { groundY, sdfAt } from './world.js';
import { mulberry32 } from './noise.js';
import { IS_WINTER } from './season.js';

const C = (h) => new THREE.Color(h);
const _c = new THREE.Color();

// ---- fish: body + a separate tail that beats, plus pectoral fins that flutter ----
const ballG = new THREE.SphereGeometry(1, 9, 6);
function sunfishParts() {
  const body = new GeoBuilder();
  body.add(ballG, matrix(0, 0, 0, 0, 0, 0, 0.17, 0.23, 0.46), {
    faceColorFn: (c, n) => {
      if (n.y < -0.25) return _c.copy(C('#e9a23a'));                 // orange belly
      if (n.y > 0.45) return _c.copy(C('#4f6b3a'));                  // olive back
      return _c.copy(C('#8fa64e')).lerp(C('#4aa7a0'), 0.25 * (0.5 + 0.5 * Math.sin(c.z * 14)));
    },
  });
  body.add(new THREE.ConeGeometry(1, 1, 4), matrix(0, 0.22, -0.02, 0, 0, 0, 0.04, 0.13, 0.3), { color: C('#556a3c') });
  const eye = new THREE.SphereGeometry(1, 5, 4);
  body.add(eye, matrix(0.13, 0.05, 0.3, 0, 0, 0, 0.04, 0.04, 0.04), { color: C('#1f1a14') });
  body.add(eye, matrix(-0.13, 0.05, 0.3, 0, 0, 0, 0.04, 0.04, 0.04), { color: C('#1f1a14') });
  const tail = new GeoBuilder();                                       // pivot at z = -0.3 (body frame)
  tail.add(ballG, matrix(0, 0, -0.08, 0, 0, 0, 0.07, 0.1, 0.16), { color: C('#8c8a40') });
  tail.add(new THREE.ConeGeometry(1, 1, 5), matrix(0, 0, -0.22, -Math.PI / 2, 0, 0, 0.1, 0.3, 0.26), { color: C('#c97b34') });
  const fin = new GeoBuilder();
  fin.add(ballG, matrix(0, 0, -0.07, 0, 0, 0, 0.09, 0.012, 0.1), { color: C('#d9923a') });
  return { body: body.build(), tail: tail.build(), fin: fin.build(), pivot: -0.3, finAt: [0.15, -0.07, 0.14] };
}
function bassParts() {
  const body = new GeoBuilder();
  body.add(ballG, matrix(0, 0, 0, 0, 0, 0, 0.14, 0.17, 0.68), {
    faceColorFn: (c, n) => {
      if (n.y < -0.3) return _c.copy(C('#d8d6a8'));
      if (Math.abs(n.y) < 0.28 && Math.abs(Math.sin(c.z * 6.5)) < 0.3) return _c.copy(C('#26331f')); // lateral blotches
      return _c.copy(C('#58703a'));
    },
  });
  body.add(new THREE.ConeGeometry(1, 1, 4), matrix(0, 0.17, -0.1, 0, 0, 0, 0.035, 0.13, 0.34), { color: C('#3d5028') });
  const eye = new THREE.SphereGeometry(1, 5, 4);
  body.add(eye, matrix(0.11, 0.05, 0.5, 0, 0, 0, 0.035, 0.035, 0.035), { color: C('#1a160f') });
  body.add(eye, matrix(-0.11, 0.05, 0.5, 0, 0, 0, 0.035, 0.035, 0.035), { color: C('#1a160f') });
  const tail = new GeoBuilder();                                       // pivot at z = -0.46
  tail.add(ballG, matrix(0, 0, -0.1, 0, 0, 0, 0.06, 0.09, 0.2), { color: C('#4f6334') });
  tail.add(new THREE.ConeGeometry(1, 1, 5), matrix(0, 0, -0.28, -Math.PI / 2, 0, 0, 0.08, 0.32, 0.3), { color: C('#46592f') });
  const fin = new GeoBuilder();
  fin.add(ballG, matrix(0, 0, -0.08, 0, 0, 0, 0.09, 0.012, 0.12), { color: C('#6f8348') });
  return { body: body.build(), tail: tail.build(), fin: fin.build(), pivot: -0.46, finAt: [0.12, -0.08, 0.3] };
}

// ---- painted turtle: shell, a head that stretches and withdraws, and four paddling flippers ----
function turtleParts() {
  const shell = new GeoBuilder();
  const dome = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  shell.add(dome, matrix(0, 0, 0, 0, 0, 0, 0.34, 0.17, 0.42), {
    faceColorFn: (c, n, tri) => {
      if (c.y < 0.03) return _c.copy(C('#d5452c'));                  // painted-turtle red rim
      return _c.copy(C('#2d3b23')).multiplyScalar(0.85 + 0.3 * ((tri * 7) % 5) / 5);
    },
  });
  shell.add(new THREE.CylinderGeometry(1, 1, 0.04, 10), matrix(0, -0.01, 0, 0, 0, 0, 0.32, 1, 0.4), { color: C('#e2c35c') });
  shell.add(new THREE.ConeGeometry(1, 1, 4), matrix(0, 0.0, -0.46, -Math.PI / 2, 0, 0, 0.04, 0.12, 0.04), { color: C('#4d6a33') });
  const ball = new THREE.SphereGeometry(1, 6, 5);
  const head = new GeoBuilder();                                       // pivot at the neck, (0, 0.04, 0.4)
  head.add(ball, matrix(0, 0.0, 0.0, 0, 0, 0, 0.06, 0.055, 0.09), { color: C('#4d6a33') });          // neck
  head.add(ball, matrix(0, 0.01, 0.1, 0, 0, 0, 0.085, 0.075, 0.12), { color: C('#5b7a3a') });        // head
  head.add(ball, matrix(0, 0.055, 0.14, 0, 0, 0, 0.03, 0.012, 0.05), { color: C('#e5c93e') });       // yellow stripe
  head.add(ball, matrix(0.06, 0.03, 0.15, 0, 0, 0, 0.018, 0.018, 0.018), { color: C('#15110c') });   // eyes
  head.add(ball, matrix(-0.06, 0.03, 0.15, 0, 0, 0, 0.018, 0.018, 0.018), { color: C('#15110c') });
  const flip = (side) => {                                           // pivot at the shoulder; the paddle reaches outward
    const f = new GeoBuilder();
    f.add(ball, matrix(side * 0.11, 0, 0, 0, 0, 0, 0.13, 0.025, 0.065), { color: C('#4d6a33') });
    return f.build();
  };
  return { shell: shell.build(), head: head.build(), flipR: flip(1), flipL: flip(-1) };
}

const FILL = { sway: false };

export function makeInstanced(geo, cap) {
  const fill = new THREE.InstancedMesh(geo, fillMaterial(FILL), cap);
  const line = new THREE.InstancedMesh(geo, outlineMaterial({ ...FILL, color: new THREE.Color(0.12, 0.17, 0.14) }), cap);
  for (const m of [fill, line]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  for (let i = 0; i < cap; i++) fill.setColorAt(i, new THREE.Color(1, 1, 1));
  return { fill, line };
}

export class Wildlife {
  /** @param lake the lake object (level / originalLevel) */
  constructor(scene, lake, { mobile = false } = {}) {
    this.lake = lake; this.chunks = null; this.fx = null;
    this.rng = mulberry32(4242);
    this.t = 0;
    const schools = mobile ? 2 : 3, perSchool = mobile ? 4 : 5, turtles = mobile ? 1 : 2;
    const sp = sunfishParts(), bp = bassParts(), tp = turtleParts();
    this.fishSpec = { sun: sp, bass: bp };
    const mkFish = (spec, cap) => ({ body: makeInstanced(spec.body, cap), tail: makeInstanced(spec.tail, cap), fin: makeInstanced(spec.fin, cap * 2) });
    this.sunfish = mkFish(sp, schools * perSchool);
    this.bass = mkFish(bp, schools * 3);
    this.turtle = { shell: makeInstanced(tp.shell, turtles), head: makeInstanced(tp.head, turtles), flipR: makeInstanced(tp.flipR, turtles * 2), flipL: makeInstanced(tp.flipL, turtles * 2) };
    this.all = [...Object.values(this.sunfish), ...Object.values(this.bass), ...Object.values(this.turtle)];
    for (const g of this.all) { scene.add(g.fill); scene.add(g.line); }

    // schools: a wandering leader plus followers with fixed offsets
    this.schools = [];
    for (let s = 0; s < schools; s++) {
      const bass = s % 3 === 2;
      const n = bass ? 3 : perSchool;
      const mem = [];
      for (let i = 0; i < n; i++) mem.push({ ox: (this.rng() - 0.5) * 1.6, oz: -this.rng() * 1.8 - (i ? 0.2 : 0), ph: this.rng() * 6.28, sc: 0.85 + this.rng() * 0.4, x: 0, z: 0, h: 0 });
      this.schools.push({ bass, mem, x: 0, z: 0, h: this.rng() * 6.28, spd: bass ? 0.9 : 0.7, active: false, bad: 0, dy: 0.3 + this.rng() * 0.25 });
    }
    this.turtles = [];
    for (let i = 0; i < (IS_WINTER ? 0 : turtles); i++) this.turtles.push({ x: 0, z: 0, h: this.rng() * 6.28, active: false, bad: 0, cycle: 8 + this.rng() * 25, surf: 0, sc: 0.9 + this.rng() * 0.5, ph: this.rng() * 6 });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler(); this._up = new THREE.Vector3(0, 1, 0);
    this._body = new THREE.Matrix4(); this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._q2 = new THREE.Quaternion(); this._e2 = new THREE.Euler(); this._one = new THREE.Vector3(1, 1, 1);
  }

  _attach(out, parent, pivot, rx, ry, rz) {
    this._b.compose(pivot, this._q2.setFromEuler(this._e2.set(rx, ry, rz, 'YXZ')), this._one);
    return out.multiplyMatrices(parent, this._b);
  }
  /** pose one turtle from explicit parameters (basking, scurrying) */
  _poseTurtle(n, o) {
    const T = this._tv || (this._tv = new THREE.Vector3()), k = o.k;
    this._body.compose(this._p.set(o.x, o.y, o.z), this._q.setFromEuler(this._e.set(o.pitch || 0, o.h, o.roll || 0, 'YXZ')), this._s.set(k, k, k));
    this._set(this.turtle.shell, n, this._body);
    this._attach(this._a, this._body, T.set(0, 0.04, 0.38 + o.ext * 0.5), o.hp || 0, o.hy || 0, 0);
    this._set(this.turtle.head, n, this._a);
    for (let f = 0; f < 4; f++) {
      const sg = f & 1 ? -1 : 1, front = f < 2, [ry, rz] = o.fl(f);
      this._attach(this._a, this._body, T.set(sg * 0.3, 0.0, front ? 0.2 : -0.2), 0, sg * ry, -sg * rz * 0.5);
      this._set(sg > 0 ? this.turtle.flipR : this.turtle.flipL, n * 2 + (front ? 0 : 1), this._a);
    }
  }
  _set(g, i, m) { g.fill.setMatrixAt(i, m); g.line.setMatrixAt(i, m); }

  depthAt(x, z) { return this.lake.level - groundY(x, z); }

  // find open water near the player, deep enough to hold a fish and close enough to be seen
  _place(px, pz, minD, maxD, rmin, rmax) {
    for (let k = 0; k < 24; k++) {
      const a = this.rng() * 6.283, r = rmin + this.rng() * (rmax - rmin);
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      if (sdfAt(x, z) > -4) continue;
      const d = this.depthAt(x, z);
      if (d >= minD && d <= maxD) return [x, z];
    }
    return null;
  }

  update(dt, player, speed = 0) {
    this.t += dt;
    const lake = this.lake, px = player.x, pz = player.z;
    const full = lake.level > lake.originalLevel - 1.4 && !lake.drained;
    let nSun = 0, nBass = 0, nTur = 0;
    const T = this._tv || (this._tv = new THREE.Vector3());
    for (const sc of this.schools) {
      // (re)place the school on water 10..42 m from the player
      if (full && (!sc.active || sc.bad > 2.5 || Math.hypot(sc.x - px, sc.z - pz) > 75)) {
        const spot = this._place(px, pz, 0.9, 3.2, 9, 42);
        if (spot) {
          [sc.x, sc.z] = spot; sc.h = this.rng() * 6.283; sc.active = true; sc.bad = 0;
          for (const m of sc.mem) { m.x = sc.x + m.ox; m.z = sc.z + m.oz; m.h = sc.h; }
        } else sc.active = false;
      }
      if (!full) sc.active = false;
      if (!sc.active) continue;
      // swim: gentle wander, turn away from shallows
      sc.h += (Math.sin(this.t * 0.31 + sc.dy * 20) * 0.5 + Math.sin(this.t * 0.9 + sc.dy * 7) * 0.25) * dt;
      const lx = sc.x + Math.sin(sc.h) * 3.2, lz = sc.z + Math.cos(sc.h) * 3.2;
      const dAhead = this.depthAt(lx, lz), dHere = this.depthAt(sc.x, sc.z);
      if (dAhead < 0.8 || sdfAt(lx, lz) > -3) {
        const l2 = [sc.x + Math.sin(sc.h + 0.9) * 3.2, sc.z + Math.cos(sc.h + 0.9) * 3.2], r2 = [sc.x + Math.sin(sc.h - 0.9) * 3.2, sc.z + Math.cos(sc.h - 0.9) * 3.2];
        sc.h += (this.depthAt(l2[0], l2[1]) > this.depthAt(r2[0], r2[1]) ? 1 : -1) * 2.2 * dt;
      }
      sc.bad = dHere < 0.7 ? sc.bad + dt : 0;
      // scatter from a walker splashing in close
      const dp = Math.hypot(sc.x - px, sc.z - pz);
      let spd = sc.spd * (dp < 5 ? 2.6 : 1);
      if (dp < 5) sc.h = Math.atan2(sc.x - px, sc.z - pz) + 0.0;
      sc.x += Math.sin(sc.h) * spd * dt; sc.z += Math.cos(sc.h) * spd * dt;
      const fs = sc.bass ? this.bass : this.sunfish, spec = sc.bass ? this.fishSpec.bass : this.fishSpec.sun;
      // burst-and-coast swimming: the school surges, then glides, and the tail beats faster on each surge
      const surge = 0.5 + 0.5 * Math.sin(this.t * 0.9 + sc.dy * 11);
      const flee = dp < 5 ? 1 : 0;
      for (const m of sc.mem) {
        const tx = sc.x + Math.cos(sc.h) * m.ox + Math.sin(sc.h) * m.oz, tz = sc.z - Math.sin(sc.h) * m.ox + Math.cos(sc.h) * m.oz;
        m.x += (tx - m.x) * Math.min(1, dt * 1.6); m.z += (tz - m.z) * Math.min(1, dt * 1.6);
        const turn = Math.atan2(Math.sin(sc.h - (m.h ?? sc.h)), Math.cos(sc.h - (m.h ?? sc.h)));
        m.h = (m.h ?? sc.h) + turn * Math.min(1, dt * 3);
        m.bp = (m.bp ?? m.ph) + dt * (2.6 + 5.5 * surge + 5 * flee);
        const beat = Math.sin(m.bp);
        const amp = 0.28 + 0.34 * surge + 0.2 * flee;
        const y = lake.level - sc.dy - 0.12 * Math.sin(this.t * 0.8 + m.ph);
        const i = sc.bass ? nBass++ : nSun++;
        const k = m.sc * (sc.bass ? 1.15 : 1);
        // the head swings against the tail; the body banks slightly into each turn
        this._body.compose(this._p.set(m.x, y, m.z), this._q.setFromEuler(this._e.set(0.04 * Math.sin(this.t * 0.8 + m.ph), m.h - beat * amp * 0.22, -turn * 0.5 + Math.sin(m.bp) * 0.04, 'YXZ')), this._s.set(k, k, k));
        this._set(fs.body, i, this._body);
        this._attach(this._a, this._body, T.set(0, 0, spec.pivot), 0, Math.sin(m.bp - 1.0) * amp * 1.5, 0);
        this._set(fs.tail, i, this._a);
        const flap = 0.45 + 0.4 * Math.sin(m.bp * 0.6 + 1.3) * (0.4 + 0.6 * (1 - surge));
        for (let sd = 0; sd < 2; sd++) {
          const sg = sd ? -1 : 1;
          this._attach(this._a, this._body, T.set(sg * spec.finAt[0], spec.finAt[1], spec.finAt[2]), 0, sg * 0.5, -sg * flap);
          this._set(fs.fin, i * 2 + sd, this._a);
        }
      }
    }

    for (const tu of this.turtles) {
      if (full && (!tu.active || tu.bad > 2.5 || Math.hypot(tu.x - px, tu.z - pz) > 80)) {
        if (tu.bask) { tu.bask.taken = false; tu.bask = null; }
        tu.mode = 'swim';
        let placed = false;
        // often start out basking on a log or rock that breaks the surface
        if (this.chunks && this.rng() < 0.6) {
          const spots = this.chunks.baskSpots(px, pz, 10, 45).filter((q) => !q.taken);
          if (spots.length) {
            const sp = spots[(this.rng() * spots.length) | 0];
            sp.taken = true; tu.bask = sp; tu.mode = 'bask';
            const off = sp.len ? (this.rng() - 0.5) * sp.len * 1.2 : 0;
            tu.x = sp.x + Math.cos(sp.yaw) * off; tu.z = sp.z - Math.sin(sp.yaw) * off;
            tu.h = sp.len ? sp.yaw + Math.PI / 2 + (this.rng() < 0.5 ? 0 : Math.PI) : this.rng() * 6.28;
            tu.active = true; tu.bad = 0; tu.surf = 0; tu.k = 0; tu.stroke = 0; tu.cycle = 30 + this.rng() * 30; placed = true;
          }
        }
        if (!placed) {
          const spot = this._place(px, pz, 0.7, 2.6, 8, 38);
          if (spot) { [tu.x, tu.z] = spot; tu.active = true; tu.bad = 0; tu.surf = 0; tu.cycle = 6 + this.rng() * 20; } else tu.active = false;
        }
      }
      if (!full) { tu.active = false; if (tu.bask) { tu.bask.taken = false; tu.bask = null; } }
      if (!tu.active) continue;
      const dpT = Math.hypot(tu.x - px, tu.z - pz);
      if (tu.mode === 'bask') {
        // the player running past (faster = noticed from further away) sends it into the water
        if (dpT < 6 + (speed || 0) * 1.4) {
          const sp = tu.bask;
          const gx = groundY(tu.x + 1, tu.z) - groundY(tu.x - 1, tu.z), gz = groundY(tu.x, tu.z + 1) - groundY(tu.x, tu.z - 1);
          let vx = -gx * 2, vz = -gz * 2;                            // downhill: toward deeper water
          const l = dpT || 1; vx += (tu.x - px) / l * 0.7; vz += (tu.z - pz) / l * 0.7;
          tu.th = Math.atan2(vx, vz); tu.mode = 'scurry'; tu.st = 0; tu.splashed = false;
          if (sp) { sp.taken = false; tu.bask = null; }
        } else {
          const bob = 0.004 * Math.sin(this.t * 1.1 + tu.ph);
          const stretch = 0.5 + 0.5 * Math.sin(this.t * 0.35 + tu.ph);
          const sp = tu.bask;
          this._poseTurtle(nTur++, {
            x: tu.x, y: (sp ? sp.top : lake.level + 0.1) + bob, z: tu.z, h: tu.h, k: tu.sc * 0.9, pitch: 0.02, roll: 0,
            ext: 0.1 + 0.08 * stretch, hp: -0.18 - 0.1 * stretch, hy: Math.sin(this.t * 0.3 + tu.ph) * 0.5,
            fl: (f) => (f < 2 ? [-0.55, 0.45] : [0.55, 0.4]),         // flippers splayed out flat to the sun
          });
          continue;
        }
      }
      if (tu.mode === 'scurry') {
        tu.st += dt;
        const dh = Math.atan2(Math.sin(tu.th - tu.h), Math.cos(tu.th - tu.h)); tu.h += dh * Math.min(1, dt * 9);
        const sp = Math.max(0, 1.9 - tu.st * 0.8);
        tu.x += Math.sin(tu.h) * sp * dt; tu.z += Math.cos(tu.h) * sp * dt;
        tu.pp = (tu.pp ?? 0) + dt * 17;                                // frantic paddling
        const topY = (tu.top ??= lake.level + 0.1);
        const drop = Math.min(1, tu.st / 0.55); const dE = drop * drop * (3 - 2 * drop);
        const y = topY + (lake.level - 0.3 - topY) * dE;
        if (!tu.splashed && tu.st > 0.4 && this.fx) { this.fx.splash(tu.x, lake.level, tu.z, 12); tu.splashed = true; }
        this._poseTurtle(nTur++, {
          x: tu.x, y, z: tu.z, h: tu.h, k: tu.sc * 0.9, pitch: 0.25 * (1 - dE), roll: Math.sin(tu.pp) * 0.08,
          ext: 0.02, hp: 0.1, hy: 0,
          fl: (f) => { const off = (f === 0 || f === 3) ? 0 : Math.PI; return [Math.sin(tu.pp + off) * 0.7, 0.3]; },
        });
        if (tu.st > 1.7) {
          tu.mode = 'swim'; tu.surf = 0; tu.cycle = 40 + this.rng() * 40; tu.stroke = 1; tu.k = 0; tu.bad = -25; tu.top = undefined;
        }
        continue;
      }
      tu.h += Math.sin(this.t * 0.2 + tu.ph) * 0.3 * dt;
      const lx = tu.x + Math.sin(tu.h) * 2.4, lz = tu.z + Math.cos(tu.h) * 2.4;
      if (this.depthAt(lx, lz) < 0.7 || sdfAt(lx, lz) > -3) tu.h += 1.8 * dt;
      tu.bad = this.depthAt(tu.x, tu.z) < 0.6 ? tu.bad + dt : 0;
      const dp = Math.hypot(tu.x - px, tu.z - pz);
      tu.cycle -= dt;
      if (dp < 4 && tu.surf > 0) tu.cycle = Math.min(tu.cycle, 0.01);
      // surface for ~6 s every so often, then dive
      if (tu.cycle <= 0 && tu.surf <= 0) { tu.surf = 6 + this.rng() * 4; tu.cycle = 25 + this.rng() * 40; }
      if (tu.surf > 0) tu.surf -= dt;
      const up = tu.surf > 0 && dp > 4 ? 1 : 0;
      tu.k = (tu.k ?? 0) + (up - (tu.k ?? 0)) * Math.min(1, dt * 1.5);
      // swim in strokes with glides between; at the surface just float and scull gently
      const strokeT = tu.k > 0.5 ? 0.2 : (Math.sin(this.t * 0.45 + tu.ph) > -0.25 ? 1 : 0);
      tu.stroke = (tu.stroke ?? 0) + (strokeT - (tu.stroke ?? 0)) * Math.min(1, dt * 1.8);
      tu.pp = (tu.pp ?? tu.ph) + dt * (2.2 + 2.2 * tu.stroke);
      const spd = (0.06 + 0.4 * tu.stroke) * (0.7 + 0.3 * Math.sin(tu.pp * 2 - 0.8));
      tu.x += Math.sin(tu.h) * spd * dt; tu.z += Math.cos(tu.h) * spd * dt;
      const y = lake.level - 0.3 + tu.k * 0.26 + 0.015 * Math.sin(this.t * 1.3 + tu.ph);
      const k = tu.sc;
      this._body.compose(this._p.set(tu.x, y, tu.z), this._q.setFromEuler(this._e.set(-0.1 * tu.k + 0.03 * Math.sin(tu.pp * 2), tu.h + Math.sin(tu.pp) * 0.06 * tu.stroke, Math.sin(tu.pp) * 0.05 * tu.stroke, 'YXZ')), this._s.set(k, k, k));
      this._set(this.turtle.shell, nTur, this._body);
      tu.out = (tu.out ?? 0.6) + ((tu.k > 0.5 || tu.stroke > 0.5 ? 1 : 0.15) - (tu.out ?? 0.6)) * Math.min(1, dt * 1.6);
      const ext = -0.14 + 0.28 * tu.out + 0.025 * Math.sin(tu.pp * 2) * tu.stroke;
      this._attach(this._a, this._body, T.set(0, 0.04, 0.38 + ext * 0.5), 0.35 * tu.k - 0.08 * tu.stroke + 0.04 * Math.sin(tu.pp * 2), Math.sin(this.t * 0.4 + tu.ph) * 0.45 * (1 - tu.stroke), 0);
      this._set(this.turtle.head, nTur, this._a);
      const sw = 0.3 + 0.45 * tu.stroke;
      for (let f = 0; f < 4; f++) {
        const sg = f & 1 ? -1 : 1, front = f < 2, off = (f === 0 || f === 3) ? 0 : Math.PI;
        const ang = Math.sin(tu.pp + off + (front ? 0 : 0.6)) * sw, drop = 0.25 + 0.3 * Math.cos(tu.pp + off + (front ? 0 : 0.6));
        this._attach(this._a, this._body, T.set(sg * 0.3, 0.0, front ? 0.2 : -0.2), 0, sg * (ang + (front ? 0.25 : -0.45)), -sg * (0.1 + drop * 0.3));
        this._set(sg > 0 ? this.turtle.flipR : this.turtle.flipL, nTur * 2 + (front ? 0 : 1), this._a);
      }
      nTur++;
    }

    const setCount = (g, n) => { g.fill.count = g.line.count = n; g.fill.instanceMatrix.needsUpdate = g.line.instanceMatrix.needsUpdate = true; g.fill.visible = g.line.visible = n > 0; };
    setCount(this.sunfish.body, nSun); setCount(this.sunfish.tail, nSun); setCount(this.sunfish.fin, nSun * 2);
    setCount(this.bass.body, nBass); setCount(this.bass.tail, nBass); setCount(this.bass.fin, nBass * 2);
    setCount(this.turtle.shell, nTur); setCount(this.turtle.head, nTur); setCount(this.turtle.flipR, nTur * 2); setCount(this.turtle.flipL, nTur * 2);
  }
}
