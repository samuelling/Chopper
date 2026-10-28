// Binoculars: in the Q kit from the start.  Click raises them (a narrow view through two round lenses), click again or
// Q lowers them.  Good for birds across the water, and for finding where smoke is coming from.
import * as THREE from 'three';
import { simpleToon } from './toon.js';

export class Binoculars {
  constructor(camera, player) {
    this.camera = camera; this.player = player; this.up = false; this.k = 0;
    const g = new THREE.Group(), body = simpleToon('#2a2a2e'), rub = simpleToon('#17171a'), glass = simpleToon('#4a6a8a'), ol = simpleToon('#0e0e10', { side: THREE.BackSide });
    const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); const o = new THREE.Mesh(geo, ol); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.setScalar(1.1); g.add(o); return m; };
    for (const sx of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.024, 0.026, 0.11, 12), body, sx * 0.034, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.027, 0.027, 0.03, 12), rub, sx * 0.034, 0, -0.045, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 12), glass, sx * 0.034, 0, -0.061, Math.PI / 2);
    }
    add(new THREE.BoxGeometry(0.04, 0.016, 0.05), body, 0, 0.01, 0.01);
    g.traverse((o) => { o.frustumCulled = false; }); g.visible = false; camera.add(g); this.model = g;
    // the view through them: two overlapping round windows, the rest dark
    const el = document.createElement('div'); el.id = 'binoview'; el.className = 'hidden';
    el.innerHTML = `<svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 160 90"><defs><mask id="bmask"><rect width="160" height="90" fill="white"/><circle cx="62" cy="45" r="37" fill="black"/><circle cx="98" cy="45" r="37" fill="black"/></mask></defs><rect width="160" height="90" fill="#050506" mask="url(#bmask)"/></svg><div class="bhint"></div>`;
    document.body.appendChild(el); this.el = el;
  }
  /** shown in hand (carry 'binoculars') */
  show(on) { this.model.visible = on && this.k < 0.95; if (!on && this.up) this.lower(); }
  raise() { if (this.up) return; this.up = true; }
  lower() { if (!this.up) return; this.up = false; }
  toggle() { this.up ? this.lower() : this.raise(); }
  hint(t) { this.el.querySelector('.bhint').textContent = t || ''; }
  update(dt, normalFov) {
    const want = this.up ? 1 : 0; this.k += Math.max(-dt / 0.25, Math.min(dt / 0.3, want - this.k));
    const e = this.k * this.k * (3 - 2 * this.k);
    this.model.position.set(0.18 * (1 - e), -0.22 * (1 - e) - 0.02 * e, -0.42 + 0.3 * e); this.model.rotation.set(-0.5 * (1 - e), -0.3 * (1 - e), 0);
    const on = this.k > 0.9; this.el.classList.toggle('hidden', !on); document.body.classList.toggle('binos', on);
    if (this.up || this.k > 0) { const fov = on ? 13 : normalFov; if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); } }
    this.player.lookScale = on ? 13 / normalFov : 1;            // slower look when zoomed in
    this.looking = on;
  }
}
