const $ = (id) => document.getElementById(id);
// what counts as 'you just did something'
for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, (e) => { if (e.isTrusted && !e.repeat) ui._input = performance.now(); }, { capture: true, passive: true });
export const ui = {
  els: { felled: $('felled'), woodbar: $('woodbar'), pct: $('lakepct'), bar: $('lakebar'), prompt: $('prompt'), toast: $('toast'), mood: $('mood'), hud: $('hud'),
    title: $('title'), paused: $('paused'), loading: $('loading'), loadmsg: $('loadmsg'), name: $('lakename') },
  _toastT: 0, _last: {},
  progress(msg, frac) {
    this.els.loadmsg.textContent = msg;
    document.querySelector('#bar i').style.width = `${Math.round(frac * 100)}%`;
  },
  set(el, key, text) { if (this._last[key] !== text) { this._last[key] = text; el.textContent = text; } },
  prompt(text) {
    this.set(this.els.prompt, 'prompt', text || '');
    this.els.prompt.classList.toggle('on', !!text);
  },
  // Messages come in two kinds.  An answer to something you just did (a key, a tap, a click in the last moment) shows at
  // once.  Anything else (the world's news: a bird arriving, the light turning, a rumour) waits its turn: one at a time,
  // a breath apart, never over another, and held back altogether for a while after you first step in.
  _q: [], _gap: 0, quietUntil: 0, _input: -1e9, chimeNext: false,
  _show(text, secs) { this.els.toast.textContent = text; this.els.toast.classList.add('on'); this._toastT = secs; },
  /** hold the world's news back for `sec` seconds (stepping into the park) */
  quiet(sec) { this.quietUntil = Math.max(this.quietUntil, performance.now() + sec * 1000); },
  get holding() { return performance.now() < this.quietUntil || this._toastT > 0 || this._gap > 0 || this._q.length > 0; },
  toast(text, secs = 3.2) {
    if (!text) return;
    if (this.mirror) { this.mirror(text, secs); return; }     // (while flying the drone, messages show on its screen)
    const mine = performance.now() - this._input < 1500;
    if (mine) { this._show(text, secs); this._gap = 0; this.chimeNext = false; return; }
    if (!this.holding) { this._show(text, secs); this._gap = 0; this.chimeNext = false; return; }
    if (this._q.some((m) => m.text === text)) return;
    this._q.push({ text, secs: Math.max(secs, 3.2), chime: this.chimeNext }); this.chimeNext = false;
    if (this._q.length > 5) this._q.splice(0, this._q.length - 5);   // a pile-up: the oldest news can go
  },
  tick(dt) {
    if (this._toastT > 0) { this._toastT -= dt; if (this._toastT <= 0) { this.els.toast.classList.remove('on'); this._gap = this._q.length ? 2.2 : 0; } return; }
    if (this._gap > 0) { this._gap -= dt; return; }
    if (this._q.length && performance.now() >= this.quietUntil) { const m = this._q.shift(); if (m.chime) this.onChime?.(); this._show(m.text, m.secs); }
  },
  /** alive: share of the park's trees still alive (0..1) */
  hud(alive, felled, frac, drained, name) {
    // the moment one tree is down it stops being 'all standing': near the top the share shows decimals, and the count of
    // trees cut down sits beside it
    const wp = alive * 100, ap = Math.round(wp), low = alive < 0.35;
    const txt = alive >= 0.99995 && !felled ? 'All standing' : `${wp >= 99.95 ? Math.min(99.99, Math.floor(wp * 100) / 100).toFixed(2) : wp >= 99 ? (Math.floor(wp * 10) / 10).toFixed(1) : ap}% alive`;
    const html = `${txt}${felled ? `<small> \u00b7 ${felled} cut down</small>` : ''}`;
    if (this._last.felled !== html) { this._last.felled = html; this.els.felled.innerHTML = html; }
    if (this._last.woodLow !== low) { this._last.woodLow = low; this.els.felled.classList.toggle('low', low); this.els.woodbar.parentElement.classList.toggle('low', low); }
    this.els.woodbar.style.width = `${wp.toFixed(2)}%`;
    const pct = Math.round(frac * 100);
    this.set(this.els.pct, 'pct', drained ? 'Drained. A lot of mud.' : pct >= 99 ? 'Full' : `${pct}% full`);
    this.els.bar.style.width = `${pct}%`;
    this.set(this.els.mood, 'mood', name);
  },
};
