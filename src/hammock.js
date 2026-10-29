// The hammock.  A portable nylon hammock that someone left strung between two trees in the woods: from the third season
// on, a note on the trailhead board says where.  Find it, pack it up (E), and it is yours: Q brings it out, and the
// action button hangs it between two trees close by (about three to five steps apart) and you climb in.  Lie back and
// look up and around: the canopy, the sky, the birds, the light going by, four times faster, as when you sit (but not
// at night).  Animals come closer to someone lying still.  Any step gets you out; E beside it packs it up again (and if
// you walk off and leave it, you take it down as you go).
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, sdfAt, trailDistAt, waterDepthAt } from './world.js';
import { RUN } from './run.js';
import { mulberry32 } from './noise.js';

const FORCE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('hammock');   // testing: there to be found from the start
const COLOR = '#e8642a', EDGE = '#b8481a', STRAP = '#3a3a40';
export class Hammock {
  constructor(scene, chunks) {
    this.scene = scene; this.chunks = chunks; this.mesh = null; this.hung = null; this.lying = false; this.t = 0;
    this.S = (RUN.s.hammock ||= { have: false });
    // where the left-behind one is: off the trail in the woods, not far from the water (the same place every life)
    const rng = mulberry32(4242);
    for (let i = 0; i < 4000 && !this.S.at; i++) {
      const x = -380 + rng() * 760, z = -420 + rng() * 840, sd = sdfAt(x, z), td = trailDistAt(x, z);
      if (sd > 18 && sd < 60 && td > 10 && td < 35 && waterDepthAt(x, z) <= 0 && Math.abs(groundY(x + 3, z) - groundY(x, z)) < 0.8) this.S.at = { x, z };
    }
  }
  get have() { return !!this.S.have; }
  /** the left-behind one is out there to be found (from the third season, until you pack it up) */
  get waiting() { return !this.S.have && !!this.S.at && ((RUN.n || 0) >= 2 || FORCE); }
  /** two trees close by, about 3 to 5.5 m apart, with you near the middle */
  _pair(x, z, near = 4, R = 9) {
    const ts = this.chunks.treesNear(x, z, R).filter((t) => t.radius < 0.7);
    let best = null, bs = 1e9;
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      const a = ts[i], b = ts[j], d = Math.hypot(a.x - b.x, a.z - b.z); if (d < 2.6 || d > 5.5) continue;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, dm = Math.hypot(mx - x, mz - z); if (dm > near) continue;
      if (Math.abs(groundY(a.x, a.z) - groundY(b.x, b.z)) > 1) continue;
      const sc = dm + Math.abs(d - 4) * 0.5; if (sc < bs) { bs = sc; best = [a, b]; }
    }
    return best;
  }
  /** string it between two trees: a sagging nylon cocoon and two straps */
  _build(a, b) {
    this._drop();
    const g = new THREE.Group(), ya = groundY(a.x, a.z) + 1.55, yb = groundY(b.x, b.z) + 1.55;
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, sx = -uz, sz = ux;
    // the ends are tied at the trunks' surfaces
    const A = { x: a.x + ux * a.radius, y: ya, z: a.z + uz * a.radius }, B = { x: b.x - ux * b.radius, y: yb, z: b.z - uz * b.radius };
    const span = Math.hypot(B.x - A.x, B.z - A.z), sag = 0.35 + span * 0.18;
    const N = 18, M = 6, pos = [], idx = [], col = [], cA = new THREE.Color(COLOR), cE = new THREE.Color(EDGE);
    const at = (u) => ({ x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u - sag * 4 * u * (1 - u), z: A.z + (B.z - A.z) * u });
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = at(u), w = 0.08 + 0.62 * Math.pow(Math.sin(Math.PI * u), 0.6);   // gathered at the ends, wide in the middle
      for (let k = 0; k <= M; k++) { const v = k / M - 0.5, cup = (v * v * 4) * 0.22 * Math.sin(Math.PI * u); pos.push(p.x + sx * v * w, p.y + cup, p.z + sz * v * w); const c = Math.abs(v) > 0.42 ? cE : cA; col.push(c.r, c.g, c.b); }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < M; k++) { const q = i * (M + 1) + k; idx.push(q, q + 1, q + M + 1, q + 1, q + M + 2, q + M + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const cloth = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide })); g.add(cloth);
    // straps around each trunk, and the cord to the hammock's end
    for (const [t, E, y] of [[a, A, ya], [b, B, yb]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(t.radius + 0.02, 0.022, 5, 16), simpleToon(STRAP)); ring.position.set(t.x, y + 0.05, t.z); ring.rotation.x = Math.PI / 2; g.add(ring);
    }
    g.traverse((o) => { o.frustumCulled = false; });
    this.scene.add(g); this.mesh = g;
    this.hung = { a, b, A, B, mid: at(0.5), sx, sz, ux, uz };
  }
  _drop() { if (this.mesh) { this.scene.remove(this.mesh); this.mesh.traverse((o) => o.geometry?.dispose?.()); this.mesh = null; } this.hung = null; }
  /** each frame: the left-behind one appears when you come near its place; a hung one comes down if you walk off */
  update(dt, you) {
    this.t += dt;
    if (this.waiting && !this.hung && Math.hypot(you.x - this.S.at.x, you.z - this.S.at.z) < 70 && (this._try = (this._try || 0) - dt) <= 0) { this._try = 1.5; const pr = this._pair(this.S.at.x, this.S.at.z, 32, 34); if (pr) { this._build(pr[0], pr[1]); this.hung.found = true; const m = this.hung.mid; if (Math.hypot(m.x - this.S.at.x, m.z - this.S.at.z) > 2) { this.S.at = { x: m.x, z: m.z }; RUN.save?.(); this.onMoved?.(this.S.at); } } }   // between the nearest two trees that will hold it
    if (this.hung && !this.lying && !this.hung.found && Math.hypot(you.x - this.hung.mid.x, you.z - this.hung.mid.z) > 45) { this._drop(); this.onAutoPack?.(); }
    if (this.hung?.found && !this.waiting) this._drop();
  }
  /** what E would do here: 'take' (the left-behind one), 'pack' (yours, hung), or null */
  near(p) { const h = this.hung; if (!h || this.lying) return null; return Math.hypot(p.x - h.mid.x, p.z - h.mid.z) < 2.6 ? (h.found ? 'take' : 'pack') : null; }
  take() { if (this.hung?.found) { this.S.have = true; RUN.save?.(); this._drop(); return true; } return false; }
  pack() { if (this.hung && !this.hung.found) { this._drop(); return true; } return false; }
  /** hang it here and climb in; returns false when there are no two trees to hang it from */
  hang(player) {
    if (!this.have || this.lying) return false;
    const pr = this._pair(player.pos.x, player.pos.z, 4); if (!pr) return false;
    this._build(pr[0], pr[1]); this.lieIn(player); return true;
  }
  lieIn(player) {
    const h = this.hung; if (!h || h.found) return false;
    this.lying = true; this.player = player; player.sitting = false;
    player.yaw = Math.atan2(-h.ux, -h.uz) + (Math.random() < 0.5 ? 0 : Math.PI); player.pitch = 0.75;   // lying back, looking up into the trees
    player.ropeCtl = (dt) => this._lie(dt);
    return true;
  }
  _lie(dt) {
    const p = this.player, h = this.hung, k = p.keys;
    const moving = k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight || k.Space || Math.hypot(p.touch.x, p.touch.y) > 0.3;
    if (moving) { this.getUp(); return; }
    const sway = Math.sin(this.t * 0.7) * 0.07;
    p.pos.set(h.mid.x + h.sx * sway, h.mid.y + 0.32 - 1.7, h.mid.z + h.sz * sway); p.vy = 0; p.onGround = true;
  }
  getUp() {
    const p = this.player, h = this.hung; if (!this.lying) return;
    this.lying = false; p.ropeCtl = null;
    if (h) { p.pos.set(h.mid.x + h.sx * 0.9, groundY(h.mid.x + h.sx * 0.9, h.mid.z + h.sz * 0.9), h.mid.z + h.sz * 0.9); }
    p.pitch = 0; this.onGetUp?.();
  }
}
