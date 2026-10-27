import * as THREE from 'three';
import { groundY, sdfAt, waterDepthAt, lake, WORLD, trailDistAt } from './world.js';
import { simpleToon } from './toon.js';
import { clamp } from './noise.js';

const EYE = 1.7, RADIUS = 0.38, WADE_MAX = 1.15, PLAY_SDF = 175;

export class Player {
  constructor(camera, colliders, dom) {
    this.camera = camera;
    this.colliders = colliders;
    this.pos = new THREE.Vector3();
    this.vy = 0;
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.keys = {};
    this.touch = { x: 0, y: 0 };      // virtual joystick, -1..1 (y down is positive)
    this.locked = false;
    this.stepDist = 0;
    this.wasWet = false;
    this.swing = 0;           // 0 = idle, else 0..1 swing progress
    this.swingStruck = false;
    this.bob = 0;
    this.speed = 0;
    this.events = { step: null, swing: null, strike: null, jump: null, splash: null, interact: null };
    this._buildAxe();
    this._buildPhone();
    this.sitting = false; this.sit = 0; this.stillT = 0; this.boat = null; this.mouseDown = false; this.inputLock = false; this.camOff = new THREE.Vector3();
    this.carry = 'none'; this.raise = 0; this.raiseTo = 0; this.refreshCarry();

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'Space' && this.locked && !this.boat) { this.sitting = false; this._jump(); }
      if (e.code === 'KeyE' && this.locked) this.events.interact?.();
      if (e.code === 'KeyB' && this.locked && !this.cameraMode && !this.boat) this.sitting = !this.sitting && waterDepthAt(this.pos.x, this.pos.z) < 0.2;
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = clamp(this.pitch - e.movementY * 0.0022, -1.45, 1.45);
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.locked) this.mouseDown = true;
      if (this.locked && e.button === 0) { if (this.cameraMode) this.events.photo?.(); else if (this.carry === 'rod') this.events.cast?.(); else if (this.carry === 'axe' && !this.boat) this.startSwing(); }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom; if (!this.locked) this.mouseDown = false;
      this.onLockChange?.(this.locked);
    });
  }

  _buildAxe() {
    const g = new THREE.Group();
    const wood = simpleToon('#8a5a32'), steel = simpleToon('#9aa3a8'), dark = simpleToon('#3a2a1e');
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.82, 6), wood);
    handle.position.y = 0.2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.22), steel);
    head.position.set(0, 0.55, -0.09);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.04), steel);
    edge.position.set(0, 0.55, -0.22);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.22, 6), dark);
    grip.position.y = -0.1;
    g.add(handle, head, edge, grip);
    // outlines: dark back-face shells
    const ol = simpleToon('#2a1f24', { side: THREE.BackSide });
    for (const m of [handle, head, edge, grip]) {
      const o = new THREE.Mesh(m.geometry, ol); o.position.copy(m.position); o.scale.setScalar(1.18); g.add(o);
    }
    g.traverse((o) => { o.frustumCulled = false; });
    g.scale.setScalar(0.62);
    this.axe = g;
    this.camera.add(g);
  }

  _buildPhone() {
    const rr = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
    const g = new THREE.Group(), W = 0.074, H = 0.152, T = 0.0085;
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(rr(W, H, 0.012), { depth: T, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0016, bevelSegments: 2 }), simpleToon('#8d8a94'));
    frame.position.z = -T / 2;
    const back = new THREE.Mesh(new THREE.ExtrudeGeometry(rr(W - 0.002, H - 0.002, 0.011), { depth: 0.0006, bevelEnabled: false }), simpleToon('#37333f'));
    back.position.z = -T / 2 - 0.0026;
    const lump = new THREE.Mesh(new THREE.ExtrudeGeometry(rr(0.03, 0.03, 0.007), { depth: 0.003, bevelEnabled: false }), simpleToon('#2a2630'));
    lump.position.set(-0.017, 0.049, -T / 2 - 0.0056);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 10), simpleToon('#0b0a0d')); lens.rotation.x = Math.PI / 2; lens.position.set(-0.023, 0.055, -T / 2 - 0.0082);
    const lens2 = lens.clone(); lens2.position.set(-0.011, 0.043, -T / 2 - 0.0082);
    const glass = new THREE.Mesh(new THREE.ExtrudeGeometry(rr(W - 0.006, H - 0.006, 0.009), { depth: 0.0004, bevelEnabled: false }), simpleToon('#0a090c'));
    glass.position.z = T / 2 + 0.0017;
    const olm = simpleToon('#1a1820', { side: THREE.BackSide });
    const ol = new THREE.Mesh(frame.geometry, olm); ol.position.copy(frame.position); ol.scale.set(1.07, 1.035, 1.5);
    this.screenCv = document.createElement('canvas'); this.screenCv.width = 240; this.screenCv.height = 490;
    this.screenTex = new THREE.CanvasTexture(this.screenCv); this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.0085, H - 0.0085), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
    scr.position.z = T / 2 + 0.0023;
    g.add(ol, frame, back, lump, lens, lens2, glass, scr);
    g.traverse((o) => { o.frustumCulled = false; });
    this.phone = g; this.camera.add(g);
  }
  refreshCarry() {
    const hide = this.cameraMode || this.carryHidden;
    this.axe.visible = this.carry === 'axe' && !hide;
    this.phone.visible = this.carry === 'phone' && !hide;   // carry 'none' = hands in pockets
  }
  setCarry(c) { this.carry = c; this.raiseTo = 0; this.refreshCarry(); }
  look(dx, dy) { this.yaw -= dx; this.pitch = clamp(this.pitch - dy, -1.45, 1.45); }

  teleport(x, z, yaw = this.yaw, pitch = 0) {
    this.pos.set(x, groundY(x, z), z);
    this.yaw = yaw; this.pitch = pitch; this.vy = 0;
  }

  _jump() {
    if (!this.onGround) return;
    this.vy = 5.0; this.onGround = false;
    this.events.jump?.();
  }

  startSwing() {
    if (this.swing > 0) return;
    if (this.carry !== 'axe') this.setCarry('axe');
    this.swing = 0.0001; this.swingStruck = false;
    this.events.swing?.();
  }

  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  _blockedAt(x, z) {
    if (sdfAt(x, z) > PLAY_SDF) return true;
    if (x < WORLD.minX + 12 || x > WORLD.maxX - 12 || z < WORLD.minZ + 12 || z > WORLD.maxZ - 12) return true;
    if (waterDepthAt(x, z) > WADE_MAX && groundY(x, z) < this.pos.y + 0.2) return true;
    return false;
  }

  /** rowing: the boat carries you; the camera sits low in it, and the view turns with the bow */
  _ride(dt) {
    const k = this.keys, b = this.boat, on = this.locked && !this.inputLock;
    b.input.row = on ? (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) : 0;
    b.input.turn = on ? (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) : 0;
    const seat = b.seatWorld();
    this.pos.set(seat.x, b.root.position.y - 0.08, seat.z);
    this.yaw += b.dh; this.vx = this.vz = 0; this.speed = Math.abs(b.v); this.onGround = true; this.vy = 0; this.sitting = false; this.bob = 0;
    this.sit += (0.55 - this.sit) * Math.min(1, dt * 3);
    this.stillT = this.speed < 0.3 ? this.stillT + dt : 0;
    this.raise += (this.raiseTo - this.raise) * Math.min(1, dt * 9);
    this._applyCamera(dt);
  }

  update(dt) {
    if (this.boat) { this._ride(dt); return; }
    const k = this.keys;
    let fx = 0, fz = 0;
    if (this.locked) {
      fz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      fx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    }
    if (this.locked && (this.touch.x || this.touch.y)) { fx += this.touch.x; fz -= this.touch.y; }
    if (this.inputLock) { fx = 0; fz = 0; }
    if (this.sitting && (fx || fz)) this.sitting = false;          // any step stands you up
    this.sit += ((this.sitting ? 1 : 0) - this.sit) * Math.min(1, dt * 3.2);
    if (this.sit > 0.05) { fx = 0; fz = 0; }
    const sprint = k.ShiftLeft || k.ShiftRight || Math.hypot(this.touch.x, this.touch.y) > 0.92;
    const depth = waterDepthAt(this.pos.x, this.pos.z);
    let sp = (sprint ? 6.2 : 3.6) * (depth > 0.2 ? 1 - Math.min(0.5, depth * 0.4) : 1);
    const len = Math.hypot(fx, fz) || 1;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    // forward = (-sin, -cos), right = (cos, -sin)
    const mag = Math.min(1, len);
    let vx = (-sy * fz + cy * fx) / len * sp * mag;
    let vz = (-cy * fz - sy * fx) / len * sp * mag;
    if (!fx && !fz) { vx = 0; vz = 0; }
    // slight smoothing
    this.vx = (this.vx ?? 0) + (vx - (this.vx ?? 0)) * Math.min(1, dt * 12);
    this.vz = (this.vz ?? 0) + (vz - (this.vz ?? 0)) * Math.min(1, dt * 12);

    let nx = this.pos.x + this.vx * dt, nz = this.pos.z + this.vz * dt;
    // axis-separated boundary checks so we slide along limits
    if (this._blockedAt(nx, this.pos.z)) nx = this.pos.x;
    if (this._blockedAt(nx, nz)) nz = this.pos.z;
    // circle colliders
    for (let it = 0; it < 2; it++) {
      this.colliders.query(nx, nz, RADIUS + 3, (c) => {
        if (this.pos.y > groundY(c.x, c.z) + c.h - 0.05) return;
        const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), min = c.r + RADIUS;
        if (d < min) { const m = d || 1e-4; nx = c.x + dx / m * min; nz = c.z + dz / m * min; }
      });
    }
    const moved = Math.hypot(nx - this.pos.x, nz - this.pos.z);
    this.pos.x = nx; this.pos.z = nz;
    this.speed = moved / Math.max(dt, 1e-4);

    // vertical
    const gy = groundY(nx, nz);
    if (!this.onGround || this.pos.y > gy + 0.02) {
      this.vy -= 14 * dt;
      this.pos.y += this.vy * dt;
    }
    if (this.pos.y <= gy) {
      // step up/down gently when walking
      this.pos.y = this.onGround ? this.pos.y + (gy - this.pos.y) * Math.min(1, dt * 18) : gy;
      if (!this.onGround) { this.vy = 0; this.onGround = true; if (depth > 0.1) this.events.splash?.(); }
      else if (Math.abs(this.pos.y - gy) < 0.01) this.pos.y = gy;
      this.onGround = true; this.vy = Math.max(this.vy, 0);
    } else if (this.pos.y > gy + 0.12 && this.vy !== 0) this.onGround = false;
    else if (this.pos.y > gy + 0.12) this.onGround = false;

    // splash on entering water
    const wet = depth > 0.25;
    if (wet && !this.wasWet) this.events.splash?.();
    this.wasWet = wet;

    // footsteps + head bob
    if (this.onGround && this.speed > 0.5) {
      this.stepDist += moved;
      this.bob += moved * 2.2;
      const stride = sprint ? 2.0 : 1.55;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        const kind = wet ? 'water' : (this.surfaceAt ? this.surfaceAt(this.pos.x, this.pos.z) : 'grass');
        this.events.step?.(kind, sprint ? 1.35 : 1);
      }
    } else this.bob *= 0.9;

    this.stillT = this.speed < 0.4 ? this.stillT + dt : 0;
    this.raise += (this.raiseTo - this.raise) * Math.min(1, dt * 9);
    // axe swing
    if (this.swing > 0) {
      this.swing += dt / 0.52;
      if (!this.swingStruck && this.swing >= 0.42) { this.swingStruck = true; this.events.strike?.(); }
      if (this.swing >= 1) this.swing = 0;
    }
    this._applyCamera(dt);
  }

  /** after a sudden move (into or out of the boat) glide the view from where it was instead of jumping */
  blendFrom(prev) { this.update(0.0001); this.camOff.copy(prev).sub(this.camera.position); this._applyCamera(0); }

  _applyCamera(dt = 0) {
    const c = this.camera;
    if (dt > 0) this.camOff.multiplyScalar(Math.exp(-dt * 6));
    const bobY = Math.sin(this.bob) * 0.035 * Math.min(1, this.speed / 3.6);
    const bobX = Math.cos(this.bob * 0.5) * 0.02 * Math.min(1, this.speed / 3.6);
    c.position.set(this.pos.x, this.pos.y + EYE - this.sit * 0.95 + bobY, this.pos.z);
    c.position.add(this.camOff); c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    // axe pose: rest -> windup -> strike
    const s = this.swing;
    let rx = 0.35, ry = 0.0, rz = -0.15, px = 0.36 + bobX, py = -0.42 + bobY * 0.5, pz = -0.6;
    if (s > 0) {
      const wind = s < 0.42 ? Math.sin((s / 0.42) * Math.PI * 0.5) : 1;
      const back = s < 0.42 ? wind : 1 - Math.min(1, (s - 0.42) / 0.12);
      const hitp = s < 0.42 ? 0 : Math.min(1, (s - 0.42) / 0.12) * (1 - Math.max(0, (s - 0.62) / 0.38));
      rx = 0.35 + 0.9 * back * (s < 0.42 ? 1 : 0) - 2.0 * hitp;
      rz = -0.15 - 0.4 * hitp;
      py = -0.42 + 0.2 * (s < 0.42 ? wind : 0) - 0.1 * hitp;
      px = 0.34 - 0.1 * hitp; pz = -0.6 - 0.1 * hitp;
    }
    this.axe.position.set(px, py, pz);
    this.axe.rotation.set(rx, ry, rz);
    // phone: low in the right corner, screen tipped toward you; raised, it fills the middle of the view
    const k = this.raise, e = k * k * (3 - 2 * k), sway = Math.sin(this.bob * 0.5) * 0.003 * Math.min(1, this.speed / 3.6);
    this.phone.position.set(0.25 * (1 - e) + sway, -0.23 * (1 - e) - 0.01 * e, -0.46 + 0.2 * e);
    this.phone.rotation.set(-0.55 * (1 - e) + 0.0 * e, -0.38 * (1 - e), 0.18 * (1 - e));
  }
}
