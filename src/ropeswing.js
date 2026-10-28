// The rope swing: grab the rope on the bank (E / Use), and you swing out over the water.  Let go (Space / Hop, or the
// action button) near the far end of the swing to fly, and land with a splash.  Hang on and you swing back and forth,
// lower each time, until you drop off.  Not in winter: the water is frozen (or far too cold).
import * as THREE from 'three';
import { groundY, waterDepthAt, lake } from './world.js';
import { ropeGeom } from './hidden.js';
import { IS_WINTER } from './season.js';

const G = 9.8;
export class RopeSwing {
  constructor(scene, item) {
    this.item = item; this.state = 'idle';
    if (!item?.out) { this.geo = null; return; }
    this.geo = ropeGeom(item.x, item.y, item.z, item.out);
    const g = this.geo;
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), new THREE.MeshToonMaterial({ color: '#c8b48a' })); this.rope.frustumCulled = false; scene.add(this.rope);
    this.stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6), new THREE.MeshToonMaterial({ color: '#7a5a3a' })); this.stick.rotation.z = Math.PI / 2; this.rope.add(this.stick);
    this.theta = 0; this.omega = 0; this.rest = 0;
    this.grab = { x: g.hx - g.ox * (g.len * Math.sin(0.85)), z: g.hz - g.oz * (g.len * Math.sin(0.85)) };   // where you take hold, up the bank
    this._place(0);
  }
  _end(theta) { const g = this.geo; return new THREE.Vector3(g.hx + g.ox * Math.sin(theta) * g.len, g.hy - Math.cos(theta) * g.len, g.hz + g.oz * Math.sin(theta) * g.len); }
  _place(theta) {
    const g = this.geo, e = this._end(theta), mid = new THREE.Vector3(g.hx, g.hy, g.hz).add(e).multiplyScalar(0.5);
    this.rope.position.copy(mid); this.rope.scale.set(1, g.len, 1);
    this.rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.hx, g.hy, g.hz).sub(e).normalize());
    this.stick.position.set(0, -0.5, 0); this.stick.scale.set(1, 1 / g.len, 1);
  }
  near(p) { return this.geo && this.state === 'idle' && Math.hypot(p.x - this.grab.x, p.z - this.grab.z) < 2.6 ? true : false; }
  /** take hold: returns false (with a reason) when you cannot */
  start(player) {
    if (!this.geo) return false;
    if (IS_WINTER) return 'winter';
    if (lake.level < lake.originalLevel - 1.2) return 'low';
    this.state = 'swing'; this.theta = -0.85; this.omega = 0; this.player = player; this.t = 0; this.peak = 0;
    player.yaw = Math.atan2(-this.geo.ox, -this.geo.oz); player.pitch = -0.1; player.sitting = false;
    player.ropeCtl = (dt) => this._step(dt);
    return true;
  }
  /** let go */
  release() {
    if (this.state !== 'swing') return;
    const g = this.geo, v = this.omega * g.len;   // tangential speed
    this.vel = new THREE.Vector3(g.ox * Math.cos(this.theta) * v, Math.sin(this.theta) * v, g.oz * Math.cos(this.theta) * v);
    this.pos = this._end(this.theta).add(new THREE.Vector3(0, -1.9, 0)); this.state = 'fly'; this.air = 0;
  }
  _step(dt) {
    const p = this.player, g = this.geo; this.t += dt;
    if (this.state === 'swing') {
      this.omega += (-G / g.len) * Math.sin(this.theta) * dt; this.omega *= 1 - 0.06 * dt; this.theta += this.omega * dt;
      this.peak = Math.max(this.peak, this.theta);
      const e = this._end(this.theta); p.pos.set(e.x, e.y - 1.9, e.z); p.vy = 0; p.onGround = false;
      if (this.t > 9 && Math.abs(this.omega) < 0.25) this.release();   // tired arms: you drop
    } else if (this.state === 'fly') {
      this.air += dt; this.vel.y -= G * dt; this.pos.addScaledVector(this.vel, dt); p.pos.copy(this.pos);
      const gy = groundY(this.pos.x, this.pos.z), wet = waterDepthAt(this.pos.x, this.pos.z) > 0.3;
      if (wet && this.pos.y <= Math.max(gy, lake.level - 1.0)) { this.state = 'idle'; p.ropeCtl = null; p.vy = Math.min(-2, this.vel.y); p.pos.y = lake.level - 1.0; this.onSplash?.(this.air, Math.hypot(this.pos.x - g.hx, this.pos.z - g.hz)); }
      else if (!wet && this.pos.y <= gy) { this.state = 'idle'; p.ropeCtl = null; p.pos.y = gy; p.vy = 0; this.onLand?.(); }
    }
    if (this.state === 'swing') this._place(this.theta);
    else { this.theta *= 0.9; this._place(this.theta); }
  }
  update(dt) { if (this.geo && this.state === 'idle') { this.theta += (0 - this.theta) * Math.min(1, dt * 0.8); this._place(this.theta + Math.sin(performance.now() / 1300) * 0.03); } }
}
