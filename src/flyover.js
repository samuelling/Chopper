// A slow drone flight over the reservoir and its forests, used as the living backdrop of the title and season cards.
// The route follows the real lake's centre line, up one side and back the other, so the shoreline, islands and ridges all drift past.
import * as THREE from 'three';
import { lakeSdf, LAKE_BOX, DAM_Z } from './ashland.js';
import { groundY, LEVEL } from './world.js';

export class Flyover {
  constructor(camera, player) {
    this.camera = camera; this.player = player; this.active = false; this.t = Math.random(); this.speed = 13;   // metres per second
    const mid = [];
    for (let z = DAM_Z + 150; z < LAKE_BOX.z1 - 110; z += 80) {
      let bx = 0, bs = 1e9;
      for (let x = LAKE_BOX.x0; x < LAKE_BOX.x1; x += 6) { const s = lakeSdf(x, z); if (s < bs) { bs = s; bx = x; } }
      mid.push([bx, z]);
    }
    const pts = [];
    const alt = (x, z) => Math.max(groundY(x, z) + 34, LEVEL + 42);
    mid.forEach(([x, z], i) => { const w = 90 + 25 * Math.sin(i * 0.9); pts.push(new THREE.Vector3(x + w, alt(x + w, z), z)); });        // north, east of centre
    for (let i = mid.length - 1; i >= 0; i--) { const [x, z] = mid[i]; const w = 100 + 25 * Math.cos(i * 0.7); pts.push(new THREE.Vector3(x - w, alt(x - w, z), z)); }  // and back, west
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.len = this.curve.getLength();
    this._p = new THREE.Vector3(); this._q = new THREE.Vector3(); this._look = new THREE.Vector3();
  }
  start() { this.active = true; if (this.player.axe) this.player.axe.visible = false; }
  stop() { this.active = false; if (this.player.axe) this.player.axe.visible = true; }
  /** leave the drone path and settle onto the player's eyes (position and view), then call done */
  glideTo(done, secs = 6) {
    this.glide = { t: 0, secs, done, from: this.camera.position.clone(), fq: this.camera.quaternion.clone() };
  }
  update(dt) {
    if (!this.active) return;
    const g = this.glide;
    if (g) {                                   // player.update has just put the camera at the player's eyes: that is the target
      const tp = this.camera.position.clone(), tq = this.camera.quaternion.clone();
      g.t += dt; const k = Math.min(1, g.t / g.secs), u = k * k * (3 - 2 * k);
      this.camera.position.lerpVectors(g.from, tp, u);
      this.camera.quaternion.copy(g.fq).slerp(tq, u);
      if (k >= 1) { this.glide = null; this.stop(); g.done?.(); }
      return;
    }
    this.t = (this.t + (this.speed * dt) / this.len) % 1;
    this.curve.getPointAt(this.t, this._p);
    this.curve.getPointAt((this.t + 70 / this.len) % 1, this._q);
    const sway = Math.sin(this.t * this.len * 0.004) * 6;
    this._p.y += sway * 0.5;
    this.camera.position.copy(this._p);
    this._look.copy(this._q); this._look.y -= 20; this._look.x += Math.sin(this.t * 40) * 6;
    this.camera.lookAt(this._look);
    this.camera.rotateZ(Math.sin(this.t * this.len * 0.006) * 0.03);   // a little drone lean
  }
}
