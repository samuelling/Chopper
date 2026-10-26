// Winter only: a world-sized painted mask of trampled snow.  Walking stamps soft discs into it; the terrain shader
// turns the mask into a crisp, cel-edged band of compacted, bluish snow with bits of dark earth showing through.
import * as THREE from 'three';
import { WORLD } from './ashland.js';
import { smoothstep } from './noise.js';

const N = 2048;
export const trailUniforms = {
  uTrail: { value: null },
  uTrailInfo: { value: new THREE.Vector4(WORLD.minX, WORLD.minZ, WORLD.maxX - WORLD.minX, WORLD.maxZ - WORLD.minZ) },
};

export class SnowTrail {
  constructor() {
    this.cpu = new Uint8Array(N * N);
    this.tex = new THREE.DataTexture(this.cpu, N, N, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;
    trailUniforms.uTrail.value = this.tex;
    this.W = WORLD.maxX - WORLD.minX; this.H = WORLD.maxZ - WORLD.minZ;
    this.last = null; this.dirty = false; this.timer = 0; this.side = 1;
  }
  _stamp(x, z, r) {
    const sx = N / this.W, sz = N / this.H;
    const i0 = Math.max(0, Math.floor((x - r - WORLD.minX) * sx)), i1 = Math.min(N - 1, Math.ceil((x + r - WORLD.minX) * sx));
    const j0 = Math.max(0, Math.floor((z - r - WORLD.minZ) * sz)), j1 = Math.min(N - 1, Math.ceil((z + r - WORLD.minZ) * sz));
    for (let j = j0; j <= j1; j++) {
      const wz = WORLD.minZ + (j + 0.5) / sz;
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(WORLD.minX + (i + 0.5) / sx - x, wz - z) / r;
        if (d >= 1) continue;
        const v = (1 - smoothstep(0.35, 1, d)) * 255;
        const k = j * N + i;
        if (v > this.cpu[k]) this.cpu[k] = v;
      }
    }
    this.dirty = true;
  }
  /** call every frame: stamps along the path walked, only on dry ground */
  update(dt, pos, onSnow) {
    if (onSnow) {
      if (!this.last) this.last = { x: pos.x, z: pos.z };
      const dx = pos.x - this.last.x, dz = pos.z - this.last.z, d = Math.hypot(dx, dz);
      if (d > 0.35) {
        const steps = Math.min(8, Math.ceil(d / 0.35));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          this._stamp(this.last.x + dx * t, this.last.z + dz * t, 0.55);
        }
        this.last.x = pos.x; this.last.z = pos.z;
      }
    } else this.last = null;
    this.timer += dt;
    if (this.dirty && this.timer > 0.12) { this.tex.needsUpdate = true; this.dirty = false; this.timer = 0; }
  }
}
