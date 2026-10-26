import * as THREE from 'three';

// Small pooled particles: wood chips, leaf bursts, drifting leaves, splashes.
export class FX {
  constructor(scene, max = 900) {
    this.max = max;
    const geo = new THREE.OctahedronGeometry(0.5, 0);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ fog: true }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, g: 1, spin: 0, rot: 0, drag: 0 });
    this.next = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.sv = new THREE.Vector3();
    this.c = new THREE.Color();
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, z);
  }
  spawn(x, y, z, vx, vy, vz, life, size, color, g = 9, drag = 0.5) {
    const p = this.p[this.next];
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    Object.assign(p, { life, max: life, x, y, z, vx, vy, vz, s: size, g, spin: (Math.random() - 0.5) * 12, rot: Math.random() * 6, drag });
    this.c.set(color);
    this.mesh.setColorAt(i, this.c);
    this.mesh.instanceColor.needsUpdate = true;
  }
  chips(x, y, z, dx, dz, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 3;
      this.spawn(x, y, z, -dx * 2 + Math.cos(a) * sp, 1.5 + Math.random() * 3, -dz * 2 + Math.sin(a) * sp, 0.7 + Math.random() * 0.4, 0.07 + Math.random() * 0.07, Math.random() < 0.5 ? '#d9b583' : '#8b6642', 11, 0.3);
    }
  }
  leaves(x, y, z, n = 24, spread = 2, up = 1) {
    const cols = ['#d4341c', '#e8721c', '#f2b229', '#a42a2c', '#c8801c'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = Math.random() * spread;
      this.spawn(x + Math.cos(a) * sp * 0.4, y + Math.random() * 1.5, z + Math.sin(a) * sp * 0.4, Math.cos(a) * sp, up * (1 + Math.random() * 3), Math.sin(a) * sp, 2.5 + Math.random() * 2.2, 0.16 + Math.random() * 0.1, cols[(Math.random() * cols.length) | 0], 1.1, 1.6);
    }
  }
  splash(x, y, z, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = 0.8 + Math.random() * 2;
      this.spawn(x, y, z, Math.cos(a) * sp, 2 + Math.random() * 2.5, Math.sin(a) * sp, 0.6 + Math.random() * 0.3, 0.08 + Math.random() * 0.05, '#dceae6', 11, 0.2);
    }
  }
  update(dt) {
    const m = this.m;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; if (p.g < 3) p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
      let s = p.s * Math.min(1, p.life * 3);
      if (p.life <= 0) s = 0;
      this.e.set(p.rot, p.rot * 0.7, p.rot * 0.4);
      this.q.setFromEuler(this.e);
      m.compose(this.v.set(p.x, p.y, p.z), this.q, this.sv.set(s, s * 0.3, s));
      this.mesh.setMatrixAt(i, m);
    }
    if (any || this._dirty) this.mesh.instanceMatrix.needsUpdate = true;
    this._dirty = any;
  }
}
