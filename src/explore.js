// Exploring: named places that label your map once you reach them, spots you can only find from the water (a beaver
// lodge, an osprey nest, a sunken skiff, an old road under the reservoir), and leads: a rough circle on the map where
// someone says something is.  Leads come from a note on the trailhead board, from what you find, from the talk at the
// start of each season and, from Year Two, from Clyde (whose circles are tighter).
//
// Real: the dam, the beach, the boat ramp, the spillway's brook (Cold Spring Brook), the two islands.  Invented: every
// other name, the lodge, the nest, the skiff and the road (the valley was farmland before the dam, so a drowned road is
// plausible, not documented).  Positions are picked from the terrain with a fixed seed.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt, lake, WORLD } from './world.js';
import { lakeSdf, islandSdf, LAKE_BOX, DAM_Z, BEACH, RAMP, GATE, SPILLWAY, BROOK, WRECK, SPAWN } from './ashland.js';
import { wetlandAt } from './ashland_wetlands.js';
import { mulberry32 } from './noise.js';
import { JOURNAL } from './places.js';
import { SEASON } from './season.js';

const KEY = 'ashland.explore';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

const NAMES = {
  cove: ['Heron Cove', 'Lily Cove', 'Stillwater Cove', 'Pickerel Cove'],
  point: ['Birch Point', 'Windy Point', 'Ledge Point', 'Gull Point'],
  hill: ['Kettle Hill', 'Lookout Knoll', 'Oak Rise'],
  wetland: ['Alder Swamp', 'Peeper Marsh', 'Red Maple Swamp'],
};
const NOTE = {
  cove: 'A sheltered bend of the shore where the water lies flat.', point: 'A finger of land out into the reservoir, open to the wind.',
  hill: 'A high point in the woods. Through the trees, the water shows in pieces.', wetland: 'Wet ground, hummocks and standing water: loud with frogs in spring.',
  island: 'One of the reservoir’s two islands. You can only reach it by water.',
  dam: 'The earth dam that made the reservoir in 1885, holding the brook back.', beach: 'The swimming beach, sand and a lifeguard chair.', ramp: 'Where the rowboats go in.',
  brook: 'Cold Spring Brook, running on below the dam toward the Sudbury River.',
  lodge: 'A beaver lodge: a dome of sticks and mud out in the water. The way in is underwater.',
  osprey: 'A dead pine standing in the water, with a great nest of sticks on top. Ospreys come back to the same nest each spring.',
  skiff: 'A wooden rowboat on the bottom, half full of silt. Nobody remembers whose it was.',
  road: 'Under the water: a straight bed of gravel between two stone walls. A farm road that ran down this valley before the dam.',
  wreck: 'On the bottom: the wreck of a small ultralight helicopter, rotor blades bent.',
};
// what a find is worth on the park's page (Year Two): ordinary places pay a little, the ones guests come out to see more
export const ATTRACTION = { lodge: 500, osprey: 600, skiff: 450, road: 700, wreck: 550, island: 300 };
const WATER = new Set(['lodge', 'osprey', 'island']), UNDER = new Set(['skiff', 'road', 'wreck']);

// rumours: where someone says something is (no names until you have been there)
const RUMOUR = {
  cove: 'there is a quiet cove along the shore here, where the herons fish', point: 'there is a point of land out into the water here, a good place to sit in the wind',
  hill: 'there is a hilltop around here with a view down to the water', wetland: 'there is a swamp back here, loud with frogs in spring',
  island: 'there is an island out here you can only reach by boat', lodge: 'beavers have a lodge in this part of the lake, best seen from a boat',
  osprey: 'ospreys are nesting on a dead tree out in the water here. Best seen from a boat', skiff: 'an old rowboat sank around here; you would have to swim out and dive for it',
  road: 'the road that ran down this valley before the dam is still down there, under the water. Dive for it', wreck: 'a small helicopter went into the water around here, and part of it is said to lie on the bottom',
  cellar: 'there is an old cellar hole somewhere off the trail here', well: 'there is a stone well in the woods here', marker: 'there is an old boundary stone somewhere around here',
};
const WHO = ['Overheard at the boat ramp:', 'A man fishing off the beach says', 'Someone at the parking lot says', 'A woman walking her dog says'];
const HIDDEN = ['lodge', 'osprey', 'skiff', 'road', 'wreck', 'cellar', 'well', 'marker'];

function stickGeo(b, cx, cy, cz, rx, ry, rz, n, rng, col) {
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 5);
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.283, u = rng(), r = Math.sqrt(u), h = Math.sqrt(Math.max(0, 1 - u)) * ry;
    b.add(cyl, matrix(cx + Math.cos(a) * r * rx, cy + h, cz + Math.sin(a) * r * rz, (rng() - 0.5) * 2.4, rng() * 6, Math.PI / 2 + (rng() - 0.5) * 1.2, 0.05 + rng() * 0.05, 1.2 + rng() * 1.6, 0.05 + rng() * 0.05), { color: new THREE.Color(col[(i * 7) % col.length]) });
  }
}
const BARK = ['#5b4632', '#6d553c', '#4a3a2b', '#7a6146', '#3f3428'];

export class Explore {
  constructor(scene, discoveries) {
    this.discoveries = discoveries;
    const st = load(); this.found = new Set(st.found || []); this.leads = st.leads || []; this.st = st;
    this.list = []; this.onFound = null; this.onLead = null;
    const rng = mulberry32(8080), add = (p) => { p.id ||= `${p.kind}${this.list.filter((q) => q.kind === p.kind).length}`; p.r ||= 26; this.list.push(p); return p; };
    // ---- the real ones
    add({ kind: 'dam', name: 'The dam', x: GATE.x - 40, z: DAM_Z + 2, r: 34, real: true });
    add({ kind: 'beach', name: 'The beach', x: BEACH.x, z: BEACH.z, r: 26, real: true });
    add({ kind: 'ramp', name: 'The boat ramp', x: RAMP.x, z: RAMP.z, r: 20, real: true });
    const bk = BROOK[Math.min(BROOK.length - 1, 3)]; add({ kind: 'brook', name: 'Cold Spring Brook', x: bk[0], z: bk[1], r: 30, real: true });
    // the two islands (real outlines; the names are plain descriptions)
    const cells = [];
    for (let x = LAKE_BOX.x0; x < LAKE_BOX.x1; x += 5) for (let z = LAKE_BOX.z0; z < LAKE_BOX.z1; z += 5) if (islandSdf(x, z) < 0) cells.push([x, z]);
    const groups = [];
    for (const c of cells) { const g = groups.find((g) => Math.hypot(g.x / g.n - c[0], g.z / g.n - c[1]) < 60); if (g) { g.x += c[0]; g.z += c[1]; g.n++; } else groups.push({ x: c[0], z: c[1], n: 1 }); }
    groups.sort((a, b) => b.n - a.n);
    groups.slice(0, 2).forEach((g, i) => add({ kind: 'island', name: i === 0 ? 'The big island' : 'The little island', x: g.x / g.n, z: g.z / g.n, r: 22 + Math.sqrt(g.n) * 3, real: true }));
    // ---- coves and points: shore spots by how much water is around them
    const shore = [];
    for (let x = LAKE_BOX.x0; x < LAKE_BOX.x1; x += 7) for (let z = DAM_Z + 50; z < LAKE_BOX.z1; z += 7) {
      const s = lakeSdf(x, z); if (s < 0 || s > 4 || islandSdf(x, z) < 30) continue;
      if (Math.hypot(x - BEACH.x, z - BEACH.z) < 70 || Math.hypot(x - RAMP.x, z - RAMP.z) < 60) continue;
      let w = 0; for (let k = 0; k < 24; k++) { const a = k / 12 * Math.PI, r = k < 12 ? 22 : 44; if (lakeSdf(x + Math.cos(a) * r, z + Math.sin(a) * r) < 0) w++; }
      shore.push({ x, z, w: w / 24 });
    }
    const pick = (arr, n, gap, kind) => { const out = []; for (const c of arr) { if (out.length >= n) break; if (out.some((q) => Math.hypot(q.x - c.x, q.z - c.z) < gap) || this.list.some((q) => Math.hypot(q.x - c.x, q.z - c.z) < Math.min(gap, 75)) || Math.hypot(c.x - SPAWN.x, c.z - SPAWN.z) < 90) continue; out.push(c); } out.forEach((c, i) => add({ kind, name: NAMES[kind][i], x: c.x, z: c.z, r: 28 })); return out; };
    const coves = pick([...shore].filter((s) => s.w < 0.34).sort((a, b) => a.w - b.w), 3, 110, 'cove');
    const points = pick([...shore].filter((s) => s.w > 0.57).sort((a, b) => b.w - a.w), 3, 110, 'point');
    // ---- hilltops and wetlands
    const hills = [];
    for (let x = WORLD.minX + 70; x < WORLD.maxX - 70; x += 12) for (let z = WORLD.minZ + 70; z < WORLD.maxZ - 70; z += 12) { const sd = sdfAt(x, z); if (sd < 40 || sd > 150) continue; hills.push({ x, z, y: groundY(x, z) }); }
    pick(hills.sort((a, b) => b.y - a.y), 2, 260, 'hill');
    const wet = [];
    for (let x = WORLD.minX + 50; x < WORLD.maxX - 50; x += 10) for (let z = WORLD.minZ + 50; z < WORLD.maxZ - 50; z += 10) {
      { const sd = sdfAt(x, z); if (sd < 15 || sd > 150) continue; } let n = 0; for (let k = 0; k < 9; k++) if (wetlandAt(x + (k % 3 - 1) * 10, z + ((k / 3 | 0) - 1) * 10) > 0) n++; if (n >= 7) wet.push({ x, z, n: n + rng() });
    }
    pick(wet.sort((a, b) => b.n - a.n), 2, 200, 'wetland');
    // ---- by the water: a lodge off a cove, an osprey snag off a point, a skiff and an old road on the bottom
    const out = (x, z, want) => {       // the nearest spot to (x, z) where the full lake is about `want` metres deep
      let best = null, bd = 1e9;
      for (let a = 0; a < 6.283; a += 0.2) for (let r = 4; r < 90; r += 3) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, d = lake.originalLevel - groundY(px, pz);
        if (d > want && d < want + 1.2 && sdfAt(px, pz) < -3 && islandSdf(px, pz) > 6 && r < bd) { bd = r; best = [px, pz]; }
      }
      return best || [x, z];
    };
    const props = new GeoBuilder();
    const c0 = coves[0] || shore[0];
    if (c0) { const [x, z] = out(c0.x, c0.z, 1.3); const y = groundY(x, z); this.lodge = add({ kind: 'lodge', name: 'The beaver lodge', x, z, r: 20 });
      stickGeo(props, x, lake.originalLevel - 0.5, z, 2.7, 1.9, 2.4, 150, rng, BARK);
      props.add(new THREE.SphereGeometry(1, 9, 6), matrix(x, y, z, 0, 0, 0, 2.6, lake.originalLevel - y + 0.9, 2.3), { color: new THREE.Color('#4b3b2c') });
    }
    const p0 = points[0] || shore[shore.length - 1];
    if (p0) { const [x, z] = out(p0.x, p0.z, 0.9); const y = groundY(x, z), top = lake.originalLevel + 9;
      this.osprey = add({ kind: 'osprey', name: 'The osprey nest', x, z, r: 30, top });
      const cyl = new THREE.CylinderGeometry(1, 1, 1, 7);
      props.add(cyl, matrix(x, (y + top) / 2, z, 0.04, 0, -0.03, 0.26, top - y, 0.26), { color: new THREE.Color('#8f877b') });
      for (let k = 0; k < 5; k++) { const h = y + (top - y) * (0.45 + k * 0.1), a = k * 2.1; props.add(cyl, matrix(x + Math.cos(a) * 0.7, h + 0.3, z + Math.sin(a) * 0.7, Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1, 0.06, 1.6 - k * 0.2, 0.06), { color: new THREE.Color('#8a8275') }); }
      stickGeo(props, x, top - 0.25, z, 1.5, 0.75, 1.5, 90, rng, BARK);
    }
    // the skiff: on the bottom 2-4 m down, near the middle of the lake's west side
    let sk = null; for (let t = 0; t < 400 && !sk; t++) { const x = LAKE_BOX.x0 + rng() * (LAKE_BOX.x1 - LAKE_BOX.x0), z = DAM_Z + 120 + rng() * (LAKE_BOX.z1 - DAM_Z - 200), d = lake.originalLevel - groundY(x, z); if (d > 2.2 && d < 3.6 && sdfAt(x, z) < -12 && islandSdf(x, z) > 25 && !this.list.some((q) => Math.hypot(q.x - x, q.z - z) < 80)) sk = [x, z]; }
    if (sk) { const [x, z] = sk, y = groundY(x, z), yaw = rng() * 6.28; this.skiff = add({ kind: 'skiff', name: 'The sunken skiff', x, z, r: 12 });
      const wood = ['#6a5038', '#5a4430', '#76593c'], box = new THREE.BoxGeometry(1, 1, 1), c = Math.cos(yaw), s = Math.sin(yaw), at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) { const [px, pz] = at(side * 0.62, 0); props.add(box, matrix(px, y + 0.18 + k * 0.17, pz, 0.15 * side, yaw, 0, 0.06, 0.15, 3.6 - k * 0.3), { color: new THREE.Color(wood[k]) }); }
      props.add(box, matrix(x, y + 0.08, z, 0, yaw, 0.08, 1.2, 0.08, 3.4), { color: new THREE.Color('#4c3a28') });
      for (const v of [-1.1, 0.2]) { const [px, pz] = at(0, v); props.add(box, matrix(px, y + 0.4, pz, 0, yaw, 0.05, 1.25, 0.06, 0.3), { color: new THREE.Color(wood[1]) }); }
      const [ox, oz] = at(0.9, 0.6); props.add(box, matrix(ox, y + 0.06, oz, 0, yaw + 0.6, 0, 0.12, 0.04, 2.4), { color: new THREE.Color(wood[2]) });   // an oar
      props.add(box, matrix(x + 0.1, y + 0.14, z, 0, yaw, 0, 1.0, 0.1, 3.0), { color: new THREE.Color('#5c5442') });   // silt inside
    }
    // the old road: a straight run of gravel between stone walls, 4-6 m down
    let rd = null; for (let t = 0; t < 600 && !rd; t++) { const x = LAKE_BOX.x0 + rng() * (LAKE_BOX.x1 - LAKE_BOX.x0), z = DAM_Z + 80 + rng() * (LAKE_BOX.z1 - DAM_Z - 160), d = lake.originalLevel - groundY(x, z); if (d > 4 && d < 5.6 && sdfAt(x, z) < -18 && islandSdf(x, z) > 30 && !this.list.some((q) => Math.hypot(q.x - x, q.z - z) < 90)) rd = [x, z]; }
    if (rd) { const yaw = 0.3 + rng() * 0.6, dx = Math.sin(yaw), dz = Math.cos(yaw), box = new THREE.BoxGeometry(1, 1, 1), STONE = ['#7d7a70', '#6c6a61', '#8a867a', '#5f5d55'];
      const pts = [];
      for (let u = -28; u <= 28; u += 1.6) {
        const x = rd[0] + dx * u, z = rd[1] + dz * u, y = groundY(x, z); if (lake.originalLevel - y < 2.6) continue;
        pts.push([x, z]);
        props.add(box, matrix(x, y + 0.03, z, 0, yaw, 0, 3.2, 0.08, 1.9), { color: new THREE.Color('#8a826e') });
        props.add(box, matrix(x, y + 0.075, z, 0, yaw, 0, 0.5, 0.03, 1.9), { color: new THREE.Color('#6f6858') });   // the old crown of the road
        for (const sd of [-1, 1]) for (const du of [0, 0.8]) for (let h = 0; h < 2; h++) {
          if (h && rng() < 0.35) continue;               // fallen in places
          const wx = x + dx * du + dz * sd * 2.5, wz = z + dz * du - dx * sd * 2.5;
          props.add(box, matrix(wx, groundY(wx, wz) + 0.18 + h * 0.3, wz, 0, yaw + (rng() - 0.5) * 0.3, 0, 0.55, 0.34, 0.75), { color: new THREE.Color(STONE[(rng() * 4) | 0]) });
        }
      }
      if (pts.length > 4) this.road = add({ kind: 'road', name: 'The old road', x: rd[0], z: rd[1], r: 14, pts });
    }
    if (WRECK) add({ kind: 'wreck', name: 'The helicopter wreck', x: WRECK.x, z: WRECK.z, r: 14 });
    if (props.pos.length) { const geo = props.build(); const m = makeInstanced(geo, 1); m.fill.count = m.line.count = 1; m.fill.setMatrixAt(0, new THREE.Matrix4()); m.line.setMatrixAt(0, new THREE.Matrix4()); scene.add(m.fill); scene.add(m.line); this.mesh = m; }
    // an osprey on the nest in the warm months
    if (this.osprey && (SEASON === 'spring' || SEASON === 'summer')) this.bird = this._osprey(scene);
    this.seen = [];
  }
  _osprey(scene) {
    const b = new GeoBuilder(), o = this.osprey, y = o.top + 0.75, sp = new THREE.SphereGeometry(1, 8, 6), cone = new THREE.ConeGeometry(1, 1, 6);
    b.add(sp, matrix(0, 0, 0, 0.5, 0, 0, 0.2, 0.2, 0.36), { color: new THREE.Color('#ece8de') });
    b.add(sp, matrix(0, 0.06, -0.02, 0.5, 0, 0, 0.22, 0.17, 0.36), { color: new THREE.Color('#4e3e30') });     // brown back and wings
    b.add(sp, matrix(0, 0.26, 0.16, 0, 0, 0, 0.11, 0.11, 0.12), { color: new THREE.Color('#f2efe8') });
    b.add(sp, matrix(0, 0.29, 0.15, 0, 0, 0, 0.115, 0.04, 0.1), { color: new THREE.Color('#3c3026') });     // the dark eye stripe
    b.add(cone, matrix(0, 0.24, 0.29, Math.PI / 2 + 0.4, 0, 0, 0.03, 0.08, 0.03), { color: new THREE.Color('#2a2622') });
    b.add(sp, matrix(0, -0.06, -0.38, 0.3, 0, 0, 0.09, 0.04, 0.2), { color: new THREE.Color('#5a4838') });
    const m = makeInstanced(b.build(), 1); m.fill.count = m.line.count = 1;
    const mat = new THREE.Matrix4().compose(new THREE.Vector3(o.x, y, o.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 2.2), new THREE.Vector3(1.6, 1.6, 1.6));
    m.fill.setMatrixAt(0, mat); m.line.setMatrixAt(0, mat); scene.add(m.fill); scene.add(m.line); m.y = y; m.base = mat; return m;
  }
  save() { this.st.found = [...this.found]; this.st.leads = this.leads; try { localStorage.setItem(KEY, JSON.stringify(this.st)); } catch {} }
  get named() { return this.list.filter((p) => this.found.has(p.id)); }
  /** everything a lead can point at that you have not found yet (ruins included) */
  targets() {
    const t = this.list.filter((p) => !this.found.has(p.id) && !p.real).map((p) => ({ id: p.id, kind: p.kind, x: p.x, z: p.z }));
    for (const r of this.discoveries?.items || []) if (!this.discoveries.found.has(r.id)) t.push({ id: r.id, kind: r.kind, x: r.x, z: r.z, ruin: true });
    return t;
  }
  isFound(id) { return this.found.has(id) || !!this.discoveries?.found.has(id); }
  /** adds a lead toward `prefer` (a list of kinds) or anything not yet found; returns it or null */
  addLead(src, { prefer = null, r = 70, text = null, quiet = false } = {}) {
    const open = new Set(this.leads.filter((l) => !l.done).map((l) => l.target));
    let ts = this.targets().filter((t) => !open.has(t.id)); if (!ts.length) return null;
    if (!prefer && src === 'clyde') prefer = HIDDEN;
    if (prefer) { const p = ts.filter((t) => prefer.includes(t.kind)); if (p.length) ts = p; }
    const rng = Math.random, t = ts[(rng() * ts.length) | 0], a = rng() * 6.283, off = r * (0.2 + rng() * 0.45);
    const who = src === 'clyde' ? 'Clyde, from old maps, aerial photos and lidar:' : src === 'note' ? 'A note pinned to the trailhead board, in pencil:' : src === 'ruin' ? 'The farm you just found is on an 1850s map in the town library, and so is more:' : WHO[(rng() * WHO.length) | 0];
    const l = { id: `L${Date.now().toString(36)}${(rng() * 1e4) | 0}`, target: t.id, kind: t.kind, cx: t.x + Math.cos(a) * off, cz: t.z + Math.sin(a) * off, r, src, season: SEASON, text: text || `${who} ${(RUMOUR[t.kind] || 'there is something worth finding here').replace(/^./, (ch) => (who.endsWith(':') ? ch.toUpperCase() : ch))}.`, done: false };
    this.leads.push(l); this.save();
    JOURNAL.add(`Lead: ${l.text} (Circled on your map.)`);
    if (!quiet) this.onLead?.(l);
    return l;
  }
  /** at the start of each season (each page load is one): the board note first, then talk; Clyde's own from Year Two */
  seasonLeads(n, { clyde = false } = {}) {
    if (this.st.leadN === n) return;
    this.st.leadN = n; this.save();
    if (!this.leads.length) this.addLead('note', { prefer: ['osprey'], r: 80 });
    else this.addLead('talk', { r: 75 });
    if (clyde) this.addLead('clyde', { prefer: ['road', 'skiff', 'wreck', 'cellar', 'well'], r: 32 });
  }
  /** a ruin you find hints at the next thing */
  ruinFound() { if (Math.random() < 0.7) this.addLead('ruin', { prefer: ['road', 'cellar', 'well', 'marker'], r: 65, text: null }); }
  update(dt, player) {
    const p = player.pos, onWater = !!player.boat || player.swimming, under = !!player.underwater;
    for (const it of this.list) {
      if (this.found.has(it.id)) continue;
      let d = Math.hypot(it.x - p.x, it.z - p.z);
      if (it.pts) for (const q of it.pts) d = Math.min(d, Math.hypot(q[0] - p.x, q[1] - p.z));
      let ok;
      if (UNDER.has(it.kind)) ok = under ? d < it.r : it.kind === 'skiff' && onWater && d < 6;
      else if (WATER.has(it.kind)) ok = (onWater || under) && d < it.r;
      else ok = d < it.r;
      if (ok) this._find(it);
    }
    // leads close when their target is found (by you, from any direction)
    let ch = false; for (const l of this.leads) if (!l.done && this.isFound(l.target)) { l.done = true; ch = true; }
    if (ch) this.save();
    // the osprey: a little head turn now and then; photographable
    this.seen.length = 0;
    if (this.bird) { const o = this.osprey; this.seen.push({ kind: 'osprey', x: o.x, y: this.bird.y + 0.3, z: o.z, r: 0.5 }); }
  }
  _find(it) {
    this.found.add(it.id); this.save();
    JOURNAL.add(`${it.name}. ${NOTE[it.kind] || ''}`.trim(), it.x, it.z);
    this.onFound?.(it);
  }
  pins() {
    return this.named.map((p) => ({ x: p.x, z: p.z, name: p.name, c: WATER.has(p.kind) || UNDER.has(p.kind) ? '#8fd0e0' : '#e8d9a8' }));
  }
  note(kind) { return NOTE[kind]; }
  openLeads() { return this.leads.filter((l) => !l.done); }
  reset() { this.found.clear(); this.leads = []; this.st = {}; try { localStorage.removeItem(KEY); } catch {} }
}
export const EXPLORE_NOTE = NOTE;
