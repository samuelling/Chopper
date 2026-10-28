// More hidden things in the woods, on the shore and under the water, arriving in three shipments over a life: the
// first set is there from the start, the second appears a third of the way through your life expectancy, the third at
// two-thirds.  So a long life keeps turning up something new.  All of them, and where they are, are invented; each is
// the kind of thing New England woods really do hide (glacial boulders, old farm machines, family burying grounds,
// ice-house foundations).  Placement is fixed by a seed, off the trails, by the shore, or on the lake bottom.
import * as THREE from 'three';
import { matrix } from './builder.js';
import { groundY, sdfAt, lake, WORLD } from './world.js';
import { TRAIL_LINES, BROOK, BEACH, RAMP, LAKE_BOX, DAM_Z, islandSdf } from './ashland.js';
import { mulberry32 } from './noise.js';

export const HIDDEN_KINDS = {
  // shipment 0: there from the start
  erratic: { ship: 0, where: 'land', name: 'A glacial erratic', note: 'A boulder the size of a car, left here by the ice sheet that covered New England about twenty thousand years ago.', rumour: 'there is a boulder the size of a car back in the woods here, nothing like the rocks around it', pay: 300 },
  truck: { ship: 0, where: 'land', name: 'An old truck', note: 'A pickup from the 1940s rusting into the leaves, a sapling growing up through the engine. Old farms left their machines where they stopped.', rumour: 'an old truck is rusting away somewhere in these woods', pay: 400 },
  ropeswing: { ship: 0, where: 'shore', name: 'A rope swing', note: 'A frayed rope hanging from a tree that leans out over the water. Someone has been jumping from here for years.', rumour: 'there is a rope swing over the water along this shore', pay: 250 },
  // shipment 1: a third of the way through your life
  chimney: { ship: 1, where: 'land', name: 'A lone chimney', note: 'A fieldstone chimney standing on its own. The house it warmed is long gone.', rumour: 'a chimney stands on its own in the woods here, with no house', pay: 350 },
  cemetery: { ship: 1, where: 'land', name: 'A family burying ground', note: 'Four slate stones, too worn to read, inside what is left of an iron fence. New England woods hold hundreds of these small family plots.', rumour: 'there is a small old burying ground in the woods around here', pay: 350 },
  bottles: { ship: 1, where: 'land', name: 'An old bottle dump', note: 'Old glass half buried in the leaves: medicine bottles, a stoneware crock. Farms kept their own dumps long before towns collected trash.', rumour: 'people used to find old bottles in the woods around here', pay: 250 },
  canoe: { ship: 1, where: 'shore', name: 'An old canoe', note: 'A wooden canoe turned over above the waterline, its canvas cracked. Nobody has come back for it.', rumour: 'someone left an old canoe on the shore here years ago', pay: 250 },
  benchmark: { ship: 1, where: 'trail', name: 'A survey mark', note: 'A brass disk set in the rock, stamped with an elevation. Surveyors left marks like this all over the country.', rumour: 'there is a brass survey mark set in a rock near the trail here', pay: 200 },
  // shipment 2: two-thirds of the way through
  carvedbeech: { ship: 2, where: 'trail', name: 'A carved beech', note: 'Initials and a heart cut into smooth beech bark, stretched wide as the tree grew. A beech keeps a carving for its whole life.', rumour: 'there is a beech by the trail with a heart carved in it', pay: 200 },
  fairyhouse: { ship: 2, where: 'trail', name: 'A fairy house', note: 'A tiny house of sticks, bark and moss at the foot of a stump, built by someone small. Look, don’t touch.', rumour: 'kids have built something small at the foot of a stump near the trail here', pay: 200 },
  icehouse: { ship: 2, where: 'shore', name: 'An ice house foundation', note: 'Before refrigerators, ice was cut from ponds in winter and packed in sawdust in a house like this to last the summer. Only the stone foundation is left.', rumour: 'there was an ice house on the shore here once', pay: 400 },
  anchor: { ship: 2, where: 'under', name: 'A sunken anchor', note: 'A heavy iron anchor and a length of chain on the bottom, furred with silt.', rumour: 'an old anchor is said to be down on the bottom here; you would have to dive', pay: 300 },
  mill: { ship: 2, where: 'brook', name: 'An old mill seat', note: 'Cut stones beside the brook and a cracked millstone: the kind of small mill that ran on brooks like this one before there was a dam.', rumour: 'there are old mill stones along the brook below the dam', pay: 450 },
};

/** which shipments have arrived: all of them in testing; otherwise by how far through your life expectancy you are */
export function shipmentsIn(RUN) {
  if (RUN.dev) return 2;
  const life = RUN.lifeYears || 40, n = RUN.s?.n ?? RUN.n ?? 0;
  return n >= Math.floor(life * 8 / 3) ? 2 : n >= Math.floor(life * 4 / 3) ? 1 : 0;
}
/** the season a shipment arrives in (so the game can say something has turned up) */
export function shipmentSeason(RUN, k) { const life = RUN.lifeYears || 40; return k === 1 ? Math.floor(life * 4 / 3) : k === 2 ? Math.floor(life * 8 / 3) : 0; }

const C = (h) => new THREE.Color(h);
const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 8), ball = new THREE.SphereGeometry(1, 7, 5), cone = new THREE.ConeGeometry(1, 1, 7);
const STONE = ['#8d8a82', '#777469', '#9a968a', '#6f6c62'];

// each builder adds world-space geometry at (x, y, z) facing yaw
const BUILD = {
  erratic(b, x, y, z, yaw, r) {
    for (let i = 0; i < 4; i++) b.add(ball, matrix(x + (r() - 0.5) * 1.4, y + 0.9 + i * 0.15, z + (r() - 0.5) * 1.4, r(), yaw + i, r() * 0.3, 1.8 - i * 0.25, 1.3 - i * 0.15, 1.5 - i * 0.2), { color: C(['#8a8780', '#7d7a72', '#959187', '#6f6c66'][i]) });
    for (let i = 0; i < 5; i++) b.add(ball, matrix(x + (r() - 0.5) * 2.4, y + 1.2 + r() * 1.2, z + (r() - 0.5) * 2.4, 0, 0, 0, 0.35, 0.05, 0.3), { color: C(i % 2 ? '#a8b07a' : '#c8c89a') });   // lichen
  },
  truck(b, x, y, z, yaw, r) {
    const c = Math.cos(yaw), s = Math.sin(yaw), at = (u, v) => [x + c * u + s * v, z - s * u + c * v], P = (u, h, v, sx, sy, sz, col, rx = 0, rz = 0) => { const [px, pz] = at(u, v); b.add(box, matrix(px, y + h, pz, rx, yaw, rz, sx, sy, sz), { color: C(col) }); };
    P(0, 0.65, 0.6, 1.7, 0.55, 1.6, '#7a3e22', 0, 0.06); P(0, 1.05, -0.2, 1.5, 0.75, 1.1, '#6a3a22', 0, 0.06); P(0, 0.75, -1.4, 1.4, 0.45, 1.3, '#7a4426', 0.1, 0.06);    // bed, cab, hood
    P(0, 1.2, -0.78, 1.3, 0.5, 0.04, '#2a2a2a');                                                                                                                     // the empty windscreen
    for (const [u, v] of [[-0.85, -1.3], [0.85, -1.3], [-0.85, 0.9], [0.85, 0.9]]) { const [px, pz] = at(u, v); b.add(cyl, matrix(px, y + 0.3, pz, 0, yaw, Math.PI / 2 + 0.2, 0.35, 0.22, 0.35), { color: C('#2a2420') }); }
    const [tx, tz] = at(0, -1.4); b.add(cyl, matrix(tx, y + 1.6, tz, 0.1, 0, 0.05, 0.05, 3, 0.05), { color: C('#6a5a44') });
    for (let i = 0; i < 6; i++) b.add(ball, matrix(tx + (r() - 0.5) * 0.8, y + 2.6 + r() * 0.8, tz + (r() - 0.5) * 0.8, 0, 0, 0, 0.35, 0.25, 0.35), { color: C('#5a8a3a') });   // the sapling through the engine
  },
  ropeswing(b, x, y, z, yaw, r, out) {
    // a trunk leaning out over the water, a rope from its branch, a stick seat
    const ox = out[0], oz = out[1], L = 6.5, lean = 0.55, tx = x + ox * Math.sin(lean) * L * 0.5, tz = z + oz * Math.sin(lean) * L * 0.5;
    b.add(cyl, matrix(tx, y + Math.cos(lean) * L * 0.5, tz, oz * lean, 0, -ox * lean, 0.22, L, 0.22), { color: C('#6a5a48') });
    const hx = x + ox * Math.sin(lean) * L * 0.85, hz = z + oz * Math.sin(lean) * L * 0.85, hy = y + Math.cos(lean) * L * 0.85;
    for (let i = 0; i < 8; i++) b.add(ball, matrix(x + ox * Math.sin(lean) * L + (r() - 0.5) * 2, y + Math.cos(lean) * L + (r() - 0.5) * 1.2, z + oz * Math.sin(lean) * L + (r() - 0.5) * 2, 0, 0, 0, 1.1, 0.7, 1.1), { color: C(i % 2 ? '#4f7a34' : '#3f6a2c') });
    const ry = Math.max(lake.originalLevel + 0.9, hy - 3.6);
    b.add(cyl, matrix(hx, (hy + ry) / 2, hz, 0, 0, 0, 0.02, hy - ry, 0.02), { color: C('#c8b48a') });
    b.add(cyl, matrix(hx, ry, hz, 0, yaw, Math.PI / 2, 0.04, 0.45, 0.04), { color: C('#7a5a3a') });
  },
  chimney(b, x, y, z, yaw, r) {
    for (let k = 0; k < 12; k++) { const w = 1.1 - k * 0.03; b.add(box, matrix(x + (r() - 0.5) * 0.04, y + 0.15 + k * 0.3, z, 0, yaw + (r() - 0.5) * 0.06, 0, w, 0.31, w * 0.9), { color: C(STONE[(k * 3 + 1) % 4]) }); }
    b.add(box, matrix(x + Math.sin(yaw) * 0.6, y + 0.35, z + Math.cos(yaw) * 0.6, 0, yaw, 0, 0.7, 0.7, 0.4), { color: C('#2a2420') });     // the hearth opening
    for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = 1.2 + r() * 2.2; b.add(box, matrix(x + Math.cos(a) * d, y + 0.1, z + Math.sin(a) * d, r(), r() * 6, r(), 0.4, 0.25, 0.35), { color: C(STONE[i % 4]) }); }
  },
  cemetery(b, x, y, z, yaw, r) {
    const c = Math.cos(yaw), s = Math.sin(yaw), at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
    for (let i = 0; i < 4; i++) { const [px, pz] = at(-1.2 + i * 0.8, 0.2 + (i % 2) * 0.3); b.add(box, matrix(px, y + 0.3, pz, (r() - 0.5) * 0.25, yaw, (r() - 0.5) * 0.2, 0.45, 0.65, 0.06), { color: C(['#4a4e52', '#555a5e', '#3f4347', '#5a5e60'][i]) }); b.add(ball, matrix(px, y + 0.62, pz, 0, yaw, 0, 0.22, 0.08, 0.03), { color: C('#4a4e52') }); }
    for (let u = -2; u <= 2; u += 0.5) for (const v of [-1.3, 1.6]) { if (r() < 0.25) continue; const [px, pz] = at(u, v); b.add(cyl, matrix(px, y + 0.45, pz, (r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2, 0.025, 0.9, 0.025), { color: C('#2a2624') }); }
    for (let v = -1.3; v <= 1.6; v += 0.5) for (const u of [-2, 2]) { if (r() < 0.25) continue; const [px, pz] = at(u, v); b.add(cyl, matrix(px, y + 0.45, pz, 0, 0, 0, 0.025, 0.9, 0.025), { color: C('#2a2624') }); }
    for (const v of [-1.3, 1.6]) { const [px, pz] = at(0, v); b.add(box, matrix(px, y + 0.85, pz, 0, yaw, 0, 4, 0.04, 0.04), { color: C('#2a2624') }); }
  },
  bottles(b, x, y, z, yaw, r) {
    const cols = ['#3f7a4a', '#7a4a1e', '#cfe0e0', '#3a5aa8', '#5a8a7a', '#8a5a2a'];
    for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = r() * 1.6, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, tilt = 0.4 + r() * 1.2, col = C(cols[i % cols.length]);
      b.add(cyl, matrix(px, y + 0.05, pz, tilt, r() * 6, 0, 0.05, 0.22, 0.05), { color: col }); b.add(cyl, matrix(px + Math.sin(tilt) * 0.08, y + 0.08, pz, tilt, r() * 6, 0, 0.018, 0.08, 0.018), { color: col }); }
    b.add(cyl, matrix(x + 0.6, y + 0.15, z - 0.4, 0.3, 0, 0.2, 0.16, 0.32, 0.16), { color: C('#c8b89a') });                      // a stoneware crock
    b.add(cyl, matrix(x + 0.6, y + 0.32, z - 0.4, 0.3, 0, 0.2, 0.12, 0.04, 0.12), { color: C('#5a4a3a') });
  },
  canoe(b, x, y, z, yaw, r) {
    b.add(ball, matrix(x, y + 0.18, z, 0, yaw, 0, 0.42, 0.24, 2.4), { color: C('#3f5a3a') });                                    // the hull, upside down
    b.add(box, matrix(x, y + 0.05, z, 0, yaw, 0, 0.84, 0.04, 4.4), { color: C('#5a4a3a') });                                       // gunwales
    b.add(box, matrix(x + Math.cos(yaw) * 0.9, y + 0.04, z - Math.sin(yaw) * 0.9, 0, yaw + 0.3, 0, 0.14, 0.03, 1.5), { color: C('#8a6a44') });   // a paddle
  },
  benchmark(b, x, y, z) {
    b.add(ball, matrix(x, y + 0.15, z, 0, 0, 0, 0.6, 0.35, 0.5), { color: C('#8a8780') });
    b.add(cyl, matrix(x, y + 0.49, z, 0, 0, 0, 0.06, 0.012, 0.06), { color: C('#c8a040') });
  },
  carvedbeech(b, x, y, z, yaw, r) {
    b.add(cyl, matrix(x, y + 3, z, 0, 0, 0, 0.3, 6, 0.3), { color: C('#a8aaa4') });
    const fx = x + Math.sin(yaw) * 0.29, fz = z + Math.cos(yaw) * 0.29;
    for (const sd of [-1, 1]) b.add(ball, matrix(fx + Math.cos(yaw) * sd * 0.06, y + 1.62, fz - Math.sin(yaw) * sd * 0.06, 0, yaw, 0, 0.07, 0.07, 0.02), { color: C('#4a4238') });
    b.add(cone, matrix(fx, y + 1.5, fz, Math.PI, yaw, 0, 0.13, 0.16, 0.02), { color: C('#4a4238') });
    b.add(box, matrix(fx, y + 1.3, fz, 0, yaw, 0, 0.22, 0.05, 0.02), { color: C('#4a4238') });                                 // the initials, roughly
    for (let i = 0; i < 9; i++) b.add(ball, matrix(x + (r() - 0.5) * 4, y + 5.5 + r() * 2, z + (r() - 0.5) * 4, 0, 0, 0, 1.4, 0.9, 1.4), { color: C(i % 2 ? '#6a9a3a' : '#5a8a34') });
  },
  fairyhouse(b, x, y, z, yaw, r) {
    b.add(cyl, matrix(x, y + 0.2, z, 0, 0, 0, 0.3, 0.4, 0.3), { color: C('#6a5440') });                                       // the stump
    const hx = x + Math.sin(yaw) * 0.45, hz = z + Math.cos(yaw) * 0.45;
    for (let i = 0; i < 10; i++) { const a = i * 0.63; b.add(cyl, matrix(hx + Math.cos(a) * 0.08, y + 0.17, hz + Math.sin(a) * 0.08, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35, 0.012, 0.36, 0.012), { color: C('#7a5a3a') }); }
    b.add(cone, matrix(hx, y + 0.36, hz, 0, 0, 0, 0.16, 0.12, 0.16), { color: C('#4f7a34') });                                    // moss roof
    b.add(box, matrix(hx + Math.sin(yaw) * 0.12, y + 0.06, hz + Math.cos(yaw) * 0.12, 0, yaw, 0, 0.06, 0.1, 0.01), { color: C('#3a2a1e') });   // the door
    for (let i = 0; i < 6; i++) b.add(ball, matrix(hx + Math.sin(yaw) * (0.2 + i * 0.08), y + 0.01, hz + Math.cos(yaw) * (0.2 + i * 0.08), 0, 0, 0, 0.03, 0.015, 0.03), { color: C('#d8d4c8') });   // a pebble path
  },
  icehouse(b, x, y, z, yaw, r) {
    const W = 6, D = 4.2, c = Math.cos(yaw), s = Math.sin(yaw), at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
    let i = 0;
    for (let k = 0; k <= 12; k++) for (const v of [-D / 2, D / 2]) { const [px, pz] = at(-W / 2 + k * W / 12, v); b.add(box, matrix(px, y + 0.25, pz, 0, yaw + (k % 3) * 0.1, 0, 0.55, 0.5 + (k % 2) * 0.2, 0.5), { color: C(STONE[i++ % 4]) }); }
    for (let k = 1; k < 9; k++) for (const u of [-W / 2, W / 2]) { const [px, pz] = at(u, -D / 2 + k * D / 9); b.add(box, matrix(px, y + 0.25, pz, 0, yaw, 0, 0.5, 0.5, 0.5), { color: C(STONE[i++ % 4]) }); }
    { const [px, pz] = at(0, 0); b.add(box, matrix(px, y + 0.06, pz, 0, yaw, 0, W - 0.5, 0.08, D - 0.5), { color: C('#b89a6a') }); }       // old sawdust
  },
  anchor(b, x, y, z, yaw, r) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    b.add(cyl, matrix(x, y + 0.12, z, Math.PI / 2, yaw, 0, 0.06, 1.4, 0.06), { color: C('#4a3a30') });                             // shank, lying down
    b.add(cyl, matrix(x + s * 0.7, y + 0.2, z + c * 0.7, 0, yaw, Math.PI / 2, 0.05, 1.1, 0.05), { color: C('#4a3a30') });           // stock
    for (const sd of [-1, 1]) b.add(cyl, matrix(x - s * 0.62 + c * sd * 0.3, y + 0.15, z - c * 0.62 - s * sd * 0.3, 0.3, yaw + sd * 0.9, Math.PI / 2, 0.05, 0.7, 0.05), { color: C('#4a3a30') });   // arms
    for (let k = 0; k < 14; k++) { const a = yaw + 0.5 + k * 0.12; b.add(cyl, matrix(x + s * (0.8 + k * 0.18) + Math.sin(a) * 0.3, y + 0.04, z + c * (0.8 + k * 0.18) + Math.cos(a) * 0.3, Math.PI / 2, a, k % 2 * 1.57, 0.04, 0.16, 0.025), { color: C('#3a3028') }); }
  },
  mill(b, x, y, z, yaw, r) {
    const c = Math.cos(yaw), s = Math.sin(yaw), at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
    for (let k = 0; k < 10; k++) for (let h = 0; h < 2; h++) { const [px, pz] = at(-2.5 + k * 0.55, 0); b.add(box, matrix(px, groundY(px, pz) + 0.25 + h * 0.45, pz, 0, yaw, 0, 0.6, 0.45, 0.6), { color: C(STONE[(k + h) % 4]) }); }
    for (let k = 0; k < 5; k++) { const [px, pz] = at(-2.5, 0.6 + k * 0.55); b.add(box, matrix(px, groundY(px, pz) + 0.25, pz, 0, yaw, 0, 0.6, 0.5, 0.6), { color: C(STONE[k % 4]) }); }
    const [mx, mz] = at(0.5, 1.6); b.add(cyl, matrix(mx, groundY(mx, mz) + 0.2, mz, 0.5, yaw, 0.2, 0.7, 0.18, 0.7), { color: C('#8a8478') });   // the millstone, tipped
  },
};

/** places each shipped hidden thing and adds its geometry to `props`; returns the items ({kind, name, x, z, r, ship}) */
export function placeHidden(props, rng, upTo, others) {
  // every thing is placed (shipped or not) so the spots never depend on what has arrived; only shipped ones are built
  const out = [], all = [], trails = TRAIL_LINES.flat().filter((_, i) => i % 3 === 0), far = (x, z, d) => [...others, ...all].every((q) => Math.hypot(q.x - x, q.z - z) > d);
  let idx = 0;
  const flat = (x, z) => { const g = groundY(x, z); return Math.abs(groundY(x + 2.5, z) - g) < 0.8 && Math.abs(groundY(x, z + 2.5) - g) < 0.8; };
  for (const [kind, K] of Object.entries(HIDDEN_KINDS)) {
    let spot = null;
    for (let tries = 0; tries < 400 && !spot; tries++) {
      if (K.where === 'land' || K.where === 'trail') {
        const t = trails[(rng() * trails.length) | 0], a = rng() * 6.283, d = K.where === 'trail' ? 5 + rng() * 9 : 22 + rng() * 45;
        const x = t[0] + Math.cos(a) * d, z = t[1] + Math.sin(a) * d, sd = sdfAt(x, z);
        if (sd < 14 || sd > 150 || !flat(x, z) || !far(x, z, 60)) continue;
        spot = { x, z };
      } else if (K.where === 'shore') {
        const x = LAKE_BOX.x0 + rng() * (LAKE_BOX.x1 - LAKE_BOX.x0), z = DAM_Z + 60 + rng() * (LAKE_BOX.z1 - DAM_Z - 80), sd = sdfAt(x, z);
        if (sd < 1.5 || sd > 7 || groundY(x, z) < lake.originalLevel + 0.15 || islandSdf(x, z) < 20 || Math.hypot(x - BEACH.x, z - BEACH.z) < 70 || Math.hypot(x - RAMP.x, z - RAMP.z) < 60 || !far(x, z, tries < 200 ? 70 : 45)) continue;
        // which way is the water
        const gx = sdfAt(x + 2, z) - sdfAt(x - 2, z), gz = sdfAt(x, z + 2) - sdfAt(x, z - 2), l = Math.hypot(gx, gz) || 1;
        spot = { x, z, out: [-gx / l, -gz / l] };
      } else if (K.where === 'under') {
        const x = LAKE_BOX.x0 + rng() * (LAKE_BOX.x1 - LAKE_BOX.x0), z = DAM_Z + 100 + rng() * (LAKE_BOX.z1 - DAM_Z - 180), dep = lake.originalLevel - groundY(x, z);
        if (dep < 3 || dep > 5 || sdfAt(x, z) > -12 || islandSdf(x, z) < 25 || !far(x, z, 80)) continue;
        spot = { x, z };
      } else if (K.where === 'brook') {
        const p = BROOK[Math.min(BROOK.length - 1, 1 + ((rng() * 4) | 0))], a = rng() * 6.283, x = p[0] + Math.cos(a) * 6, z = p[1] + Math.sin(a) * 6;
        if (x < WORLD.minX + 30 || x > WORLD.maxX - 30 || z < WORLD.minZ + 30 || sdfAt(x, z) > 165 || !flat(x, z)) continue;
        spot = { x, z };
      }
    }
    idx++; if (!spot) continue;
    const yaw = rng() * 6.283, item = { kind, name: K.name, x: spot.x, z: spot.z, r: K.where === 'under' ? 12 : K.where === 'trail' ? 9 : 13, ship: K.ship, hidden: true };
    all.push(item);
    if (K.ship <= upTo) { BUILD[kind](props, spot.x, groundY(spot.x, spot.z) - 0.02, spot.z, yaw, mulberry32(7001 + idx * 31), spot.out || [1, 0]); out.push(item); }
  }
  return out;
}
