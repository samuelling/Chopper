// The score: now and then, a few bars of fingerpicked steel-string guitar drift in, ring out into a long reverb, and
// stop.  A light version of the Acoustic engine (samuelling/acoustic): each note is rendered once into a buffer from the
// same string physics (D'Addario EJ16 tensions and unit weights, Woodhouse et al. 2012 damping and stiffness, a steel
// parlor's 0.62 m scale), as inharmonic partials f_k = k f0 sqrt(1 + B k^2) with frequency-dependent loss, a finger
// pluck's position and contact width, and two slightly detuned polarizations.  The notes then share one body: a few
// of the measured low resonances (A0, the top-plate pair, the back, the dipoles) and the radiation highpass.  The right
// hand follows Acoustic's hand model: whole-hand drift (AR(1), rho 0.9) plus note-to-note jitter, finger-dependent
// loudness, and a ritardando at the end.
const TAU = Math.PI * 2, mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// steel parlor (Acoustic's PRESETS.parlor): low E first
const SCALE = 0.62, STRINGS = [
  { T: 103, EI: 534e-6, etaF: 5e-5, etaB: 1.3e-2, etaA: 1.7 }, { T: 119, EI: 262e-6, etaF: 11e-5, etaB: 1.1e-2, etaA: 1.2 },
  { T: 123, EI: 204e-6, etaF: 9e-5, etaB: 2.0e-2, etaA: 1.3 }, { T: 124, EI: 187e-6, etaF: 11e-5, etaB: 3.3e-2, etaA: 1.2 },
  { T: 96, EI: 267e-6, etaF: 6e-5 + 3.6e-4, etaB: 1.1e-2, etaA: 1.0 }, { T: 96, EI: 85e-6, etaF: 7e-5 + 3.6e-4, etaB: 0.7e-2, etaA: 2.5 }];
const OPEN = [40, 45, 50, 55, 59, 64], AIR = 0.75, POL = 0.0016;
// body: [Hz, Q, gain dB] from the parlor's low modes (A0, T11 pair, back, cross and long dipoles, quadrupole)
const BODY = [[118, 22, 7], [214, 30, 5], [230, 32, 4], [262, 38, 2.5], [330, 34, 2], [415, 36, 1.5], [480, 36, 1.5]];

// chord shapes, low E to high e (-1 = not played)
const SHAPES = {
  Am: [-1, 0, 2, 2, 1, 0], Am7: [-1, 0, 2, 0, 1, 0], C: [-1, 3, 2, 0, 1, 0], Cadd9: [-1, 3, 2, 0, 3, 0], G: [3, 2, 0, 0, 0, 3], G6: [3, 2, 0, 0, 0, 0],
  Em: [0, 2, 2, 0, 0, 0], Em7: [0, 2, 2, 0, 3, 0], D: [-1, -1, 0, 2, 3, 2], Dsus2: [-1, -1, 0, 2, 3, 0], Dm: [-1, -1, 0, 2, 3, 1],
  Fmaj7: [-1, -1, 3, 2, 1, 0], Bbmaj7: [-1, 1, 3, 2, 3, 1], E: [0, 2, 2, 1, 0, 0], A: [-1, 0, 2, 2, 2, 0], Asus2: [-1, 0, 2, 2, 0, 0], Gmaj7: [3, 2, 0, 0, 0, 2],
};
// a few progressions per season; a harmed park leans on the minor ones and plays slower
const PROG = {
  autumn: { bright: [['Am', 'Fmaj7', 'C', 'G'], ['C', 'G', 'Am', 'Fmaj7'], ['Em7', 'Cadd9', 'G', 'Dsus2']], dark: [['Am', 'Em', 'Fmaj7', 'Am'], ['Em', 'Am7', 'Em', 'E']] },
  winter: { bright: [['Dm', 'Bbmaj7', 'Fmaj7', 'C'], ['Am7', 'Fmaj7', 'C', 'G6']], dark: [['Dm', 'Am', 'Bbmaj7', 'Am'], ['Em', 'Am', 'Em', 'E']] },
  spring: { bright: [['G', 'Cadd9', 'Em7', 'Dsus2'], ['C', 'Am7', 'Fmaj7', 'G'], ['D', 'Gmaj7', 'Asus2', 'D']], dark: [['Em', 'Cadd9', 'Am', 'Em'], ['Am', 'Fmaj7', 'Dm', 'E']] },
  summer: { bright: [['D', 'Gmaj7', 'Asus2', 'D'], ['G', 'G6', 'Cadd9', 'G'], ['A', 'Dsus2', 'E', 'Asus2']], dark: [['Em', 'Am7', 'Em', 'Dsus2'], ['Am', 'Em', 'Fmaj7', 'E']] },
};
// right-hand patterns over eight 8ths: each step lists the fingers that pluck (p = thumb on the bass, b = alternate bass, i/m/a = strings 3/2/1)
export const PATTERNS = {
  arpeggio: [['p'], ['i'], ['m'], ['a'], ['m'], ['i'], ['m'], ['i']],
  travis: [['p', 'm'], ['i'], ['b'], ['m'], ['p'], ['i', 'a'], ['b'], ['m']],
  ballad: [['p', 'a'], [], ['i'], ['m'], ['p'], ['i'], ['m'], ['i']],
  sparse: [['p', 'a'], [], [], ['i'], ['m'], [], ['i'], []],
};
const FINGER_DB = { p: -1.5, b: -3, i: -0.5, m: 0.5, a: -1 };   // the middle finger loudest, the ring finger weakest, the thumb softer in accompaniment

function gauss(r) { return (r() + r() + r() + r() - 2) * 1.2247; }

export class Score {
  constructor(audio) {
    this.audio = audio; this.cache = new Map(); this.ready = false; this.busy = false; this.rng = Math.random;
    this.wait = 25 + Math.random() * 20;   // the first passage comes a little while into a season
    try { this.on = localStorage.getItem('ashland.music') !== '0'; } catch { this.on = true; }
    this.voices = new Array(6).fill(null);
  }
  setOn(v) { this.on = v; try { localStorage.setItem('ashland.music', v ? '1' : '0'); } catch {} if (!v) this.stop(); }
  _init() {
    const A = this.audio; if (this.ready || !A?.ready) return !!this.ready;
    const ctx = A.ctx; this.ctx = ctx;
    // the body: a bank of resonances in parallel with the direct string sound, then the radiation highpass
    const inp = ctx.createGain(), body = ctx.createGain(); body.gain.value = 1;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 108; hp.Q.value = 0.6;
    const air = ctx.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 9000;
    let node = inp; for (const [f, q, db] of BODY) { const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = f; b.Q.value = q / 6; b.gain.value = db * 0.6; node.connect(b); node = b; }
    node.connect(hp); hp.connect(air);
    // lots of reverb: a long, dark, slowly blooming tail (stereo, decorrelated), and only a little of the dry guitar
    const dry = ctx.createGain(); dry.gain.value = 0.32; const wet = ctx.createGain(); wet.gain.value = 1.0;
    const conv = ctx.createConvolver(); conv.buffer = this._ir(ctx, 6.5); const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.045;
    const out = ctx.createGain(); out.gain.value = 0;
    air.connect(dry); air.connect(pre); pre.connect(conv); conv.connect(wet); dry.connect(out); wet.connect(out); out.connect(A.master);
    Object.assign(this, { inp, out, dry, wet }); this.ready = true;
    // render the notes in the background, a few per idle moment, so the first passage never stalls the game
    this._queue = [...new Set(Object.values(SHAPES).flatMap((sh) => sh.map((f, s) => (f < 0 ? null : `${s}:${f}`)).filter(Boolean)))];
    return true;
  }
  _ir(ctx, sec) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, bloom = Math.min(1, t / 0.12), env = Math.exp(-t * 6.9 / sec) * bloom;   // RT60 = sec
        const k = 0.35 + 0.6 * Math.min(1, t / sec);                                                 // darker as it decays
        lp += (Math.random() * 2 - 1 - lp) * (1 - k); d[i] = lp * env;
      }
    }
    return b;
  }
  /** one note on string s at fret f, rendered from the string's physics (cached) */
  _note(s, f) {
    const key = `${s}:${f}`; if (this.cache.has(key)) return this.cache.get(key);
    const ctx = this.ctx, sr = Math.min(32000, ctx.sampleRate), dur = s < 2 ? 5.5 : 4.5, N = Math.floor(sr * dur);
    const st = STRINGS[s], L = SCALE * Math.pow(2, -f / 12), f0 = mtof(OPEN[s] + f), B = (Math.PI ** 2 * st.EI) / (st.T * L * L);
    const beta = s < 3 ? 0.2 : 0.16, w = 0.008;            // the thumb plucks a little nearer the soundhole; flesh touches ~8 mm of string
    const buf = ctx.createBuffer(1, N, sr), d = buf.getChannelData(0);
    for (let k = 1; k <= 48; k++) {
      const fk = k * f0 * Math.sqrt(1 + B * k * k); if (fk > 7500) break;
      const om = TAU * fk, kl = (k * Math.PI) / L;
      // Woodhouse's string loss, plus a share of the bridge's (which grows with frequency) and a fretted string's extra
      let eta = (st.T * (st.etaF + (st.etaA * AIR) / om) + st.EI * st.etaB * kl * kl) / (st.T + st.EI * kl * kl);
      eta += 3e-4 * (1 + fk / 450) + (f > 0 ? 2e-4 : 0);
      const amp = (Math.sin(k * Math.PI * beta) / k) * Math.exp(-0.5 * (k * Math.PI * w / L) ** 2);   // force at the bridge from a finger pluck
      if (Math.abs(amp) < 1e-4) continue;
      for (const [det, share, loss] of [[0, 0.62, 1], [POL, 0.38, 1.7]]) {   // two polarizations: one rings on, the other (driving the top) dies sooner
        const w1 = (om * (1 + det)) / sr, dec = Math.exp((-om * eta * loss) / 2 / sr), c = Math.cos(w1), sn = Math.sin(w1);
        let x = 0, y = amp * share, a = 1;
        for (let i = 0; i < N; i++) { const nx = x * c - y * sn; y = x * sn + y * c; x = nx; d[i] += y * a; a *= dec; if (a < 2e-5) break; }
      }
    }
    // a soft finger-flesh onset and the release of the string from the fingertip
    for (let i = 0; i < Math.min(N, sr * 0.004); i++) d[i] *= Math.sin((i / (sr * 0.004)) * Math.PI / 2);
    let pk = 0; for (let i = 0; i < Math.min(N, sr * 0.3); i++) pk = Math.max(pk, Math.abs(d[i]));
    const g = 0.5 / (pk || 1); for (let i = 0; i < N; i++) d[i] *= g;
    this.cache.set(key, buf); return buf;
  }
  _prerender(budgetMs = 8) {
    if (!this._queue?.length) return; const t0 = performance.now();
    while (this._queue.length && performance.now() - t0 < budgetMs) { const [s, f] = this._queue.shift().split(':').map(Number); this._note(s, f); }
  }
  stop() { if (!this.ready) return; const t = this.ctx.currentTime; this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, 0.8); this.busy = false; }
  /** one bar of fingerpicking from time t; returns when the bar ends.  o: { pat, e8, base, loose, last, rit } */
  _bar(name, t, o) {
    const r = this.rng, sh = SHAPES[name], played = sh.map((f, s) => (f >= 0 ? s : -1)).filter((s) => s >= 0);
    const bass = played[0], alt = played.find((s) => s >= 2 && s <= 3) ?? played[1], fingers = { p: bass, b: alt, i: 3, m: 4, a: 5 };
    const loose = o.loose ? 2 : 1, steps = o.last ? [o.pat[0]] : o.pat, now = this.ctx.currentTime;
    steps.forEach((step, k) => {
      this.drift = 0.9 * (this.drift || 0) + gauss(r) * 0.006 * loose;           // the whole hand drifts against the beat
      const swing = o.loose && k % 2 === 1 ? o.e8 * 0.08 : 0;                    // a casual player lilts the off-beats a little
      for (const fg of step) {
        const s = fingers[fg]; if (s == null || sh[s] < 0) continue;
        if (o.loose && fg !== 'p' && r() < 0.06) continue;                      // now and then a finger skips its note
        const jit = gauss(r) * Math.sqrt(0.004 ** 2 + ((o.loose ? 0.06 : 0.03) * o.e8) ** 2);
        const db = o.base + FINGER_DB[fg] + gauss(r) * (o.loose ? 3 : 2.2) + (k === 0 ? 2 : 0) - (step.length > 1 && fg !== 'p' ? 1 : 0);
        this._pluck(s, sh[s], Math.max(now, t + this.drift + swing + jit + (fg === 'a' && step.length > 1 ? 0.012 : 0)), Math.pow(10, db / 20));
      }
      t += o.e8 * (o.rit ? 1 + o.rit * (k / 8) : 1);
    });
    return o.last ? t + o.e8 * 6 : t;
  }
  _pluck(s, f, at, gain) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this._note(s, f);
    const g = ctx.createGain(); g.gain.value = gain; const pan = ctx.createStereoPanner(); pan.pan.value = -0.35 + s * 0.14;   // bass a little left, treble a little right
    src.connect(g); g.connect(pan); pan.connect(this.inp); src.start(at);
    const prev = this.voices[s]; if (prev && prev.end > at) prev.g.gain.setTargetAtTime(0, at, 0.02);   // a new note on a string stops the old one
    this.voices[s] = { g, end: at + src.buffer.duration };
  }
  _fadeIn(at, lvl = 0.9) { const now = this.ctx.currentTime; this.out.gain.cancelScheduledValues(now); this.out.gain.setValueAtTime(this.out.gain.value, now); this.out.gain.linearRampToValueAtTime(lvl, at); }
  /** a passage: a progression, a pattern, a tempo; returns how long it lasts */
  play(season = 'autumn', harm = 0) {
    if (!this._init() || !this.on || this.looping) return;
    const r = this.rng, P = PROG[season] || PROG.autumn, dark = r() < Math.min(0.85, 0.2 + harm), progs = dark ? P.dark : P.bright;
    let prog = progs[(r() * progs.length) | 0];
    if (r() < 0.35) prog = prog.slice(0, 2).concat([prog[0]]);              // sometimes only a short flourish
    const pat = PATTERNS[dark || season === 'winter' ? (r() < 0.5 ? 'sparse' : 'ballad') : ['arpeggio', 'travis', 'ballad', 'arpeggio'][(r() * 4) | 0]];
    const bpm = (season === 'winter' ? 58 : 66 + r() * 12) * (1 - 0.15 * harm), e8 = 30 / bpm, t0 = this.ctx.currentTime + 0.3, base = -9 + gauss(r);
    this._fadeIn(t0); let t = t0; this.drift = 0;
    prog.forEach((name, bar) => { t = this._bar(name, t, { pat, e8, base, last: bar === prog.length - 1, rit: bar === prog.length - 2 ? 0.12 : 0 }); });
    const end = t + 4, now = this.ctx.currentTime;
    this.out.gain.setValueAtTime(0.9, end - 3); this.out.gain.linearRampToValueAtTime(0, end);
    this.busy = true; this.until = end; return end - now;
  }
  /** a progression on repeat (the title screen, the credits), scheduled a bar ahead until stopLoop */
  loop(prog, { bpm = 72, loose = true, pats = ['travis', 'arpeggio', 'ballad'], lvl = 0.9 } = {}) {
    if (!this._init() || !this.on) return;
    this.stopLoop(0); this.looping = true; this.busy = true;
    for (const name of prog) SHAPES[name].forEach((f, s) => { if (f >= 0) this._note(s, f); });   // render these now
    const e8 = 30 / bpm; let t = this.ctx.currentTime + 0.4, i = 0, pat = PATTERNS[pats[0]];
    this._fadeIn(t + 1.5, lvl); this.drift = 0;
    const tick = () => {
      if (!this.looping) return;
      while (t < this.ctx.currentTime + 2.2) {
        if (i % prog.length === 0 && i) pat = PATTERNS[pats[(Math.random() * pats.length) | 0]];   // a fresh pattern each time round
        t = this._bar(prog[i % prog.length], t, { pat, e8: e8 * (1 + gauss(this.rng) * 0.02), base: -10 + gauss(this.rng) * 0.8, loose });
        i++;
      }
    };
    tick(); this._loopT = setInterval(tick, 400);
  }
  stopLoop(fade = 3) {
    if (!this.looping) return; this.looping = false; clearInterval(this._loopT);
    const now = this.ctx.currentTime; this.out.gain.cancelScheduledValues(now); this.out.gain.setValueAtTime(this.out.gain.value, now); this.out.gain.linearRampToValueAtTime(0, now + Math.max(0.05, fade));
    for (const v of this.voices) if (v) v.g.gain.setTargetAtTime(0, now + Math.max(0.05, fade), 0.1);
    this.busy = true; this.until = now + fade + 0.5; this.wait = Math.max(this.wait, 40);
  }
  /** every so often, a passage; sitting still brings one sooner */
  update(dt, { live, sitting, season, harm }) {
    if (!this.on || !this.audio?.ready) return;
    this._init(); this._prerender(live ? 6 : 14);
    if (this.looping) return;
    if (this.busy) { if (this.ctx.currentTime > this.until) this.busy = false; return; }
    if (!live) return;
    this.wait -= dt * (sitting ? 2.5 : 1);
    if (this.wait <= 0 && !this._queue.length) { this.play(season, harm); this.wait = 80 + Math.random() * 110; }
  }
}
