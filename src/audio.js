// Everything synthesised with WebAudio: no asset files.
import { SEASON } from './season.js';

export class Audio {
  constructor() { this.ctx = null; this.ready = false; }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let b0 = 0; for (let i = 0; i < len; i++) { b0 = 0.97 * b0 + (Math.random() * 2 - 1) * 0.2; d[i] = b0 * 3; }
    // wind bed
    this.wind = this._loop(420, 0.7, 0.05);
    this.lap = this._loop(900, 0.6, 0.0);
    this.gateSnd = this._loop(140, 1.5, 0.0);
    this.rustle = this._loop(3200, 0.6, 0.0);          // wind in the leaves
    this.cicada = this._loop(5600, 9, 0.0);            // summer: the drone of cicadas, pulsing
    const lfo = ctx.createOscillator(); lfo.frequency.value = 46; const lg = ctx.createGain(); lg.gain.value = 0.0;
    lfo.connect(lg); lg.connect(this.cicada.g.gain); lfo.start(); this.cicadaLfo = lg;
    this.ready = true;
    this.birdT = 3; this.insectT = 1; this.frogT = 4; this.creakT = 12; this.hawkT = 30;
  }
  _loop(freq, q, gain) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    return { f, g };
  }
  _burst(freq, q, dur, gain, type = 'bandpass', sweep = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur); f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain * (this._fv || 1), t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  _tone(freq, dur, gain, type = 'sine', endFreq = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  /** one footfall; kind is the surface underfoot, loud > 1 when hurrying */
  footstep(kind, loud = 1) {
    if (!this.ready) return;
    this._fv = loud;
    const r = Math.random;
    switch (kind) {
      case 'water': this._burst(1400, 0.8, 0.22, 0.25, 'bandpass', 0.5); break;
      case 'pave': case 'dam':                                   // hard and light: a dry tick and a small shoe slap
        this._burst(1900 + r() * 500, 1.6, 0.05, 0.16, 'bandpass'); this._burst(420, 1, 0.06, 0.09, 'lowpass'); break;
      case 'gravel':                                             // little stones shifting
        this._grains(7, 0.13, 2400, 6200, 0.07, 1.4); this._burst(900, 0.8, 0.07, 0.07, 'lowpass'); break;
      case 'leaves':                                             // a dry shuffle through fallen leaves
        this._grains(9, 0.3, 1500, 5200, 0.055, 1.1); this._burst(650, 0.7, 0.24, 0.07, 'bandpass'); break;
      case 'snow':                                               // the crunch of fresh snow: squeaky grains over a soft thump
        this._grains(12, 0.19, 800, 2400, 0.085, 3.2); this._burst(170, 0.8, 0.1, 0.13, 'lowpass');
        if (r() < 0.5) this._tone(1500 + r() * 300, 0.05, 0.012, 'sine', 1100); break;
      case 'dirt':                                               // packed earth: a dull thud, now and then a twig
        this._burst(210, 0.8, 0.11, 0.22, 'lowpass'); this._burst(950, 1, 0.07, 0.07, 'bandpass');
        if (r() < 0.12) this._burst(3200, 3, 0.03, 0.12, 'highpass'); break;
      case 'sand':
        this._burst(1500, 0.4, 0.24, 0.12, 'lowpass', 0.6); this._burst(180, 0.8, 0.08, 0.08, 'lowpass'); break;
      case 'mud':                                                // a squelch
        this._burst(450, 2.2, 0.22, 0.2, 'bandpass', 0.35); this._tone(230, 0.09, 0.05, 'sine', 130); break;
      default:                                                   // grass: a soft swish
        this._burst(1100, 0.5, 0.17, 0.11, 'lowpass'); this._burst(5200, 0.4, 0.12, 0.045, 'highpass'); this._burst(200, 0.8, 0.07, 0.06, 'lowpass');
    }
    this._fv = 1;
  }
  /** n tiny filtered noise grains scattered across dur seconds (crunch, shuffle, gravel) */
  _grains(n, dur, fLo, fHi, gain, q) {
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let i = 0; i < n; i++) {
      const t = t0 + Math.random() * dur, f = fLo + Math.random() * (fHi - fLo);
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.6;
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); const gd = 0.008 + Math.random() * 0.02;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * (this._fv || 1) * (0.5 + Math.random()), t + 0.002); g.gain.exponentialRampToValueAtTime(0.0003, t + gd);
      s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + gd + 0.02);
    }
  }
  swing() { this._burst(900, 1.0, 0.28, 0.12, 'bandpass', 0.4); }
  chop(size = 1) { this._burst(300, 2.5, 0.12, 0.7); this._tone(150 * (1.2 - size * 0.3), 0.18, 0.5, 'triangle', 70); }
  crack() { this._burst(1800, 3, 0.35, 0.4, 'bandpass', 0.4); this._tone(90, 0.5, 0.25, 'sawtooth', 50); }
  land(size = 1) {
    this._burst(180, 0.8, 0.8 + size * 0.4, 0.9, 'lowpass', 0.4);
    this._tone(55, 0.7, 0.8, 'sine', 30);
    setTimeout(() => this._burst(2500, 0.5, 0.5, 0.25, 'highpass'), 80);
  }
  splash() { this._burst(1800, 0.5, 0.5, 0.35, 'bandpass', 0.3); }
  toggle() { this._tone(200, 0.15, 0.3, 'square', 120); this._burst(2000, 2, 0.1, 0.25); }
  // ---- voices ----
  _seq(list) { list.forEach(([dt, f, d, g, f2, type]) => setTimeout(() => this._tone(f, d, g, type || 'sine', f2 || null), dt * 1000)); }
  chickadee() { this._seq([[0, 3750, 0.2, 0.05, 3700], [0.26, 3050, 0.34, 0.05, 3000]]); }
  cardinal() { for (let i = 0; i < 3; i++) this._seq([[i * 0.24, 3500, 0.2, 0.05, 2000]]); if (Math.random() < 0.6) this._seq([[0.9, 2600, 0.07, 0.04, 3000], [1.0, 2600, 0.07, 0.04, 3000], [1.1, 2600, 0.07, 0.04, 3000]]); }
  robin() { const l = []; let t = 0; for (let i = 0; i < 5 + ((Math.random() * 3) | 0); i++) { const f = 2100 + Math.random() * 1300; l.push([t, f, 0.1, 0.045, f * (0.8 + Math.random() * 0.5)]); t += 0.1 + Math.random() * 0.12; } this._seq(l); }
  wren() { const l = []; for (let i = 0; i < 14; i++) l.push([i * 0.04, 4300 + (i % 2) * 450 + Math.random() * 200, 0.03, 0.035, null]); this._seq(l); }
  vireo() { const l = []; for (let i = 0; i < 4; i++) l.push([i * 0.5, 2400 + Math.random() * 500, 0.12, 0.04, 2900 + Math.random() * 400]); this._seq(l); }
  woodpecker() { for (let i = 0; i < 16; i++) setTimeout(() => this._burst(2200, 2.5, 0.025, 0.1, 'bandpass'), i * 52); }
  crow() { const n = 2 + ((Math.random() * 2) | 0); for (let i = 0; i < n; i++) setTimeout(() => { this._burst(800, 3, 0.3, 0.2, 'bandpass', 0.7); this._tone(440, 0.3, 0.05, 'sawtooth', 270); }, i * 520); }
  jay() { for (let i = 0; i < 2; i++) setTimeout(() => { this._tone(2400, 0.17, 0.035, 'square', 1800); this._burst(2600, 2.5, 0.17, 0.12, 'bandpass', 0.7); }, i * 280); }
  honk() { const n = 2 + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) setTimeout(() => { this._tone(540 + Math.random() * 60, 0.34, 0.05, 'sawtooth', 430); this._burst(700, 2, 0.34, 0.12, 'bandpass'); }, i * 430 + Math.random() * 100); }
  hawkCry() { this._burst(3600, 1.5, 1.2, 0.1, 'bandpass', 0.5); this._tone(3300, 0.9, 0.03, 'sawtooth', 2000); }
  peep() { this._tone(2800 + Math.random() * 300, 0.09, 0.022, 'sine', 3300); }
  cricket() { for (let i = 0; i < 4; i++) setTimeout(() => this._tone(4300 + Math.random() * 200, 0.022, 0.014, 'sine'), i * 38); }
  bullfrog() { this._tone(130, 0.28, 0.07, 'sawtooth', 100); setTimeout(() => this._tone(110, 0.2, 0.06, 'sawtooth', 90), 330); }
  owl() { if (!this.ready) return; [[0, 0.22], [0.3, 0.2], [0.6, 0.2], [0.95, 0.26], [1.6, 0.2], [1.9, 0.2], [2.2, 0.2], [2.55, 0.5]].forEach(([d, l]) => setTimeout(() => this._tone(l > 0.4 ? 330 : 400, l, 0.06, 'sine', l > 0.4 ? 260 : 390), d * 1000)); }
  coyote() { if (!this.ready) return; const n = 5 + ((Math.random() * 5) | 0); for (let i = 0; i < n; i++) setTimeout(() => this._tone(700 + Math.random() * 500, 0.22, 0.03, 'sawtooth', 900 + Math.random() * 400), i * 190 + Math.random() * 80); setTimeout(() => this._tone(620, 1.4, 0.04, 'sine', 980), n * 190); }
  snort() { if (!this.ready) return; this._burst(900, 1.2, 0.18, 0.16, 'bandpass', 0.6); setTimeout(() => this._burst(700, 1.2, 0.22, 0.14, 'bandpass', 0.5), 260); }
  creak() { this._tone(110 + Math.random() * 60, 0.9, 0.025, 'sawtooth', 70 + Math.random() * 30); }
  bird() { this._song(SEASON); }
  _song(season) {
    if (!this.ready) return;
    const pick = (l) => l[(Math.random() * l.length) | 0];
    const t = { spring: ['robin', 'robin', 'cardinal', 'cardinal', 'wren', 'chickadee', 'woodpecker'], summer: ['cardinal', 'cardinal', 'vireo', 'vireo', 'robin', 'wren', 'jay'], autumn: ['chickadee', 'chickadee', 'jay', 'jay', 'crow', 'crow', 'cardinal'], winter: ['chickadee', 'chickadee', 'chickadee', 'crow', 'jay'] }[season];
    this[pick(t)]();
  }
  update(dt, s) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, evening = s.mood >= 2 ? 1 : s.mood === 1 ? 0.3 : 0;
    const gust = 0.5 + 0.5 * Math.sin(t * 0.23) * Math.sin(t * 0.11 + 1);
    // the wind bed and the leaves it moves through, by season
    const w = { spring: [0.045, 0.012], summer: [0.03, 0.015], autumn: [0.06, 0.035], winter: [0.07, 0.0] }[SEASON];
    this.wind.g.gain.setTargetAtTime(w[0] * (0.7 + 0.6 * gust) + s.wind * 0.03, t, 0.4);
    this.wind.f.frequency.setTargetAtTime((SEASON === 'winter' ? 260 : 350) + 150 * Math.sin(t * 0.21), t, 0.5);
    this.rustle.g.gain.setTargetAtTime(w[1] * (0.3 + gust), t, 0.5);
    this.rustle.f.frequency.setTargetAtTime(2600 + 900 * gust, t, 0.5);
    // lapping loudest at the water's edge
    const near = Math.max(0, 1 - Math.max(0, s.sdf) / 45) * (s.lakeFrac);
    this.lap.g.gain.setTargetAtTime((SEASON === 'winter' ? 0.025 : 0.045) * near, t, 0.5);
    this.gateSnd.g.gain.setTargetAtTime(s.gate ? 0.18 : 0, t, 0.3);
    // summer: cicadas through the day, swelling and fading
    const cic = SEASON === 'summer' ? (1 - evening * 0.7) * (0.55 + 0.45 * Math.sin(t * 0.13)) : 0;
    this.cicada.g.gain.setTargetAtTime(0.012 * cic, t, 0.8);
    this.cicadaLfo.gain.setTargetAtTime(0.012 * cic, t, 0.8);
    // birds: busy in spring, steady in summer, sparse in autumn, a few in winter
    this.birdT -= dt;
    if (this.birdT < 0) {
      const iv = { spring: [1.5, 3.5], summer: [2.5, 6], autumn: [3, 8], winter: [9, 20] }[SEASON];
      this.birdT = (iv[0] + Math.random() * (iv[1] - iv[0])) * (1 + evening * 1.5);
      if (s.sdf > -5) this.bird();
    }
    // night-ish insects and frogs
    this.insectT -= dt;
    if (this.insectT < 0) {
      this.insectT = 0.3 + Math.random() * 0.5;
      const cr = { summer: 0.3 + evening * 0.7, autumn: evening * 0.35, spring: 0, winter: 0 }[SEASON];
      if (Math.random() < cr) this.cricket();
      if (SEASON === 'spring' && s.sdf < 40 && Math.random() < 0.35 + evening * 0.6) for (let i = 0; i < 1 + ((Math.random() * 3) | 0); i++) setTimeout(() => this.peep(), i * 90 + Math.random() * 60);
    }
    this.frogT -= dt;
    if (this.frogT < 0) { this.frogT = 4 + Math.random() * 9; if (SEASON === 'summer' && s.sdf < 30 && s.lakeFrac > 0.5) this.bullfrog(); }
    // night: owls from the dusk on, coyotes only in the dark
    this.nightT = (this.nightT ?? 12) - dt;
    if (this.nightT < 0) { this.nightT = 10 + Math.random() * 22; if (s.mood >= 2 && Math.random() < 0.7) this.owl(); else if (s.mood === 3 && Math.random() < 0.8) this.coyote(); }
    this.creakT -= dt;
    if (this.creakT < 0) { this.creakT = 14 + Math.random() * 25; if (SEASON === 'winter') this.creak(); }
    // a hawk's cry now and then (the hawk itself is drawn by Birds)
    if (s.hawk) { this.hawkT -= dt; if (this.hawkT < 0) { this.hawkT = 25 + Math.random() * 35; this.hawkCry(); } }
    if (s.geese) { this.honkT = (this.honkT ?? 0) - dt; if (this.honkT < 0) { this.honkT = 2.5 + Math.random() * 3; this.honk(); } }
  }
}

// Every voice reports itself so the Field Guide can log songs you actually hear.  Replays from the guide use the raw originals.
export const RAW_VOICES = {};
for (const v of ['chickadee', 'cardinal', 'robin', 'wren', 'vireo', 'woodpecker', 'crow', 'jay', 'honk', 'hawkCry', 'peep', 'cricket', 'bullfrog', 'owl', 'coyote']) {
  const f = RAW_VOICES[v] = Audio.prototype[v];
  Audio.prototype[v] = function (...a) { if (this.ready) this.onHeard?.(v); return f.apply(this, a); };
}
Audio.prototype.shutter = function () { if (!this.ready) return; this._burst(3000, 1.2, 0.05, 0.25, 'bandpass'); setTimeout(() => this._burst(1800, 1.2, 0.07, 0.2, 'bandpass'), 70); };
Audio.prototype.replay = function (v) { if (this.ready) RAW_VOICES[v]?.call(this); };
