// Hi-fi sounds for the boat and the rod, all synthesised: water on the hull, blade entries and drips, oarlocks, the reel's flywheel and ratchet,
// the cast, the bobber, a strained line.  Each sound layers several small events (a splash is a noise sweep, a low thump, bubbles that rise in
// pitch, then drips) so it does not read as one beep, and everything goes through a short outdoor reverb.
const rnd = (a, b) => a + Math.random() * (b - a);

export function installWaterSounds(Audio) {
  const P = Audio.prototype;

  P._wsInit = function () {
    if (this._ws) return this._ws;
    const ctx = this.ctx, sr = ctx.sampleRate;
    const white = ctx.createBuffer(1, sr * 2, sr), d = white.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // an open-air reverb: a few early reflections off the water and the far shore, then a dark, quick tail
    const len = Math.floor(sr * 1.2), ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const c = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) { const t = i / len; lp += ((Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) - lp) * 0.2; c[i] = lp; }
      for (const [ms, g] of [[11, 0.5], [23, 0.35], [41, -0.3], [67, 0.25], [95, 0.2]]) c[Math.floor(sr * ms / 1000) + ch * 7] += g;
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.26; conv.connect(wet); wet.connect(this.master);
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(this.master); bus.connect(conv);
    this._ws = { white, bus, bed: null, reel: null, slapT: 1, clickT: 0 };
    return this._ws;
  };

  /** a shaped burst of filtered noise */
  P._nz = function (t, { f0 = 1000, f1 = null, q = 1, type = 'bandpass', dur = 0.2, peak = 0.1, att = 0.004, pan = 0, buf = 'white', rate = 1 } = {}) {
    const ctx = this.ctx, ws = this._wsInit();
    const s = ctx.createBufferSource(); s.buffer = buf === 'white' ? ws.white : this.noiseBuf; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + att + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak * (this._fv || 1), t + att); g.gain.exponentialRampToValueAtTime(0.0003, t + att + dur);
    const pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, pan));
    s.connect(f); f.connect(g); g.connect(pn); pn.connect(ws.bus); s.start(t, Math.random() * 1.5); s.stop(t + att + dur + 0.05);
  };
  /** a pitched blip (a drop, a bubble, a click's body) */
  P._pt = function (t, { f0 = 800, f1 = null, dur = 0.05, peak = 0.05, att = 0.002, type = 'sine', pan = 0 } = {}) {
    const ctx = this.ctx, ws = this._wsInit(), o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + att + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak * (this._fv || 1), t + att); g.gain.exponentialRampToValueAtTime(0.0003, t + att + dur);
    const pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(g); g.connect(pn); pn.connect(ws.bus); o.start(t); o.stop(t + att + dur + 0.03);
  };
  /** a water bubble: its pitch climbs as it closes */
  P._bubble = function (t, f, pan = 0, peak = 0.04) { this._pt(t, { f0: f, f1: f * rnd(1.8, 2.6), dur: rnd(0.02, 0.05), peak, att: 0.003, pan }); };
  P._drip = function (t, pan = 0, peak = 0.03) { const f = rnd(1500, 2800); this._pt(t, { f0: f, f1: f * 1.5, dur: 0.018, peak, att: 0.001, pan }); this._nz(t, { f0: 4200, q: 3, dur: 0.01, peak: peak * 0.5, att: 0.0005, pan }); };

  // ---- the blade and the oarlock
  /** the blade bites the water: a noise sweep, a low push, then bubbles rising */
  P.dip = function (k = 1, side = 0) {
    if (!this.ready) return; const t = this.ctx.currentTime, pan = side * 0.7;
    this._nz(t, { f0: 500, f1: 2600, q: 0.8, dur: 0.2, peak: 0.1 * k, att: 0.01, pan });
    this._nz(t, { f0: 5200, f1: 2200, q: 0.6, type: 'highpass', dur: 0.12, peak: 0.035 * k, att: 0.004, pan });
    this._nz(t + 0.01, { f0: 240, q: 1.2, type: 'lowpass', dur: 0.22, peak: 0.12 * k, att: 0.012, pan, buf: 'brown' });
    const n = 3 + ((Math.random() * 4) | 0); for (let i = 0; i < n; i++) this._bubble(t + 0.03 + Math.random() * 0.28, rnd(380, 1200), pan * rnd(0.6, 1.2), 0.03 * k);
  };
  /** the blade lifts out: a thin sheet of water, then drops falling back */
  P.oarOut = function (side = 0) {
    if (!this.ready) return; const t = this.ctx.currentTime, pan = side * 0.7;
    this._nz(t, { f0: 3800, f1: 1400, q: 0.7, type: 'highpass', dur: 0.4, peak: 0.04, att: 0.02, pan });
    this._nz(t, { f0: 1200, f1: 600, q: 1.5, dur: 0.25, peak: 0.03, att: 0.02, pan });
    const n = 4 + ((Math.random() * 5) | 0); for (let i = 0; i < n; i++) this._drip(t + 0.05 + i * rnd(0.05, 0.11), pan * rnd(0.6, 1.2), 0.018 + Math.random() * 0.02);
  };
  /** wood in the rowlock: a knock and a short creak */
  P.oarlock = function (side = 0) {
    if (!this.ready) return; const t = this.ctx.currentTime, pan = side * 0.5;
    this._pt(t, { f0: 190, f1: 150, dur: 0.07, peak: 0.07, att: 0.001, pan, type: 'triangle' });
    this._pt(t, { f0: 460, f1: 380, dur: 0.05, peak: 0.035, att: 0.001, pan, type: 'triangle' });
    this._nz(t, { f0: 1800, q: 2, dur: 0.02, peak: 0.05, att: 0.0008, pan });
    const ctx = this.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), pn = ctx.createStereoPanner(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(105, 150), t + 0.03); o.frequency.linearRampToValueAtTime(rnd(75, 110), t + 0.3);
    lfo.frequency.value = rnd(26, 40); lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = rnd(650, 900); f.Q.value = 5;
    g.gain.setValueAtTime(0.0001, t + 0.03); g.gain.linearRampToValueAtTime(0.022, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0003, t + 0.32);
    pn.pan.value = pan; o.connect(f); f.connect(g); g.connect(pn); pn.connect(this._wsInit().bus); o.start(t + 0.03); lfo.start(t + 0.03); o.stop(t + 0.35); lfo.stop(t + 0.35);
  };

  // ---- the hull
  /** a wave slapping the planking: a hollow thump, a wet slap and a dribble */
  P.hullSlap = function (k = 1) {
    if (!this.ready) return; const t = this.ctx.currentTime, pan = rnd(-0.25, 0.25);
    this._pt(t, { f0: 150, f1: 105, dur: 0.22, peak: 0.07 * k, att: 0.004, pan, type: 'sine' });
    this._nz(t, { f0: 700, f1: 260, q: 1.1, dur: 0.14, peak: 0.12 * k, att: 0.004, pan });
    this._nz(t + 0.03, { f0: 2400, f1: 1200, q: 0.7, dur: 0.12, peak: 0.03 * k, att: 0.006, pan, type: 'highpass' });
    if (Math.random() < 0.6) this._bubble(t + 0.05 + Math.random() * 0.1, rnd(500, 900), pan, 0.016 * k);
  };
  /** the hull knocks the shore or the bottom: wood on stone or mud */
  P.thud = function (k = 1) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    this._pt(t, { f0: 105, f1: 70, dur: 0.28, peak: 0.16 * k, att: 0.002, type: 'sine' });
    this._pt(t, { f0: 210, f1: 170, dur: 0.12, peak: 0.07 * k, att: 0.001, type: 'triangle' });
    this._nz(t, { f0: 900, f1: 300, q: 0.9, dur: 0.2, peak: 0.1 * k, att: 0.002, buf: 'brown' });
    this._nz(t + 0.02, { f0: 1500, f1: 700, q: 1.5, dur: 0.18, peak: 0.04 * k, att: 0.01 });          // the scrape
  };
  P.boardThump = function () { this.thud(0.55); setTimeout(() => this.hullSlap(1.3), 120); setTimeout(() => this.hullSlap(0.8), 420); };

  // ---- the rod and the water
  P.castSwish = function () {
    if (!this.ready) return; const t = this.ctx.currentTime;
    this._nz(t, { f0: 500, f1: 3400, q: 1.1, dur: 0.26, peak: 0.07, att: 0.05, pan: 0.2 });                              // the rod whips through the air
    this._nz(t + 0.06, { f0: 5200, q: 0.8, type: 'highpass', dur: 0.4, peak: 0.03, att: 0.03, pan: 0.1 });                // line peeling off the spool
    this._pt(t + 0.05, { f0: 700, f1: 2400, dur: 0.5, peak: 0.012, att: 0.05, type: 'sawtooth', pan: 0.15 });
    this._pt(t + 0.5, { f0: 2400, f1: 800, dur: 0.3, peak: 0.008, att: 0.02, type: 'sawtooth', pan: 0.15 });
  };
  /** the bobber lands */
  P.plop = function () {
    if (!this.ready) return; const t = this.ctx.currentTime;
    this._bubble(t, 640, 0, 0.06); this._nz(t, { f0: 1600, f1: 700, q: 0.9, dur: 0.12, peak: 0.07, att: 0.003 }); this._nz(t, { f0: 260, type: 'lowpass', dur: 0.16, peak: 0.07, att: 0.004, buf: 'brown' });
    for (let i = 0; i < 3; i++) this._drip(t + 0.08 + i * rnd(0.04, 0.09), rnd(-0.2, 0.2), 0.012);
  };
  P.biteSnd = function () { if (!this.ready) return; const t = this.ctx.currentTime; this._bubble(t, 420, 0, 0.07); this._bubble(t + 0.11, 520, 0.1, 0.05); this._nz(t, { f0: 900, f1: 400, q: 1, dur: 0.18, peak: 0.05 }); };
  /** a fish coming out of the water and back in */
  P.landSplash = function (k = 1) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    this.dip(1.5 * k, 0);
    this._nz(t + 0.05, { f0: 3000, f1: 1500, q: 0.6, type: 'highpass', dur: 0.3, peak: 0.05, att: 0.01 });
    for (let i = 0; i < 6; i++) this._drip(t + 0.1 + i * rnd(0.04, 0.1), rnd(-0.3, 0.3), 0.02);
  };
  P.pull = function () { if (!this.ready) return; const t = this.ctx.currentTime; this._nz(t, { f0: 3800, f1: 6200, q: 1, type: 'highpass', dur: 0.22, peak: 0.04, att: 0.02 }); this._pt(t, { f0: 900, f1: 1700, dur: 0.2, peak: 0.01, type: 'sawtooth' }); };
  P.strain = function (k = 1) {
    if (!this.ready) return; const t = this.ctx.currentTime, f = 1300 + k * 900;
    this._pt(t, { f0: f, f1: f * 1.04, dur: 0.14, peak: 0.016, att: 0.02 }); this._pt(t, { f0: f * 2.01, f1: f * 2.05, dur: 0.1, peak: 0.006, att: 0.02 });
  };
  P.snap = function () {
    if (!this.ready) return; const t = this.ctx.currentTime;
    this._nz(t, { f0: 5200, q: 0.8, type: 'highpass', dur: 0.05, peak: 0.12, att: 0.0005 });
    this._pt(t, { f0: 3400, f1: 1300, dur: 0.14, peak: 0.05, att: 0.0005 }); this._pt(t + 0.01, { f0: 6800, f1: 2600, dur: 0.08, peak: 0.02, att: 0.0005 });
    this._nz(t + 0.03, { f0: 2500, f1: 800, q: 0.7, dur: 0.15, peak: 0.04, att: 0.01 });
  };
  P.reelTick = function () { /* the reel is now a continuous bed: see waterUpdate */ };

  // ---- the beds: wake, swirl and the reel's flywheel.  Called every frame.
  P._wsBed = function () {
    const ctx = this.ctx, ws = this._wsInit(); if (ws.bed) return ws.bed;
    const mk = (buf, type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; const pn = ctx.createStereoPanner(); s.connect(fl); fl.connect(g); g.connect(pn); pn.connect(ws.bus); s.start(0, Math.random() * 1.5); return { fl, g, pn }; };
    ws.bed = { wake: mk(ws.white, 'bandpass', 1100, 0.6), rumble: mk(this.noiseBuf, 'lowpass', 170, 0.7), swirl: mk(ws.white, 'bandpass', 650, 1.0) };
    // the reel: a spinning spool (a buzzy tone through a band-pass) that rises with speed
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 80; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 3; const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 7; lg.gain.value = 0.004; lfo.connect(lg); lg.connect(g.gain);       // the flywheel's slight wobble
    o.connect(f); f.connect(g); g.connect(ws.bus); o.start(); lfo.start(); ws.reel = { o, f, g };
    return ws.bed;
  };
  /**
   * s: { vol (0..1 how near you are), v (boat speed), tl, tr (oar thrusts), reel: { on, speed (0..1), drag } }
   */
  P.waterUpdate = function (dt, s) {
    if (!this.ready) return;
    const bed = this._wsBed(), ws = this._ws, t = this.ctx.currentTime, vol = s.vol ?? 0, sp = Math.min(1, Math.abs(s.v || 0) / 2.2);
    const thr = Math.min(1, (Math.abs(s.tl || 0) + Math.abs(s.tr || 0)) / 3.5);
    bed.wake.g.gain.setTargetAtTime(vol * (0.002 + 0.03 * Math.pow(sp, 1.4)), t, 0.25); bed.wake.fl.frequency.setTargetAtTime(900 + 1400 * sp, t, 0.3);
    bed.rumble.g.gain.setTargetAtTime(vol * (0.004 + 0.03 * sp), t, 0.3);
    bed.swirl.g.gain.setTargetAtTime(vol * 0.06 * thr, t, 0.07); bed.swirl.fl.frequency.setTargetAtTime(500 + 500 * thr, t, 0.1); bed.swirl.pn.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, ((s.tr || 0) - (s.tl || 0)) * 0.3)), t, 0.1);
    ws.slapT -= dt;
    if (ws.slapT < 0 && vol > 0.05) { ws.slapT = (1.3 - 0.8 * sp) * rnd(0.6, 1.5); this.hullSlap(vol * (0.5 + 0.9 * sp) * rnd(0.7, 1.1)); }
    // the reel
    const r = s.reel || {}, on = !!r.on, speed = r.speed ?? 0.5, drag = !!r.drag, R = ws.reel;
    R.g.gain.setTargetAtTime(drag ? 0.016 : on ? 0.012 + 0.014 * speed : 0, t, 0.05);
    R.o.frequency.setTargetAtTime(drag ? 330 : 70 + 150 * speed, t, 0.08); R.f.frequency.setTargetAtTime(drag ? 1500 : 800 + 900 * speed, t, 0.1);
    ws.clickT -= dt;
    if ((on || drag) && ws.clickT <= 0) {
      ws.clickT = 1 / (drag ? 30 : 9 + 14 * speed) * rnd(0.9, 1.1);
      this._nz(t, { f0: 3600, q: 5, dur: 0.012, peak: drag ? 0.03 : 0.04, att: 0.0006, pan: 0.15 }); this._pt(t, { f0: 2000, f1: 1500, dur: 0.01, peak: drag ? 0.015 : 0.025, att: 0.0005, type: 'square', pan: 0.15 });
    }
  };
}
