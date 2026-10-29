// On-screen controls: left-thumb joystick, drag the rest of the screen to look, buttons.
export class TouchControls {
  constructor(player, { onUse, onMood, onPhone, onSwing, onMenu, onTool }) {
    this.player = player;
    this.root = document.getElementById('touch');
    this.stick = document.getElementById('stick');
    this.knob = this.stick.querySelector('i');
    this.look = null;           // {id, x, y}
    this.joy = null;            // {id, cx, cy}
    this.onUse = onUse; this.onMood = onMood; this.onPhone = onPhone; this.onSwing = onSwing; this.onMenu = onMenu; this.onTool = onTool;
    this.home = null;   // the stick's resting place; it follows your thumb wherever it lands on the left
    const opts = { passive: false };
    const find = (e, id) => [...e.changedTouches].find((t) => t.identifier === id);
    // iOS: after the on-screen keyboard closes (the birth year, a place name, field notes) Safari can leave the page
    // scrolled a little, so the buttons are drawn in one place and hit in another.  Put it back whenever that can happen.
    const unshift = () => {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
      for (const el of [document.scrollingElement, document.documentElement, document.body]) if (el && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0; }
    };
    this.unshift = unshift;
    addEventListener('focusout', () => { setTimeout(unshift, 60); setTimeout(unshift, 450); });
    window.visualViewport?.addEventListener('resize', unshift); window.visualViewport?.addEventListener('scroll', unshift);
    addEventListener('scroll', unshift); addEventListener('orientationchange', () => setTimeout(unshift, 350)); addEventListener('resize', () => setTimeout(unshift, 100));
    // which button a touch means: the one under it, else the nearest within a fingertip of its edge
    const buttonAt = (x, y) => {
      const el = document.elementFromPoint(x, y), hit = el && el.closest && el.closest('.tbtn');
      if (hit) return hit;
      let best = null, bd = 16;
      for (const b of this.root.querySelectorAll('.tbtn')) {
        if (!b.offsetParent) continue;
        const r = b.getBoundingClientRect(), d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    };
    // ?touchdebug=1: a dot where each touch lands, outlined in green if it hit a button
    const dbg = new URLSearchParams(location.search).has('touchdebug');
    const mark = (x, y, hit) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:${x - 9}px;top:${y - 9}px;width:18px;height:18px;border-radius:50%;z-index:9999;pointer-events:none;background:${hit ? 'rgba(80,220,120,.8)' : 'rgba(255,80,60,.8)'};box-shadow:0 0 0 2px #fff`; document.body.appendChild(d); setTimeout(() => d.remove(), 1200); };
    // a few things must get a real tap from iOS (it only lets sound start on one): the touch layer leaves them alone
    const passThrough = (e) => !!e.target?.closest?.('#soundpill');
    addEventListener('touchstart', (e) => {
      if (!this.root.classList.contains('on') || passThrough(e)) return;
      e.preventDefault();                 // also suppresses emulated mouse events
      unshift();
      for (const t of e.changedTouches) {
        const btn = buttonAt(t.clientX, t.clientY);
        if (dbg) mark(t.clientX, t.clientY, !!btn);
        if (btn) { if (!btn.hasAttribute('data-fullscreen')) this._button(btn, true); continue; }
        const r = this.stick.getBoundingClientRect();
        const inStick = t.clientX < innerWidth * 0.42 && t.clientY > innerHeight * 0.35;
        if (inStick && !this.joy) {
          // a floating stick: it centres under your thumb wherever it lands in the lower left
          const inside = Math.hypot(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2)) < r.width / 2;
          const cx = inside ? r.left + r.width / 2 : t.clientX, cy = inside ? r.top + r.height / 2 : t.clientY;
          if (!inside) { this.stick.classList.add('float'); this.stick.style.left = `${cx - r.width / 2}px`; this.stick.style.top = `${cy - r.height / 2}px`; this.stick.style.bottom = 'auto'; }
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
          const k = 0.0052 * Math.min(1, Math.max(0.72, 900 / innerWidth)) * (this.player.lookScale || 1);   // the same turn for the same share of the screen on a big tablet
          this.player.look((t.clientX - this.look.x) * k, (t.clientY - this.look.y) * k);
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
    }, opts);
    const end = (e) => {
      if (!this.root.classList.contains('on') || passThrough(e)) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.player.touch.x = this.player.touch.y = 0; this.knob.style.transform = ''; this.stick.classList.remove('float'); this.stick.style.left = this.stick.style.top = this.stick.style.bottom = ''; }
        if (this.look && t.identifier === this.look.id) this.look = null;
      }
      for (const b of this.root.querySelectorAll('.tbtn.on')) { b.classList.remove('on'); if (b.id === 'bSwing') this.onSwing?.(false); if (b.id === 'bHop') this.player.keys.Space = false; }
    };
    addEventListener('touchend', end, opts);
    // a mouse or trackpad on a tablet presses the on-screen buttons too (and not the game behind them)
    addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || !this.root.classList.contains('on')) return;
      const btn = e.target.closest?.('.tbtn'); if (!btn) return;
      e.preventDefault(); e.stopPropagation(); if (!btn.hasAttribute('data-fullscreen')) this._button(btn, true);
    }, true);
    addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') return;
      for (const b of this.root.querySelectorAll('.tbtn.on')) { b.classList.remove('on'); if (b.id === 'bSwing') this.onSwing?.(false); if (b.id === 'bHop') this.player.keys.Space = false; }
    }, true);
    addEventListener('touchcancel', end, opts);
  }
  show() { this.root.classList.add('on'); }
  hide() { this.root.classList.remove('on'); }
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
    if (btn.id === 'bSwing') this.onSwing ? this.onSwing(true) : this.player.startSwing();
    else if (btn.id === 'bPhone') this.onPhone?.();
    else if (btn.id === 'bMenu') this.onMenu?.();
    else if (btn.id === 'bHop') { this.player._jump(); this.player.keys.Space = true; }
    else if (btn.id === 'bUse') this.onUse?.();
    else if (btn.id === 'bMood') this.onMood?.();
    else if (btn.id === 'bTool') this.onTool?.();
  }
}
