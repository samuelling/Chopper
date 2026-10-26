import * as THREE from 'three';
import { InstanceBatch } from './instances.js';
import { treeColor, SPECIES, buildStump } from './trees.js';
import { fillMaterial, outlineMaterial } from './toon.js';
import { wetlandAt } from './ashland_wetlands.js';
import { standAt, SPECIES_W } from './ashland_species.js';
import { canopyAt } from './ashland_canopy.js';
import { landcoverAt } from './ashland_landcover.js';
import { mulberry32, fbm, smoothstep, clamp, lerp } from './noise.js';
import { groundY, sdfAt, trailDistAt, gravelAt, WORLD, LEVEL } from './world.js';
import { DAM_Z, DAM_HALF, BROOK, BEACH, LOT, RAMP, distToPolyline } from './ashland.js';

export const CHUNK = 64;
const UP = new THREE.Vector3(0, 1, 0);

const FERN_COLORS = ['#c9892f', '#b4601f', '#8d9a3a', '#d6a73a', '#a8561e'].map((c) => new THREE.Color(c));
const SHRUB_COLORS = ['#b3252a', '#e0701f', '#e8b92c', '#6a8a35', '#8a2535'].map((c) => new THREE.Color(c));
const REED_COLORS = ['#c9b36a', '#a98a4a', '#d8c887'].map((c) => new THREE.Color(c));
const STONE_COLORS = ['#8a8479', '#776f66', '#9a9284', '#6d6a5c'].map((c) => new THREE.Color(c));

function onDam(x, z) { return x > -DAM_HALF - 55 && x < DAM_HALF + 55 && z > DAM_Z - 50 && z < DAM_Z + 11; }
function inLot(x, z, pad = 0) {
  const e = Math.hypot((x - LOT.x) / (LOT.rx + pad), (z - LOT.z) / (LOT.rz + pad));
  return e < 1;
}

/**
 * Streams the world in 64 m chunks: trees, understory, boulders, logs, shore
 * reeds and old stone walls.  Everything is generated deterministically from
 * the chunk coordinates, so a chunk that is unloaded and reloaded is identical
 * (minus whatever the player has chopped down).
 */
export class ChunkManager {
  constructor({ scene, colliders, layout, treeModels, propModels, walls, spawnClear }) {
    this.scene = scene;
    this.colliders = colliders;
    this.layout = layout;
    this.walls = walls;
    this.spawnClear = spawnClear;

    this.root = new THREE.Group();
    this.fallen = new THREE.Group();
    scene.add(this.root, this.fallen);
    this.chunks = new Map();
    this.felled = new Map();          // tree id -> record (persists across unloads)
    this.felledByChunk = new Map();   // chunk key -> [record]
    this.shaking = [];
    this.fallers = [];
    this.felledCount = 0;
    this.onLand = null;
    this.treeModels = treeModels;

    // shared materials
    const fill = fillMaterial({ sway: true });
    const fillStatic = fillMaterial({ sway: false });
    const fillDouble = fillMaterial({ sway: false, side: THREE.DoubleSide });
    const outline = outlineMaterial({ sway: true });
    const outlineStatic = outlineMaterial({ sway: false });
    this.mats = { fill, fillStatic, fillDouble, outline, outlineStatic };

    // model definitions -> InstanceBatch descriptors
    this.defs = {};
    for (const [sp, list] of Object.entries(treeModels)) {
      list.forEach((m, v) => {
        this.defs[`${sp}:${v}`] = {
          geoNear: m.geo, geoFar: m.geoFar, matFill: fill, matOutline: outline,
          castShadow: true, nearDist: 80, farDist: 255,
        };
      });
    }
    this.defs.fern = { geoNear: propModels.fern.geo, geoFar: propModels.fern.geoFar, matFill: fillDouble, matOutline: null, castShadow: false, nearDist: 40, farDist: 95 };
    this.defs.shrub = { geoNear: propModels.shrub.geo, geoFar: propModels.shrub.geoFar, matFill: fillStatic, matOutline: outlineStatic, castShadow: false, nearDist: 55, farDist: 115 };
    propModels.boulders.forEach((g, i) => {
      this.defs[`boulder:${i}`] = { geoNear: g, geoFar: null, matFill: fillStatic, matOutline: outlineStatic, castShadow: true, nearDist: 120, farDist: 240 };
    });
    propModels.beaverStumps.forEach((g, i) => {
      this.defs[`beaver:${i}`] = { geoNear: g, geoFar: null, matFill: fillStatic, matOutline: outlineStatic, castShadow: true, nearDist: 60, farDist: 110 };
    });
    this.defs.log = { geoNear: propModels.log, geoFar: null, matFill: fillStatic, matOutline: outlineStatic, castShadow: true, nearDist: 70, farDist: 150 };
    this.defs.reeds = { geoNear: propModels.reeds.geo, geoFar: propModels.reeds.geoFar, matFill: fillDouble, matOutline: null, castShadow: false, nearDist: 40, farDist: 100 };
    propModels.stones.forEach((g, i) => {
      this.defs[`stone:${i}`] = { geoNear: g, geoFar: null, matFill: fillStatic, matOutline: outlineStatic, castShadow: false, nearDist: 70, farDist: 125 };
    });

    this.stumpGeo = buildStump();
    this.stumpMat = fillStatic;
    this.stumpOutline = outlineStatic;
    this.queue = [];
    this.cleared = [];
    this.loadR = 285; this.unloadR = 345;
  }

  // -------------------------------------------------------------------------
  // streaming
  // -------------------------------------------------------------------------
  keyOf(cx, cz) { return cx * 100 + cz; }
  chunkAt(x, z) {
    return [Math.floor((x - WORLD.minX) / CHUNK), Math.floor((z - WORLD.minZ) / CHUNK)];
  }

  update(dt, cam, audioHooks, budget = 2) {
    const loadR = this.loadR, unloadR = this.unloadR;
    const [ccx, ccz] = this.chunkAt(cam.x, cam.z);
    const span = Math.ceil(loadR / CHUNK) + 1;
    const want = [];
    for (let cz = ccz - span; cz <= ccz + span; cz++) {
      for (let cx = ccx - span; cx <= ccx + span; cx++) {
        if (cx < 0 || cz < 0 || cx * CHUNK >= WORLD.maxX - WORLD.minX || cz * CHUNK >= WORLD.maxZ - WORLD.minZ) continue;
        const k = this.keyOf(cx, cz);
        if (this.chunks.has(k)) continue;
        const mx = WORLD.minX + (cx + 0.5) * CHUNK, mz = WORLD.minZ + (cz + 0.5) * CHUNK;
        const d = Math.hypot(mx - cam.x, mz - cam.z);
        if (d < loadR) want.push([d, cx, cz]);
      }
    }
    want.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(budget, want.length); i++) this.load(want[i][1], want[i][2]);

    for (const [k, ch] of this.chunks) {
      const d = Math.hypot(ch.mx - cam.x, ch.mz - cam.z);
      if (d > unloadR) { this.unload(k); continue; }
      const dd = d - CHUNK * 0.72;
      for (const b of ch.batches) b.setLOD(dd);
      ch.stumps.visible = dd < 200;
      ch.stumpsOl.visible = dd < 120;
    }

    this._updateDynamics(dt, cam, audioHooks);
  }

  preload(cam, budget = Infinity) {
    const loadR = this.loadR;
    const [ccx, ccz] = this.chunkAt(cam.x, cam.z);
    const span = Math.ceil(loadR / CHUNK) + 1;
    for (let cz = ccz - span; cz <= ccz + span; cz++) {
      for (let cx = ccx - span; cx <= ccx + span; cx++) {
        if (cx < 0 || cz < 0 || cx * CHUNK >= WORLD.maxX - WORLD.minX || cz * CHUNK >= WORLD.maxZ - WORLD.minZ) continue;
        const mx = WORLD.minX + (cx + 0.5) * CHUNK, mz = WORLD.minZ + (cz + 0.5) * CHUNK;
        if (Math.hypot(mx - cam.x, mz - cam.z) < loadR && !this.chunks.has(this.keyOf(cx, cz))) this.load(cx, cz);
      }
    }
  }

  load(cx, cz) {
    const key = this.keyOf(cx, cz);
    const x0 = WORLD.minX + cx * CHUNK, z0 = WORLD.minZ + cz * CHUNK;
    const group = new THREE.Group();
    this.root.add(group);
    const ch = {
      key, cx, cz, x0, z0, mx: x0 + CHUNK / 2, mz: z0 + CHUNK / 2,
      group, batches: [], trees: [], colliders: [], stumpCount: 0,
    };
    const buckets = new Map();
    const push = (name, matrix, color) => {
      let l = buckets.get(name);
      if (!l) { l = []; buckets.set(name, l); }
      const item = { matrix, color: color || null, index: -1, batch: null };
      l.push(item);
      return item;
    };

    this._genTrees(ch, push);
    this._genUnderstory(ch, push);
    this._genWalls(ch, push);

    if (this.cleared.length) {
      for (const [name, items] of buckets) {
        buckets.set(name, items.filter((it) => !this._inCleared(it.matrix.elements[12], it.matrix.elements[14])));
      }
      for (const c of ch.colliders.slice()) {
        if (this._inCleared(c.x, c.z)) { this.colliders.remove(c); ch.colliders.splice(ch.colliders.indexOf(c), 1); }
      }
    }
    for (const [name, items] of buckets) {
      if (!items.length) continue;
      ch.batches.push(new InstanceBatch(group, this.defs[name], items));
    }

    // stumps of trees felled earlier
    const cap = 96;
    ch.stumps = new THREE.InstancedMesh(this.stumpGeo, this.stumpMat, cap);
    ch.stumps.count = 0;
    ch.stumps.castShadow = true;
    ch.stumps.receiveShadow = true;
    ch.stumps.frustumCulled = false;
    ch.stumpsOl = new THREE.InstancedMesh(this.stumpGeo, this.stumpOutline, cap);
    ch.stumpsOl.instanceMatrix = ch.stumps.instanceMatrix;
    ch.stumpsOl.count = 0;
    ch.stumpsOl.frustumCulled = false;
    group.add(ch.stumps, ch.stumpsOl);
    for (const rec of this.felledByChunk.get(key) || []) this._addStump(ch, rec);

    this.chunks.set(key, ch);
    return ch;
  }

  unload(key) {
    const ch = this.chunks.get(key);
    if (!ch) return;
    for (const c of ch.colliders) this.colliders.remove(c);
    for (const b of ch.batches) b.dispose();
    ch.stumps.dispose(); ch.stumpsOl.dispose();
    this.root.remove(ch.group);
    // drop shaking trees from the unloaded chunk
    this.shaking = this.shaking.filter((t) => t.chunk !== ch);
    this.chunks.delete(key);
  }

  // -------------------------------------------------------------------------
  // generation
  // -------------------------------------------------------------------------
  /** nearest live tree within r metres (for animals), or null */
  nearestTree(x, z, r) {
    const [cx, cz] = this.chunkAt(x, z);
    let best = null, bd = r;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const ch = this.chunks.get(this.keyOf(cx + dx, cz + dz));
      if (!ch) continue;
      for (const t of ch.trees) {
        if (!t.alive) continue;
        const d = Math.hypot(t.x - x, t.z - z) - t.radius;
        if (d < bd) { bd = d; best = t; }
      }
    }
    return best;
  }

  /** keep trees and props out of a circle (a building site), regenerating any loaded chunks it touches */
  clearArea(x, z, r) {
    this.cleared.push({ x, z, r });
    this.reloadRect(x - r - 6, z - r - 6, x + r + 6, z + r + 6);
  }
  /** unload and regenerate the loaded chunks overlapping a rectangle (after the terrain under them changed) */
  reloadRect(x0, z0, x1, z1) {
    const [a, b] = this.chunkAt(x0, z0), [c, d] = this.chunkAt(x1, z1);
    for (let cz = b; cz <= d; cz++) for (let cx = a; cx <= c; cx++) {
      const key = this.keyOf(cx, cz);
      if (!this.chunks.has(key)) continue;
      this.unload(key);
      this.load(cx, cz);
    }
  }
  _inCleared(x, z, pad = 0) {
    for (const c of this.cleared) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
    return false;
  }

  _blocked(x, z, pad) {
    if (this.cleared.length && this._inCleared(x, z, pad)) return true;
    if (this.layout.blocked(x, z, pad)) return true;
    if (trailDistAt(x, z) < 2.6 + pad) return true;
    if (gravelAt(x, z) < 2 + pad) return true;
    if (onDam(x, z)) return true;
    if (z < DAM_Z - 30 && distToPolyline(BROOK, x, z) < 4.5 + pad) return true;
    return false;
  }

  _genTrees(ch, push) {
    const cell = 4.6;
    let idx = 0;
    for (let gz = ch.z0; gz < ch.z0 + CHUNK; gz += cell) {
      for (let gx = ch.x0; gx < ch.x0 + CHUNK; gx += cell) {
        idx++;
        const rng = mulberry32(ch.cx * 131071 + ch.cz * 8191 + idx * 17 + 5);
        const x = gx + (rng() - 0.5) * cell * 0.92;
        const z = gz + (rng() - 0.5) * cell * 0.92;
        const roll = rng();
        if (x < WORLD.minX + 8 || x > WORLD.maxX - 8 || z < WORLD.minZ + 8 || z > WORLD.maxZ - 8) continue;
        const sdf = sdfAt(x, z);
        if (sdf > 330) continue;
        if (sdf < 0 && groundY(x, z) < LEVEL + 1.15) continue; // open water (islands are fine)
        // forest density: glades and thickets
        const dn = fbm(x * 0.013 + 9.0, z * 0.013 - 4.0, 3, 7);
        const lc = landcoverAt(x, z);
        const thick = 0.35 + 0.65 * smoothstep(0.30, 0.52, dn);
        const dens = lc ? lc.dens * thick : 0.2 + 0.8 * smoothstep(0.34, 0.54, dn);
        if (roll > dens * 0.9) continue;
        const pf = lc ? lc.pine : 0.2;
        const wl = wetlandAt(x, z);   // real NWI wetland class
        if (wl >= 3 || (wl === 2 && roll > 0.3 * dens)) continue;   // open marsh / pond / shrub swamp
        const y = groundY(x, z);
        if (y < LEVEL + 0.8 && sdf < 12 && sdf >= 0) continue;
        if (this._blocked(x, z, 1.4)) continue;
        if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r * 1.1 && y < LEVEL + 3) continue;
        if (Math.hypot(x - RAMP.x, z - RAMP.z) < RAMP.r * 1.4) continue;
        if (inLot(x, z, 6)) continue;

        const wet = smoothstep(150, 8, sdf);
        const high = smoothstep(LEVEL + 7, LEVEL + 24, y);
        const pineN = fbm(x * 0.016 + 2.0, z * 0.016 + 8.0, 3, 13);
        let wPine = 0.1 + 3.2 * pf * pf + 0.5 * high + 0.3 * smoothstep(0.5, 0.72, pineN);
        let wBirch = (0.14 + 1.4 * smoothstep(60, 6, sdf)) * (1 - 0.6 * pf);
        let wMaple = (1.5 + 1.0 * wet) * (1 - 0.7 * pf);
        let wOak = (0.5 + 0.9 * high + 0.4 * smoothstep(0.35, 0.55, pineN)) * (1 - 0.6 * pf);
        // real stand type (LANDFIRE) steers the mix; the generic mix above keeps a little variety
        const sw = SPECIES_W[standAt(x, z)];
        if (sw) {
          const tw = wMaple + wOak + wPine + wBirch, ss = sw[0] + sw[1] + sw[2] + sw[3];
          wMaple = 0.3 * wMaple + 0.7 * tw * sw[0] / ss;
          wOak = 0.3 * wOak + 0.7 * tw * sw[1] / ss;
          wPine = 0.3 * wPine + 0.7 * tw * sw[2] / ss;
          wBirch = 0.3 * wBirch + 0.7 * tw * sw[3] / ss;
        }
        if (wl === 1) { wPine *= 0.4; wOak *= 0.4; wMaple *= 1.8; wBirch *= 1.4; }   // red-maple swamp
        const tot = wPine + wBirch + wMaple + wOak;
        let r = rng() * tot, sp;
        if ((r -= wMaple) < 0) sp = 'maple';
        else if ((r -= wOak) < 0) sp = 'oak';
        else if ((r -= wPine) < 0) sp = 'pine';
        else sp = 'birch';

        const id = `${ch.cx}:${ch.cz}:${idx}`;
        const models = this.treeModels[sp];
        const v = Math.floor(rng() * models.length);
        const g = models[v];
        const hc = canopyAt(x, z);   // real canopy height (m); 0 = unknown
        const real = hc > 0 ? Math.min(1.3, Math.max(0.7, 0.55 + 0.45 * hc / 19)) : 1;
        const s = (0.78 + rng() * 0.62) * real;
        const sy = s * (0.9 + rng() * 0.22);
        const yaw = rng() * Math.PI * 2;
        const leanMax = sp === 'pine' ? 0.025 : 0.06;
        const lx = (rng() - 0.5) * leanMax * 2, lz = (rng() - 0.5) * leanMax * 2;
        const color = treeColor(sp, x, z, wet, rng);
        const radius = g.rBase * s * 1.1;
        const base = { id, sp, v, x, y: y - 0.15, z, yaw, lx, lz, sx: s, sy, radius, H: g.H * sy };

        if (this.felled.has(id)) continue; // already chopped down: stump handled separately

        const tree = {
          ...base, color, geo: g, alive: true, chunk: ch,
          hp: Math.max(3, Math.round(SPECIES[sp].hpBase + g.rBase * s * 9)),
        };
        tree.maxHp = tree.hp;
        tree.item = push(`${sp}:${v}`, this.treeMatrix(tree), color);
        tree.collider = this.colliders.add(x, z, Math.max(0.28, radius * 0.95), { tag: tree });
        ch.colliders.push(tree.collider);
        ch.trees.push(tree);
      }
    }
  }

  _genUnderstory(ch, push) {
    const mkItem = (name, x, z, sc, yaw, color, dy = 0) => {
      const y = groundY(x, z) + dy;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(UP, yaw),
        new THREE.Vector3(sc, sc, sc));
      return push(name, m, color);
    };
    const inBounds = (x, z) => x >= WORLD.minX + 6 && x <= WORLD.maxX - 6 && z >= WORLD.minZ + 6 && z <= WORLD.maxZ - 6;

    // --- ferns: patchy carpets of bracken and hay-scented fern ---
    {
      const cell = 3.3;
      let idx = 0;
      for (let gz = ch.z0; gz < ch.z0 + CHUNK; gz += cell) {
        for (let gx = ch.x0; gx < ch.x0 + CHUNK; gx += cell) {
          idx++;
          const rng = mulberry32(ch.cx * 9973 + ch.cz * 7919 + idx * 31 + 11);
          const x = gx + rng() * cell, z = gz + rng() * cell, roll = rng();
          if (!inBounds(x, z)) continue;
          const n = fbm(x * 0.03 + 7, z * 0.03 - 3, 3, 81);
          const p = 0.06 + 0.8 * smoothstep(0.42, 0.6, n);
          if (roll > p) continue;
          const sdf = sdfAt(x, z);
          if (sdf < 5 || sdf > 340) continue;
          if (this._blocked(x, z, 0.3)) continue;
          if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r) continue;
          if (inLot(x, z, 4)) continue;
          const cn = fbm(x * 0.06 - 9, z * 0.06 + 4, 2, 83);
          const col = FERN_COLORS[Math.min(FERN_COLORS.length - 1, Math.floor(cn * FERN_COLORS.length * 1.2 + rng() * 0.8))].clone().multiplyScalar(0.85 + rng() * 0.3);
          mkItem('fern', x, z, 0.7 + rng() * 0.8, rng() * 6.28, col);
        }
      }
    }
    // --- shrubs ---
    {
      const cell = 6.5;
      let idx = 0;
      for (let gz = ch.z0; gz < ch.z0 + CHUNK; gz += cell) {
        for (let gx = ch.x0; gx < ch.x0 + CHUNK; gx += cell) {
          idx++;
          const rng = mulberry32(ch.cx * 6151 + ch.cz * 3571 + idx * 13 + 29);
          const x = gx + rng() * cell, z = gz + rng() * cell, roll = rng();
          if (!inBounds(x, z) || roll > 0.2) continue;
          const sdf = sdfAt(x, z);
          if (sdf < 6 || sdf > 330) continue;
          if (this._blocked(x, z, 0.5) || inLot(x, z, 4)) continue;
          if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r) continue;
          const cn = fbm(x * 0.05 + 3, z * 0.05 - 8, 2, 85);
          const col = SHRUB_COLORS[Math.min(SHRUB_COLORS.length - 1, Math.floor((cn * 0.8 + rng() * 0.45) * SHRUB_COLORS.length))].clone().multiplyScalar(0.85 + rng() * 0.3);
          mkItem('shrub', x, z, 0.8 + rng() * 0.8, rng() * 6.28, col, -0.05);
        }
      }
    }
    // --- boulders: erratics in the woods, rubble on the lake bed ---
    {
      const cell = 12;
      let idx = 0;
      for (let gz = ch.z0; gz < ch.z0 + CHUNK; gz += cell) {
        for (let gx = ch.x0; gx < ch.x0 + CHUNK; gx += cell) {
          idx++;
          const rng = mulberry32(ch.cx * 4421 + ch.cz * 2659 + idx * 7 + 3);
          const x = gx + rng() * cell, z = gz + rng() * cell, roll = rng();
          if (!inBounds(x, z)) continue;
          const sdf = sdfAt(x, z);
          if (sdf > 340) continue;
          const under = sdf < -4;
          if (roll > (under ? 0.5 : 0.3)) continue;
          if (!under && this._blocked(x, z, 1.5)) continue;
          if (under && sdf > -12) continue;
          if (inLot(x, z, 2)) continue;
          const sc = 0.55 + Math.pow(rng(), 2) * (under ? 1.6 : 2.2);
          const v = Math.floor(rng() * 3);
          const g = mkItem(`boulder:${v}`, x, z, sc, rng() * 6.28, null, -0.2 * sc);
          if (!under) {
            const c = this.colliders.add(x, z, sc * 1.0, { tag: 'boulder' });
            ch.colliders.push(c);
          }
        }
      }
    }
    // --- fallen logs ---
    {
      const cell = 19;
      let idx = 0;
      for (let gz = ch.z0; gz < ch.z0 + CHUNK; gz += cell) {
        for (let gx = ch.x0; gx < ch.x0 + CHUNK; gx += cell) {
          idx++;
          const rng = mulberry32(ch.cx * 1291 + ch.cz * 887 + idx * 19 + 41);
          const x = gx + rng() * cell, z = gz + rng() * cell, roll = rng();
          if (!inBounds(x, z)) continue;
          const sdf = sdfAt(x, z);
          const under = sdf < -6;
          if (roll > (under ? 0.2 : 0.35)) continue;
          if (sdf > 330 || (!under && (sdf < 4 || this._blocked(x, z, 2)))) continue;
          if (under && sdf > -14) continue;
          if (inLot(x, z, 4)) continue;
          mkItem('log', x, z, 0.8 + rng() * 0.7, rng() * 6.28, null, -0.05);
        }
      }
    }
    // --- beaver-gnawed stumps along the shore (clustered, sparse) ---
    {
      const cell = 7;
      let idx = 0;
      for (let gz = ch.z0; gz < ch.z0 + CHUNK; gz += cell) {
        for (let gx = ch.x0; gx < ch.x0 + CHUNK; gx += cell) {
          idx++;
          const rng = mulberry32(ch.cx * 5113 + ch.cz * 3571 + idx * 13 + 91);
          const x = gx + rng() * cell, z = gz + rng() * cell, roll = rng();
          if (!inBounds(x, z)) continue;
          const sdf = sdfAt(x, z);
          if (sdf < 1.5 || sdf > 20) continue;
          const y = groundY(x, z);
          if (y < LEVEL + 0.15 || y > LEVEL + 3.2) continue;
          const lodge = fbm(x * 0.012 + 31, z * 0.012 - 17, 2, 97);     // beavers work a few stretches of shore
          if (roll > 0.3 * smoothstep(0.55, 0.7, lodge)) continue;
          if (z < DAM_Z + 14) continue;
          if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r * 1.2) continue;
          if (Math.hypot(x - RAMP.x, z - RAMP.z) < RAMP.r * 1.5) continue;
          if (this._blocked(x, z, 1.0) || inLot(x, z, 5)) continue;
          const sc = 0.9 + rng() * 0.5;
          mkItem(`beaver:${rng() > 0.45 ? 1 : 0}`, x, z, sc, rng() * 6.28, null, -0.04);
          ch.colliders.push(this.colliders.add(x, z, 0.3 * sc, { tag: 'stump' }));
        }
      }
    }
    // --- shore reeds / cattails ---
    {
      const cell = 2.6;
      let idx = 0;
      for (let gz = ch.z0; gz < ch.z0 + CHUNK; gz += cell) {
        for (let gx = ch.x0; gx < ch.x0 + CHUNK; gx += cell) {
          idx++;
          const rng = mulberry32(ch.cx * 3361 + ch.cz * 1759 + idx * 23 + 57);
          const x = gx + rng() * cell, z = gz + rng() * cell, roll = rng();
          const sdf = sdfAt(x, z);
          const wl = wetlandAt(x, z);
          const marsh = wl >= 2 && sdf > 4;   // real marsh / pond / shrub swamp away from the reservoir
          if (!marsh && (sdf < -2.5 || sdf > 8)) continue;
          if (!inBounds(x, z)) continue;
          const y = groundY(x, z);
          if (!marsh && (y < LEVEL - 0.45 || y > LEVEL + 0.8)) continue;
          const patch = fbm(x * 0.05, z * 0.05, 2, 87);
          if (marsh) { if (roll > (wl === 2 ? 0.25 : 0.7)) continue; }
          else if (roll > 0.12 + 0.75 * smoothstep(0.5, 0.65, patch)) continue;
          if (this._blocked(x, z, 0.5)) continue;
          if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r * 1.05) continue;
          if (Math.hypot(x - RAMP.x, z - RAMP.z) < RAMP.r * 1.2) continue;
          if (z < DAM_Z + 14) continue;
          const col = REED_COLORS[Math.floor(rng() * REED_COLORS.length)].clone().multiplyScalar(0.85 + rng() * 0.3);
          mkItem('reeds', x, z, 0.8 + rng() * 0.7, rng() * 6.28, col, -0.05);
        }
      }
    }
  }

  _genWalls(ch, push) {
    const inChunk = (x, z) => x >= ch.x0 && x < ch.x0 + CHUNK && z >= ch.z0 && z < ch.z0 + CHUNK;
    const spacing = 0.62;
    this.walls.forEach((w, wi) => {
      let gIdx = 0;
      for (let i = 0; i < w.length - 1; i++) {
        const a = w[i], b = w[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        const n = Math.floor(len / spacing);
        const ang = Math.atan2(dz, dx);
        for (let k = 0; k < n; k++) {
          const si = gIdx++;
          const px = a.x + (dx / len) * k * spacing, pz = a.z + (dz / len) * k * spacing;
          if (!inChunk(px, pz)) continue;
          if (trailDistAt(px, pz) < 2.4 || sdfAt(px, pz) < 18 || onDam(px, pz) || gravelAt(px, pz) < 3) continue;
          const rng = mulberry32(wi * 100003 + si * 31 + 7);
          const base = groundY(px, pz);
          const layers = [0.2, 0.55, 0.88];
          for (let l = 0; l < 3; l++) {
            if (l === 2 && rng() < 0.4) continue;
            const off = (rng() - 0.5) * 0.3;
            const x = px - Math.sin(ang) * off, z = pz + Math.cos(ang) * off;
            const sc = (l === 2 ? 0.7 : 0.95) * (0.85 + rng() * 0.45);
            const m = new THREE.Matrix4().compose(
              new THREE.Vector3(x, base + layers[l] - 0.12, z),
              new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - 0.5) * 0.2, ang + (rng() - 0.5) * 0.7, (rng() - 0.5) * 0.2, 'YXZ')),
              new THREE.Vector3(sc * 1.15, sc, sc));
            const col = STONE_COLORS[Math.floor(rng() * STONE_COLORS.length)].clone().multiplyScalar(0.88 + rng() * 0.25);
            push(`stone:${Math.floor(rng() * 3)}`, m, col);
          }
          if (si % 2 === 0) {
            const c = this.colliders.add(px, pz, 0.62, { h: 0.95, tag: 'wall' });
            ch.colliders.push(c);
          }
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // trees: matrices, chopping, felling
  // -------------------------------------------------------------------------
  treeMatrix(t, shakeQ) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(t.lx, t.yaw, t.lz, 'YXZ'));
    if (shakeQ) q.premultiply(shakeQ);
    m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.sx, t.sy, t.sx));
    return m;
  }

  findTarget(px, pz, dirx, dirz, reach = 3.4) {
    let best = null, bestScore = Infinity;
    const [ccx, ccz] = this.chunkAt(px, pz);
    for (let cz = ccz - 1; cz <= ccz + 1; cz++) {
      for (let cx = ccx - 1; cx <= ccx + 1; cx++) {
        const ch = this.chunks.get(this.keyOf(cx, cz));
        if (!ch) continue;
        for (const t of ch.trees) {
          if (!t.alive) continue;
          const dx = t.x - px, dz = t.z - pz;
          const d = Math.hypot(dx, dz);
          if (d > reach + t.radius) continue;
          const dot = (dx * dirx + dz * dirz) / (d || 1);
          const cone = Math.min(0.97, 0.7 + (t.radius / Math.max(d, 0.5)) * 0.35);
          if (dot < cone - 0.1) continue;
          const score = d - dot * 2;
          if (score < bestScore) { bestScore = score; best = t; }
        }
      }
    }
    return best;
  }

  hit(tree, fromX, fromZ) {
    tree.hp--;
    tree.shake = { t: 0, amp: 0.05 + 0.03 * ((tree.maxHp - tree.hp) / tree.maxHp), dx: tree.x - fromX, dz: tree.z - fromZ };
    if (!this.shaking.includes(tree)) this.shaking.push(tree);
    if (tree.hp <= 0) { this.fell(tree, fromX, fromZ); return true; }
    return false;
  }

  _addStump(ch, rec) {
    if (ch.stumps.count >= ch.stumps.instanceMatrix.count) return;
    const i = ch.stumps.count++;
    ch.stumpsOl.count = ch.stumps.count;
    const r = Math.max(0.22, rec.radius * 0.98);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(rec.x, groundY(rec.x, rec.z) - 0.05, rec.z),
      new THREE.Quaternion().setFromAxisAngle(UP, rec.yaw),
      new THREE.Vector3(r, 0.8 + (rec.sx - 0.78) * 0.5, r));
    ch.stumps.setMatrixAt(i, m);
    ch.stumps.instanceMatrix.needsUpdate = true;
  }

  fell(tree, fromX, fromZ) {
    const ch = tree.chunk;
    tree.alive = false;
    this.colliders.remove(tree.collider);
    this.felledCount++;
    this.shaking = this.shaking.filter((t) => t !== tree);
    tree.item.batch.remove(tree.item);

    const rec = { x: tree.x, z: tree.z, radius: tree.radius, yaw: tree.yaw, sx: tree.sx };
    this.felled.set(tree.id, rec);
    const key = ch.key;
    if (!this.felledByChunk.has(key)) this.felledByChunk.set(key, []);
    this.felledByChunk.get(key).push(rec);
    this._addStump(ch, rec);

    // a falling, non-instanced copy
    const fillMat = fillMaterial({ sway: false });
    fillMat.userData.uTreeColor.value.copy(tree.color);
    const olMat = outlineMaterial({ sway: false });
    olMat.userData.uTreeColor.value.copy(tree.color);
    const pivot = new THREE.Group();
    pivot.position.set(tree.x, tree.y, tree.z);
    const inner = new THREE.Group();
    inner.quaternion.setFromEuler(new THREE.Euler(tree.lx, tree.yaw, tree.lz, 'YXZ'));
    inner.scale.set(tree.sx, tree.sy, tree.sx);
    const fill = new THREE.Mesh(tree.geo.geo, fillMat);
    fill.castShadow = true; fill.receiveShadow = true;
    inner.add(fill, new THREE.Mesh(tree.geo.geo, olMat));
    pivot.add(inner);
    this.fallen.add(pivot);
    // keep the number of lying trees bounded
    if (this.fallen.children.length > 260) {
      const old = this.fallen.children[0];
      this.fallen.remove(old);
    }

    let fx = tree.x - fromX, fz = tree.z - fromZ;
    const l = Math.hypot(fx, fz) || 1;
    fx /= l; fz /= l;
    const a = (Math.random() - 0.5) * 0.35;
    const dx = fx * Math.cos(a) - fz * Math.sin(a), dz = fx * Math.sin(a) + fz * Math.cos(a);
    this.fallers.push({
      tree, pivot, axis: new THREE.Vector3(dz, 0, -dx).normalize(),
      angle: 0, vel: 0.12, state: 'fall', t: 0, H: tree.H, bv: 0, landAngle: 0,
    });
  }

  _updateDynamics(dt, cam, audioHooks) {
    for (let i = this.shaking.length - 1; i >= 0; i--) {
      const t = this.shaking[i];
      const s = t.shake;
      s.t += dt;
      const life = 0.7;
      let q = null;
      if (s.t >= life) this.shaking.splice(i, 1);
      else {
        const k = 1 - s.t / life;
        const ang = Math.sin(s.t * 38) * s.amp * k * k;
        const d = Math.hypot(s.dx, s.dz) || 1;
        q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(s.dz / d, 0, -s.dx / d), ang);
      }
      t.item.batch.setMatrix(t.item, this.treeMatrix(t, q));
    }

    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i];
      f.t += dt;
      if (f.state === 'fall') {
        f.vel += (3.4 * Math.sin(Math.max(f.angle, 0.05)) + 0.15) * dt;
        f.angle += f.vel * dt;
        const top = new THREE.Vector3(0, f.H * 0.92, 0).applyAxisAngle(f.axis, f.angle);
        const gx = f.pivot.position.x + top.x, gz = f.pivot.position.z + top.z;
        const gy = groundY(gx, gz) + f.tree.radius * 0.6;
        if (f.pivot.position.y + top.y <= gy || f.angle > 1.52) {
          f.state = 'bounce';
          f.landAngle = f.angle;
          f.bv = -f.vel * 0.22;
          f.t = 0;
          if (audioHooks?.land) audioHooks.land(f.pivot.position, f.H, gx, gz, gy);
          if (this.onLand) this.onLand(f, gx, gz, gy);
        }
      } else if (f.state === 'bounce') {
        f.bv += (f.landAngle - f.angle) * 90 * dt;
        f.bv *= Math.pow(0.02, dt);
        f.angle += f.bv * dt;
        if (f.t > 0.9) { f.angle = f.landAngle; f.state = 'done'; }
      }
      f.pivot.quaternion.setFromAxisAngle(f.axis, f.angle);
      if (f.state === 'done') this.fallers.splice(i, 1);
    }
    // hide lying trees that are far away
    for (const p of this.fallen.children) {
      p.visible = Math.hypot(p.position.x - cam.x, p.position.z - cam.z) < 220;
    }
  }

  get loadedChunks() { return this.chunks.size; }
  get treeCount() { let n = 0; for (const c of this.chunks.values()) n += c.trees.length; return n; }
}
