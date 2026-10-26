// Things the forest remembers: a cellar hole, a stone well, a boundary stone. Found by walking near them, logged in the journal.
// Positions are invented (picked off the real trails with a fixed seed); New England woods really are full of such ruins.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt } from './world.js';
import { TRAIL_LINES } from './ashland.js';
import { mulberry32 } from './noise.js';
import { JOURNAL } from './places.js';

const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 9);
const STONE = ['#8d8a82', '#777469', '#9a968a', '#6f6c62'];
const stoneColor = (i) => new THREE.Color(STONE[i % STONE.length]);

function cellarGeo() {            // a rectangle of tumbled fieldstone, a chimney base, and a dark hollow
  const b = new GeoBuilder(); let i = 0;
  const W = 4.2, D = 5.4;
  for (let k = 0; k <= 10; k++) for (const [x, z] of [[-W / 2 + k * W / 10, -D / 2], [-W / 2 + k * W / 10, D / 2]]) b.add(box, matrix(x, 0.2, z, 0, (k * 0.7) % 1, 0, 0.5, 0.42 + (k % 3) * 0.12, 0.5), { color: stoneColor(i++) });
  for (let k = 1; k < 10; k++) for (const [x, z] of [[-W / 2, -D / 2 + k * D / 10], [W / 2, -D / 2 + k * D / 10]]) b.add(box, matrix(x, 0.2, z, 0, (k * 0.9) % 1, 0, 0.5, 0.4 + (k % 3) * 0.1, 0.5), { color: stoneColor(i++) });
  b.add(box, matrix(0, 0.05, 0, 0, 0, 0, W - 0.5, 0.06, D - 0.5), { color: new THREE.Color('#2b2620') });
  b.add(box, matrix(W / 2 - 0.4, 0.45, -D / 2 + 0.5, 0, 0.2, 0, 1.1, 0.9, 1.1), { color: stoneColor(1) });
  return b.build();
}
function wellGeo() {
  const b = new GeoBuilder();
  for (let k = 0; k < 12; k++) { const a = k / 12 * 6.2832; b.add(box, matrix(Math.cos(a) * 0.85, 0.3 + (k % 2) * 0.12, Math.sin(a) * 0.85, 0, -a, 0, 0.55, 0.5 + (k % 3) * 0.08, 0.42), { color: stoneColor(k) }); }
  b.add(cyl, matrix(0, 0.15, 0, 0, 0, 0, 0.62, 0.1, 0.62), { color: new THREE.Color('#1c2a30') });
  return b.build();
}
function markerGeo() {
  const b = new GeoBuilder();
  b.add(box, matrix(0, 0.55, 0, 0, 0.3, 0.05, 0.38, 1.1, 0.2), { color: stoneColor(2) });
  b.add(box, matrix(0, 0.08, 0, 0, 0.5, 0, 0.6, 0.18, 0.5), { color: stoneColor(3) });
  b.add(box, matrix(0.0, 0.8, 0.095, 0, 0.3, 0.05, 0.12, 0.012, 0.01), { color: new THREE.Color('#3b372f') });
  return b.build();
}
export const KINDS = {
  cellar: { name: 'A cellar hole', note: 'Fieldstone walls around a dark hollow: the foundation of a house that stood here long before the park.', geo: cellarGeo },
  well: { name: 'A stone well', note: 'A ring of fitted stones, long dry. Someone carried water from here every morning.', geo: wellGeo },
  marker: { name: 'A boundary stone', note: 'A squared stone with a notch cut into it. It marked where one farm ended and the next began.', geo: markerGeo },
};
const PLAN = [['cellar', 1], ['well', 1], ['marker', 2], ['cellar', 1], ['marker', 1]];

export class Discoveries {
  constructor(scene, chunks) {
    this.items = []; this.found = new Set(); try { for (const k of JSON.parse(localStorage.getItem('ashland.found') || '[]')) this.found.add(k); } catch {}
    const rng = mulberry32(5150), trails = TRAIL_LINES.flat().filter((_, i) => i % 3 === 0);
    const inst = {};
    for (const k of Object.keys(KINDS)) { inst[k] = makeInstanced(KINDS[k].geo(), 4); scene.add(inst[k].fill); scene.add(inst[k].line); }
    let n = 0;
    for (const [kind] of PLAN) {
      for (let tries = 0; tries < 200; tries++) {
        const t = trails[(rng() * trails.length) | 0], ang = rng() * 6.283, r = 22 + rng() * 40;
        const x = t[0] + Math.cos(ang) * r, z = t[1] + Math.sin(ang) * r;
        if (sdfAt(x, z) < 14) continue;
        const gy = groundY(x, z);
        if (Math.abs(groundY(x + 3, z) - gy) > 0.9 || Math.abs(groundY(x, z + 3) - gy) > 0.9) continue;
        if (this.items.some((q) => Math.hypot(q.x - x, q.z - z) < 70)) continue;
        const id = `${kind}${n++}`, it = { id, kind, x, z, y: gy, yaw: rng() * 6.283 };
        const o = inst[kind], i = o.fill.count++; o.line.count = o.fill.count;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, gy - 0.02, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.yaw), new THREE.Vector3(1, 1, 1));
        o.fill.setMatrixAt(i, m); o.line.setMatrixAt(i, m); o.fill.instanceMatrix.needsUpdate = o.line.instanceMatrix.needsUpdate = true;
        this.items.push(it); break;
      }
    }
    this.onFound = null;
  }
  update(player) {
    for (const it of this.items) if (!this.found.has(it.id) && Math.hypot(it.x - player.x, it.z - player.z) < 13) {
      this.found.add(it.id); try { localStorage.setItem('ashland.found', JSON.stringify([...this.found])); } catch {}
      JOURNAL.add(`Found ${KINDS[it.kind].name.toLowerCase()}. ${KINDS[it.kind].note}`, it.x, it.z);
      this.onFound?.(it, KINDS[it.kind]);
    }
  }
  foundList() { return this.items.filter((i) => this.found.has(i.id)); }
  reset() { this.found.clear(); try { localStorage.removeItem('ashland.found'); } catch {} }
}
