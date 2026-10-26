// On-screen controls: left-thumb joystick, drag the rest of the screen to look, buttons.
export class TouchControls {
  constructor(player, { onUse, onMood }) {
    this.player = player;
    this.root = document.getElementById('touch');
    this.stick = document.getElementById('stick');
    this.knob = this.stick.querySelector('i');
    this.look = null;           // {id, x, y}
    this.joy = null;            // {id, cx, cy}
    this.onUse = onUse; this.onMood = onMood;
    const opts = { passive: false };
    const find = (e, id) => [...e.changedTouches].find((t) => t.identifier === id);
    addEventListener('touchstart', (e) => {
      if (!this.root.classList.contains('on')) return;
      e.preventDefault();                 // also suppresses emulated mouse events
      for (const t of e.changedTouches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const btn = el && el.closest && el.closest('.tbtn');
        if (btn) { if (!btn.hasAttribute('data-fullscreen')) this._button(btn, true); continue; }
        const r = this.stick.getBoundingClientRect();
        const inStick = t.clientX < innerWidth * 0.42 && t.clientY > innerHeight * 0.35;
        if (inStick && !this.joy) {
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          this.joy = { id: t.identifier, cx, cy };
          this._joy(t);
        } else if (!this.look && t.clientX >= innerWidth * 0.3) {
          this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
    }, opts);
    addEventListener('touchmove', (e) => {
      if (!this.root.classList.contains('on')) return;
      e.preventDefault();
      if (this.joy) { const t = find(e, this.joy.id); if (t) this._joy(t); }
      if (this.look) {
        const t = find(e, this.look.id);
        if (t) {
          this.player.look((t.clientX - this.look.x) * 0.0052, (t.clientY - this.look.y) * 0.0052);
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
    }, opts);
    const end = (e) => {
      if (!this.root.classList.contains('on')) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.player.touch.x = this.player.touch.y = 0; this.knob.style.transform = ''; }
        if (this.look && t.identifier === this.look.id) this.look = null;
      }
      for (const b of this.root.querySelectorAll('.tbtn.on')) b.classList.remove('on');
    };
    addEventListener('touchend', end, opts);
    addEventListener('touchcancel', end, opts);
  }
  show() { this.root.classList.add('on'); }
  _joy(t) {
    const R = 52;
    let dx = t.clientX - this.joy.cx, dy = t.clientY - this.joy.cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = dx / l * R; dy = dy / l * R; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const dead = 0.12;
    let x = dx / R, y = dy / R;
    if (Math.hypot(x, y) < dead) { x = 0; y = 0; }
    this.player.touch.x = x; this.player.touch.y = y;
  }
  _button(btn, down) {
    btn.classList.add('on');
    if (btn.id === 'bSwing') this.player.startSwing();
    else if (btn.id === 'bHop') this.player._jump();
    else if (btn.id === 'bUse') this.onUse?.();
    else if (btn.id === 'bMood') this.onMood?.();
  }
}
