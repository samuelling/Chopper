// ---------------------------------------------------------------------------
// Ashland State Park, Massachusetts — built from real OpenStreetMap geometry
// (c) OpenStreetMap contributors, ODbL.  See ashland_data.js / data/ashland_osm.json.
//
// What is real: the reservoir shoreline and both islands, the dam, the beach,
// the boat-launch point, the two parking lots, the loop trail and spur paths,
// service roads, and the course of Cold Spring Brook below the dam.
// What is invented: ground elevation (OSM has none), depth, the gatehouse,
// the spillway's exact position and everything that sits on the land.
//
// Coordinates: game metres, +x ~ east, +z ~ south.  The map is rotated ~9 degrees
// so the dam runs exactly along +x at z = DAM_Z, and horizontally scaled by SCALE
// so a lap of the 3.5 mile trail is a ~12 minute walk.  Set SCALE = 1 for real size.
// ---------------------------------------------------------------------------
import { clamp, lerp } from './noise.js';
import { OSM } from './ashland_data.js';

export const SCALE = 0.5;
export const LEVEL = 20;          // water surface elevation (game metres)
export const MAX_DEPTH = 9;       // ~50 ft, compressed
export const DAM_Z = -470;        // the dam's lake-side edge
export const DAM_CREST = LEVEL + 2.6;
export const VALLEY_Y = LEVEL - 7.5;

// --- projection: lat/lon -> rotated game metres -----------------------------
const [LAT0, LON0] = OSM.ref;
const KZ = 111320, KX = 111320 * Math.cos(LAT0 * Math.PI / 180);
const raw = ([lat, lon]) => [(lon - LON0) * KX * SCALE, (LAT0 - lat) * KZ * SCALE];
const W_END = raw([42.2472, -71.465]);
const E_END = raw([42.24653, -71.45888]);
const DL = Math.hypot(E_END[0] - W_END[0], E_END[1] - W_END[1]);
const UX = (E_END[0] - W_END[0]) / DL, UZ = (E_END[1] - W_END[1]) / DL;   // along the dam
const VX = -UZ, VZ = UX;                                                  // away from the dam, south
const MX = (W_END[0] + E_END[0]) / 2, MZ = (W_END[1] + E_END[1]) / 2;
export const DAM_HALF = DL / 2;
export function project(p) {
  const [x, z] = raw(p);
  const dx = x - MX, dz = z - MZ;
  return [dx * UX + dz * UZ, dx * VX + dz * VZ + DAM_Z];
}
// inverse of project(): game metres -> [lat, lon]
export function unproject(x, z) {
  const v = z - DAM_Z;
  const dx = x * UX + v * VX, dz = x * UZ + v * VZ;
  return [LAT0 - (dz + MZ) / (KZ * SCALE), LON0 + (dx + MX) / (KX * SCALE)];
}
const projLine = (l) => l.map(project);

// --- the reservoir ------------------------------------------------------------
const OUTER = projLine(OSM.lake.outer);
const INNER = OSM.lake.inner.map(projLine);
let lx0 = Infinity, lx1 = -Infinity, lz0 = Infinity, lz1 = -Infinity;
for (const [x, z] of OUTER) { lx0 = Math.min(lx0, x); lx1 = Math.max(lx1, x); lz0 = Math.min(lz0, z); lz1 = Math.max(lz1, z); }
export const LAKE_BOX = { x0: lx0, x1: lx1, z0: lz0, z1: lz1 };
export const CL_LEN = lz1 - DAM_Z;

const CELL0 = 2.5;
export const WORLD = {
  minX: Math.floor((lx0 - 340) / CELL0) * CELL0, maxX: Math.ceil((lx1 + 340) / CELL0) * CELL0,
  minZ: DAM_Z - 250, maxZ: Math.ceil((lz1 + 340) / CELL0) * CELL0, cell: CELL0,
};
export const NX = Math.floor((WORLD.maxX - WORLD.minX) / WORLD.cell) + 1;
export const NZ = Math.floor((WORLD.maxZ - WORLD.minZ) / WORLD.cell) + 1;
export const WORLD_W = (NX - 1) * WORLD.cell;
export const WORLD_D = (NZ - 1) * WORLD.cell;

function flat(ring) {
  const a = new Float64Array(ring.length * 2);
  ring.forEach(([x, z], i) => { a[i * 2] = x; a[i * 2 + 1] = z; });
  return a;
}
const R_OUT = flat(OUTER), R_IN = INNER.map(flat);

function ringDist(r, x, z) {          // [distance, inside?]
  let d2 = Infinity, inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = r[j * 2], az = r[j * 2 + 1], bx = r[i * 2], bz = r[i * 2 + 1];
    const abx = bx - ax, abz = bz - az;
    const l2 = abx * abx + abz * abz || 1e-9;
    let t = ((x - ax) * abx + (z - az) * abz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + abx * t - x, pz = az + abz * t - z;
    const q = px * px + pz * pz;
    if (q < d2) d2 = q;
    if ((az > z) !== (bz > z) && x < ax + (z - az) / (bz - az) * abx) inside = !inside;
  }
  return [Math.sqrt(d2), inside];
}

/** Signed distance (game m) to the shoreline; negative = water. */
export function lakeSdf(x, z) {
  const bx = Math.max(lx0 - x, 0, x - lx1), bz = Math.max(lz0 - z, 0, z - lz1);
  if (bx > 420 || bz > 420) return Math.max(bx, bz);
  let [d, inside] = ringDist(R_OUT, x, z);
  for (const r of R_IN) {
    const [di, ins] = ringDist(r, x, z);
    if (ins) { inside = false; d = Math.min(d, di); } else d = Math.min(d, di);
  }
  return inside ? -d : d;
}
/** negative inside an island */
export function islandSdf(x, z) {
  let best = 1e9;
  for (const r of R_IN) {
    const [d, ins] = ringDist(r, x, z);
    best = Math.min(best, ins ? -d : d);
  }
  return best;
}

// --- polylines ---------------------------------------------------------------
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
const polyLen = (l) => { let s = 0; for (let i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; };

export const TRAIL_LINES = OSM.trails.map(projLine);
export const ROAD_LINES = OSM.roads.map(projLine).filter((l) => l.length > 2 || polyLen(l) > 4);

/** the two long shore paths, as one list of points (for benches etc.) */
export function buildTrail() {
  const big = TRAIL_LINES.slice().sort((a, b) => polyLen(b) - polyLen(a)).slice(0, 2);
  return big.flat();
}

// --- anchors ----------------------------------------------------------------
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
function inland(x, z) {
  const gx = lakeSdf(x + 2, z) - lakeSdf(x - 2, z), gz = lakeSdf(x, z + 2) - lakeSdf(x, z - 2);
  const l = Math.hypot(gx, gz) || 1;
  return [gx / l, gz / l];       // direction of increasing sdf: away from the water
}

export const BEACH = (() => {
  const [x, z] = centroid(projLine(OSM.beach));
  const [ex, ez] = inland(x, z);
  return { x, z, ex, ez, r: 22 };
})();

export const LOT = (() => {
  const pts = OSM.parking.flat().map(project);
  const [x, z] = centroid(pts);
  return { x, z, r: 20, rx: 17, rz: 9 };
})();

export const RAMP = (() => {
  const [x, z] = project(OSM.slip);
  const [ex, ez] = inland(x, z);
  return { x, z, r: 11, dx: -ex, dz: -ez };     // dx,dz points into the water
})();

// the brook below the dam (Cold Spring Brook flows away from the dam)
export const GATE = (() => {
  const [bx] = project(OSM.brook[0][0]);
  return { x: Math.round(bx), z: DAM_Z - 6.5, yaw: 0 };
})();
export const SPILLWAY = { x0: GATE.x + 34, x1: GATE.x + 50, zTop: DAM_Z - 3, zBottom: DAM_Z - 36 };
export const BROOK = (() => {
  const pts = OSM.brook[0].concat(OSM.brook[1].slice(1)).map(project);
  const out = [[GATE.x, DAM_Z - 41]];
  for (const p of pts) {
    if (p[1] > DAM_Z - 55) continue;
    if (p[1] < WORLD.minZ + 25 || p[0] < WORLD.minX + 25 || p[0] > WORLD.maxX - 25) break;
    out.push(p);
  }
  return out;
})();

// easter egg: the ultralight helicopter that went down in ~30 ft of water in 2016.
// (Placed in the deepest open water; the exact spot is not in any dataset I had.)
export const WRECK = (() => {
  const z = DAM_Z + CL_LEN * 0.36;
  let best = { x: 0, s: 0 };
  for (let x = lx0; x < lx1; x += 4) { const s = lakeSdf(x, z); if (s < best.s) best = { x, s }; }
  return { x: best.x, z };
})();

// where the player starts: on the dam crest, looking south down the reservoir
export const SPAWN = { x: Math.round(DAM_HALF * 0.2), z: DAM_Z - 1, yaw: Math.PI };
