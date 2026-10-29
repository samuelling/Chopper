// Birding by ear.  Now and then, on a day in the warm months, a songbird you usually only hear (a cardinal, a robin,
// a house wren, a red-eyed vireo) perches in a tree somewhere near you and sings every few seconds.  The song comes from
// its side and grows louder as you close in, so you can follow it.  Find it, and it is a photo: the bird for your Field
// Guide, and the first time, a moment of its own.  After a minute or two it flies.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, sdfAt } from './world.js';
import { SEASON } from './season.js';

const SINGERS = {
  spring: ['robin', 'cardinal', 'wren', 'titmouse', 'towhee', 'songsparrow', 'phoebe'],
  summer: ['cardinal', 'vireo', 'wren', 'robin', 'catbird', 'goldfinch', 'towhee', 'titmouse', 'woodthrush'],
  autumn: ['cardinal', 'titmouse', 'songsparrow'], winter: ['cardinal', 'titmouse'],
};
const LOOK = {   // body, breast, head, extra
  cardinal: ['#c8202a', '#d8402a', '#c8202a', '#1a1414'], robin: ['#5a5652', '#d8702a', '#2a2826', '#f2efe8'],
  wren: ['#7a5a3e', '#a8865e', '#7a5a3e', '#c8b090'], vireo: ['#7a8a5a', '#e8e6d8', '#8a8a86', '#c8202a'],
  titmouse: ['#8a8c92', '#ece8e2', '#8a8c92', '#d89a6a'], towhee: ['#1a1616', '#f2eee8', '#1a1616', '#b8602a'], songsparrow: ['#7a5a3e', '#d8d0c0', '#7a5a3e', '#4a3828'],
  phoebe: ['#6a645a', '#ece8d8', '#4a463e', '#2a2622'], catbird: ['#6a6e76', '#7a7e86', '#1a1a1e', '#9a4a2a'], goldfinch: ['#f2d020', '#f6e040', '#1a1a1a', '#1a1a1a'],
  woodthrush: ['#9a6a3a', '#f2ece0', '#a8743e', '#3a2a1e'],
};
const OL = simpleToon('#141210', { side: THREE.BackSide });
function birdModel(kind) {
  const [body, breast, head, extra] = LOOK[kind], g = new THREE.Group(), ball = new THREE.SphereGeometry(1, 10, 8), cone = new THREE.ConeGeometry(1, 1, 7);
  const add = (geo, col, x, y, z, sx, sy, sz, rx = 0, ol = true) => { const m = new THREE.Mesh(geo, simpleToon(col)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; g.add(m); if (ol) { const o = new THREE.Mesh(geo, OL); o.position.copy(m.position); o.scale.set(sx * 1.12, sy * 1.12, sz * 1.12); o.rotation.copy(m.rotation); g.add(o); } return m; };
  add(ball, body, 0, 0.09, 0, 0.065, 0.075, 0.1, -0.3);
  add(ball, breast, 0, 0.075, 0.04, 0.055, 0.06, 0.06, 0, false);
  const h = new THREE.Group(); h.position.set(0, 0.17, 0.05); g.add(h);
  const hm = new THREE.Mesh(ball, simpleToon(head)); hm.scale.setScalar(0.048); h.add(hm);
  const bk = new THREE.Mesh(cone, simpleToon(kind === 'cardinal' ? '#e8902a' : '#e0b030')); bk.scale.set(0.014, 0.04, 0.014); bk.rotation.x = Math.PI / 2; bk.position.set(0, -0.005, 0.055); h.add(bk);
  if (kind === 'cardinal') { const c = new THREE.Mesh(cone, simpleToon(body)); c.scale.set(0.022, 0.06, 0.03); c.rotation.x = -0.6; c.position.set(0, 0.045, -0.02); h.add(c); const m = new THREE.Mesh(ball, simpleToon(extra)); m.scale.set(0.03, 0.02, 0.01); m.position.set(0, -0.005, 0.042); h.add(m); }
  if (kind === 'robin') { for (const s of [-1, 1]) { const e = new THREE.Mesh(ball, simpleToon(extra)); e.scale.setScalar(0.008); e.position.set(s * 0.03, 0.012, 0.032); h.add(e); } }
  if (kind === 'titmouse') { const c = new THREE.Mesh(cone, simpleToon(head)); c.scale.set(0.02, 0.05, 0.026); c.rotation.x = -0.5; c.position.set(0, 0.04, -0.015); h.add(c); }
  if (kind === 'towhee') { for (const s of [-1, 1]) { const f = new THREE.Mesh(ball, simpleToon(extra)); f.scale.set(0.02, 0.03, 0.05); f.position.set(s * 0.045, 0.075, 0.0); g.add(f); } }
  if (kind === 'woodthrush' || kind === 'songsparrow') { for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(ball, simpleToon(extra)); sp.scale.setScalar(0.007); sp.position.set((Math.random() - 0.5) * 0.06, 0.05 + Math.random() * 0.05, 0.085); g.add(sp); } }
  if (kind === 'catbird') { const c = new THREE.Mesh(ball, simpleToon(head)); c.scale.set(0.05, 0.02, 0.05); c.position.set(0, 0.03, -0.005); h.add(c); }
  if (kind === 'goldfinch') { const c = new THREE.Mesh(ball, simpleToon(head)); c.scale.set(0.04, 0.015, 0.03); c.position.set(0, 0.035, 0.02); h.add(c); for (const s of [-1, 1]) { const w = new THREE.Mesh(ball, simpleToon('#1a1a1a')); w.scale.set(0.012, 0.04, 0.07); w.position.set(s * 0.05, 0.085, -0.02); g.add(w); } }
  if (kind === 'vireo') { for (const s of [-1, 1]) { const e = new THREE.Mesh(ball, simpleToon('#f2efe8')); e.scale.set(0.006, 0.006, 0.02); e.position.set(s * 0.04, 0.018, 0.01); h.add(e); const r = new THREE.Mesh(ball, simpleToon(extra)); r.scale.setScalar(0.007); r.position.set(s * 0.036, 0.008, 0.03); h.add(r); } }
  add(cone, body, 0, 0.06, -0.12, 0.03, 0.12, 0.012, -Math.PI / 2 - (kind === 'wren' ? -0.9 : 0.25));   // the tail (a wren cocks it up)
  g.scale.setScalar(kind === 'wren' ? 0.8 : 1.15); g.userData.head = h;
  g.traverse((o) => { o.frustumCulled = false; });
  return g;
}

export class Birding {
  constructor(scene, camera, audio, chunks) {
    this.scene = scene; this.camera = camera; this.audio = audio; this.chunks = chunks; this.seen = []; this.a = null;
    this.next = 50 + Math.random() * 70;
  }
  /** each frame (real time).  ok: daytime, on foot, nothing else going on */
  update(dt, ok, you) {
    this.seen.length = 0;
    const list = SINGERS[SEASON] || [];
    if (!this.a) {
      if (!ok || !list.length || (this.next -= dt) > 0) return;
      // a tree 22-45 m away, not straight ahead (you have to listen for it)
      const trees = this.chunks.treesNear(you.x, you.z, 46).filter((t) => { const d = Math.hypot(t.x - you.x, t.z - you.z); return d > 22 && t.H > 6 && sdfAt(t.x, t.z) > 2; });
      if (!trees.length) { this.next = 10; return; }
      this.next = 80 + Math.random() * 120;
      const t = trees[(Math.random() * trees.length) | 0], kind = list[(Math.random() * list.length) | 0];
      const m = birdModel(kind), side = Math.random() * 6.28, r = Math.max(0.6, t.radius * 2.2);
      m.position.set(t.x + Math.cos(side) * r, t.y + t.H * (0.55 + Math.random() * 0.2), t.z + Math.sin(side) * r); m.rotation.y = side + Math.PI / 2; this.scene.add(m);
      this.a = { kind, m, t: 0, sing: 1.5, life: 110, fly: 0 };
      this.onArrive?.(kind);
    }
    const a = this.a; a.t += dt;
    const p = a.m.position, dx = p.x - this.camera.position.x, dz = p.z - this.camera.position.z, d = Math.hypot(dx, dz);
    if (a.fly > 0) {   // off it goes
      a.fly += dt; p.x += Math.cos(a.dir) * dt * 9; p.z += Math.sin(a.dir) * dt * 9; p.y += dt * 2.5;
      if (a.fly > 6) { this.scene.remove(a.m); this.a = null; }
      return;
    }
    a.m.userData.head.rotation.y = Math.sin(a.t * 1.7) * 0.6;
    if ((a.sing -= dt) <= 0) {
      a.sing = 5 + Math.random() * 3;
      const rgt = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion), pan = (dx * rgt.x + dz * rgt.z) / (d || 1);   // which ear it is in
      this.audio?.songAt?.(a.kind, pan * 0.9, Math.min(1.4, 18 / Math.max(6, d)));
      a.m.userData.head.rotation.x = -0.4; setTimeout(() => { if (this.a?.m === a.m) a.m.userData.head.rotation.x = 0; }, 600);
    }
    this.seen.push({ kind: a.kind, act: 'by-ear', x: p.x, y: p.y + 0.1, z: p.z, r: 0.25 });
    if (a.t > a.life || (d < 4 && a.t > 3)) { a.fly = 0.001; a.dir = Math.atan2(dz, dx); }
  }
  /** after a photo: it has been found, and it can go */
  photographed() { if (this.a && !this.a.fly) { this.a.life = Math.min(this.a.life, this.a.t + 4); } }
}
