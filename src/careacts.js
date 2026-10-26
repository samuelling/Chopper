// Small acts of care: pick up litter (E), and every few pieces earn a seed to plant (G) as a sapling that grows very slowly.
// Nothing here is AI-related; it is simply what tending a place feels like. Small, slow, and it counts toward the care side.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt } from './world.js';
import { TRAIL_LINES, ROAD_LINES } from './ashland.js';
import { mulberry32 } from './noise.js';
import { SEASON } from './season.js';
import { RUN } from './run.js';
import { CARE } from './care.js';
import { JOURNAL } from './places.js';

const C = (h) => new THREE.Color(h);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 8), box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(1, 7, 6);
const KINDS = {
  can: { name: 'a can', geo: () => { const b = new GeoBuilder(); b.add(cyl, matrix(0, 0.06, 0, 0, 0, 1.4, 0.032, 0.06, 0.032), { color: C('#c9422f') }); b.add(cyl, matrix(0, 0.06, 0, 0, 0, 1.4, 0.026, 0.062, 0.026), { color: C('#c8ccd0') }); return b.build(); } },
  bottle: { name: 'a bottle', geo: () => { const b = new GeoBuilder(); b.add(cyl, matrix(0, 0.04, 0, 0, 0.6, 1.5, 0.03, 0.1, 0.03), { color: C('#3f7a52') }); b.add(cyl, matrix(0.1, 0.05, 0, 0, 0.6, 1.5, 0.014, 0.04, 0.014), { color: C('#3f7a52') }); return b.build(); } },
  wrapper: { name: 'a wrapper', geo: () => { const b = new GeoBuilder(); b.add(box, matrix(0, 0.01, 0, 0, 0.5, 0.1, 0.1, 0.006, 0.07), { color: C('#e9e4d4') }); b.add(box, matrix(0.02, 0.016, 0.01, 0, 0.2, 0.2, 0.05, 0.004, 0.04), { color: C('#d8553a') }); return b.build(); } },
};
const SAP_COL = { spring: '#8cc05a', summer: '#4f8a3a', autumn: '#d9742a', winter: '#8a7a68' }[SEASON];
function saplingGeo() {
  const b = new GeoBuilder();
  b.add(cyl, matrix(0, 0.5, 0, 0, 0, 0, 0.018, 0.5, 0.018), { color: C('#6a4a30') });
  b.add(ball, matrix(0, 1.05, 0, 0, 0, 0, 0.22, 0.2, 0.22), { color: C(SAP_COL) });
  b.add(ball, matrix(0.1, 0.85, 0.05, 0, 0, 0, 0.16, 0.14, 0.16), { color: C(SAP_COL) });
  b.add(ball, matrix(-0.09, 0.78, -0.06, 0, 0, 0, 0.15, 0.13, 0.15), { color: C(SAP_COL) });
  return b.build();
}

export class CareActs {
  constructor(scene) {
    const S = RUN.s; S.litterGone ||= []; S.seeds ||= 0; S.saplings ||= []; S.planted ||= 0;
    this.gone = new Set(S.litterGone);
    this.mesh = {}; for (const k of Object.keys(KINDS)) { this.mesh[k] = makeInstanced(KINDS[k].geo(), 30); scene.add(this.mesh[k].fill); scene.add(this.mesh[k].line); }
    this.sap = makeInstanced(saplingGeo(), 60); scene.add(this.sap.fill); scene.add(this.sap.line);
    const rng = mulberry32(31337), pts = [...TRAIL_LINES.flat(), ...ROAD_LINES.flat()].filter((_, i) => i % 2 === 0);
    this.items = [];
    for (let i = 0; i < 90 && this.items.length < 26; i++) {
      const p = pts[(rng() * pts.length) | 0], a = rng() * 6.283, r = 1 + rng() * 3, x = p[0] + Math.cos(a) * r, z = p[1] + Math.sin(a) * r;
      if (sdfAt(x, z) < 4) continue;
      const id = `L${this.items.length}`, kind = ['can', 'bottle', 'wrapper', 'wrapper'][(rng() * 4) | 0];
      this.items.push({ id, kind, x, z, yaw: rng() * 6.283 });
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this.nearest = null; this.onToast = null; this._dirty = true; this._lastN = -1;
  }
  get seeds() { return RUN.s.seeds; }
  get picked() { return this.gone.size; }
  _rebuild() {
    const n = {}; for (const k of Object.keys(KINDS)) n[k] = 0;
    for (const it of this.items) {
      if (this.gone.has(it.id)) continue;
      const o = this.mesh[it.kind], i = n[it.kind]++;
      this._e.set(0, it.yaw, 0, 'YXZ'); this._q.setFromEuler(this._e); this._m.compose(this._p.set(it.x, groundY(it.x, it.z) + 0.01, it.z), this._q, this._s);
      o.fill.setMatrixAt(i, this._m); o.line.setMatrixAt(i, this._m);
    }
    for (const k of Object.keys(KINDS)) { const o = this.mesh[k]; o.fill.count = o.line.count = n[k]; o.fill.instanceMatrix.needsUpdate = o.line.instanceMatrix.needsUpdate = true; o.fill.visible = o.line.visible = n[k] > 0; }
    // saplings grow over many seasons
    const age = RUN.n + RUN.s.played / Math.max(1, RUN.len);
    RUN.s.saplings.forEach((sp, i) => {
      const grown = Math.min(1, Math.max(0, age - sp.age0) / 10), sc = 0.35 + grown * 1.6;
      this._e.set(0, sp.yaw, 0, 'YXZ'); this._q.setFromEuler(this._e); this._m.compose(this._p.set(sp.x, groundY(sp.x, sp.z), sp.z), this._q, this._s.set(sc, sc, sc));
      this.sap.fill.setMatrixAt(i, this._m); this.sap.line.setMatrixAt(i, this._m);
    });
    this._s.set(1, 1, 1);
    this.sap.fill.count = this.sap.line.count = RUN.s.saplings.length; this.sap.fill.instanceMatrix.needsUpdate = this.sap.line.instanceMatrix.needsUpdate = true; this.sap.fill.visible = this.sap.line.visible = RUN.s.saplings.length > 0;
  }
  /** returns a prompt string or '' */
  update(dt, player) {
    if (this._dirty) { this._dirty = false; this._rebuild(); }
    this._t = (this._t || 0) + dt; if (this._t > 20) { this._t = 0; this._dirty = true; }
    let best = null, bd = 2.6;
    for (const it of this.items) { if (this.gone.has(it.id)) continue; const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z); if (d < bd) { bd = d; best = it; } }
    this.nearest = best;
    if (best) return `[E]  pick up ${KINDS[best.kind].name}`;
    return '';
  }
  pickUp() {
    const it = this.nearest; if (!it) return false;
    this.gone.add(it.id); RUN.s.litterGone = [...this.gone]; CARE.add(0.004);
    const n = this.gone.size;
    if (n % 4 === 0) { RUN.s.seeds++; this.onToast?.('You found a seed among the litter. G plants it.'); }
    else this.onToast?.(`Picked up ${KINDS[it.kind].name}. ${n} of ${this.items.length} cleared.`);
    if (n === this.items.length) JOURNAL.add('Cleared every scrap of litter I could find.');
    RUN.save?.(); this._dirty = true; this.nearest = null; return true;
  }
  plant(player) {
    if (RUN.s.seeds < 1) return this.onToast?.('No seeds. Picking up litter turns some up.');
    const f = player.forward(), x = player.pos.x + f.x * 1.6, z = player.pos.z + f.z * 1.6;
    if (sdfAt(x, z) < 3) return this.onToast?.('Too close to the water.');
    if (RUN.s.saplings.some((s) => Math.hypot(s.x - x, s.z - z) < 1.2)) return this.onToast?.('There is already one here.');
    RUN.s.seeds--; RUN.s.planted++; RUN.s.saplings.push({ x, z, yaw: Math.random() * 6.28, age0: RUN.n + RUN.s.played / Math.max(1, RUN.len) });
    CARE.add(0.012); JOURNAL.add('Planted a sapling. It will take many seasons.', x, z); RUN.save?.(); this._dirty = true;
    this.onToast?.('Planted. Trees do not hurry, and neither should you.');
  }
}
