// Game controllers (Xbox, PlayStation, MFi, Switch Pro: anything the browser reports with the standard layout), on a
// Mac, a PC, an iPad or an iPhone.  In play the sticks walk and look and the buttons do what the keys do; flying the
// drone they fly it; anywhere else (the phone, the menus, the season screens) they move a highlight between the
// buttons on screen, A presses, B goes back, the right stick scrolls.
//
//   left stick   walk (all the way over: hurry)      right stick  look
//   A  hop (hold to dive)    X  use (E)              B  sit (B)    Y  next tool (Q)
//   RT the action: swing, cast and reel, throw, shutter (with nothing in hand it raises the camera)
//   LT camera (V)            LB flashlight (L)       RB goggles (O)
//   Start  phone (P)         Select/View  menu       D-pad up  map (M)    R3 plant (G)
//   drone: left stick fly, right stick turn and tilt, RT/LT up and down, A photo, Y AI spotter, B bring it back

const DEAD = 0.16;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : Math.sign(v) * (Math.abs(v) - DEAD) / (1 - DEAD));
const CLICKABLE = 'button, a[href], input:not([type=hidden]), select, textarea, summary, label.ubtn, [role=button], [role=slider], [tabindex]:not([tabindex="-1"]), .go, .skip, .app, .fsbtn, [data-tab], [data-app], .cgo, .ckeep';

export class Pad {
  constructor(A) {
    this.A = A; this.prev = []; this.focus = null; this.rep = { dir: null, t: 0 }; this.active = false; this.lastUse = -1e9; this.t = 0;
    this.ring = document.createElement('div'); this.ring.id = 'padring'; document.body.appendChild(this.ring);
    this.synthetic = false;   // true while the pad is pressing an on-screen button (so the game knows not to grab the mouse)
    addEventListener('gamepadconnected', (e) => { if (!this._said) { this._said = true; A.onConnect?.(e.gamepad); } });
    // the mouse or a key takes over again: the highlight goes
    addEventListener('mousemove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this._mouse(); });
    addEventListener('keydown', (e) => { if (e.isTrusted) this._mouse(); });
  }
  _mouse() { this.lastWasPad = false; if (this.focus) { this.focus = null; this.ring.classList.remove('on'); } }
  _pick() {
    const list = navigator.getGamepads ? [...navigator.getGamepads()].filter((p) => p && p.connected) : [];
    return list.find((p) => p.mapping === 'standard') || list[0] || null;
  }
  get recent() { return this.t - this.lastUse < 20; }
  update(dt) {
    this.t += dt;
    const gp = this._pick();
    if (!gp) { if (this.active) this._release(); this.ring.classList.remove('on'); return; }
    const B = gp.buttons.map((b) => !!(b && (b.pressed || b.value > 0.5))), V = (i) => gp.buttons[i]?.value ?? (B[i] ? 1 : 0);
    const down = (i) => B[i] && !this.prev[i], up = (i) => !B[i] && this.prev[i];
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    const any = B.some(Boolean) || lx || ly || rx || ry;
    if (any) { this.lastUse = this.t; this.lastWasPad = true; if (!this.active) { this.active = true; document.body.classList.add('padmode'); } }
    else if (this.active && !this.recent) { this.active = false; document.body.classList.remove('padmode'); }
    const A = this.A, mode = A.mode();
    if (mode !== this._mode) { this._leave(this._mode); this._mode = mode; }
    if (mode === 'drone') this._drone(gp, B, down, V, lx, ly, rx, ry, dt);
    else if (mode === 'play') this._play(B, down, up, V, lx, ly, rx, ry, dt);
    else this._ui(B, down, lx, ly, ry, dt);
    this.prev = B;
  }
  /** let go of whatever the pad was holding */
  _release() { this.active = false; document.body.classList.remove('padmode'); this._leave(this._mode); this._mode = null; this.prev = []; }
  _leave(m) {
    const p = this.A.player;
    if (m === 'play') { if (this._moving) { p.touch.x = p.touch.y = 0; this._moving = false; } p.keys.Space = false; if (this._rt) { this._rt = false; this.A.primary(false); } }
    if (m === 'drone') { const d = this.A.drone; d.stick = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } }; }
    if (m === 'ui') { this.focus = null; this.ring.classList.remove('on'); }
  }
  _play(B, down, up, V, lx, ly, rx, ry, dt) {
    const A = this.A, p = A.player;
    if (lx || ly) { p.touch.x = lx; p.touch.y = ly; this._moving = true; } else if (this._moving) { p.touch.x = p.touch.y = 0; this._moving = false; }
    if (rx || ry) { const k = 2.7 * dt * (p.lookScale ?? 1), c = (v) => Math.sign(v) * v * v * 0.6 + v * 0.4; p.look(c(rx) * k, c(ry) * k * 0.8); }
    if (down(0)) A.hop(true); if (up(0)) A.hop(false);
    if (down(2)) A.use();
    if (down(1)) A.sit();
    if (down(3)) A.tool();
    if (down(7)) { this._rt = true; A.primary(true); } if (up(7) && this._rt) { this._rt = false; A.primary(false); }
    if (down(6)) A.camera();
    if (down(4)) A.torch();
    if (down(5)) A.goggles();
    if (down(9)) A.phone();
    if (down(8)) A.menu();
    if (down(12)) A.map();
    if (down(11)) A.plant();
  }
  _drone(gp, B, down, V, lx, ly, rx, ry, dt) {
    const d = this.A.drone;
    d.stick = { L: { x: rx, y: -(V(7) - V(6)) }, R: { x: lx, y: ly } };
    if (ry) d.gimbal = Math.max(-1.45, Math.min(0.35, d.gimbal - ry * dt * 1.6));
    if (down(0)) d._photo?.();
    if (down(3)) d.toggleSpot?.();
    if (down(1) || down(8)) d.exit?.();
  }
  // ---- menus: a highlight that moves between whatever can be pressed on top
  _candidates() {
    const out = new Set(), W = innerWidth, H = innerHeight;
    for (const el of document.querySelectorAll(CLICKABLE)) out.add(el);
    for (const el of document.body.querySelectorAll('div, span, li, label, b, i, small, p')) {
      const cs = getComputedStyle(el); if (cs.cursor !== 'pointer') continue;
      const par = el.parentElement; if (par && getComputedStyle(par).cursor === 'pointer') continue;   // the outermost one is the button
      out.add(el);
    }
    const list = [];
    for (const el of out) {
      if (el.closest('#touch, #padring') || el.disabled) continue;
      const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.right < 0 || r.top > H || r.left > W) continue;
      const cx = Math.min(W - 2, Math.max(2, r.left + r.width / 2)), cy = Math.min(H - 2, Math.max(2, r.top + r.height / 2));
      const hit = document.elementFromPoint(cx, cy); if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;   // covered by something on top
      if (getComputedStyle(el).visibility === 'hidden') continue;
      list.push({ el, cx, cy });
    }
    return list;
  }
  _setFocus(el) {
    this.focus = el; if (!el) { this.ring.classList.remove('on'); return; }
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    this.ring.classList.add('on'); this._place();
  }
  _place() {
    const el = this.focus; if (!el || !el.isConnected) { this._setFocus(null); return; }
    const r = el.getBoundingClientRect(); if (r.width < 2) { this._setFocus(null); return; }
    const s = this.ring.style; s.left = `${r.left - 4}px`; s.top = `${r.top - 4}px`; s.width = `${r.width + 8}px`; s.height = `${r.height + 8}px`;
  }
  _move(dir) {
    const list = this._candidates(); if (!list.length) return;
    const cur = this.focus && list.find((c) => c.el === this.focus);
    if (!cur) { list.sort((a, b) => a.cy - b.cy || a.cx - b.cx); this._setFocus(list[0].el); return; }
    const [vx, vy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
    let best = null, bs = Infinity;
    for (const c of list) {
      if (c.el === cur.el) continue;
      const dx = c.cx - cur.cx, dy = c.cy - cur.cy, along = dx * vx + dy * vy; if (along < 4) continue;
      const across = Math.abs(dx * vy - dy * vx), score = along + across * 2.2;
      if (score < bs) { bs = score; best = c; }
    }
    if (best) this._setFocus(best.el);
    else if (dir === 'down' || dir === 'up') this._scroll(dir === 'down' ? 160 : -160);   // nothing further that way on screen: scroll to bring more in
  }
  _scroller(from) {
    for (let el = from; el && el !== document.body; el = el.parentElement) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) return el; }
    return [...document.querySelectorAll('#phone .pscroll, [data-ph-body], .overlay:not(.hidden)')].find((el) => el.scrollHeight > el.clientHeight + 2 && el.getBoundingClientRect().height > 0) || null;
  }
  _scroll(px) { const s = this._scroller(this.focus); if (s) s.scrollTop += px; }
  _ui(B, down, lx, ly, ry, dt) {
    const A = this.A;
    // which way: the d-pad, or the left stick pushed well over (repeats while held)
    const dir = B[12] || ly < -0.6 ? 'up' : B[13] || ly > 0.6 ? 'down' : B[14] || lx < -0.6 ? 'left' : B[15] || lx > 0.6 ? 'right' : null;
    const slider = this.focus && (this.focus.matches?.('[role=slider], input[type=range]'));
    if (dir) {
      const fresh = dir !== this.rep.dir; this.rep.t -= dt;
      if (fresh || this.rep.t <= 0) {
        this.rep.dir = dir; this.rep.t = fresh ? 0.38 : 0.11;
        if (slider && (dir === 'left' || dir === 'right')) this._nudge(this.focus, dir === 'right' ? 1 : -1);
        else this._move(dir);
      }
    } else this.rep.dir = null;
    if (ry) this._scroll(ry * 900 * dt);
    if (this.focus) this._place();
    if (down(0)) {
      let el = this.focus && this.focus.isConnected ? this.focus : null;
      if (!el) { const list = this._candidates(); if (list.length) { list.sort((a, b) => a.cy - b.cy || a.cx - b.cx); this._setFocus(list[0].el); return; } el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); }
      this._press(el);
    }
    if (down(1)) A.back();
    if (down(9)) A.start();
    if (down(8)) A.back();
  }
  _press(el) {
    if (!el) return;
    this.synthetic = true;
    try {
      if (el.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=range]), textarea, select')) { el.focus(); return; }
      el.click();
    } finally { setTimeout(() => { this.synthetic = false; }, 0); }
  }
  _nudge(el, s) {
    if (el.matches('input[type=range]')) { const st = +el.step || 1; el.value = +el.value + s * st * 5; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return; }
    el.dispatchEvent(new KeyboardEvent('keydown', { key: s > 0 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
  }
}
