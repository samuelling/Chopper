// Foraging: something to pick in every season, the way people really do along these shores.  Fiddleheads (the curled
// tips of ostrich fern) in the wet ground in spring; highbush blueberries at the water's edge and black raspberries
// along the trail in summer; apples from a few old orchard trees, and hen-of-the-woods mushrooms at the foot of big
// oaks, in autumn; teaberries (wintergreen) red against the snow in winter.  E picks a handful.  Each patch gives a
// few handfuls a season.  What you have picked goes in the Field Guide.  Patches and where they are: invented, placed
// by fixed seed; the orchard stands where the real Old Orchard Trail leaves the park on the east side.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt, trailDistAt, WORLD } from './world.js';
import { wetlandAt } from './ashland_wetlands.js';
import { project } from './ashland.js';
import { mulberry32 } from './noise.js';
import { SEASON } from './season.js';
import { RUN } from './run.js';

export const FORAGE = {
  fiddlehead: { name: 'Fiddleheads', season: 'spring', n: 5, left: 3, what: 'a handful of fiddleheads', blurb: 'The tightly curled tips of ostrich fern, picked in early spring before they unroll. Only a few from each crown, so the fern lives.', hint: 'Spring, in wet ground near the water' },
  blueberry: { name: 'Highbush blueberries', season: 'summer', n: 6, left: 4, what: 'a handful of blueberries', blurb: 'The wild ancestor of the farmed blueberry. It grows with wet feet along shores and swamp edges, and ripens in July.', hint: 'Summer, along the shore' },
  raspberry: { name: 'Black raspberries', season: 'summer', n: 4, left: 3, what: 'a handful of black raspberries', blurb: 'Arching purple canes at sunny trail edges, with berries that come off hollow, like a thimble. Brief and very good.', hint: 'Summer, at sunny trail edges' },
  apple: { name: 'Old orchard apples', season: 'autumn', n: 5, left: 4, what: 'an apple', blurb: 'Gnarled trees from a farm orchard, never pruned in a lifetime and still bearing: small, hard, sour-sweet apples.', hint: 'Autumn, at the old orchard on the east side' },
  henwoods: { name: 'Hen-of-the-woods', season: 'autumn', n: 4, left: 1, what: 'a hen-of-the-woods', blurb: 'A great grey-brown rosette of a mushroom at the foot of old oaks in autumn, coming back to the same tree year after year. (Never eat a wild mushroom unless you are sure.)', hint: 'Autumn, at the foot of big oaks in the woods' },
  teaberry: { name: 'Teaberries', season: 'winter', n: 5, left: 3, what: 'a few teaberries', blurb: 'Eastern wintergreen: glossy leaves and red berries that last through the snow, and taste of wintergreen.', hint: 'Winter, on the forest floor under the snow' },
};
const ORCHARD = project([42.237026, -71.4581715]);   // where the Old Orchard Trail begins (OpenStreetMap), just outside the park

const C = (h) => new THREE.Color(h);
const ball = new THREE.SphereGeometry(1, 7, 5), cyl = new THREE.CylinderGeometry(1, 1, 1, 6), cone = new THREE.ConeGeometry(1, 1, 6);

const BUILD = {
  fiddlehead(b, x, y, z, r) {
    for (let i = 0; i < 11; i++) { const a = r() * 6.28, d = r() * 0.35, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, h = 0.22 + r() * 0.2;
      b.add(cyl, matrix(px, y + h / 2, pz, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3, 0.02, h, 0.02), { color: C('#5f8a2a') });
      b.add(ball, matrix(px, y + h + 0.04, pz, 0, r() * 6, Math.PI / 2, 0.065, 0.065, 0.03), { color: C('#7aa83a') }); }
    for (let i = 0; i < 5; i++) b.add(ball, matrix(x + (r() - 0.5) * 0.7, y + 0.03, z + (r() - 0.5) * 0.7, 0, r() * 6, 0, 0.12, 0.02, 0.06), { color: C('#8a6a44') });   // last year's brown fronds
  },
  blueberry(b, x, y, z, r) {
    const balls = [];
    for (let i = 0; i < 5; i++) { const q = [x + (r() - 0.5) * 1.2, y + 0.6 + r() * 0.6, z + (r() - 0.5) * 1.2]; balls.push(q); b.add(ball, matrix(q[0], q[1], q[2], 0, 0, 0, 0.55, 0.45, 0.55), { color: C(i % 2 ? '#3f6a34' : '#4f7a3a') }); }
    for (let i = 0; i < 46; i++) { const q = balls[i % 5], a = r() * 6.28, el = (r() - 0.3) * 1.2; b.add(ball, matrix(q[0] + Math.cos(a) * Math.cos(el) * 0.56, q[1] + Math.sin(el) * 0.46, q[2] + Math.sin(a) * Math.cos(el) * 0.56, 0, 0, 0, 0.045, 0.045, 0.045), { color: C(r() < 0.8 ? '#3a4a9a' : '#8a9ad0') }); }
  },
  raspberry(b, x, y, z, r) {
    for (let i = 0; i < 9; i++) { const a = r() * 6.28; b.add(cyl, matrix(x + Math.cos(a) * 0.35, y + 0.55, z + Math.sin(a) * 0.35, Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6, 0.015, 1.3, 0.015), { color: C('#7a3a5a') }); }
    for (let i = 0; i < 6; i++) b.add(ball, matrix(x + (r() - 0.5) * 1.3, y + 0.6 + r() * 0.3, z + (r() - 0.5) * 1.3, 0, 0, 0, 0.35, 0.22, 0.35), { color: C(i % 2 ? '#4f7a34' : '#5f8a3a') });
    for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 0.4 + r() * 0.5; b.add(ball, matrix(x + Math.cos(a) * d, y + 0.5 + r() * 0.5, z + Math.sin(a) * d, 0, 0, 0, 0.03, 0.03, 0.03), { color: C(r() < 0.7 ? '#1e1424' : '#a02a3a') }); }
  },
  apple(b, x, y, z, r) {
    const lean = (r() - 0.5) * 0.4;
    b.add(cyl, matrix(x, y + 0.9, z, lean, 0, (r() - 0.5) * 0.3, 0.18, 1.8, 0.18), { color: C('#5a4636') });
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + r(); b.add(cyl, matrix(x + Math.cos(a) * 0.8, y + 2.1, z + Math.sin(a) * 0.8, Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9, 0.07, 1.8, 0.07), { color: C('#5a4636') }); }
    const leafy = SEASON !== 'winter', autumn = SEASON === 'autumn';
    if (leafy) for (let i = 0; i < 9; i++) b.add(ball, matrix(x + (r() - 0.5) * 3.2, y + 2.6 + r() * 1.1, z + (r() - 0.5) * 3.2, 0, 0, 0, 1.0, 0.7, 1.0), { color: C(autumn ? ['#8a8a3a', '#a0802a', '#6f7a34'][i % 3] : SEASON === 'spring' ? (i % 3 ? '#6a9a3a' : '#f2e2ea') : '#4f7a34') });
    if (autumn) {
      for (let i = 0; i < 22; i++) b.add(ball, matrix(x + (r() - 0.5) * 3, y + 2.2 + r() * 1.3, z + (r() - 0.5) * 3, 0, 0, 0, 0.06, 0.06, 0.06), { color: C(r() < 0.6 ? '#b8322a' : '#d8a03a') });
      for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = 0.6 + r() * 1.6; b.add(ball, matrix(x + Math.cos(a) * d, y + 0.05, z + Math.sin(a) * d, 0, 0, 0, 0.06, 0.055, 0.06), { color: C(r() < 0.5 ? '#9a3a24' : '#b8862a') }); }   // windfalls
    }
  },
  henwoods(b, x, y, z, r) {
    b.add(cyl, matrix(x, y + 4, z, 0, 0, 0, 0.45, 8, 0.45), { color: C('#4f4436') });                          // the old oak
    for (let i = 0; i < 6; i++) b.add(ball, matrix(x + (r() - 0.5) * 4, y + 7.5 + r() * 2, z + (r() - 0.5) * 4, 0, 0, 0, 1.6, 1.0, 1.6), { color: C(['#8a6a2a', '#a07a30', '#6a5a2a'][i % 3]) });
    const fx = x + 0.55, fz = z + 0.1;
    for (let i = 0; i < 18; i++) { const a = r() * 6.28, d = r() * 0.22; b.add(ball, matrix(fx + Math.cos(a) * d, y + 0.08 + r() * 0.16, fz + Math.sin(a) * d, (r() - 0.5) * 0.8, a, 0.4, 0.09, 0.016, 0.06), { color: C(i % 3 ? '#7a6a58' : '#9a8a74') }); }
  },
  teaberry(b, x, y, z, r) {
    for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = r() * 0.45; b.add(ball, matrix(x + Math.cos(a) * d, y + 0.08, z + Math.sin(a) * d, 0, a, 0.2, 0.09, 0.016, 0.05), { color: C('#2f5a36') }); }
    for (let i = 0; i < 8; i++) b.add(ball, matrix(x + (r() - 0.5) * 0.7, y + 0.12, z + (r() - 0.5) * 0.7, 0, 0, 0, 0.04, 0.04, 0.04), { color: C('#c8202a') });
  },
};

export class Forage {
  constructor(scene) {
    this.patches = []; this.seen = [];
    const rng = mulberry32(7171), b = new GeoBuilder();
    const flat = (x, z) => { const g = groundY(x, z); return Math.abs(groundY(x + 1.5, z) - g) < 0.6 && Math.abs(groundY(x, z + 1.5) - g) < 0.6; };
    const far = (x, z, d) => this.patches.every((p) => Math.hypot(p.x - x, p.z - z) > d);
    const S = (RUN.s.forageS && RUN.s.forageS.n === RUN.n) ? RUN.s.forageS : (RUN.s.forageS = { n: RUN.n, taken: {} });
    this.taken = S.taken;
    for (const [kind, K] of Object.entries(FORAGE)) {
      let made = 0;
      for (let t = 0; t < 3000 && made < K.n; t++) {
        let x, z;
        if (kind === 'apple') {   // a ragged row of old trees just inside the park, toward where the orchard trail begins
          const a = rng() * 6.28, d = rng() * 40; x = ORCHARD[0] - 55 + Math.cos(a) * d; z = ORCHARD[1] - 10 + Math.sin(a) * d * 0.6;
        } else { x = WORLD.minX + 60 + rng() * (WORLD.maxX - WORLD.minX - 120); z = WORLD.minZ + 60 + rng() * (WORLD.maxZ - WORLD.minZ - 120); }
        const sd = sdfAt(x, z), tr = trailDistAt(x, z);
        if (sd > 165 || sd < 1.2 || !flat(x, z) || !far(x, z, kind === 'apple' ? 9 : 45)) continue;
        if (kind === 'fiddlehead' && !(wetlandAt(x, z) > 0 || sd < 10)) continue;
        if (kind === 'blueberry' && (sd > 9 || sd < 2)) continue;
        if (kind === 'raspberry' && (tr < 2.2 || tr > 5)) continue;
        if (kind === 'henwoods' && (sd < 30 || tr < 6)) continue;
        if (kind === 'teaberry' && (sd < 15 || tr < 4)) continue;
        if (kind === 'apple' && tr < 3) continue;
        const id = `${kind}${made++}`;
        const p = { id, kind, x, z, inSeason: K.season === SEASON }; this.patches.push(p);
        if (p.inSeason || kind === 'apple') BUILD[kind](b, x, groundY(x, z) - 0.02, z, mulberry32(Math.round(x * 31 + z * 17)));
      }
    }
    if (b.pos.length) { const m = makeInstanced(b.build(), 1); m.fill.count = m.line.count = 1; m.fill.setMatrixAt(0, new THREE.Matrix4()); m.line.setMatrixAt(0, new THREE.Matrix4()); scene.add(m.fill); scene.add(m.line); this.mesh = m; }
    this.orchard = { x: ORCHARD[0] - 55, z: ORCHARD[1] - 10 };
    // each patch is a photo subject too, in season
    this.subjects = this.patches.filter((p) => p.inSeason).map((p) => ({ kind: 'forage-' + p.kind, x: p.x, y: groundY(p.x, p.z) + (p.kind === 'apple' ? 2.5 : 0.4), z: p.z, r: p.kind === 'apple' ? 2 : 0.6 }));
  }
  /** the in-season patch you are standing at, if any */
  near(pos) { return this.patches.find((p) => p.inSeason && Math.hypot(pos.x - p.x, pos.z - p.z) < (p.kind === 'apple' ? 2.6 : 1.8)) || null; }
  left(p) { return FORAGE[p.kind].left - (this.taken[p.id] || 0); }
  /** pick a handful: returns { kind, what, first, empty } */
  pick(p) {
    const K = FORAGE[p.kind];
    if (this.left(p) <= 0) return { empty: true, kind: p.kind, K };
    this.taken[p.id] = (this.taken[p.id] || 0) + 1;
    const tot = (RUN.s.foraged ||= {}); const first = !tot[p.kind]; tot[p.kind] = (tot[p.kind] || 0) + 1; RUN.save?.();
    return { kind: p.kind, K, first, count: tot[p.kind] };
  }
}
