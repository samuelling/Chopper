// Cel-shaded gray squirrels: a few at a time near the player, darting between pauses, scampering up the
// nearest tree when you get close, then gone.  Same toon fill + outline as the trees.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt, trailDistAt } from './world.js';
import { mulberry32 } from './noise.js';

const C = (h) => new THREE.Color(h);
const _c = new THREE.Color();

function squirrelGeo() {
  const b = new GeoBuilder();
  const ball = new THREE.SphereGeometry(1, 8, 6);
  // body
  b.add(ball, matrix(0, 0.14, 0, 0.18, 0, 0, 0.1, 0.1, 0.2), {
    faceColorFn: (c, n) => (n.y < -0.2 ? _c.copy(C('#d8cdb8')) : _c.copy(C('#7d7568')).lerp(C('#a2866a'), 0.35 * (c.z > 0 ? 0 : 1))),
  });
  // head, ears, nose, eye
  b.add(ball, matrix(0, 0.22, 0.2, 0, 0, 0, 0.075, 0.07, 0.085), { color: C('#8a8174') });
  b.add(ball, matrix(0.045, 0.285, 0.17, 0, 0, 0, 0.022, 0.035, 0.018), { color: C('#6d6559') });
  b.add(ball, matrix(-0.045, 0.285, 0.17, 0, 0, 0, 0.022, 0.035, 0.018), { color: C('#6d6559') });
  b.add(ball, matrix(0, 0.21, 0.28, 0, 0, 0, 0.02, 0.018, 0.02), { color: C('#2a211b') });
  b.add(ball, matrix(0.055, 0.235, 0.24, 0, 0, 0, 0.016, 0.016, 0.016), { color: C('#171310') });
  b.add(ball, matrix(-0.055, 0.235, 0.24, 0, 0, 0, 0.016, 0.016, 0.016), { color: C('#171310') });
  // haunches and forepaws
  b.add(ball, matrix(0.07, 0.09, -0.08, 0, 0, 0, 0.045, 0.08, 0.09), { color: C('#746c5f') });
  b.add(ball, matrix(-0.07, 0.09, -0.08, 0, 0, 0, 0.045, 0.08, 0.09), { color: C('#746c5f') });
  b.add(ball, matrix(0.04, 0.05, 0.12, 0, 0, 0, 0.025, 0.05, 0.04), { color: C('#8a8174') });
  b.add(ball, matrix(-0.04, 0.05, 0.12, 0, 0, 0, 0.025, 0.05, 0.04), { color: C('#8a8174') });
  // the big arched tail: a stack of puffs curling up and over the back
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    b.add(ball, matrix(0, 0.16 + 0.34 * Math.sin(t * 1.5), -0.2 - 0.14 * Math.cos(t * 1.1) + t * 0.05, 0, 0, 0, 0.075 + 0.02 * t, 0.1, 0.1), {
      faceColorFn: (c, n) => _c.copy(C('#8d8576')).lerp(C('#cfc7b6'), n.z < -0.3 ? 0.5 : 0.1),
    });
  }
  return b.build();
}

export class Squirrels {
  constructor(scene, chunks, { mobile = false } = {}) {
    this.chunks = chunks;
    this.rng = mulberry32(8080);
    this.t = 0;
    this.mesh = makeInstanced(squirrelGeo(), 4);
    scene.add(this.mesh.fill); scene.add(this.mesh.line);
    this.list = [];
    const n = mobile ? 2 : 3;
    for (let i = 0; i < n; i++) this.list.push({ active: false, wait: 2 + i * 4, x: 0, z: 0, h: 0, st: 'sit', timer: 0, ph: this.rng() * 6, tx: 0, tz: 0, tree: null, climb: 0, sc: 0.95 + this.rng() * 0.25 });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }

  _spawn(a, px, pz) {
    for (let k = 0; k < 30; k++) {
      const ang = this.rng() * 6.283, r = 14 + this.rng() * 26;
      const x = px + Math.cos(ang) * r, z = pz + Math.sin(ang) * r;
      if (sdfAt(x, z) < 8) continue;
      if (this.chunks.nearestTree(x, z, 12) === null) continue;       // squirrels stay near trees
      a.x = x; a.z = z; a.h = this.rng() * 6.283; a.st = 'sit'; a.timer = 1 + this.rng() * 3; a.active = true; a.climb = 0; a.tree = null;
      return true;
    }
    return false;
  }

  update(dt, player) {
    this.t += dt;
    const px = player.x, pz = player.z;
    let n = 0;
    for (const a of this.list) {
      if (!a.active) {
        a.wait -= dt;
        if (a.wait <= 0 && !this._spawn(a, px, pz)) a.wait = 3;
        if (!a.active) continue;
      }
      const dp = Math.hypot(a.x - px, a.z - pz);
      if (dp > 70) { a.active = false; a.wait = 5; continue; }
      let y = groundY(a.x, a.z), pitch = 0, roll = 0, hop = 0;

      if (a.st !== 'flee' && a.st !== 'climb' && a.st !== 'hidden' && dp < 7) {
        // spooked: bolt for the nearest trunk, or just away from the player
        a.tree = this.chunks.nearestTree(a.x, a.z, 14);
        if (a.tree) { a.tx = a.tree.x; a.tz = a.tree.z; } else { const l = dp || 1; a.tx = a.x + (a.x - px) / l * 14; a.tz = a.z + (a.z - pz) / l * 14; }
        a.st = 'flee'; a.timer = 5;
      }

      if (a.st === 'sit') {
        a.timer -= dt;
        a.h += Math.sin(this.t * 0.9 + a.ph) * 0.35 * dt;             // glancing about
        pitch = -0.35;                                                  // upright, nibbling pose
        if (a.timer <= 0) {
          const ang = a.h + (this.rng() - 0.5) * 2.4, d = 2.5 + this.rng() * 4.5;
          a.tx = a.x + Math.sin(ang) * d; a.tz = a.z + Math.cos(ang) * d;
          if (sdfAt(a.tx, a.tz) < 6) { a.timer = 0.5; a.h += 2; } else { a.st = 'dash'; a.timer = 6; }
        }
      } else if (a.st === 'dash' || a.st === 'flee') {
        const fast = a.st === 'flee';
        const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz); let dh = want - a.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        a.h += dh * Math.min(1, dt * (fast ? 14 : 8));
        const spd = fast ? 5.2 : 2.6;
        const nx = a.x + Math.sin(a.h) * spd * dt, nz = a.z + Math.cos(a.h) * spd * dt;
        if (sdfAt(nx, nz) > 5) { a.x = nx; a.z = nz; } else a.timer = 0;
        hop = Math.abs(Math.sin(this.t * (fast ? 17 : 12) + a.ph)) * (fast ? 0.12 : 0.08);
        pitch = 0.18 * Math.sin(this.t * (fast ? 17 : 12) + a.ph);
        a.timer -= dt;
        const reach = a.tree ? a.tree.radius + 0.25 : 0.4;
        if (d < reach || a.timer <= 0) {
          if (fast && a.tree) { a.st = 'climb'; a.climb = 0; a.h = Math.atan2(a.tree.x - a.x, a.tree.z - a.z); }
          else if (fast) { a.active = false; a.wait = 8 + this.rng() * 10; continue; }
          else { a.st = 'sit'; a.timer = 1.5 + this.rng() * 4; }
        }
      } else if (a.st === 'climb') {
        // up the trunk, nose to the sky
        a.climb += dt * 3.2;
        const tr = a.tree;
        const top = Math.min(tr.H * 0.75, 7);
        y = groundY(tr.x, tr.z) + 0.1 + a.climb;
        pitch = -1.45;
        a.x = tr.x - Math.sin(a.h) * (tr.radius + 0.08); a.z = tr.z - Math.cos(a.h) * (tr.radius + 0.08);
        if (a.climb > top || !tr.alive) { a.active = false; a.wait = 10 + this.rng() * 18; continue; }
      }

      // pose: yaw, nose-up pitch (about local x), tiny roll when dashing
      this._p.set(a.x, y + hop, a.z);
      this._e.set(pitch, a.h, roll, 'YXZ'); this._q.setFromEuler(this._e);
      this._s.setScalar(a.sc);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.fill.setMatrixAt(n, this._m); this.mesh.line.setMatrixAt(n, this._m);
      n++;
    }
    const g = this.mesh;
    g.fill.count = g.line.count = n;
    g.fill.instanceMatrix.needsUpdate = g.line.instanceMatrix.needsUpdate = true;
    g.fill.visible = g.line.visible = n > 0;
  }
}
