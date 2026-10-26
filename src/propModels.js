import * as THREE from 'three';
import { GeoBuilder, jitterGeometry, matrix } from './builder.js';
import { mulberry32, hash2, fbm, smoothstep, clamp, lerp } from './noise.js';
import { lakeSdf, DAM_Z } from './ashland.js';
import { TRAIL } from './world.js';

const tc = new THREE.Color();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function stripGeometry(centre, widths) {
  // centre: [Vector3], widths: [number]; flat ribbon facing "up" (+ a perpendicular)
  const pos = [];
  const pts = centre.length;
  const L = [], R = [];
  for (let i = 0; i < pts; i++) {
    const p = centre[i];
    const a = centre[Math.max(0, i - 1)], b = centre[Math.min(pts - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const px = -dz / l, pz = dx / l;
    L.push(new THREE.Vector3(p.x + px * widths[i], p.y, p.z + pz * widths[i]));
    R.push(new THREE.Vector3(p.x - px * widths[i], p.y, p.z - pz * widths[i]));
  }
  for (let i = 0; i < pts - 1; i++) {
    pos.push(L[i].x, L[i].y, L[i].z, R[i].x, R[i].y, R[i].z, L[i + 1].x, L[i + 1].y, L[i + 1].z);
    pos.push(R[i].x, R[i].y, R[i].z, R[i + 1].x, R[i + 1].y, R[i + 1].z, L[i + 1].x, L[i + 1].y, L[i + 1].z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// ---------------------------------------------------------------------------
// Bracken / hay-scented fern clump
// ---------------------------------------------------------------------------
function buildFern(lod, seed = 1) {
  const rng = mulberry32(900 + seed + lod);
  const b = new GeoBuilder();
  const fronds = lod ? 5 : 8;
  const segs = lod ? 3 : 5;
  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + rng() * 0.6;
    const L = 0.85 + rng() * 0.55;
    const droop = 0.55 + rng() * 0.6;
    const pts = [], w = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const r = L * t * 0.82;
      const y = 0.1 + L * (Math.sin(t * Math.PI * 0.62) * 0.62) - droop * t * t * L * 0.55;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, Math.max(y, 0.04), Math.sin(ang) * r));
      w.push((0.17 * L * Math.pow(1 - t * 0.93, 0.75)) + 0.012);
    }
    b.add(stripGeometry(pts, w), matrix(0, 0, 0), {
      tint: 1,
      colorFn: (p) => {
        const m = 0.5 + 0.75 * clamp(p.y / 0.9, 0, 1);
        return tc.setRGB(m * 1.0, m * 0.98, m * 0.92);
      },
    });
  }
  return b.build({ smoothNormals: false });
}

// ---------------------------------------------------------------------------
// Understory shrubs (burning bush / witch hazel / blueberry)
// ---------------------------------------------------------------------------
function buildShrub(lod) {
  const rng = mulberry32(950 + lod);
  const b = new GeoBuilder();
  const n = lod ? 2 : 4;
  for (let i = 0; i < n; i++) {
    const rad = 0.5 + rng() * 0.35;
    const g = new THREE.IcosahedronGeometry(rad, lod ? 0 : 1);
    jitterGeometry(g, rad * 0.16, 70 + i);
    const cx = (rng() - 0.5) * 0.9, cz = (rng() - 0.5) * 0.9, cy = 0.45 + rng() * 0.25;
    const bv = 0.9 + rng() * 0.2;
    b.add(g, matrix(cx, cy, cz), {
      tint: 1,
      colorFn: (p, n2, tri) => {
        const m = (0.58 + 0.55 * clamp(p.y / 1.2, 0, 1) + 0.12 * Math.max(n2.y, 0)) * bv * (0.93 + 0.14 * hash2(tri, i, 3));
        return tc.setRGB(m * 1.02, m, m * 0.9);
      },
    });
  }
  return b.build({ smoothNormals: !lod });
}

// ---------------------------------------------------------------------------
// Boulders (glacial erratics) with moss caps
// ---------------------------------------------------------------------------
function buildBoulder(variant) {
  const rng = mulberry32(1000 + variant * 7);
  const b = new GeoBuilder();
  const g = new THREE.IcosahedronGeometry(1, 1);
  jitterGeometry(g, 0.2, 100 + variant);
  const stone = new THREE.Color('#8b857a');
  const moss = new THREE.Color('#566c2c');
  b.add(g, matrix(0, 0.3, 0, 0, rng() * 6, 0, 1.25, 0.82, 1.0), {
    tint: 0,
    faceColorFn: (c, n, tri) => {
      const m = smoothstep(0.35, 0.78, n.y) * (0.55 + 0.45 * hash2(Math.round(c.x * 5), Math.round(c.z * 5), 3));
      tc.copy(stone).multiplyScalar(0.78 + 0.32 * hash2(tri, variant, 7));
      return tc.lerp(moss, m * 0.8);
    },
  });
  return b.build();
}

// ---------------------------------------------------------------------------
// Fallen log
// ---------------------------------------------------------------------------
function buildLog() {
  const b = new GeoBuilder();
  const g = new THREE.CylinderGeometry(0.3, 0.34, 4.2, 8, 3, true);
  g.rotateZ(Math.PI / 2);
  jitterGeometry(g, 0.03, 140);
  const barkA = new THREE.Color('#5f4c3b'), barkB = new THREE.Color('#4a3a2e'), moss = new THREE.Color('#566c2c');
  b.add(g, matrix(0, 0.28, 0), {
    tint: 0,
    faceColorFn: (c, n, tri) => {
      tc.copy(hash2(Math.round(c.x * 3), tri % 2, 5) > 0.5 ? barkA : barkB);
      const m = smoothstep(0.5, 0.9, n.y) * (0.5 + 0.5 * hash2(Math.round(c.x * 2), 3, 9));
      return tc.lerp(moss, m * 0.7);
    },
  });
  for (const sx of [-1, 1]) {
    const cap = new THREE.CircleGeometry(0.31, 8);
    cap.rotateY(sx * Math.PI / 2);
    b.add(cap, matrix(sx * 2.1, 0.28, 0), {
      tint: 0,
      colorFn: (p) => tc.set(Math.hypot(p.y - 0.28, p.z) > 0.15 ? '#c79a5e' : '#e3c590'),
    });
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// Cattails / shore reeds
// ---------------------------------------------------------------------------
function buildReeds(lod) {
  const rng = mulberry32(1200 + lod);
  const b = new GeoBuilder();
  const blades = lod ? 4 : 8;
  for (let i = 0; i < blades; i++) {
    const ang = rng() * Math.PI * 2;
    const H = 1.1 + rng() * 0.9;
    const lean = 0.2 + rng() * 0.5;
    const pts = [], w = [];
    for (let s = 0; s <= 3; s++) {
      const t = s / 3;
      pts.push(new THREE.Vector3(Math.cos(ang) * lean * t * t * 0.9 + (rng() - 0.5) * 0.02, H * t, Math.sin(ang) * lean * t * t * 0.9));
      w.push(0.045 * (1 - t * 0.85) + 0.004);
    }
    b.add(stripGeometry(pts, w), matrix((rng() - 0.5) * 0.4, 0, (rng() - 0.5) * 0.4), {
      tint: 1,
      colorFn: (p) => tc.setRGB(0.6 + 0.5 * clamp(p.y / 1.6, 0, 1), 0.62 + 0.42 * clamp(p.y / 1.6, 0, 1), 0.5),
    });
    if (!lod && i % 3 === 0) {
      const head = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5);
      b.add(head, matrix(Math.cos(ang) * lean * 0.9 * 0.7, H * 0.82, Math.sin(ang) * lean * 0.9 * 0.7), { tint: 0, color: '#4b2e1b' });
    }
  }
  return b.build({ smoothNormals: false });
}

// ---------------------------------------------------------------------------
// Wall stone (old New England field wall)
// ---------------------------------------------------------------------------
function buildStone(variant) {
  const rng = mulberry32(1300 + variant * 5);
  const b = new GeoBuilder();
  const g = new THREE.IcosahedronGeometry(0.5, 0);
  jitterGeometry(g, 0.06, 150 + variant);
  const lichen = new THREE.Color('#7e8f56');
  b.add(g, matrix(0, 0.12, 0, 0, 0, 0, 1.0 + variant * 0.12, 0.62, 0.78), {
    tint: 1,
    faceColorFn: (c, n, tri) => {
      const m = smoothstep(0.45, 0.85, n.y) * hash2(tri, variant, 4);
      const v = 0.82 + 0.3 * hash2(tri, 2, variant);
      tc.setRGB(v, v * 0.99, v * 0.95);
      return tc.lerp(lichen, m * 0.35);
    },
  });
  return b.build();
}

// ---------------------------------------------------------------------------
// Beaver-gnawed stump: pencil-pointed top, pale chewed wood, a ring of chips
// ---------------------------------------------------------------------------
function buildBeaverStump(variant) {
  const rng = mulberry32(1300 + variant * 11);
  const b = new GeoBuilder();
  const R = 0.2 + variant * 0.07, trunkH = 0.42 + variant * 0.12;
  const bark = new THREE.Color('#5b4636'), bark2 = new THREE.Color('#4a382b'), wood = new THREE.Color('#d9b97f'), wood2 = new THREE.Color('#c79f62');
  const trunk = new THREE.CylinderGeometry(R, R * 1.18, trunkH, 8, 1, false);
  jitterGeometry(trunk, 0.02, 300 + variant);
  b.add(trunk, matrix(0, trunkH / 2, 0), {
    tint: 0,
    faceColorFn: (c, n, tri) => (c.y > trunkH * 0.72 ? tc.copy(tri % 2 ? wood : wood2) : tc.copy(hash2(tri, 2, variant) > 0.5 ? bark : bark2)),
  });
  // the gnawed point
  const tip = new THREE.ConeGeometry(R * 0.98, R * 2.1, 8, 1, false);
  jitterGeometry(tip, 0.025, 310 + variant);
  b.add(tip, matrix(0.01, trunkH + R * 1.05 - 0.02, 0, 0, rng() * 6, 0.05), {
    tint: 0,
    faceColorFn: (c, n, tri) => tc.copy(tri % 2 ? wood : wood2).multiplyScalar(0.92 + 0.12 * hash2(tri, 9, variant)),
  });
  // chips on the ground
  const chip = new THREE.BoxGeometry(0.14, 0.04, 0.05);
  for (let i = 0; i < 7; i++) {
    const a = rng() * 6.28, r = R * 1.5 + rng() * 0.45;
    b.add(chip, matrix(Math.cos(a) * r, 0.03, Math.sin(a) * r, 0, rng() * 6.28, 0, 0.8 + rng() * 0.7), {
      tint: 0, color: tc.set(rng() > 0.5 ? '#e0c68f' : '#cfa96b'),
    });
  }
  return b.build();
}

export function buildPropModels() {
  return {
    fern: { geo: buildFern(0), geoFar: buildFern(1) },
    shrub: { geo: buildShrub(0), geoFar: buildShrub(1) },
    boulders: [buildBoulder(0), buildBoulder(1), buildBoulder(2)],
    log: buildLog(),
    beaverStumps: [buildBeaverStump(0), buildBeaverStump(1)],
    reeds: { geo: buildReeds(0), geoFar: buildReeds(1) },
    stones: [buildStone(0), buildStone(1), buildStone(2)],
  };
}

// ---------------------------------------------------------------------------
// Old stone walls (former pasture boundaries).  Returns polylines of {x,z}.
// ---------------------------------------------------------------------------
export function buildWalls() {
  const rng = mulberry32(777);
  const walls = [];
  const seeds = [
    [-300, 150, 0.0], [-330, 40, 0.5], [-280, 260, 0.2], [330, 40, 3.14], [310, 200, 3.4],
    [-290, -180, 0.15], [330, -250, 3.0], [260, 330, 4.5],
  ];
  for (const [sx, sz, dir0] of seeds) {
    let x = sx, z = sz;
    let dir = dir0 + (rng() - 0.5) * 0.3;
    const pts = [];
    for (let i = 0; i < 28; i++) {
      pts.push({ x, z });
      dir += (fbm(i * 0.31 + sx * 0.01, sz * 0.01, 2, 61) - 0.5) * 0.28;
      x += Math.cos(dir) * 7;
      z += Math.sin(dir) * 7;
      if (lakeSdf(x, z) < 60 || z < DAM_Z - 40) break;
    }
    if (pts.length >= 6) walls.push(pts);
    // a perpendicular return wall: field corner
    if (pts.length >= 10 && rng() > 0.35) {
      const k = Math.floor(pts.length * (0.5 + rng() * 0.4));
      let px = pts[k].x, pz = pts[k].z, d2 = dir0 + Math.PI / 2 * (rng() > 0.5 ? 1 : -1);
      const p2 = [];
      for (let i = 0; i < 16; i++) {
        p2.push({ x: px, z: pz });
        d2 += (fbm(i * 0.4 + px * 0.01, pz * 0.01, 2, 63) - 0.5) * 0.25;
        px += Math.cos(d2) * 7; pz += Math.sin(d2) * 7;
        if (lakeSdf(px, pz) < 60) break;
      }
      if (p2.length >= 5) walls.push(p2);
    }
  }
  return walls;
}
