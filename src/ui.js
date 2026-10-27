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
