// ---------------------------------------------------------------------------
// Ashland State Park, Massachusetts — an impressionistic, compressed recreation.
//
// This file is the single place that describes the park's layout.  It is built
// from documented facts (MassWildlife / DCR / NRHP / Wikipedia):
//   * 470-acre park wrapped around the 157-173 acre Ashland Reservoir
//   * reservoir runs roughly north-south; avg depth 24 ft, max 50 ft
//   * earthen dam + 630 ft granite-stepped spillway at the NORTH end; the
//     spillway (east end of the dam) feeds Cold Spring Brook, flowing north
//   * the original gatehouse on the dam was demolished in 1976
//   * ~3.5 mile loop trail around the shore, flat, rooty, crosses the dam
//   * swimming beach + park entrance on the WEST shore (off Rt 135 / W Union St)
//   * gravel boat ramp at the SOUTH tip (Spring St), ~20 car lot
//   * a few small islands along the west shore
//
// We did NOT have survey geometry, so the exact outline is approximated with a
// centre-line + width profile.  To use real GIS data, replace `CENTERLINE` /
// `HALF_WIDTH` (or `lakeSdf` itself) with data derived from MassGIS / OSM.
//
// Coordinates: game metres, +x = east, +z = SOUTH (so north is -z).
// Horizontal scale is compressed (~0.5x of real) so a full loop is a ~10 min walk.
// ---------------------------------------------------------------------------
import { fbm, noise2, smoothstep, clamp, lerp } from './noise.js';

export const LEVEL = 20;          // water surface elevation (game metres)
export const MAX_DEPTH = 9;       // ~50 ft, compressed
export const DAM_Z = -470;        // crest of the dam (north end of the reservoir)
export const DAM_CREST = LEVEL + 2.6;
export const VALLEY_Y = LEVEL - 7.5;

export const WORLD = { minX: -430, maxX: 430, minZ: -720, maxZ: 660, cell: 2.5 };
export const NX = Math.floor((WORLD.maxX - WORLD.minX) / WORLD.cell) + 1;
export const NZ = Math.floor((WORLD.maxZ - WORLD.minZ) / WORLD.cell) + 1;
export const WORLD_W = (NX - 1) * WORLD.cell;
export const WORLD_D = (NZ - 1) * WORLD.cell;

export const CENTERLINE = [
  [-10, -470], [-8, -330], [12, -170], [4, 0], [-18, 170], [0, 330], [26, 470],
];
// [t along the lake (0 = dam, 1 = south tip), half width in metres]
export const HALF_WIDTH = [
  [0, 112], [0.18, 104], [0.42, 96], [0.68, 86], [0.86, 62], [1.0, 26],
];

// Islands near the west shore  [x, z, radius]
export const ISLANDS = [[-72, 118, 8.5], [-84, 148, 5.5], [-64, 164, 4.5]];

// --- centre-line helpers ----------------------------------------------------
const cum = [0];
for (let i = 1; i < CENTERLINE.length; i++) {
  const a = CENTERLINE[i - 1], b = CENTERLINE[i];
  cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
}
export const CL_LEN = cum[cum.length - 1];

export function halfWidthAt(t) {
  const h = HALF_WIDTH;
  if (t <= h[0][0]) return h[0][1];
  for (let i = 1; i < h.length; i++) {
    if (t <= h[i][0]) {
      const k = (t - h[i - 1][0]) / (h[i][0] - h[i - 1][0]);
      return lerp(h[i - 1][1], h[i][1], k * k * (3 - 2 * k));
    }
  }
  return h[h.length - 1][1];
}

export function centerAt(t, out = {}) {
  const d = clamp(t, 0, 1) * CL_LEN;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = CENTERLINE[i - 1], b = CENTERLINE[i];
  const k = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  out.x = a[0] + dx * k; out.z = a[1] + dz * k;
  out.tx = dx / l; out.tz = dz / l;          // tangent (pointing south)
  out.nx = -out.tz; out.nz = out.tx;          // normal (pointing east when tangent is south... see below)
  return out;
}

// raw signed distance to the lake body (negative inside), before noise
function baseSdf(x, z) {
  let best = Infinity;
  for (let i = 1; i < CENTERLINE.length; i++) {
    const a = CENTERLINE[i - 1], b = CENTERLINE[i];
    const abx = b[0] - a[0], abz = b[1] - a[1];
    const l2 = abx * abx + abz * abz;
    const k = clamp(((x - a[0]) * abx + (z - a[1]) * abz) / l2, 0, 1);
    const px = a[0] + abx * k, pz = a[1] + abz * k;
    const t = (cum[i - 1] + (cum[i] - cum[i - 1]) * k) / CL_LEN;
    const d = Math.hypot(x - px, z - pz) - halfWidthAt(t);
    if (d < best) best = d;
  }
  return best;
}

/** Signed distance (game m) to the shoreline; negative = water. Includes coves. */
export function lakeSdf(x, z) {
  let s = baseSdf(x, z);
  s += (fbm(x * 0.017 + 4.2, z * 0.017 - 8.1, 3, 31) - 0.5) * 36;
  s += (fbm(x * 0.065 - 2.0, z * 0.065 + 6.0, 2, 33) - 0.5) * 8;
  return Math.max(s, DAM_Z - z);   // the dam is a straight edge across the north
}

// ---------------------------------------------------------------------------
// Anchors for the places people actually go
// ---------------------------------------------------------------------------
function shoreOnSide(t, sign, extra = 0) {
  const c = centerAt(t);
  // normal pointing east for a north->south tangent is (-tz, tx) = (-1,0)*... compute explicitly
  const ex = -c.tz * -1, ez = c.tx * -1; // east-pointing unit normal (for tangent ~ +z -> (1,0))
  let d = halfWidthAt(t) - 20;
  let x = c.x + ex * sign * d, z = c.z + ez * sign * d;
  for (let i = 0; i < 80 && lakeSdf(x, z) < extra; i++) { d += 2; x = c.x + ex * sign * d; z = c.z + ez * sign * d; }
  return { x, z, ex: ex * sign, ez: ez * sign };
}

export const BEACH = (() => { const p = shoreOnSide(0.46, -1, 0); return { ...p, r: 36 }; })();
// parking lot / contact station inland of the beach
export const LOT = (() => {
  const x = BEACH.x + BEACH.ex * 58, z = BEACH.z + BEACH.ez * 58 - 14;
  return { x, z, r: 24, rx: 30, rz: 18 };
})();
// gravel boat ramp at the south tip (Spring Street)
export const RAMP = (() => {
  const c = centerAt(1);
  // sit just beyond the tip, ramp aims north into the water
  return { x: c.x - 4, z: c.z + 6, r: 15 };
})();
// gatehouse + drawdown gate on the dam (east side, next to the spillway)
export const GATE = { x: 78, z: DAM_Z - 6.5, yaw: 0 };
export const SPILLWAY = { x0: 118, x1: 134, zTop: DAM_Z - 3, zBottom: DAM_Z - 36 };
// the brook below the dam (Cold Spring Brook, flows north)
export const BROOK = [
  [80, DAM_Z - 41], [97, DAM_Z - 54], [104, DAM_Z - 74], [124, DAM_Z - 102], [112, DAM_Z - 140], [92, DAM_Z - 180],
  [108, DAM_Z - 215], [140, DAM_Z - 235],
];
// easter egg: the ultralight that went down in ~30 ft of water in 2016
export const WRECK = { x: -22, z: -120 };
// where the player starts: on the dam crest, looking south down the reservoir
export const SPAWN = { x: 24, z: DAM_Z - 1, yaw: Math.PI };

// distance from a point to a polyline of [x,z] pairs
export function distToPolyline(pts, x, z) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const abx = b[0] - a[0], abz = b[1] - a[1];
    const l2 = abx * abx + abz * abz || 1;
    const k = clamp(((x - a[0]) * abx + (z - a[1]) * abz) / l2, 0, 1);
    const d = Math.hypot(x - (a[0] + abx * k), z - (a[1] + abz * k));
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------------------
// The loop trail: follows the shore ~18 m back from the water, crosses the dam
// ---------------------------------------------------------------------------
export function buildTrail() {
  const pts = [];
  const steps = 110;
  const side = (sign) => {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = centerAt(t);
      const ex = -c.tz * -1, ez = c.tx * -1;
      const w = halfWidthAt(t);
      const wig = (fbm(t * 9 + sign * 4, 2.2 + sign, 3, 51) - 0.5) * 18;
      let d = w + 20 + wig;
      let x = c.x + ex * sign * d, z = c.z + ez * sign * d;
      // keep it out of coves: push outward until clear of the water
      for (let k = 0; k < 30 && lakeSdf(x, z) < 12; k++) { d += 3; x = c.x + ex * sign * d; z = c.z + ez * sign * d; }
      out.push([x, Math.max(z, DAM_Z + 1)]);
    }
    return out;
  };
  const west = side(-1), east = side(1);
  // dam crossing: west end -> east end along the crest
  const wDam = west[0], eDam = east[0];
  pts.push(...west);                         // north -> south along the west shore
  // wrap around the south tip
  const tipW = west[west.length - 1], tipE = east[east.length - 1];
  const tc = centerAt(1);
  pts.push([tc.x - 12, tc.z + 40], [tc.x + 14, tc.z + 44]);
  pts.push(...east.slice().reverse());       // south -> north along the east shore
  // crest of the dam, back to the start
  pts.push([eDam[0], DAM_Z - 1], [(eDam[0] + wDam[0]) / 2, DAM_Z - 1], [wDam[0], DAM_Z - 1]);
  return pts;
}
