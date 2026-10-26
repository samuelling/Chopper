// Everything synthesised with WebAudio: no asset files.
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
    this.ready = true;
    this.birdT = 3;
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
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
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
  footstep(kind) {
    if (kind === 'water') this._burst(1400, 0.8, 0.22, 0.25, 'bandpass', 0.5);
    else if (kind === 'dam') this._burst(500, 1.2, 0.09, 0.22);
    else this._burst(2600 + Math.random() * 900, 0.6, 0.14, 0.2, 'highpass');
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
  bird() {
    if (!this.ready) return;
    const base = 1800 + Math.random() * 2200, n = 2 + (Math.random() * 3) | 0;
    for (let i = 0; i < n; i++) setTimeout(() => this._tone(base * (1 + Math.random() * 0.25), 0.09, 0.05, 'sine', base * (0.8 + Math.random() * 0.6)), i * 130);
  }
  update(dt, s) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(0.05 + 0.04 * Math.sin(t * 0.3) + s.wind * 0.04, t, 0.4);
    this.wind.f.frequency.setTargetAtTime(350 + 150 * Math.sin(t * 0.21), t, 0.5);
    // lapping loudest at the water's edge
    const near = Math.max(0, 1 - Math.max(0, s.sdf) / 45) * (s.lakeFrac);
    this.lap.g.gain.setTargetAtTime(0.045 * near, t, 0.5);
    this.gateSnd.g.gain.setTargetAtTime(s.gate ? 0.18 : 0, t, 0.3);
    this.birdT -= dt;
    if (this.birdT < 0) { this.birdT = 2 + Math.random() * 6; if (s.sdf > -5) this.bird(); }
  }
}
