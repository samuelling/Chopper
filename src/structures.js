// Things the park builds with AI's help: benches, a boardwalk, a trail kiosk, a picnic table.  Placed in front of the
// player, remembered across seasons.  Built from boxes, with the same cel-shaded fill + outline as the rest of the park.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { fillMaterial, outlineMaterial } from './toon.js';
import { groundY, sdfAt, flattenArea, LEVEL } from './world.js';

const WOOD = '#8a6840', DARK = '#4b3a2a', ROOF = '#5a4636', SIGN = '#d9c9a0', INK = '#3f5d4a';

export class Structures {
  constructor(scene, colliders) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.colliders = colliders; this.fill = fillMaterial({ sway: false }); this.outline = outlineMaterial({ sway: false });
    this.items = [];
  }
  _box(b, x, y, z, w, h, d, color, ry = 0, rx = 0) { b.add(new THREE.BoxGeometry(w, h, d), matrix(x, y + h / 2, z, rx, ry, 0), { tint: 0, color: new THREE.Color(color) }); }
  // local (u: right, v: forward) -> world, for a structure at (x,z) turned by yaw
  /** places to sit on what has been built: a bench (facing the way it was built), both sides of a picnic table */
  get seats() {
    const out = [];
    for (const it of this.items) {
      if (it.type === 'bench') { const [x, z] = this._w(it.x, it.z, it.yaw, 0, 0.05), [fx, fz] = this._w(it.x, it.z, it.yaw, 0, 3); out.push({ x, z, fx, fz, kind: 'bench' }); }
      if (it.type === 'table') for (const s of [-0.72, 0.72]) { const [x, z] = this._w(it.x, it.z, it.yaw, 0, s); out.push({ x, z, fx: it.x, fz: it.z, kind: 'table' }); }
    }
    return out;
  }
  _w(x, z, yaw, u, v) { const c = Math.cos(yaw), s = Math.sin(yaw); return [x + u * c + v * s, z - u * s + v * c]; }

  _build(type, x, z, yaw) {
    const b = new GeoBuilder(), g = groundY(x, z), colliders = [];
    const P = (u, v) => this._w(x, z, yaw, u, v);
    const box = (u, v, y, w, h, d, color, ry = 0, rx = 0) => { const [wx, wz] = P(u, v); this._box(b, wx, y, wz, w, h, d, color, yaw + ry, rx); };
    if (type === 'bench') {
      box(0, 0, g + 0.42, 1.7, 0.07, 0.5, WOOD); box(0, -0.25, g + 0.8, 1.7, 0.4, 0.06, WOOD);
      for (const s of [-0.7, 0.7]) box(s, 0, g - 0.02, 0.08, 0.45, 0.4, DARK);
    } else if (type === 'boardwalk') {
      const len = 14, n = Math.round(len / 0.34);
      const hAt = (v) => { const [wx, wz] = P(0, v); return Math.max(groundY(wx, wz), LEVEL + 0.1) + 0.2; };
      for (let i = 0; i < n; i++) { const v = i * 0.34 + 0.17; box(0, v, hAt(v), 1.5, 0.06, 0.28, WOOD); }
      for (let v = 0; v <= len; v += 2.4) for (const s of [-0.62, 0.62]) { const h = hAt(v); const [wx, wz] = P(s, v); this._box(b, wx, groundY(wx, wz) - 0.05, wz, 0.1, h - groundY(wx, wz) + 0.0, 0.1, DARK, yaw); }
      for (const s of [-0.7, 0.7]) for (let v = 0; v < len; v += 2.4) { const h = hAt(v) + 0.06, h2 = hAt(Math.min(len, v + 2.4)) + 0.06; box(s, v + 1.2, Math.min(h, h2) + 0.55, 0.06, 0.06, 2.4, DARK, 0, Math.atan2(h2 - h, 2.4) * 0); }
    } else if (type === 'kiosk') {
      for (const s of [-0.8, 0.8]) box(s, 0, g, 0.12, 2.2, 0.12, DARK);
      box(0, 0, g + 2.2, 2.0, 0.1, 0.9, ROOF, 0, -0.12);
      box(0, 0.05, g + 0.95, 1.4, 1.0, 0.05, SIGN); box(0, 0.08, g + 1.2, 1.0, 0.5, 0.03, INK);
      colliders.push([x, z, 0.8]);
    } else if (type === 'table') {
      box(0, 0, g + 0.72, 1.9, 0.06, 0.8, WOOD);
      for (const s of [-0.62, 0.62]) box(0, s, g + 0.42, 1.9, 0.06, 0.28, WOOD);
      for (const s of [-0.8, 0.8]) { box(s, 0, g, 0.08, 0.72, 0.9, DARK); }
      colliders.push([x, z, 1.1]);
    }
    return { b, colliders };
  }
  add(type, x, z, yaw, { restore = false, flatten = false } = {}) {
    if (flatten) flattenArea(x, z, 1.8);
    const { b, colliders } = this._build(type, x, z, yaw);
    const geo = b.build();
    const fill = new THREE.Mesh(geo, this.fill), ol = new THREE.Mesh(geo, this.outline);
    fill.castShadow = true; fill.receiveShadow = true; this.group.add(fill, ol);
    const cols = colliders.map(([cx, cz, r]) => this.colliders.add(cx, cz, r, { tag: 'structure' }));
    this.items.push({ type, x, z, yaw, fill, ol, cols });
    return { type, x, z, yaw };
  }
  /** try to place something in front of the player; returns { ok, msg, rec } */
  place(type, player) {
    const f = { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) };
    const dist = type === 'boardwalk' ? 2 : 3;
    const x = player.pos.x + f.x * dist, z = player.pos.z + f.z * dist;
    const yaw = type === 'boardwalk' ? Math.atan2(f.x, f.z) : Math.atan2(f.x, f.z);
    const dry = (px, pz) => sdfAt(px, pz) >= 3 && groundY(px, pz) >= LEVEL + 0.25 && !this.items.some((it) => Math.hypot(it.x - px, it.z - pz) < 3.5);   // and not on top of something already built
    const fits = (x0, z0, fx, fz) => (type === 'boardwalk' ? [0, 4, 8, 12, 14] : [0, 1.2, -1.2]).every((v) => dry(x0 + fx * v, z0 + fz * v));
    let at = fits(x, z, f.x, f.z) ? { x, z, yaw, moved: 0 } : null;
    // the spot in front of you is wet: find the nearest ground that works, facing away from you, and build there instead
    for (let r = 4; !at && r <= 120; r += 2) for (let a = 0; a < 36 && !at; a++) {
      const an = a / 36 * Math.PI * 2 + Math.atan2(f.z, f.x), cx = player.pos.x + Math.cos(an) * r, cz = player.pos.z + Math.sin(an) * r, fx = Math.cos(an), fz = Math.sin(an);
      if (fits(cx, cz, fx, fz)) at = { x: cx, z: cz, yaw: Math.atan2(fx, fz), moved: r };
    }
    if (!at) return { ok: false, msg: 'There is no dry ground near enough to build on. Walk inland and ask again.' };
    const rec = this.add(type, at.x, at.z, at.yaw, { flatten: type === 'kiosk' || type === 'table' });
    if (at.moved) {
      const dirs = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'], ang = Math.atan2(at.z - player.pos.z, at.x - player.pos.x);
      const dir = dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8], name = { bench: 'bench', boardwalk: 'boardwalk', kiosk: 'trail kiosk', table: 'picnic table' }[type];
      return { ok: true, rec, at, msg: `It is too wet where you are facing, so the ${name} went on the nearest dry ground, about ${Math.round(at.moved)} m to the ${dir}. It is marked on your map.` };
    }
    return { ok: true, rec, msg: { bench: 'A bench is up, facing the way you were looking.', boardwalk: 'A boardwalk now runs ahead of you.', kiosk: 'A trail kiosk with a map stands here.', table: 'A picnic table is set.' }[type] };
  }
}
