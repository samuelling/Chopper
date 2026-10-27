const $ = (id) => document.getElementById(id);
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
  toast(text, secs = 3.2) {
    this.els.toast.textContent = text; this.els.toast.classList.add('on'); this._toastT = secs;
  },
  tick(dt) {
    if (this._toastT > 0) { this._toastT -= dt; if (this._toastT <= 0) this.els.toast.classList.remove('on'); }
  },
  /** alive: share of the park's trees still alive (0..1) */
  hud(alive, frac, drained, name) {
    const ap = Math.round(alive * 100), low = alive < 0.35;
    this.set(this.els.felled, 'felled', ap >= 99 ? 'All standing' : `${ap}% alive`);
    if (this._last.woodLow !== low) { this._last.woodLow = low; this.els.felled.classList.toggle('low', low); this.els.woodbar.parentElement.classList.toggle('low', low); }
    this.els.woodbar.style.width = `${ap}%`;
    const pct = Math.round(frac * 100);
    this.set(this.els.pct, 'pct', drained ? 'Drained. A lot of mud.' : pct >= 99 ? 'Full' : `${pct}% full`);
    this.els.bar.style.width = `${pct}%`;
    this.set(this.els.mood, 'mood', name);
  },
};
