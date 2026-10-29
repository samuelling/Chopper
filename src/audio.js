// Everything synthesised with WebAudio: no asset files.
import { SEASON } from './season.js';
import { installWaterSounds } from './watersound.js';

export class Audio {
  constructor() { this.ctx = null; this.ready = false; }
  /** iOS (and iPadOS) only let sound start inside a tap or a key press: this is called from the first one, and from
   *  every one after while the sound is suspended (iOS suspends it when you leave the app).  It makes the sound ready
   *  but silent; init() then fades it in when the game starts, from wherever that happens (a timer, the fly-in). */
  unlock() {
    // iPhone: web sound is 'ambient' by default, which the ring/silent switch mutes entirely; a game wants to be heard
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch {}
    if (this.ctx) { if (this.ctx.state !== 'running') { this.ctx.resume?.()?.catch?.(() => {}); this._kick(); } return; }
    this._quiet = true; this.init();
  }
  /** the game wants sound and the browser has not let it start (iOS after a reload, until a real tap) */
  get blocked() { return !!this.wanted && (!this.ctx || this.ctx.state !== 'running'); }
  _kick() { try { const ctx = this.ctx, sb = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = sb; src.connect(ctx.destination); src.start(0); } catch {} }
  init() {
    this.wanted = true;   // the game has asked for sound (so if it is not playing, the browser is holding it back)
    if (this.ctx) {
      this.ctx.resume();
      if (this._quiet) { this._quiet = false; this.master.gain.setTargetAtTime(0.7, this.ctx.currentTime + 0.05, 1.2); }   // the only automation on it, so nothing can hold it at 0
      return;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    try { this.master = new GainNode(ctx, { gain: 0 }); } catch { this.master = ctx.createGain(); this.master.gain.value = 0; }   // starts silent without a scheduled value
    if (!this._quiet) this.master.gain.setTargetAtTime(0.7, ctx.currentTime + 0.05, 1.2);
    this._kick();   // iOS: a silent sound inside the tap opens the output
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.22; this.master.connect(comp); this.muff = ctx.createBiquadFilter(); this.muff.type = 'lowpass'; this.muff.frequency.value = 22000; this.muff.Q.value = 0.5; comp.connect(this.muff); this.muff.connect(ctx.destination);   // fades in rather than starting at full
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let b0 = 0; for (let i = 0; i < len; i++) { b0 = 0.97 * b0 + (Math.random() * 2 - 1) * 0.2; d[i] = b0 * 3; }
    // wind bed
    this.wind = this._loop(380, 0.4, 0.02);
    this.lap = this._loop(900, 0.6, 0.0);
    this.gateSnd = this._loop(140, 1.5, 0.0);
    this.rustle = this._loop(3200, 0.6, 0.0);          // wind in the leaves
    this.rainHi = this._loop(5200, 0.5, 0.0); this.rainLo = this._loop(1100, 0.4, 0.0);   // rain on leaves and on the ground
    this.cicada = this._loop(3900, 2.2, 0.0);            // summer: the drone of cicadas, pulsing
    const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 0.0;
    lfo.connect(lg); lg.connect(this.cicada.g.gain); lfo.start(); this.cicadaLfo = lg;
    // crickets: a few steady, softly filtered chirpers (three quick pulses each) rather than random beeps
    this.cricketG = ctx.createGain(); this.cricketG.gain.value = 0;
    const clp = ctx.createBiquadFilter(); clp.type = 'lowpass'; clp.frequency.value = 5200; clp.Q.value = 0.3;
    this.cricketG.connect(clp); clp.connect(this.master);
    this.chirpers = [0, 1, 2, 3].map((i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 3900 + i * 190 + Math.random() * 60;
      const g = ctx.createGain(); g.gain.value = 0; const pn = ctx.createStereoPanner(); pn.pan.value = -0.8 + i * 0.5;
      o.connect(g); g.connect(pn); pn.connect(this.cricketG); o.start();
      return { g, next: ctx.currentTime + Math.random(), period: 0.75 + Math.random() * 0.5 };
    });
    this.ready = true;
    this.birdT = 3; this.insectT = 1; this.frogT = 4; this.creakT = 12; this.hawkT = 30;
  }
  /** let everything sink away over `sec` seconds (the season turning through black) */
  /** head under the surface: the world goes dull and far away */
  /** a phone notification: two soft, bright notes */
  notify() { if (!this.ready) return; this._tone(1318.5, 0.5, 0.05, 'sine'); setTimeout(() => this._tone(1975.5, 0.7, 0.04, 'sine'), 120); }
  setUnder(on) { if (!this.ready) return; this.muff.frequency.setTargetAtTime(on ? 520 : 22000, this.ctx.currentTime, on ? 0.12 : 0.18); }
  fadeOut(sec = 1.5) { if (!this.ready) return; const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setValueAtTime(this.master.gain.value, t); this.master.gain.linearRampToValueAtTime(0, t + sec); }
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
    s.connect(f); f.connect(g); g.connect(this._dest || this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  _tone(freq, dur, gain, type = 'sine', endFreq = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this._dest || this.master); o.start(t); o.stop(t + dur + 0.05);
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
  _seq(list) { const dest = this._dest; list.forEach(([dt, f, d, g, f2, type]) => setTimeout(() => { const was = this._dest; this._dest = dest; this._tone(f, d, g, type || 'sine', f2 || null); this._dest = was; }, dt * 1000)); }
  /** a song from one side and a distance: pan -1 (left) .. 1 (right), vol 0..1 */
  songAt(name, pan, vol) {
    if (!this.ready || !this[name]) return;
    const ctx = this.ctx, p = ctx.createStereoPanner(), g = ctx.createGain(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.gain.value = vol; p.connect(g); g.connect(this.master);
    const was = this._dest; this._dest = p; try { this[name](); } finally { this._dest = was; }
    setTimeout(() => { try { p.disconnect(); g.disconnect(); } catch {} }, 4000);
  }
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
  cricket() { for (let i = 0; i < 3; i++) setTimeout(() => this._tone(3900 + Math.random() * 100, 0.026, 0.012, 'sine'), i * 34); }
  bullfrog() { this._tone(130, 0.28, 0.07, 'sawtooth', 100); setTimeout(() => this._tone(110, 0.2, 0.06, 'sawtooth', 90), 330); }
  // ---- more birds.  All synthesised: each is a sketch of the real song, close enough to learn it by (shape, pitch, rhythm)
  titmouse() { const l = []; for (let i = 0; i < 3 + ((Math.random() * 2) | 0); i++) { l.push([i * 0.42, 3600, 0.12, 0.05, 3400]); l.push([i * 0.42 + 0.15, 2500, 0.16, 0.05, 2300]); } this._seq(l); }   // peter, peter, peter
  nuthatch() { const n = 2 + ((Math.random() * 3) | 0), l = []; for (let i = 0; i < n; i++) l.push([i * 0.28, 720, 0.12, 0.03, 690, 'sawtooth']); this._seq(l); }   // yank, yank
  dove() { this._seq([[0, 520, 0.28, 0.05, 580], [0.35, 600, 0.5, 0.06, 520], [1.0, 480, 0.42, 0.05, 470], [1.55, 470, 0.42, 0.05, 460], [2.1, 460, 0.45, 0.05, 445]]); }   // coo-OOO, oo, oo, oo
  redwing() { const l = [[0, 1800, 0.08, 0.04, 2300], [0.12, 2700, 0.08, 0.04, 2500]]; for (let i = 0; i < 14; i++) l.push([0.25 + i * 0.04, i % 2 ? 4300 : 3800, 0.035, 0.035, null, 'triangle']); this._seq(l); }   // konk-la-REEE
  songsparrow() { const l = [[0, 3200, 0.09, 0.05], [0.2, 3200, 0.09, 0.05], [0.4, 3200, 0.09, 0.05], [0.6, 4400, 0.28, 0.04, 3000]]; for (let i = 0; i < 9; i++) l.push([0.95 + i * 0.05, 3600 + (i % 3) * 250, 0.04, 0.035]); this._seq(l); }   // maids, maids, maids, put on your tea-kettle-ettle-ettle
  phoebe() { this._seq([[0, 4100, 0.17, 0.035, 3800, 'sawtooth'], [0.26, 3300, 0.22, 0.035, 3650, 'sawtooth']]); }   // a buzzy fee-bree
  catbird() { if (Math.random() < 0.5) { this._seq([[0, 1700, 0.15, 0.045, 2400], [0.15, 2400, 0.22, 0.045, 1600]]); return; } const l = []; for (let i = 0; i < 9; i++) l.push([i * 0.15, 1600 + Math.random() * 2600, 0.09, 0.04, 1600 + Math.random() * 2600]); this._seq(l); }   // a cat's mew, or a long jumble
  goldfinch() { this._seq([[0, 3600, 0.06, 0.04, 3900], [0.1, 3100, 0.05, 0.04], [0.19, 3400, 0.05, 0.04], [0.28, 3900, 0.07, 0.04, 3600]]); }   // po-ta-to-chip
  woodthrush() { const b = 1700 + Math.random() * 400, l = [[0, b, 0.18, 0.05], [0.22, b * 1.25, 0.16, 0.05], [0.42, b * 1.5, 0.22, 0.05, b * 1.45]]; for (let i = 0; i < 7; i++) l.push([0.7 + i * 0.03, 4200 + (i % 2) * 700, 0.025, 0.03]); this._seq(l); }   // ee-oh-LAY, and a shimmering trill
  towhee() { const l = [[0, 2600, 0.12, 0.05], [0.18, 3500, 0.08, 0.045]]; for (let i = 0; i < 10; i++) l.push([0.32 + i * 0.03, 3100 + (i % 2) * 220, 0.022, 0.04]); this._seq(l); }   // drink your tea-ea-ea
  kingfisher() { const l = []; for (let i = 0; i < 18; i++) l.push([i * 0.045, 2500 + Math.random() * 400, 0.025, 0.03, null, 'sawtooth']); this._seq(l); }   // a dry rattle over the water
  pileated() { const l = []; for (let i = 0; i < 9; i++) l.push([i * 0.13, 1250 - i * 20, 0.08, 0.035, 1150 - i * 20, 'square']); this._seq(l); }   // a wild kuk-kuk-kuk through the woods
  pewee() { this._seq([[0, 3600, 0.16, 0.04, 4200], [0.2, 4200, 0.14, 0.04, 3400], [0.45, 3400, 0.45, 0.04, 4300]]); }   // pee-a-weee, lazy and slurred
  tanager() { const l = []; let t = 0; for (let i = 0; i < 5; i++) { const f = 2300 + Math.random() * 900; l.push([t, f, 0.12, 0.035, f * 0.85, 'sawtooth']); t += 0.2; } this._seq(l); }   // a robin with a sore throat
  // migrants
  chip() { this._seq([[0, 5400, 0.035, 0.03, 4800]]); }
  hum() { this._seq([[0, 190, 0.45, 0.035, 182, 'sawtooth']]); }   // a hummingbird's wings
  loon() { if (Math.random() < 0.6) this._seq([[0, 560, 0.9, 0.06, 760], [0.95, 760, 1.4, 0.06, 900], [2.45, 900, 1.1, 0.05, 700]]); else { const l = []; for (let i = 0; i < 12; i++) l.push([i * 0.11, i % 2 ? 900 : 760, 0.09, 0.05]); this._seq(l); } }   // the wail, or the tremolo
  peent() { this._seq([[0, 2800, 0.16, 0.035, 2650, 'sawtooth']]); }
  crane() { const l = []; for (let i = 0; i < 16; i++) l.push([i * 0.06, i % 2 ? 820 : 700, 0.05, 0.05, null, 'square']); this._seq(l); }   // a rolling, bugling garoo-oo
  yrwarbler() { const l = []; for (let i = 0; i < 12; i++) l.push([i * 0.07, 3800 + Math.sin(i * 0.6) * 500, 0.05, 0.035]); this._seq(l); }   // a loose, wandering trill
  magnolia() { this._seq([[0, 4800, 0.1, 0.035, 5600], [0.14, 4800, 0.1, 0.035, 5600], [0.3, 5400, 0.12, 0.035, 6200], [0.46, 6000, 0.08, 0.035, 4800]]); }   // weety, weety, weeteo
  oriole() { this._seq([[0, 2400, 0.18, 0.05, 2700], [0.24, 2900, 0.15, 0.05], [0.44, 2200, 0.26, 0.05, 2500], [0.8, 2600, 0.18, 0.05, 2300], [1.05, 3000, 0.2, 0.05, 2800]]); }   // rich flute whistles
  grosbeak() { const l = []; let t = 0; for (let i = 0; i < 7; i++) { const f = 2200 + Math.random() * 1500; l.push([t, f, 0.11, 0.05, f * (0.85 + Math.random() * 0.4)]); t += 0.12 + Math.random() * 0.06; } this._seq(l); }   // a robin with voice lessons
  kinglet() { const l = []; for (let i = 0; i < 4; i++) l.push([i * 0.1, 7000, 0.04, 0.025]); for (let i = 0; i < 6; i++) l.push([0.5 + i * 0.07, 3500 + (i % 2) * 700, 0.05, 0.035]); for (let i = 0; i < 3; i++) l.push([0.95 + i * 0.22, 4400, 0.08, 0.035, 3600]); this._seq(l); }   // tsee-tsee, chatter, look-at-me
  junco() { const f = 4300 + Math.random() * 500, l = []; for (let i = 0; i < 16; i++) l.push([i * 0.055, f, 0.035, 0.035]); this._seq(l); }   // a ringing one-note trill
  wtsparrow() { const l = [[0, 3300, 0.55, 0.05], [0.62, 4100, 0.5, 0.05]]; for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) l.push([1.2 + k * 0.38 + j * 0.12, 4100 - (j ? 200 : 0), 0.1, 0.045]); this._seq(l); }   // Old Sam Peabody, Peabody, Peabody
  treesparrow() { const l = []; for (let i = 0; i < 8; i++) l.push([i * 0.09, 4000 + Math.random() * 1500, 0.07, 0.035, 3500 + Math.random() * 1500]); this._seq(l); }
  waxwing() { const l = []; for (let i = 0; i < 10; i++) l.push([i * 0.04, 7400 + (i % 2) * 300, 0.035, 0.02]); this._seq(l); }   // a high, thin, buzzy sreee
  evegrosbeak() { this._seq([[0, 3300, 0.17, 0.045, 2800], [0.4, 3300, 0.17, 0.045, 2800]]); }   // cleer! cleer!
  crossbill() { const l = []; for (let i = 0; i < 4; i++) l.push([i * 0.16, 3900, 0.05, 0.04, 3500]); this._seq(l); }   // kip kip kip
  prothonotary() { const l = []; for (let i = 0; i < 6; i++) l.push([i * 0.17, 4200, 0.12, 0.045, 4800]); this._seq(l); }   // sweet sweet sweet
  swan() { this._seq([[0, 700, 0.25, 0.045, 760], [0.4, 650, 0.3, 0.045, 700]]); }   // soft hooting woo-woo
  /** the data center (ending): the low electrical hum (60 Hz and its harmonics, the tone neighbours complain of), two
   *  slightly detuned fan tones beating, a broad roar of fans, and a faint high whine.  v: 0 (gone) to 1 (at the fence) */
  dcHum(v) {
    if (!this.ready) return;
    const c = this.ctx;
    if (!this._dc) {
      // everything runs through a soft-clipping distortion, for grit, then a master gain that swells slowly, like breathing
      const out = c.createGain(); out.gain.value = 0;
      const lim = c.createDynamicsCompressor(); lim.threshold.value = -5; lim.knee.value = 3; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12; out.connect(lim); lim.connect(this.master);   // a limiter: as loud as it can go without clipping
      const swell = c.createGain(); swell.gain.value = 0.85; swell.connect(out);
      const sl = c.createOscillator(), sld = c.createGain(); sl.frequency.value = 0.11; sld.gain.value = 0.22; sl.connect(sld); sld.connect(swell.gain); sl.start();
      const shaper = c.createWaveShaper(); { const n = 1024, cu = new Float32Array(n); for (let k = 0; k < n; k++) { const x = (k / (n - 1)) * 2 - 1; cu[k] = Math.tanh(x * 3.2); } shaper.curve = cu; shaper.oversample = '2x'; }
      const drive = c.createGain(); drive.gain.value = 0.9; drive.connect(shaper); shaper.connect(swell);
      // a throb on the electrical hum, faster as you get close
      const throb = c.createGain(); throb.gain.value = 0.75; throb.connect(drive);
      const tl = c.createOscillator(), tld = c.createGain(); tl.frequency.value = 1.6; tld.gain.value = 0.25; tl.connect(tld); tld.connect(throb.gain); tl.start();
      const oscs = [];
      const tone = (type, f, gn, dest) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; const gg = c.createGain(); gg.gain.value = gn; o.connect(gg); gg.connect(dest); o.start(); oscs.push(o); };
      // the electrical hum: 60 Hz and its harmonics (the tone neighbours complain of)
      tone('sine', 60, 0.55, throb); tone('sine', 120, 0.5, throb); tone('triangle', 180, 0.22, throb); tone('sawtooth', 240, 0.08, throb); tone('square', 360, 0.025, throb);
      // underneath, a deep drone a tritone below, and two fan tones beating against each other
      tone('sine', 42.4, 0.5, drive); tone('sawtooth', 84.8, 0.07, drive); tone('sine', 97, 0.18, drive); tone('sine', 99.6, 0.18, drive);
      // the fans: a broad roar
      const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; const ng = c.createGain(); ng.gain.value = 1.0; n.connect(lp); lp.connect(ng); ng.connect(swell); n.start();
      // the part phone speakers can play (they drop everything under ~200 Hz): the hum's upper harmonics as a buzzing
      // saw-and-square band from 240 Hz to 1.2 kHz, plus a hissing fan band -- the ear rebuilds the missing 60 Hz from them
      const mid = c.createBiquadFilter(); mid.type = 'bandpass'; mid.frequency.value = 520; mid.Q.value = 0.6;
      const midg = c.createGain(); midg.gain.value = 0.0; mid.connect(midg); midg.connect(throb);
      tone('sawtooth', 120, 0.55, mid); tone('square', 180, 0.22, mid); tone('sawtooth', 240.6, 0.3, mid); tone('sawtooth', 300, 0.16, mid); tone('square', 420, 0.06, mid);
      const n2 = c.createBufferSource(); n2.buffer = this.noiseBuf; n2.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8; const ng2 = c.createGain(); ng2.gain.value = 0; n2.connect(bp); bp.connect(ng2); ng2.connect(swell); n2.start();
      // a harsh high whine with a metallic ring, wavering
      const wg = c.createGain(); wg.gain.value = 0.02; wg.connect(out);
      const wl = c.createOscillator(), wld = c.createGain(); wl.frequency.value = 5.3; wld.gain.value = 0.012; wl.connect(wld); wld.connect(wg.gain); wl.start();
      for (const [f, gn] of [[6900, 1], [7350, 0.6], [1131, 0.5], [1517, 0.35]]) { const o = c.createOscillator(); o.type = f < 2000 ? 'triangle' : 'sine'; o.frequency.value = f; const gg = c.createGain(); gg.gain.value = gn; o.connect(gg); gg.connect(wg); o.start(); oscs.push(o); }
      this._dc = { out, tl, oscs, wg, midg, ng2, bp };
    }
    const D = this._dc, t = c.currentTime, k = Math.max(0, Math.min(1, v));
    D.out.gain.setTargetAtTime(Math.pow(k, 1.1) * 1.1, t, 0.6);                        // much louder, and earlier on the way in
    D.tl.frequency.setTargetAtTime(1.2 + k * 3.4, t, 1.5);                              // the throb quickens
    for (const o of D.oscs) o.detune.setTargetAtTime(k * 70, t, 2);                     // and everything creeps up in pitch
    D.midg.gain.setTargetAtTime(0.35 + k * 0.45, t, 0.8);                               // the buzz grows harsher close up
    D.ng2.gain.setTargetAtTime(0.25 + k * 0.5, t, 0.8); D.bp.frequency.setTargetAtTime(1100 + k * 900, t, 2);
    D.wg.gain.setTargetAtTime(0.02 + k * 0.03, t, 1);
  }
  // night voices that come from one place (panned by songAt, so they are built with _seq)
  trill() { const L = []; for (let i = 0; i < 16; i++) L.push([i * 0.045, 1250 + Math.random() * 40, 0.03, 0.035, 1180, 'triangle']); this._seq(L); }
  hoot() { this._seq([[0, 0.22], [0.3, 0.2], [0.6, 0.2], [0.95, 0.26], [1.6, 0.2], [1.9, 0.2], [2.2, 0.2], [2.55, 0.5]].map(([d, l]) => [d, l > 0.4 ? 330 : 400, l, 0.07, l > 0.4 ? 260 : 390])); }
  yip() { const n = 4 + ((Math.random() * 4) | 0), L = []; for (let i = 0; i < n; i++) L.push([i * 0.2, 700 + Math.random() * 500, 0.22, 0.035, 900 + Math.random() * 400, 'sawtooth']); L.push([n * 0.2, 620, 1.4, 0.045, 980]); this._seq(L); }
  chitter() { const L = []; for (let i = 0; i < 6; i++) L.push([i * 0.07, 1900 + Math.random() * 600, 0.05, 0.02, 1500, 'square']); this._seq(L); }
  owl() { if (!this.ready) return; [[0, 0.22], [0.3, 0.2], [0.6, 0.2], [0.95, 0.26], [1.6, 0.2], [1.9, 0.2], [2.2, 0.2], [2.55, 0.5]].forEach(([d, l]) => setTimeout(() => this._tone(l > 0.4 ? 330 : 400, l, 0.06, 'sine', l > 0.4 ? 260 : 390), d * 1000)); }
  coyote() { if (!this.ready) return; const n = 5 + ((Math.random() * 5) | 0); for (let i = 0; i < n; i++) setTimeout(() => this._tone(700 + Math.random() * 500, 0.22, 0.03, 'sawtooth', 900 + Math.random() * 400), i * 190 + Math.random() * 80); setTimeout(() => this._tone(620, 1.4, 0.04, 'sine', 980), n * 190); }
  thunder() { if (!this.ready) return; this._burst(110, 0.7, 2.6, 0.35, 'lowpass', 0.4); setTimeout(() => this._burst(70, 0.6, 2.2, 0.25, 'lowpass', 0.5), 600); }
  snort() { if (!this.ready) return; this._burst(900, 1.2, 0.18, 0.16, 'bandpass', 0.6); setTimeout(() => this._burst(700, 1.2, 0.22, 0.14, 'bandpass', 0.5), 260); }
  oarlock() { if (!this.ready) return; this._tone(150 + Math.random() * 60, 0.16, 0.022, 'square', 110); this._burst(900, 3, 0.1, 0.03, 'bandpass'); }
  dip(k = 1) { if (!this.ready) return; this._burst(1500, 1.1, 0.22, 0.1 * k, 'bandpass'); this._burst(500, 1, 0.3, 0.05 * k, 'lowpass'); }
  /** a legendary sighting: a bright, rising four-note chime */
  legend() { if (!this.ready) return; [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => this._tone(f, 0.9 - i * 0.1, 0.05, 'sine'), i * 110)); }
  /** a rifle shot a long way off, and its echo off the hills */
  shot() { if (!this.ready) return; this._burst(500, 0.8, 0.35, 0.3, 'lowpass', 0.5); this._tone(70, 0.4, 0.12, 'sine', 40); setTimeout(() => this._burst(380, 0.8, 0.6, 0.09, 'lowpass', 0.5), 420); }
  thud() { if (!this.ready) return; this._burst(180, 1, 0.22, 0.2, 'lowpass'); }
  castSwish() { if (!this.ready) return; this._burst(2600, 1.5, 0.28, 0.07, 'bandpass', 0.4); }
  plop() { if (!this.ready) return; this._tone(420, 0.1, 0.07, 'sine', 180); this._burst(1200, 1.5, 0.15, 0.07, 'bandpass'); }
  reelTick() { if (!this.ready) return; for (let i = 0; i < 9; i++) setTimeout(() => this._burst(3400, 3, 0.02, 0.05, 'bandpass'), i * 120); }
  strain(k = 1) { if (!this.ready) return; this._tone(700 + k * 500, 0.1, 0.018, 'sine', 900 + k * 500); }
  pull() { if (!this.ready) return; this._burst(700, 1.2, 0.18, 0.1, 'bandpass'); }
  snap() { if (!this.ready) return; this._burst(3800, 1, 0.1, 0.16, 'highpass'); this._tone(1800, 0.12, 0.05, 'sine', 400); }
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
    const t = this.ctx.currentTime, cr = s.credits, evening = cr === 'life' ? 0 : s.mood >= 2 ? 1 : s.mood === 1 ? 0.3 : 0;   // under the credits: a dawn chorus if the park lived
    // gentle gusts: a calm floor with a soft swell every few seconds, drawn at random
    this.gustT = (this.gustT ?? 0) - dt;
    if (this.gustT < 0) { this.gustT = 3 + Math.random() * 6; this.gustTo = Math.random() < 0.35 ? 0.6 + Math.random() * 0.4 : Math.random() * 0.3; }
    this.gustV = (this.gustV ?? 0.2) + ((this.gustTo ?? 0.2) - (this.gustV ?? 0.2)) * Math.min(1, dt / 2.2);
    const gust = this.gustV;
    // the wind bed and the leaves it moves through, by season
    const w = { spring: [0.022, 0.006], summer: [0.014, 0.007], autumn: [0.026, 0.014], winter: [0.034, 0.0] }[SEASON];
    this.wind.g.gain.setTargetAtTime(w[0] * (0.35 + 1.1 * gust) + s.wind * 0.015, t, 0.4);
    this.wind.f.frequency.setTargetAtTime((SEASON === 'winter' ? 220 : 280) + 200 * gust, t, 0.5);
    this.rustle.g.gain.setTargetAtTime(w[1] * (0.15 + 1.2 * gust * gust), t, 0.5);
    this.rustle.f.frequency.setTargetAtTime(2200 + 800 * gust, t, 0.5);
    // lapping loudest at the water's edge
    const near = cr ? (cr === 'life' ? 0.55 : 0) : Math.max(0, 1 - Math.max(0, s.sdf) / 45) * (s.lakeFrac);   // the drone follows the shore
    this.lap.g.gain.setTargetAtTime((SEASON === 'winter' ? 0.025 : 0.045) * near, t, 0.5);
    const rn = s.rain || 0; this.rainHi.g.gain.setTargetAtTime(s.snow ? 0 : 0.05 * rn, t, 0.8); this.rainLo.g.gain.setTargetAtTime(s.snow ? 0 : 0.035 * rn, t, 0.8);
    this.gateSnd.g.gain.setTargetAtTime(s.gate ? 0.18 : 0, t, 0.3);
    // summer: cicadas through the day, swelling and fading
    const cic = SEASON === 'summer' ? (1 - evening * 0.7) * (0.35 + 0.65 * Math.max(0, Math.sin(t * 0.17))) : SEASON === 'autumn' ? 0.18 * (1 - evening) * Math.max(0, Math.sin(t * 0.11)) : 0;
    this.cicada.g.gain.setTargetAtTime(0.018 * cic, t, 1.2);
    this.cicadaLfo.gain.setTargetAtTime(0.008 * cic, t, 1.2);
    // birds: busy in spring, steady in summer, sparse in autumn, a few in winter
    this.birdT -= dt;
    if (this.birdT < 0) {
      const iv = { spring: [1.5, 3.5], summer: [2.5, 6], autumn: [3, 8], winter: [18, 45] }[SEASON];
      this.birdT = (iv[0] + Math.random() * (iv[1] - iv[0])) * (1 + evening * 1.5) * (cr === 'life' ? 0.4 : cr ? 2.5 : 1);
      if ((s.sdf > -5 || cr) && !(s.rain > 0.35)) this.bird();
    }
    // night-ish insects and frogs
    // the cricket chorus: loudest at dusk and night, and only while it is warm
    const cl = { summer: 0.5 + evening * 0.5, autumn: 0.25 + evening * 0.35, spring: 0, winter: 0 }[SEASON] * (s.rain > 0.35 ? 0.3 : 1);
    this.cricketG.gain.setTargetAtTime(0.03 * cl, t, 1.5);
    if (cl > 0) {
      for (const ch of this.chirpers) {
        while (ch.next < t + 0.4) {
          if (Math.random() < 0.8) for (let p = 0; p < 3; p++) { const tp = Math.max(ch.next, t) + p * 0.034; ch.g.gain.setValueAtTime(0, tp); ch.g.gain.linearRampToValueAtTime(1, tp + 0.006); ch.g.gain.linearRampToValueAtTime(0, tp + 0.024); }
          ch.next += ch.period * (0.9 + Math.random() * 0.25);
        }
      }
      this.heardT = (this.heardT ?? 20) - dt; if (this.heardT < 0) { this.heardT = 40; this.onHeard?.('cricket'); }
    }
    this.insectT -= dt;
    if (this.insectT < 0) {
      this.insectT = 0.3 + Math.random() * 0.5;
      if (SEASON === 'spring' && s.sdf < 40 && Math.random() < 0.35 + evening * 0.6) for (let i = 0; i < 1 + ((Math.random() * 3) | 0); i++) setTimeout(() => this.peep(), i * 90 + Math.random() * 60);
    }
    // the rest of the resident birds: by season, by time of day (wood thrushes and pewees at dusk), and by place
    // (red-winged blackbirds and kingfishers by the water)
    this.birdT2 = (this.birdT2 ?? 6) - dt;
    if (this.birdT2 < 0 && cr !== 'death') {
      this.birdT2 = 5 + Math.random() * 9;
      const water = s.sdf < 35, dusk = s.mood === 2, night = s.mood === 3;
      const pool = night ? [] : {
        spring: ['titmouse', 'titmouse', 'nuthatch', 'dove', 'songsparrow', 'phoebe', 'towhee', 'goldfinch', ...(water ? ['redwing', 'redwing', 'kingfisher'] : []), 'pileated'],
        summer: ['titmouse', 'dove', 'catbird', 'catbird', 'goldfinch', 'goldfinch', 'towhee', 'songsparrow', 'tanager', 'pewee', ...(dusk ? ['woodthrush', 'woodthrush', 'woodthrush', 'pewee'] : []), ...(water ? ['redwing', 'kingfisher'] : [])],
        autumn: ['titmouse', 'titmouse', 'nuthatch', 'nuthatch', 'dove', 'pileated', 'songsparrow', ...(water ? ['kingfisher'] : [])],
        winter: ['titmouse', 'nuthatch', 'nuthatch', 'dove', 'pileated'],
      }[SEASON];
      if (pool.length) this[pool[(Math.random() * pool.length) | 0]]();
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
for (const v of ['chickadee', 'cardinal', 'robin', 'wren', 'vireo', 'woodpecker', 'crow', 'jay', 'honk', 'hawkCry', 'peep', 'cricket', 'bullfrog', 'owl', 'coyote', 'trill', 'hoot', 'yip', 'titmouse', 'nuthatch', 'dove', 'redwing', 'songsparrow', 'phoebe', 'catbird', 'goldfinch', 'woodthrush', 'towhee', 'kingfisher', 'pileated', 'pewee', 'tanager', 'hum', 'loon', 'peent', 'crane', 'yrwarbler', 'magnolia', 'oriole', 'grosbeak', 'kinglet', 'junco', 'wtsparrow', 'treesparrow', 'waxwing', 'evegrosbeak', 'crossbill', 'prothonotary', 'swan']) {
  const f = RAW_VOICES[v] = Audio.prototype[v];
  Audio.prototype[v] = function (...a) { if (this.ready) this.onHeard?.(v); return f.apply(this, a); };
}
Audio.prototype.shutter = function () { if (!this.ready) return; this._burst(3000, 1.2, 0.05, 0.25, 'bandpass'); setTimeout(() => this._burst(1800, 1.2, 0.07, 0.2, 'bandpass'), 70); };
Audio.prototype.replay = function (v) { if (this.ready) RAW_VOICES[v]?.call(this); };

installWaterSounds(Audio);
