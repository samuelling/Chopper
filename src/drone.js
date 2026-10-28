// Drone mode, just for fun: a small camera quadcopter bought from the Park Fund.  Q until it is in your hand, then the
// action button throws it up; your phone comes up sideways, fills the screen, and you fly first-person with two sticks
// (left: climb and turn, right: fly).  It stays over the park: at the edge it says so and drifts back.  Return (Q, or the
// button) and you are back on your feet, putting the phone away.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, sdfAt, lake, WORLD } from './world.js';
import { clamp } from './noise.js';
import { RUN } from './run.js';

const H_MAX = 11, V_MAX = 4.2, YAW_RATE = 1.7, CEIL = 70, RANGE_SDF = 158, BATTERY = 180, CHARGE = 420;   // m/s, m/s, rad/s, m above ground, park edge, seconds of flight, seconds to charge from flat

/** the little quadcopter, about 30 cm across, as a group of toon parts; returns { g, props } */
function buildModel() {
  const g = new THREE.Group(), props = [];
  const shell = simpleToon('#cfd0cc'), dark = simpleToon('#3a3d42'), black = simpleToon('#121214'), ol = simpleToon('#1a1820', { side: THREE.BackSide });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, outline = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m);
    if (outline) { const o = new THREE.Mesh(geo, ol); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.setScalar(1.12); g.add(o); }
    return m;
  };
  add(new THREE.BoxGeometry(0.09, 0.045, 0.17), shell, 0, 0, 0);                      // body
  add(new THREE.BoxGeometry(0.07, 0.02, 0.12), dark, 0, 0.03, 0.01);                   // top cover
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const ax = sx * 0.11, az = sz * 0.1;
    add(new THREE.BoxGeometry(0.15, 0.014, 0.018), dark, ax / 2, 0.005, az / 2, 0, Math.atan2(-az, ax), 0);          // arm
    add(new THREE.CylinderGeometry(0.016, 0.018, 0.03, 10), dark, ax, 0.018, az);                                     // motor
    const p = new THREE.Group(); p.position.set(ax, 0.036, az); g.add(p); props.push(p);
    for (const a of [0, Math.PI]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.003, 0.016), black); b.rotation.y = a; b.position.set(Math.cos(a) * 0.03, 0, -Math.sin(a) * 0.03); p.add(b); }
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), simpleToon(sz < 0 ? '#3cff6a' : '#ff3a3a')); led.position.set(ax, -0.004, az); g.add(led);
  }
  add(new THREE.SphereGeometry(0.022, 10, 8), dark, 0, -0.028, -0.085);                                               // gimbal
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.01, 10), black, 0, -0.028, -0.103, Math.PI / 2, 0, 0, false);         // lens
  g.traverse((o) => { o.frustumCulled = false; });
  return { g, props };
}

export class Drone {
  constructor({ scene, camera, player, audio, mobile }) {
    Object.assign(this, { scene, camera, player, audio, mobile });
    this.hand = buildModel(); this.hand.g.scale.setScalar(0.85); this.hand.g.visible = false; camera.add(this.hand.g);
    this.world = buildModel(); this.world.g.visible = false; scene.add(this.world.g);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.gimbal = -0.2; this.tiltF = 0; this.tiltS = 0;
    this.state = 'off';      // off | throw | launch | fly | land
    this.spotOn = true; this.spotOwned = false;
    this.t = 0; this.keys = {};
    // the battery lasts the season (it charges overnight); after a flight it must charge back to full before it flies again
    const B = RUN.s.droneBat; this.battery = B && B.n === RUN.n ? B.v : 1; this.charging = !!(B && B.n === RUN.n && B.charging); this.stick = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
    this.onExit = null; this.onPhoto = null; this.onNote = null;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._ui();
    this._inputs();
  }
  get flying() { return this.state === 'fly' || this.state === 'launch'; }
  get active() { return this.state !== 'off'; }

  // ------------------------------------------------------------------ the phone, sideways, over the whole screen
  _ui() {
    const el = document.createElement('div'); el.id = 'dronefpv'; el.className = 'hidden';
    el.innerHTML = `<div class="dphone"><div class="dscreen">
      <div class="dtop"><span class="drec"><i></i>REC</span><span data-d="alt">ALT 0 m</span><span data-d="dist">DIST 0 m</span><span data-d="spd">0 m/s</span><span data-d="bat">▮▮▮▮ 100%</span></div>
      <div class="dwarn" data-d="warn"></div>
      <div class="dcross"><i></i><i></i></div>
      <div class="dstick L" data-stick="L"><i></i><small>climb · turn</small></div>
      <div class="dstick R" data-stick="R"><i></i><small>fly</small></div>
      <button class="dret" data-d="ret">✕ Return</button>
      <button class="dshot" data-d="shot" aria-label="Take a photo"></button>
      <button class="dsurvey" data-d="survey" hidden><b>AI spotter</b> <span data-d="spot">ON</span><small>Clyde looks for hidden things \u00b7 adds harm</small></button>
      <div class="dlocks" data-d="locks"></div>
      <div class="dmsg" data-d="msg"></div>
      <div class="dhelp">${this.mobile ? '' : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly &nbsp; <kbd>Space</kbd> <kbd>Shift</kbd> up, down &nbsp; mouse: turn, tilt &nbsp; click: photo &nbsp; <span class="hspot"><kbd>R</kbd> AI spotter &nbsp;</span><kbd>Q</kbd> return'}</div>
      <div class="dcon" data-d="con"><span>Connecting to drone…</span></div>
    </div><span class="dcam"></span></div>`;
    document.body.appendChild(el); this.el = el;
    this.$ = (k) => el.querySelector(`[data-d="${k}"]`);
    for (const ev of ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend']) el.addEventListener(ev, (e) => e.stopPropagation());
    this.$('ret').addEventListener('click', () => this.exit());
    this.$('shot').addEventListener('click', () => this._photo());
    this.$('survey').addEventListener('click', () => this.toggleSpot());
    // touch sticks (they also move to show the keyboard and mouse on a desktop)
    for (const s of el.querySelectorAll('[data-stick]')) {
      const side = s.dataset.stick; let id = null;
      const set = (e) => { const r = s.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2), l = Math.max(1, Math.hypot(x, y)); this.stick[side] = { x: x / l, y: y / l }; };
      s.addEventListener('pointerdown', (e) => { id = e.pointerId; s.setPointerCapture(id); set(e); e.preventDefault(); });
      s.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
      const up = (e) => { if (e.pointerId === id) { id = null; this.stick[side] = { x: 0, y: 0 }; } };
      s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
    }
  }
  _inputs() {
    // while the drone is up, the keyboard and mouse belong to it (caught before the walking controls see them)
    const keyEv = (down) => (e) => {
      if (this.state === 'off') return;
      if (e.code === 'Escape' || e.code === 'KeyF' || /^Digit/.test(e.code)) return;     // the menu, fullscreen and the light still work
      this.keys[e.code] = down;
      if (down && !e.repeat && e.code === 'KeyQ' && this.state === 'fly') this.exit();
      if (down && !e.repeat && e.code === 'KeyR' && this.state === 'fly') this.toggleSpot();
      e.stopImmediatePropagation(); if (e.code === 'Space') e.preventDefault();
    };
    addEventListener('keydown', keyEv(true), { capture: true }); addEventListener('keyup', keyEv(false), { capture: true });
    addEventListener('mousemove', (e) => {
      if (this.state === 'off') return; e.stopImmediatePropagation();
      if (!this.player.locked || this.state !== 'fly') return;
      this.yaw -= e.movementX * 0.0022; this.gimbal = clamp(this.gimbal - e.movementY * 0.0018, -1.45, 0.35);
    }, { capture: true });
    addEventListener('mousedown', (e) => {
      if (this.state === 'off' || e.target.closest?.('#dronefpv button, #dronefpv [data-stick]')) return;
      e.stopImmediatePropagation(); if (e.button === 0 && this.player.locked && this.state === 'fly') this._photo();
    }, { capture: true });
  }

  /** the drone in your hand (carry 'drone') */
  showHand(on) {
    const v = on && this.state === 'off'; this.hand.g.visible = v;
    if (v) { this.hand.g.position.set(0.26, -0.27, -0.62); this.hand.g.rotation.set(-0.35, 0.4, 0); }
  }
  /** the season ends (or the game does) mid-flight: everything down at once */
  forceOff() {
    if (this.state === 'off') return;
    const was = this.state !== 'throw'; if (was && this.battery < 0.999) { this.charging = true; this._saveBat(); } this.state = 'off'; this._back = false; this.world.g.visible = false;
    this.el.classList.add('hidden'); this.el.classList.remove('up', 'down', 'con'); this.keys = {}; this.stick = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } }; this._hum(0);
    if (was) this.onExit?.(true);
  }

  /** action button with the drone in hand: throw it up */
  launch() {
    if (this.state !== 'off') return false;
    const p = this.player;
    if (p.boat || p.swimming) { this.onNote?.('Not from here: you need your feet on the ground to throw it up.'); return false; }
    if (this.charging) { const m = Math.ceil((1 - this.battery) * CHARGE / 60); this.onNote?.(`The drone is charging: ${Math.floor(this.battery * 100)}%. It can fly again when it is full, in about ${m} minute${m === 1 ? '' : 's'}.`); return false; }
    this.state = 'throw'; this.t = 0; this.keys = {}; p.keys = {};
    return true;
  }

  _saveBat() { RUN.s.droneBat = { n: RUN.n, v: +this.battery.toFixed(3), charging: this.charging }; RUN.save?.(); }
  exit() {
    if (this.state !== 'fly' && this.state !== 'launch') return;
    if (this.battery < 0.999) { this.charging = true; this._saveBat(); }
    this.state = 'land'; this.t = 0;
    this.$('con').firstElementChild.textContent = 'Drone returning…'; this.el.classList.add('con');
  }

  /** the AI spotter upgrade: shown if owned, toggled with its button or R */
  setSpotter(owned) { this.spotOwned = owned; this.$('survey').hidden = !owned; this.$('spot').textContent = this.spotOn ? 'ON' : 'OFF'; this.$('survey').classList.toggle('off', !this.spotOn); this.el.querySelector('.dhelp').dataset.spot = owned ? '1' : ''; }
  toggleSpot() { if (!this.spotOwned || this.state !== 'fly') return; this.spotOn = !this.spotOn; this.setSpotter(true); this.note(this.spotOn ? 'AI spotter on: Clyde watches the camera feed for hidden things. It adds harm while it runs.' : 'AI spotter off.', 3); }
  /** a line of news on the drone's screen (the game's usual messages are under the phone while you fly) */
  note(text, secs = 3.2) { const m = this.$('msg'); m.textContent = text; m.classList.add('on'); clearTimeout(this._mt); this._mt = setTimeout(() => m.classList.remove('on'), secs * 1000); }
  _photo() {
    if (this.state !== 'fly') return;
    const f = this.el.querySelector('.dcam'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    this.onPhoto?.();
  }

  _startFPV() {
    this.el.classList.remove('hidden', 'down'); this.el.classList.add('con', 'up');
    this.$('con').firstElementChild.textContent = 'Connecting to drone…';
    this.onEnter?.();
  }

  /** each frame; returns true when the camera belongs to the drone */
  update(dt) {
    const p = this.player, cam = this.camera;
    for (const pr of this.world.props) pr.rotation.y += dt * (this.state === 'off' ? 0 : 60);
    if (this.state === 'off') {
      if (this.charging) { this.battery = Math.min(1, this.battery + dt / CHARGE); if (this.battery >= 1) { this.charging = false; this.onCharged?.(); } }
      if ((this._saveT = (this._saveT || 0) - dt) <= 0) { this._saveT = 5; this._saveBat(); }
      this._hum(0); return false;
    }
    this.t += dt;
    if (this.state === 'throw') {
      // the hand swings the drone forward and up, then lets go
      const k = Math.min(1, this.t / 0.32), e = k * k;
      this.hand.g.position.set(0.26 - 0.2 * e, -0.27 + 0.22 * e, -0.62 - 0.3 * e); this.hand.g.rotation.set(-0.35 + 0.5 * e, 0.4, 0);
      if (k >= 1) {
        this.hand.g.visible = false; this.hand.g.getWorldPosition(this.pos);
        const fwd = p.forward(this._v); this.vel.set(fwd.x * 5.5, 3.6, fwd.z * 5.5); this.yaw = p.yaw; this.gimbal = -0.2;
        this.world.g.visible = true; this.state = 'launch'; this.t = 0; this.tiltF = this.tiltS = 0;
      }
      this._hum(0.6); return false;
    }
    if (this.state === 'launch' && this.t > 0.55 && !this.el.classList.contains('up')) this._startFPV();
    const fpv = this.state === 'fly' || (this.state === 'launch' && this.t > 1.05) || (this.state === 'land' && this.t < 0.45);
    if (this.state === 'launch' && this.t > 1.05) { this.state = 'fly'; this.t = 0; setTimeout(() => this.el.classList.remove('con'), 120); }
    // ---- flight
    const k = this.keys, flyIn = this.state === 'fly';
    const kf = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), ks = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const ku = (k.Space ? 1 : 0) - (k.ShiftLeft || k.ShiftRight ? 1 : 0), ky = (k.KeyE ? 1 : 0) - (k.KeyC ? 1 : 0);
    const L = this.stick.L, R = this.stick.R;
    const fwdIn = flyIn ? clamp(kf - R.y, -1, 1) : 0, sideIn = flyIn ? clamp(ks + R.x, -1, 1) : 0, upIn = flyIn ? clamp(ku - L.y, -1, 1) : 0, yawIn = flyIn ? clamp(L.x + ky, -1, 1) : 0;
    this.yaw -= yawIn * YAW_RATE * dt;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let tvx = (fx * fwdIn + rx * sideIn) * H_MAX, tvz = (fz * fwdIn + rz * sideIn) * H_MAX, tvy = upIn * V_MAX;
    if (this.state === 'launch') { tvx = tvz = 0; tvy = 0.4; }
    const ah = 1 - Math.exp(-dt * (this.state === 'launch' ? 2.4 : 1.9)), av = 1 - Math.exp(-dt * 3);
    this.vel.x += (tvx - this.vel.x) * ah; this.vel.z += (tvz - this.vel.z) * ah; this.vel.y += (tvy - this.vel.y) * av;
    // the edge of the park: a notice, and a gentle push back in
    const sd = sdfAt(this.pos.x, this.pos.z), m = 30;
    const outW = this.pos.x < WORLD.minX + m || this.pos.x > WORLD.maxX - m || this.pos.z < WORLD.minZ + m || this.pos.z > WORLD.maxZ - m;
    let warn = '';
    if (sd > RANGE_SDF || outW) {
      warn = 'Flying out of drone range';
      let bx = 0, bz = 0;
      if (outW) { bx = (WORLD.minX + WORLD.maxX) / 2 - this.pos.x; bz = (WORLD.minZ + WORLD.maxZ) / 2 - this.pos.z; }
      else { bx = -(sdfAt(this.pos.x + 2, this.pos.z) - sdfAt(this.pos.x - 2, this.pos.z)); bz = -(sdfAt(this.pos.x, this.pos.z + 2) - sdfAt(this.pos.x, this.pos.z - 2)); }
      const l = Math.hypot(bx, bz) || 1; bx /= l; bz /= l;
      const outward = -(this.vel.x * bx + this.vel.z * bz); if (outward > 0) { this.vel.x += bx * outward * Math.min(1, dt * 4); this.vel.z += bz * outward * Math.min(1, dt * 4); }
      const push = 3 + Math.max(0, sd - RANGE_SDF) * 0.4; this.vel.x += bx * push * dt * 3; this.vel.z += bz * push * dt * 3;
    }
    { const hv = Math.hypot(this.vel.x, this.vel.z), cap = H_MAX * 1.15; if (hv > cap) { this.vel.x *= cap / hv; this.vel.z *= cap / hv; } }
    this.pos.addScaledVector(this.vel, dt);
    const g = Math.max(groundY(this.pos.x, this.pos.z), sdfAt(this.pos.x, this.pos.z) < 0 ? lake.level : -1e9);
    if (this.pos.y < g + 0.35) { this.pos.y = g + 0.35; this.vel.y = Math.max(0, this.vel.y); }
    if (this.pos.y > g + CEIL) { warn ||= 'Altitude limit'; this.vel.y = Math.min(this.vel.y, 0) - (this.pos.y - g - CEIL) * dt * 2; }
    // the body leans into its motion; the camera on its gimbal stays level
    this.tiltF += ((-fwdIn * 0.32) - this.tiltF) * Math.min(1, dt * 5); this.tiltS += ((-sideIn * 0.28) - this.tiltS) * Math.min(1, dt * 5);
    this.world.g.position.copy(this.pos); this.world.g.rotation.set(-this.tiltF, this.yaw, this.tiltS, 'YXZ');
    if (flyIn) this.onFly?.(dt);
    if (flyIn) { this.battery = Math.max(0, this.battery - dt / BATTERY); if (this.battery <= 0) { this.onNote?.('Battery flat: the drone flies itself home.'); this.exit(); } }
    this._hum(0.55 + 0.45 * Math.min(1, this.vel.length() / H_MAX));
    // ---- the screen
    if (fpv) {
      this.world.g.visible = false;
      cam.position.copy(this.pos).add(this._v.set(0, -0.04, 0));
      cam.rotation.set(this.gimbal, this.yaw, this.tiltS * 0.12, 'YXZ');
      if (cam.fov !== 84) { cam.fov = 84; cam.updateProjectionMatrix(); }
    } else this.world.g.visible = true;
    if (this._uiT === undefined || (this._uiT -= dt) <= 0) {
      this._uiT = 0.15; const alt = Math.round(this.pos.y - groundY(this.pos.x, this.pos.z)), dist = Math.round(Math.hypot(this.pos.x - p.pos.x, this.pos.z - p.pos.z));
      this.$('alt').textContent = `ALT ${alt} m`; this.$('dist').textContent = `DIST ${dist} m`; this.$('spd').textContent = `${Math.round(Math.hypot(this.vel.x, this.vel.z))} m/s`;
      const b = Math.round(this.battery * 100); this.$('bat').textContent = `${'▮'.repeat(Math.ceil(b / 25))}${'▯'.repeat(4 - Math.ceil(b / 25))} ${b}%`; this.$('bat').classList.toggle('low', b < 20);
      const w = this.$('warn'); if (w.textContent !== warn) w.textContent = warn; w.classList.toggle('on', !!warn);
    }
    // show the sticks moving, keyboard or touch
    const st = (side, x, y) => { const i = this.el.querySelector(`[data-stick="${side}"] i`); i.style.transform = `translate(${x * 34}px, ${y * 34}px)`; };
    st('L', yawIn, -upIn); st('R', sideIn, -fwdIn);
    // ---- coming home: the screen goes dark, the view is yours again, the phone goes down and away
    if (this.state === 'land' && this.t > 0.45 && !this._back) {
      this._back = true; this.world.g.visible = false; this.el.classList.remove('up'); this.el.classList.add('down');
      this.onExit?.();
    }
    if (this.state === 'land' && this.t > 1.1) { this.state = 'off'; this._back = false; this.el.classList.add('hidden'); this.el.classList.remove('down', 'con'); this.stick = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } }; this.keys = {}; this._hum(0); return false; }
    return fpv;
  }

  // a thin electric whine that rises with speed (nothing when the drone is down)
  _hum(level) {
    const a = this.audio; if (!a?.ready) return;
    if (!this._osc && level > 0) {
      const c = a.ctx; this._g = c.createGain(); this._g.gain.value = 0; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
      this._osc = [c.createOscillator(), c.createOscillator()]; this._osc[0].type = 'sawtooth'; this._osc[1].type = 'sawtooth'; this._osc[0].frequency.value = 210; this._osc[1].frequency.value = 214;
      for (const o of this._osc) { o.connect(f); o.start(); } f.connect(this._g); this._g.connect(a.master);
    }
    if (!this._osc) return;
    const t = a.ctx.currentTime, fpv = this.el.classList.contains('up');
    this._g.gain.setTargetAtTime(level * (fpv ? 0.018 : 0.03), t, 0.12);
    this._osc[0].frequency.setTargetAtTime(190 + level * 90, t, 0.1); this._osc[1].frequency.setTargetAtTime(194 + level * 92, t, 0.1);
  }
}
