// Cel-shaded pond life: schools of sunfish and bass, painted turtles that surface now and then.
// Everything is built with the same toon fill + inverted-hull outline as the trees, so it belongs to the world.
// Creatures live just under the water surface (the water is semi-transparent in the shallows, so they read as
// shapes through it), keep to water that is deep enough, and leave when the lake is drawn down.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { fillMaterial, outlineMaterial } from './toon.js';
import { groundY, sdfAt } from './world.js';
import { mulberry32 } from './noise.js';

const C = (h) => new THREE.Color(h);
const _c = new THREE.Color();

function sunfishGeo() {
  const b = new GeoBuilder();
  const body = new THREE.SphereGeometry(1, 9, 6);
  b.add(body, matrix(0, 0, 0, 0, 0, 0, 0.17, 0.23, 0.46), {
    faceColorFn: (c, n) => {
      if (n.y < -0.25) return _c.copy(C('#e9a23a'));                 // orange belly
      if (n.y > 0.45) return _c.copy(C('#4f6b3a'));                  // olive back
      return _c.copy(C('#8fa64e')).lerp(C('#4aa7a0'), 0.25 * (0.5 + 0.5 * Math.sin(c.z * 14)));
    },
  });
  const tail = new THREE.ConeGeometry(1, 1, 5);
  b.add(tail, matrix(0, 0, -0.5, -Math.PI / 2, 0, 0, 0.1, 0.3, 0.26), { color: C('#c97b34') });
  const dorsal = new THREE.ConeGeometry(1, 1, 4);
  b.add(dorsal, matrix(0, 0.22, -0.02, 0, 0, 0, 0.04, 0.13, 0.3), { color: C('#556a3c') });
  const eye = new THREE.SphereGeometry(1, 5, 4);
  b.add(eye, matrix(0.13, 0.05, 0.3, 0, 0, 0, 0.04, 0.04, 0.04), { color: C('#1f1a14') });
  b.add(eye, matrix(-0.13, 0.05, 0.3, 0, 0, 0, 0.04, 0.04, 0.04), { color: C('#1f1a14') });
  return b.build();
}

function bassGeo() {
  const b = new GeoBuilder();
  b.add(new THREE.SphereGeometry(1, 9, 6), matrix(0, 0, 0, 0, 0, 0, 0.14, 0.17, 0.68), {
    faceColorFn: (c, n) => {
      if (n.y < -0.3) return _c.copy(C('#d8d6a8'));
      if (Math.abs(n.y) < 0.28 && Math.abs(Math.sin(c.z * 6.5)) < 0.3) return _c.copy(C('#26331f')); // lateral blotches
      return _c.copy(C('#58703a'));
    },
  });
  b.add(new THREE.ConeGeometry(1, 1, 5), matrix(0, 0, -0.74, -Math.PI / 2, 0, 0, 0.08, 0.32, 0.3), { color: C('#46592f') });
  b.add(new THREE.ConeGeometry(1, 1, 4), matrix(0, 0.17, -0.1, 0, 0, 0, 0.035, 0.13, 0.34), { color: C('#3d5028') });
  const eye = new THREE.SphereGeometry(1, 5, 4);
  b.add(eye, matrix(0.11, 0.05, 0.5, 0, 0, 0, 0.035, 0.035, 0.035), { color: C('#1a160f') });
  b.add(eye, matrix(-0.11, 0.05, 0.5, 0, 0, 0, 0.035, 0.035, 0.035), { color: C('#1a160f') });
  return b.build();
}

function turtleGeo() {
  const b = new GeoBuilder();
  const dome = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  b.add(dome, matrix(0, 0, 0, 0, 0, 0, 0.34, 0.17, 0.42), {
    faceColorFn: (c, n, tri) => {
      if (c.y < 0.03) return _c.copy(C('#d5452c'));                  // painted-turtle red rim
      return _c.copy(C('#2d3b23')).multiplyScalar(0.85 + 0.3 * ((tri * 7) % 5) / 5);
    },
  });
  b.add(new THREE.CylinderGeometry(1, 1, 0.04, 10), matrix(0, -0.01, 0, 0, 0, 0, 0.32, 1, 0.4), { color: C('#e2c35c') });
  const ball = new THREE.SphereGeometry(1, 6, 5);
  b.add(ball, matrix(0, 0.05, 0.47, 0, 0, 0, 0.085, 0.075, 0.12), { color: C('#5b7a3a') });      // head
  b.add(ball, matrix(0, 0.1, 0.52, 0, 0, 0, 0.03, 0.012, 0.05), { color: C('#e5c93e') });         // yellow stripe
  for (const [sx, sz, ry] of [[1, 1, 0.5], [-1, 1, -0.5], [1, -1, -0.4], [-1, -1, 0.4]]) {
    b.add(ball, matrix(sx * 0.36, -0.01, sz * 0.22, 0, ry, 0, 0.13, 0.04, 0.07), { color: C('#4d6a33') });
  }
  b.add(new THREE.ConeGeometry(1, 1, 4), matrix(0, 0.02, -0.46, -Math.PI / 2, 0, 0, 0.04, 0.12, 0.04), { color: C('#4d6a33') });
  return b.build();
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
    this.lake = lake;
    this.rng = mulberry32(4242);
    this.t = 0;
    const schools = mobile ? 3 : 6, perSchool = mobile ? 5 : 7, turtles = mobile ? 2 : 4;
    this.sunfish = makeInstanced(sunfishGeo(), schools * perSchool);
    this.bass = makeInstanced(bassGeo(), schools * 3);
    this.turtleMesh = makeInstanced(turtleGeo(), turtles);
    for (const g of [this.sunfish, this.bass, this.turtleMesh]) { scene.add(g.fill); scene.add(g.line); }

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
    for (let i = 0; i < turtles; i++) this.turtles.push({ x: 0, z: 0, h: this.rng() * 6.28, active: false, bad: 0, cycle: 8 + this.rng() * 25, surf: 0, sc: 0.9 + this.rng() * 0.5, ph: this.rng() * 6 });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler(); this._up = new THREE.Vector3(0, 1, 0);
  }

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

  update(dt, player) {
    this.t += dt;
    const lake = this.lake, px = player.x, pz = player.z;
    const full = lake.level > lake.originalLevel - 1.4 && !lake.drained;
    const sets = [this.sunfish, this.bass, this.turtleMesh];
    let nSun = 0, nBass = 0, nTur = 0;
    const put = (mesh, i, x, y, z, yaw, roll, sc) => {
      this._p.set(x, y, z);
      this._e.set(0, yaw, roll, 'YXZ'); this._q.setFromEuler(this._e);
      this._s.set(sc, sc, sc);
      this._m.compose(this._p, this._q, this._s);
      mesh.fill.setMatrixAt(i, this._m); mesh.line.setMatrixAt(i, this._m);
    };

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
      const mesh = sc.bass ? this.bass : this.sunfish;
      for (const m of sc.mem) {
        const tx = sc.x + Math.cos(sc.h) * m.ox + Math.sin(sc.h) * m.oz, tz = sc.z - Math.sin(sc.h) * m.ox + Math.cos(sc.h) * m.oz;
        m.x += (tx - m.x) * Math.min(1, dt * 1.6); m.z += (tz - m.z) * Math.min(1, dt * 1.6);
        const dh = Math.atan2(tx - m.x + Math.sin(sc.h) * 0.2, tz - m.z + Math.cos(sc.h) * 0.2);
        m.h = sc.h + Math.sin(this.t * 7 + m.ph) * 0.22;
        const y = lake.level - sc.dy - 0.12 * Math.sin(this.t * 0.8 + m.ph);
        const i = sc.bass ? nBass++ : nSun++;
        put(mesh, i, m.x, y, m.z, m.h, Math.sin(this.t * 7 + m.ph) * 0.12, m.sc * (sc.bass ? 1.15 : 1));
      }
    }

    for (const tu of this.turtles) {
      if (full && (!tu.active || tu.bad > 2.5 || Math.hypot(tu.x - px, tu.z - pz) > 80)) {
        const spot = this._place(px, pz, 0.7, 2.6, 8, 38);
        if (spot) { [tu.x, tu.z] = spot; tu.active = true; tu.bad = 0; tu.surf = 0; tu.cycle = 6 + this.rng() * 20; } else tu.active = false;
      }
      if (!full) tu.active = false;
      if (!tu.active) continue;
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
      const spd = 0.3 + 0.1 * Math.sin(this.t * 1.7 + tu.ph);
      tu.x += Math.sin(tu.h) * spd * dt; tu.z += Math.cos(tu.h) * spd * dt;
      const y = lake.level - 0.3 + tu.k * 0.26;
      put(this.turtleMesh, nTur++, tu.x, y, tu.z, tu.h + Math.sin(this.t * 1.4 + tu.ph) * 0.06, Math.sin(this.t * 1.1 + tu.ph) * 0.05, tu.sc);
    }

    const counts = [nSun, nBass, nTur];
    sets.forEach((g, k) => {
      g.fill.count = g.line.count = counts[k];
      g.fill.instanceMatrix.needsUpdate = true; g.line.instanceMatrix.needsUpdate = true;
      g.fill.visible = g.line.visible = counts[k] > 0;
    });
  }
}
