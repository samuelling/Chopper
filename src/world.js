import * as THREE from 'three';
import { fbm, noise2, smoothstep, clamp, lerp, GLSL_NOISE } from './noise.js';
import { gradientMap } from './toon.js';
import {
  LEVEL, MAX_DEPTH, DAM_Z, DAM_CREST, VALLEY_Y, WORLD, NX, NZ, CL_LEN, DAM_HALF, GATE,
  lakeSdf, islandSdf, unproject, BEACH, LOT, RAMP, BROOK, buildTrail, distToPolyline, SPILLWAY, TRAIL_LINES, ROAD_LINES,
} from './ashland.js';

import { elevLatLon, DEM } from './ashland_dem.js';
export { NX, NZ, WORLD, LEVEL, lakeSdf };
export const CELL = WORLD.cell;
export const TRAIL = buildTrail();

// One heightfield, sampled once.  The terrain mesh, the water shader, the
// player, every prop and every tree read from this same data.
const H = new Float32Array(NX * NZ);
const TEX = new Float32Array(NX * NZ * 4); // R height, G lake sdf, B trail dist, A gravel dist
export const grid = H;

export const lake = {
  id: 0, name: 'Ashland Reservoir', level: LEVEL, originalLevel: LEVEL,
  floor: LEVEL - MAX_DEPTH, drained: false, gateOpen: false, bbox: null,
};
export const lakes = [lake];

// ---------------------------------------------------------------------------
// Height function
// ---------------------------------------------------------------------------
function hillNoise(x, z) {
  return (fbm(x * 0.0048 + 3.1, z * 0.0048 - 1.7, 4, 11) - 0.5) * 40
    + (fbm(x * 0.022 - 5.0, z * 0.022 + 2.0, 3, 5) - 0.5) * 7
    + (fbm(x * 0.09, z * 0.09, 2, 9) - 0.5) * 1.4;
}

// Real USGS 3DEP terrain, relative to the reservoir surface, vertically scaled for the game.
const VS = 0.6;
function realRel(x, z) {
  const [lat, lon] = unproject(x, z);
  return (elevLatLon(lat, lon) - DEM.RES_ELEV) * VS;
}
function heightCore(x, z) {
  const sdf = lakeSdf(x, z);
  const fine = (fbm(x * 0.09, z * 0.09, 2, 9) - 0.5) * 1.0 + (fbm(x * 0.022 - 5.0, z * 0.022 + 2.0, 3, 5) - 0.5) * 2.0;
  const real = realRel(x, z);
  const hills = real + fine;

  // --- south of the dam: hills rise away from a gentle shore ---
  const rim = LEVEL + 0.45 + 2.0 * smoothstep(0, 60, sdf);
  let hs = lerp(rim, Math.max(rim, LEVEL + hills), smoothstep(0, 90, sdf));

  // --- north of the dam: the Cold Spring Brook valley ---
  const valley = VALLEY_Y + Math.max(0, LEVEL + hills - VALLEY_Y) * smoothstep(20, 140, DAM_Z - z);
  const nw = smoothstep(DAM_Z - 6, DAM_Z - 42, z);
  let h = lerp(hs, valley, nw);

  // --- the dam: a flat crest with a steep downstream face ---
  const wx = smoothstep(-DAM_HALF - 48, -DAM_HALF - 10, x) * smoothstep(DAM_HALF + 42, DAM_HALF + 4, x);
  const wz = smoothstep(DAM_Z - 46, DAM_Z - 32, z) * smoothstep(DAM_Z + 9, DAM_Z + 3, z);
  const wd = wx * wz;
  if (wd > 0) {
    const crest = z >= DAM_Z - 9
      ? DAM_CREST - Math.max(0, z - (DAM_Z + 1)) * 0.5
      : lerp(DAM_CREST, VALLEY_Y + 0.6, smoothstep(DAM_Z - 9, DAM_Z - 40, z));
    h = lerp(h, crest, wd);
  }

  // --- the reservoir bowl ---
  if (sdf < 0) {
    const t = clamp((z - DAM_Z) / CL_LEN, 0, 1);
    const dn = (0.62 + 0.55 * smoothstep(0.95, 0.2, t)) * (0.85 + 0.3 * noise2(x * 0.03 + 4, z * 0.03, 5));
    let prof = smoothstep(0, -52, sdf);
    // the dam's upstream face is steep riprap, not a beach
    prof = Math.max(prof, 0.92 * smoothstep(0, 9, z - DAM_Z) * smoothstep(DAM_HALF + 30, DAM_HALF - 5, Math.abs(x)));
    h = (LEVEL + 0.45) - (MAX_DEPTH + 0.45) * prof * dn;
    h += (noise2(x * 0.35, z * 0.35, 8) - 0.5) * 0.3 * prof; // lumpy rubble bed
  }
  // the two real islands
  if (sdf > -70) {
    const isl = islandSdf(x, z);
    if (isl < 0) h = Math.max(h, LEVEL + 0.5 + 1.7 * smoothstep(0, -9, isl) + (noise2(x * 0.45, z * 0.45, 2) - 0.5) * 0.5);
  }

  // --- Cold Spring Brook channel ---
  if (z < DAM_Z - 30) {
    const d = distToPolyline(BROOK, x, z);
    if (d < 9) h -= 1.1 * smoothstep(8, 1.4, d);
  }
  return h;
}

// flat pads for the parking lot and the boat ramp
const LOT_H = heightCore(LOT.x, LOT.z);
const RAMP_H = heightCore(RAMP.x, RAMP.z);

export function heightAnalytic(x, z) {
  let h = heightCore(x, z);
  const le = Math.hypot((x - LOT.x) / LOT.rx, (z - LOT.z) / LOT.rz);
  if (le < 1.5) h = lerp(h, LOT_H, smoothstep(1.5, 1.0, le));
  const rd = Math.hypot(x - RAMP.x, z - RAMP.z);
  if (rd < RAMP.r * 1.8) h = lerp(h, Math.max(RAMP_H, LEVEL + 0.7), smoothstep(RAMP.r * 1.8, RAMP.r * 0.8, rd));
  return h;
}

function gravelDist(x, z) {
  const le = Math.hypot((x - LOT.x) / LOT.rx, (z - LOT.z) / LOT.rz);
  const dLot = (le - 1) * Math.min(LOT.rx, LOT.rz);
  const dRamp = Math.hypot(x - RAMP.x, z - RAMP.z) - RAMP.r;
  return Math.min(dLot, dRamp);
}

// distance (m, capped) to the nearest segment of a set of polylines, by splatting each segment
function rasterDist(lines, cap) {
  const out = new Float32Array(NX * NZ).fill(cap);
  for (const pts of lines) {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - cap - WORLD.minX) / CELL)), i1 = Math.min(NX - 1, Math.ceil((Math.max(ax, bx) + cap - WORLD.minX) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - cap - WORLD.minZ) / CELL)), j1 = Math.min(NZ - 1, Math.ceil((Math.max(az, bz) + cap - WORLD.minZ) / CELL));
      const abx = bx - ax, abz = bz - az, l2 = abx * abx + abz * abz || 1e-9;
      for (let j = j0; j <= j1; j++) {
        const z = WORLD.minZ + j * CELL;
        for (let ii = i0; ii <= i1; ii++) {
          const x = WORLD.minX + ii * CELL;
          const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / l2));
          const d = Math.hypot(x - (ax + abx * t), z - (az + abz * t));
          const k = j * NX + ii;
          if (d < out[k]) out[k] = d;
        }
      }
    }
  }
  return out;
}

export function buildGrid() {
  const trailR = rasterDist(TRAIL_LINES, 14);
  const roadR = rasterDist(ROAD_LINES, 14);
  for (let j = 0; j < NZ; j++) {
    const z = WORLD.minZ + j * CELL;
    for (let i = 0; i < NX; i++) {
      const x = WORLD.minX + i * CELL;
      const k = j * NX + i;
      const h = heightAnalytic(x, z);
      const sdf = lakeSdf(x, z);
      H[k] = h;
      TEX[k * 4] = h;
      TEX[k * 4 + 1] = sdf;
      TEX[k * 4 + 2] = trailR[k];
      TEX[k * 4 + 3] = Math.min(gravelDist(x, z), roadR[k] - 1.6);
    }
  }
  // lowest point + bbox of the reservoir
  let min = Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      if (TEX[k * 4 + 1] < 0) {
        min = Math.min(min, H[k]);
        const x = WORLD.minX + i * CELL, z = WORLD.minZ + j * CELL;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
    }
  }
  lake.floor = min;
  lake.bbox = { x0: x0 - 20, x1: x1 + 20, z0: z0 - 20, z1: z1 + 20 };
}

// triangle-accurate height lookup (matches the mesh triangulation)
export function groundY(x, z) {
  const fx = clamp((x - WORLD.minX) / CELL, 0, NX - 1.001);
  const fz = clamp((z - WORLD.minZ) / CELL, 0, NZ - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz);
  const u = fx - i, v = fz - j;
  const h00 = H[j * NX + i], h10 = H[j * NX + i + 1];
  const h01 = H[(j + 1) * NX + i], h11 = H[(j + 1) * NX + i + 1];
  if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

export function groundNormal(x, z, out = new THREE.Vector3()) {
  const e = 0.8;
  return out.set(groundY(x - e, z) - groundY(x + e, z), 2 * e, groundY(x, z - e) - groundY(x, z + e)).normalize();
}

// sampled fields
function sampleChan(x, z, c) {
  const fx = clamp((x - WORLD.minX) / CELL, 0, NX - 1.001);
  const fz = clamp((z - WORLD.minZ) / CELL, 0, NZ - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz);
  const u = fx - i, v = fz - j;
  const a = TEX[(j * NX + i) * 4 + c], b = TEX[(j * NX + i + 1) * 4 + c];
  const d = TEX[((j + 1) * NX + i) * 4 + c], e = TEX[((j + 1) * NX + i + 1) * 4 + c];
  return lerp(lerp(a, b, u), lerp(d, e, u), v);
}
export const sdfAt = (x, z) => sampleChan(x, z, 1);
export const trailDistAt = (x, z) => sampleChan(x, z, 2);
export const gravelAt = (x, z) => sampleChan(x, z, 3);

export function waterDepthAt(x, z) {
  if (sdfAt(x, z) > 3) return 0;
  return Math.max(0, lake.level - groundY(x, z));
}
export function inLakeBasin(x, z, margin = 0) { return sdfAt(x, z) < margin; }

// ---------------------------------------------------------------------------
// Height texture shared with shaders
// ---------------------------------------------------------------------------
export const heightUniforms = {
  uHeightTex: { value: null },
  uHeightInfo: { value: new THREE.Vector4(WORLD.minX, WORLD.minZ, CELL, 0) },
  uGridDim: { value: new THREE.Vector2(NX, NZ) },
};

export const GLSL_HEIGHT = /* glsl */ `
uniform sampler2D uHeightTex;
uniform vec4 uHeightInfo;
uniform vec2 uGridDim;
vec4 terrainSample(vec2 xz){
  vec2 t = (xz - uHeightInfo.xy) / uHeightInfo.z;
  t = clamp(t, vec2(0.0), uGridDim - 1.001);
  ivec2 i0 = ivec2(floor(t)); vec2 f = fract(t);
  vec4 a = texelFetch(uHeightTex, i0, 0);
  vec4 b = texelFetch(uHeightTex, i0 + ivec2(1,0), 0);
  vec4 c = texelFetch(uHeightTex, i0 + ivec2(0,1), 0);
  vec4 d = texelFetch(uHeightTex, i0 + ivec2(1,1), 0);
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float terrainH(vec2 xz){ return terrainSample(xz).r; }
`;

export function makeHeightTexture() {
  const tex = new THREE.DataTexture(TEX, NX, NZ, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  heightUniforms.uHeightTex.value = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// Terrain mesh
// ---------------------------------------------------------------------------
const LITTER = ['#a65b27', '#94562b', '#b87a31', '#80502d', '#9c4a24'].map((c) => new THREE.Color(c));
const MUD = new THREE.Color('#4a3b2c');
const MUD_OLIVE = new THREE.Color('#4a4a2c');
const ROCK = new THREE.Color('#756759');
const SAND = new THREE.Color('#d6c28f');
const GRASS = new THREE.Color('#8e9a46');
const tmp = new THREE.Color();

export function buildTerrain() {
  const pos = new Float32Array(NX * NZ * 3);
  const col = new Float32Array(NX * NZ * 3);
  const litterA = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      pos[k * 3] = WORLD.minX + i * CELL;
      pos[k * 3 + 1] = H[k];
      pos[k * 3 + 2] = WORLD.minZ + j * CELL;
    }
  }
  const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
  let p = 0;
  for (let j = 0; j < NZ - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const v00 = j * NX + i, v10 = v00 + 1, v01 = v00 + NX, v11 = v01 + 1;
      idx[p++] = v00; idx[p++] = v01; idx[p++] = v10;
      idx[p++] = v10; idx[p++] = v01; idx[p++] = v11;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal.array;

  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      const x = pos[k * 3], h = pos[k * 3 + 1], z = pos[k * 3 + 2];
      const sdf = TEX[k * 4 + 1];
      const slope = 1 - nrm[k * 3 + 1];
      const n = fbm(x * 0.018, z * 0.018, 3, 21);
      const li = Math.min(LITTER.length - 1.001, n * LITTER.length * 1.25);
      const a = Math.floor(li), f = li - a;
      tmp.copy(LITTER[a]).lerp(LITTER[Math.min(a + 1, LITTER.length - 1)], f);
      let litterW = 1;

      // wet banks and the lake bed
      const wet = smoothstep(LEVEL + 0.9, LEVEL + 0.05, h) * smoothstep(40, -2, sdf);
      if (wet > 0) {
        const deep = smoothstep(LEVEL - 0.2, LEVEL - 4, h);
        tmp.lerp(MUD.clone().lerp(MUD_OLIVE, deep * 0.8), wet);
        litterW *= 1 - wet;
      }
      // sandy beach on the west shore
      const bd = Math.hypot(x - BEACH.x, z - BEACH.z);
      const sandW = smoothstep(BEACH.r, BEACH.r * 0.45, bd) * smoothstep(LEVEL - 2.4, LEVEL - 0.6, h) * smoothstep(LEVEL + 2.2, LEVEL + 0.5, h);
      if (sandW > 0) { tmp.lerp(SAND, sandW); litterW *= 1 - sandW; }
      // rocky on steep ground
      const rk = smoothstep(0.24, 0.5, slope);
      tmp.lerp(ROCK, rk);
      litterW *= 1 - rk;
      // mown grass on the dam
      const gw = smoothstep(-DAM_HALF - 50, -DAM_HALF - 12, x) * smoothstep(DAM_HALF + 40, DAM_HALF + 2, x) * smoothstep(DAM_Z - 44, DAM_Z - 30, z) * smoothstep(DAM_Z + 12, DAM_Z + 4, z) * (1 - rk * 0.5);
      if (gw > 0) { tmp.lerp(GRASS, gw); litterW *= 1 - gw; }

      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
      litterA[k] = litterW;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aLitter', new THREE.BufferAttribute(litterA, 1));

  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap });
  mat.customProgramCacheKey = () => 'terrain-ashland';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHeightTex = heightUniforms.uHeightTex;
    shader.uniforms.uHeightInfo = heightUniforms.uHeightInfo;
    shader.uniforms.uGridDim = heightUniforms.uGridDim;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aLitter; varying float vLitter; varying vec3 vWorld;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLitter = aLitter; vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vLitter; varying vec3 vWorld;
        ${GLSL_NOISE}
        ${GLSL_HEIGHT}
        const float LEVEL_HI = ${(LEVEL + 1.2).toFixed(2)};`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 w = vWorld.xz;
          vec4 fld = terrainSample(w);
          float n1 = vnoise(w * 0.20);
          float n2 = vnoise(w * 0.85 + 17.0);
          float n3 = vnoise(w * 3.1 + 3.0);
          float lum = 0.80 + 0.13 * step(0.46, n1) + 0.12 * step(0.58, n2);
          vec3 base = diffuseColor.rgb;
          float moss = step(0.63, vnoise(w * 0.11 + 40.0)) * vLitter;
          base = mix(base, vec3(0.085, 0.16, 0.035) * (0.85 + 0.5 * n2), moss * 0.9);
          float fleck = step(0.80, n3) * vLitter;
          base = mix(base, vec3(0.42, 0.045, 0.012) * (0.8 + 0.5 * n2), fleck * 0.7);
          float fleck2 = step(0.84, vnoise(w * 2.3 + 9.0)) * vLitter;
          base = mix(base, vec3(0.62, 0.30, 0.02), fleck2 * 0.65);
          // the loop trail: packed earth with a crisp, slightly ragged edge
          float tw = 1.55 + 0.55 * vnoise(w * 0.9) + 0.25 * n3;
          float trail = 1.0 - smoothstep(tw - 0.18, tw + 0.18, fld.b);
          vec3 dirt = vec3(0.235, 0.135, 0.062) * (0.85 + 0.3 * n2);
          dirt = mix(dirt, vec3(0.30, 0.19, 0.09), step(0.72, n3) * 0.6);
          // gravel (parking lot, boat ramp)
          float gr = 1.0 - smoothstep(-0.4, 0.4, fld.a);
          vec3 gravel = vec3(0.30, 0.285, 0.26) * (0.8 + 0.4 * step(0.55, n3));
          base = mix(base, dirt, trail * 0.95);
          base = mix(base, gravel, gr);
          diffuseColor.rgb = mix(base * lum, base * 1.0, max(trail, gr));
          // beyond the streamed forest: a painted canopy mosaic so the far hills read as woods
          {
            float cd = length(w - cameraPosition.xz);
            float cov = smoothstep(95.0, 190.0, cd) * smoothstep(4.0, 22.0, fld.g) * (1.0 - max(trail, gr))
                      * smoothstep(LEVEL_HI, LEVEL_HI + 1.5, fld.r);
            float c1 = vnoise(w * 0.035 + 7.0), c2 = vnoise(w * 0.09 + 3.0);
            float k = c1 * 0.8 + c2 * 0.35;
            vec3 can = k < 0.30 ? vec3(0.50, 0.075, 0.03) : k < 0.46 ? vec3(0.62, 0.30, 0.04)
                     : k < 0.60 ? vec3(0.66, 0.46, 0.07) : k < 0.74 ? vec3(0.30, 0.34, 0.07) : vec3(0.08, 0.20, 0.10);
            can *= 0.75 + 0.35 * step(0.5, c2);
            diffuseColor.rgb = mix(diffuseColor.rgb, can, cov);
          }
        }`);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  return mesh;
}
