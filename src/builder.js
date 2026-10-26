import * as THREE from 'three';
import { hash2 } from './noise.js';

const _c = new THREE.Color();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();

/**
 * Merges many THREE geometries into one non-indexed, flat-shaded (or smooth)
 * BufferGeometry with:
 *   position, normal, color (painted multipliers), aTint (how much the
 *   per-instance tint applies), aSmooth (position-welded normal, for outlines).
 */
export class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.tint = [];
  }

  /**
   * @param {THREE.BufferGeometry} geometry
   * @param {THREE.Matrix4} matrix  placement in tree-local space
   * @param {object} o
   *   color: THREE.Color | hex string        flat colour
   *   colorFn: (p, n, tri) => THREE.Color    per-vertex painted colour (p in local space)
   *   tint: 0..1                             how much instance tint applies
   *   smooth: keep the source geometry's smooth normals (default flat-shaded facets)
   */
  add(geometry, matrix, o = {}) {
    let g = geometry;
    const smooth = !!o.smooth;
    if (!smooth) {
      g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      g.deleteAttribute('normal');
      if (g.attributes.uv) g.deleteAttribute('uv');
      g.computeVertexNormals();
    } else {
      g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    }
    g.applyMatrix4(matrix);
    const pa = g.attributes.position, na = g.attributes.normal;
    const flat = o.color !== undefined ? new THREE.Color(o.color) : null;
    const cen = new THREE.Vector3();
    for (let t = 0; t < pa.count; t += 3) {
      // optional per-face colour (bark stripes, stone faces ...)
      let fc = null;
      if (o.faceColorFn) {
        cen.set(0, 0, 0);
        for (let k = 0; k < 3; k++) cen.add(_p.fromBufferAttribute(pa, t + k));
        cen.multiplyScalar(1 / 3);
        _n.fromBufferAttribute(na, t);
        const r = o.faceColorFn(cen, _n, t / 3);
        fc = [r.r, r.g, r.b];
      }
      for (let k = 0; k < 3; k++) {
        const i = t + k;
        _p.fromBufferAttribute(pa, i);
        _n.fromBufferAttribute(na, i);
        this.pos.push(_p.x, _p.y, _p.z);
        this.nor.push(_n.x, _n.y, _n.z);
        if (fc) {
          this.col.push(fc[0], fc[1], fc[2]);
        } else {
          let c = flat;
          if (o.colorFn) c = o.colorFn(_p, _n, t / 3);
          if (!c) c = _c.setRGB(1, 1, 1);
          this.col.push(c.r, c.g, c.b);
        }
        this.tint.push(o.tint ?? 0);
      }
    }
    return this;
  }

  build({ smoothNormals = true } = {}) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 1));
    if (smoothNormals) geo.setAttribute('aSmooth', weldedNormals(this.pos, this.nor));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

// Average the normals of all vertices that share a position, so an inflated
// hull doesn't tear apart along flat-shaded edges.
export function weldedNormals(pos, nor) {
  const map = new Map();
  const n = pos.length / 3;
  const keys = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 400)},${Math.round(pos[i * 3 + 1] * 400)},${Math.round(pos[i * 3 + 2] * 400)}`;
    keys[i] = k;
    let e = map.get(k);
    if (!e) { e = [0, 0, 0]; map.set(k, e); }
    e[0] += nor[i * 3]; e[1] += nor[i * 3 + 1]; e[2] += nor[i * 3 + 2];
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const e = map.get(keys[i]);
    const l = Math.hypot(e[0], e[1], e[2]) || 1;
    out[i * 3] = e[0] / l; out[i * 3 + 1] = e[1] / l; out[i * 3 + 2] = e[2] / l;
  }
  return new THREE.BufferAttribute(out, 3);
}

// Deterministic per-position jitter (shared vertices move together).
export function jitterGeometry(geo, amount, seed = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const kx = Math.round(x * 300), ky = Math.round(y * 300), kz = Math.round(z * 300);
    const h1 = hash2(kx, ky + kz * 31, seed);
    const h2 = hash2(ky, kz + kx * 17, seed + 5);
    const h3 = hash2(kz, kx + ky * 13, seed + 9);
    p.setXYZ(i, x + (h1 - 0.5) * 2 * amount, y + (h2 - 0.5) * 2 * amount, z + (h3 - 0.5) * 2 * amount);
  }
  p.needsUpdate = true;
  return geo;
}

export function matrix(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

// Branch (cylinder) between two points, local space.
export function branchMatrix(a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, len, 1));
  return m;
}
