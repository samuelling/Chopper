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
  Bm7: [-1, 2, 0, 2, 0, 2], Bm: [-1, 2, 4, 4, 3, 2], 'F#m': [2, 4, 4, 2, 2, 2], F: [1, 3, 3, 2, 1, 1], Gm: [3, 5, 5, 3, 3, 3],
};
// right-hand styles from Acoustic's hand model (src/hand.js STYLES).  Tokens: finger:role, roles B = root bass, A =
// alternate bass (the chord's 5th where it can), T1/T2/T3 = the three highest chord strings; modifiers > accent,
// . ghost, _ palm-muted thumb.  swing: long/short ratio of off-beat pairs at slow tempo, easing toward even as tempo rises.
export const PATTERNS = {
  travis: { swing: 1.2, thumbDb: 0, steps: ['p:B_> m:T3', 'i:T2', 'p:A_', 'm:T3', 'p:B_', 'i:T2', 'p:A_', 'm:T3.'] },
  folk: { swing: 1, thumbDb: -1, steps: ['p:B>', 'i:T1', 'm:T2', 'i:T1', 'p:A', 'i:T1', 'm:T2', 'i:T1'] },
  ballad: { swing: 1, thumbDb: 0, steps: ['p:B> a:T3', 'i:T1', 'm:T2', 'i:T1', 'p:A m:T2', 'i:T1', 'a:T3', 'i:T1'] },
  classical: { swing: 1, thumbDb: 0, steps: ['p:B', 'i:T1', 'm:T2', 'a:T3', 'm:T2', 'i:T1', 'm:T2', 'i:T1'] },
  sparse: { swing: 1, thumbDb: -1, steps: ['p:B> a:T3', '-', '-', 'i:T1', 'p:A', '-', 'm:T2', '-'] },
};
for (const P of Object.values(PATTERNS)) P.parsed = P.steps.map((st) => (st === '-' ? [] : st.split(' ').map((tok) => { const [f, rest] = tok.split(':'), role = rest.replace(/[>._!]/g, ''); return { f, role, acc: rest.includes('>'), ghost: rest.includes('.'), palm: rest.includes('_') }; })));
const swingRatio = (P, bpm) => (P.swing > 1 ? 1 + (P.swing - 1) * Math.min(1, Math.max(0, (220 - bpm) / 120)) : 1);
/** which string each role plays for a chord shape */
function roles(sh) {
  const played = sh.map((f, s) => (f >= 0 ? s : -1)).filter((s) => s >= 0), B = played[0], root = (OPEN[B] + sh[B]) % 12;
  const A = played.find((s) => s !== B && s <= 3 && (OPEN[s] + sh[s]) % 12 === (root + 7) % 12) ?? played[1];
  const top = played.slice(-3); return { B, A, T1: top[0], T2: top[1], T3: top[2] };
}
const FINGER_DB = { p: -1.5, i: -0.5, m: 0.5, a: -1 };   // the middle finger loudest, the ring finger weakest, the thumb softer in accompaniment

// keys for the generated passages: scale steps, the tonic's pitch class, and the chords on each degree (first is plain, others colour)
const KEYS = {
  G: { major: true, pc: 7, steps: [0, 2, 4, 5, 7, 9, 11], chords: { I: ['G', 'G6', 'Gmaj7'], ii: ['Am', 'Am7'], iii: ['Bm7'], IV: ['C', 'Cadd9'], V: ['D', 'Dsus2'], vi: ['Em', 'Em7'] } },
  C: { major: true, pc: 0, steps: [0, 2, 4, 5, 7, 9, 11], chords: { I: ['C', 'Cadd9'], ii: ['Dm'], iii: ['Em', 'Em7'], IV: ['Fmaj7', 'F'], V: ['G', 'G6'], vi: ['Am', 'Am7'] } },
  D: { major: true, pc: 2, steps: [0, 2, 4, 5, 7, 9, 11], chords: { I: ['D', 'Dsus2'], ii: ['Em', 'Em7'], iii: ['F#m'], IV: ['G', 'Gmaj7'], V: ['A', 'Asus2'], vi: ['Bm', 'Bm7'] } },
  Em: { major: false, pc: 4, steps: [0, 2, 3, 5, 7, 8, 10], chords: { i: ['Em', 'Em7'], III: ['G', 'G6'], iv: ['Am', 'Am7'], v: ['Bm7'], V: ['Bm7'], VI: ['C', 'Cadd9'], VII: ['D', 'Dsus2'] } },
  Am: { major: false, pc: 9, steps: [0, 2, 3, 5, 7, 8, 10], chords: { i: ['Am', 'Am7'], III: ['C', 'Cadd9'], iv: ['Dm'], v: ['Em', 'Em7'], V: ['E'], VI: ['Fmaj7', 'F'], VII: ['G', 'G6'] } },
  Dm: { major: false, pc: 2, steps: [0, 2, 3, 5, 7, 8, 10], chords: { i: ['Dm'], III: ['F'], iv: ['Gm'], v: ['Am', 'Am7'], V: ['A'], VI: ['Bbmaj7'], VII: ['C', 'Cadd9'] } },
};
// where a chord tends to go next (weights): common-practice and folk habits
const MAJ = { I: { IV: 3, V: 2, vi: 3, ii: 1.5, iii: 0.7 }, ii: { V: 4, IV: 1, vi: 0.5 }, iii: { vi: 3, IV: 2 }, IV: { I: 3, V: 3, ii: 1, vi: 1 }, V: { I: 4, vi: 2, IV: 1 }, vi: { IV: 3, ii: 2, V: 1.5, iii: 0.5 } };
const MIN = { i: { iv: 2.5, VI: 3, VII: 2.5, III: 1.5, v: 1 }, III: { VI: 2, iv: 2, VII: 1.5 }, iv: { i: 2, VII: 2, v: 1.5, V: 1 }, v: { i: 2, VI: 2 }, V: { i: 4 }, VI: { VII: 3, iv: 2, III: 1.5, i: 1 }, VII: { i: 2.5, III: 2.5, VI: 1 } };

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
    // two spaces: a short, bright room for most of the game (mostly dry), and a long hall kept for the ending
    const dry = ctx.createGain(); dry.gain.value = 0.9; const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.02;
    const small = ctx.createConvolver(); small.buffer = this._ir(ctx, 1.4, 0.15); const big = ctx.createConvolver(); big.buffer = this._ir(ctx, 6.5, 0.35);
    const wetS = ctx.createGain(); wetS.gain.value = 0.22; const wetB = ctx.createGain(); wetB.gain.value = 0;
    const out = ctx.createGain(); out.gain.value = 0;
    air.connect(dry); air.connect(pre); pre.connect(small); pre.connect(big); small.connect(wetS); big.connect(wetB); dry.connect(out); wetS.connect(out); wetB.connect(out); out.connect(A.master);
    Object.assign(this, { inp, out, dry, wetS, wetB }); this.ready = true;
    // render the notes in the background, a few per idle moment, so the first passage never stalls the game
    this._queue = [...new Set(Object.values(SHAPES).flatMap((sh) => sh.map((f, s) => (f < 0 ? null : `${s}:${f}`)).filter(Boolean)))];
    return true;
  }
  /** 'light' (most of the game) or 'vast' (the ending: long reverb, less dry guitar) */
  space(kind, sec = 3) {
    if (!this._init()) return; const t = this.ctx.currentTime, v = kind === 'vast';
    this.dry.gain.setTargetAtTime(v ? 0.4 : 0.9, t, sec / 3); this.wetS.gain.setTargetAtTime(v ? 0 : 0.22, t, sec / 3); this.wetB.gain.setTargetAtTime(v ? 1.0 : 0, t, sec / 3);
  }
  _ir(ctx, sec, dark0 = 0.35) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, bloom = Math.min(1, t / 0.12), env = Math.exp(-t * 6.9 / sec) * bloom;   // RT60 = sec
        const k = dark0 + 0.6 * Math.min(1, t / sec);                                                // darker as it decays
        lp += (Math.random() * 2 - 1 - lp) * (1 - k); d[i] = lp * env;
      }
    }
    return b;
  }
  /** one note on string s at fret f, rendered from the string's physics (cached) */
  _note(s, f) {
    const key = `${s}:${f}`; if (this.cache.has(key)) return this.cache.get(key);
    const harm = f === 'h'; if (harm) f = 0;               // a natural harmonic at the 12th fret: a fingertip on the node silences the odd partials
    const ctx = this.ctx, sr = Math.min(32000, ctx.sampleRate), dur = s < 2 ? 5.5 : 4.5, N = Math.floor(sr * dur);
    const st = STRINGS[s], L = SCALE * Math.pow(2, -f / 12), f0 = mtof(OPEN[s] + f), B = (Math.PI ** 2 * st.EI) / (st.T * L * L);
    const beta = s < 3 ? 0.2 : 0.16, w = 0.008;            // the thumb plucks a little nearer the soundhole; flesh touches ~8 mm of string
    const buf = ctx.createBuffer(1, N, sr), d = buf.getChannelData(0);
    for (let k = 1; k <= 48; k++) {
      const fk = k * f0 * Math.sqrt(1 + B * k * k); if (fk > 7500) break; if (harm && k % 2) continue;
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
  /** one bar of fingerpicking from time t; returns when the bar ends.
   *  o: { pat (a PATTERNS entry), e8, bpm, base dB, loose, last, rit, melody(k, tok) -> [s, f] | null } */
  _bar(name, t, o) {
    const r = this.rng, sh = SHAPES[name], R = roles(sh), P = o.pat, sw = swingRatio(P, o.bpm || 30 / o.e8), loose = o.loose ? 2 : 1, now = this.ctx.currentTime;
    const steps = o.last ? [P.parsed[0]] : P.parsed, pair = 2 * o.e8;
    steps.forEach((step, k) => {
      this.drift = 0.9 * (this.drift || 0) + gauss(r) * 0.006 * loose;           // the whole hand drifts against the beat
      const off = k % 2 ? pair * (sw / (1 + sw) - 0.5) : 0;                       // swung off-beats land a little late
      const rit = o.rit ? 1 + o.rit * (k / steps.length) : 1;
      let melS = -1;
      for (const tok of step) {
        let s = R[tok.role], f = s == null ? -1 : sh[s];
        const mel = o.melody?.(k, tok, sh); if (mel) { [s, f] = mel; melS = s; } else if (s === melS) continue;
        if (s == null || f < 0) continue;
        if (o.loose && tok.f !== 'p' && r() < 0.05) continue;                    // now and then a finger skips its note
        const jit = gauss(r) * Math.sqrt(0.004 ** 2 + ((o.loose ? 0.06 : 0.03) * o.e8) ** 2);
        const db = o.base + FINGER_DB[tok.f] + (tok.f === 'p' ? P.thumbDb : 0) + (tok.acc ? 3.5 : 0) + (tok.ghost ? -6 : 0) + (mel ? 1 : 0) + gauss(r) * (o.loose ? 3 : 2.2) - (step.length > 1 && tok.f !== 'p' ? 1 : 0);
        const at = Math.max(now, t + off + this.drift + jit + (tok.f !== 'p' && step.length > 1 ? 0.012 : 0));
        this._pluck(s, f, at, Math.pow(10, db / 20), tok.palm && !o.last);
        if (o.hammer && !o.last && tok.f !== 'p' && r() < o.hammer) this._pluck(s, f + 2, at + 0.12 + r() * 0.04, Math.pow(10, (db - 5) / 20));
      }
      t += o.e8 * rit;
    });
    return o.last ? t + o.e8 * 6 : t;
  }
  _pluck(s, f, at, gain, palm = false) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this._note(s, f);
    const g = ctx.createGain(); g.gain.value = gain;
    if (palm) { g.gain.setValueAtTime(gain * 0.85, at); g.gain.setTargetAtTime(0, at + 0.05, 0.07); }   // the heel of the hand on the bass strings: a short, dull thump
    const pan = ctx.createStereoPanner(); pan.pan.value = -0.35 + s * 0.14;   // bass a little left, treble a little right
    src.connect(g); g.connect(pan); pan.connect(this.inp); src.start(at);
    const prev = this.voices[s]; if (prev && prev.end > at) prev.g.gain.setTargetAtTime(0, at, 0.02);   // a new note on a string stops the old one
    this.voices[s] = { g, end: at + src.buffer.duration };
  }
  _fadeIn(at, lvl = 0.9) { const now = this.ctx.currentTime; this.out.gain.cancelScheduledValues(now); this.out.gain.setValueAtTime(this.out.gain.value, now); this.out.gain.linearRampToValueAtTime(lvl, at); }
  /** a progression on repeat (the title screen, the credits), scheduled a bar ahead until stopLoop */
  loop(prog, { bpm = 72, loose = true, pats = ['travis', 'folk'], lvl = 0.9 } = {}) {
    if (!this._init() || !this.on) return;
    this.stopLoop(0); this.looping = true; this.busy = true;
    for (const name of prog) SHAPES[name].forEach((f, s) => { if (f >= 0) this._note(s, f); });   // render these now
    const e8 = 30 / bpm; let t = this.ctx.currentTime + 0.4, i = 0, pat = PATTERNS[pats[0]];
    this._fadeIn(t + 1.5, lvl); this.drift = 0;
    const tick = () => {
      if (!this.looping) return;
      while (t < this.ctx.currentTime + 2.2) {
        if (i % prog.length === 0 && i) pat = PATTERNS[pats[(Math.random() * pats.length) | 0]];   // a fresh pattern each time round
        t = this._bar(prog[i % prog.length], t, { pat, bpm, e8: e8 * (1 + gauss(this.rng) * 0.02), base: -10 + gauss(this.rng) * 0.8, loose });
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
  /** a passage composed on the spot: key and mode from the season and the park's health, a walk through the key's chords,
   *  a right-hand rhythm made for this phrase (varied a little bar to bar), a melody on the top strings that steps through
   *  the scale and lands on chord tones, now and then a hammer-on, and a cadence (usually home, sometimes left open) */
  playGen(season = 'autumn', harm = 0) {
    if (!this._init() || !this.on || this.looping) return;
    // the mood follows the reservoir: bleak as it drains (and the lower it is), hopeful while it refills
    const bleak = this.bleak ?? 0, hope = this.hope ?? 0;
    this.space('light'); this.wetS.gain.setTargetAtTime(0.22 + 0.25 * bleak, this.ctx.currentTime, 1);
    const r = this.rng, pick = (a) => a[(r() * a.length) | 0], wpick = (o) => { let t = r() * Object.values(o).reduce((a, b) => a + b, 0); for (const [k, w] of Object.entries(o)) { t -= w; if (t <= 0) return k; } return Object.keys(o)[0]; };
    const minorP = Math.max(0.03, Math.min(0.95, { spring: 0.08, summer: 0.1, autumn: 0.22, winter: 0.38 }[season] + harm * 0.3 + bleak * 0.8 - hope * 0.3));   // bright to begin with
    const K = r() < minorP ? KEYS[pick(['Em', 'Am', 'Dm'])] : KEYS[pick(['G', 'C', 'D'])];
    const scale = K.steps.map((x) => (x + K.pc) % 12), T = K.major ? 'I' : 'i';
    // harmony: a Markov walk, home at the start; 2 to 5 bars; a cadence at the end
    const n = wpick({ 2: 1, 3: 2, 4: 3, 5: 1 }) | 0, chords = [T];
    const TR = K.major ? MAJ : MIN;
    for (let i = 1; i < n - 1; i++) { const nx = Object.fromEntries(Object.entries(TR[chords[i - 1]] || {}).filter(([c]) => K.chords[c])); chords.push(Object.keys(nx).length ? wpick(nx) : T); }
    if (n > 1) chords.push(r() < 0.45 + 0.4 * (1 - bleak) + 0.15 * hope ? T : K.major ? pick(['IV', 'vi']) : pick(['VI', 'VII', 'iv']));   // bleak phrases are often left unresolved
    const shapes = chords.map((rn) => { const opts = K.chords[rn] || K.chords[T]; return r() < 0.35 ? pick(opts) : opts[0]; });
    // the right hand: Travis or folk picking (a bleak park drifts to the sparser styles), the engine's own patterns;
    // the melody rides on the top-string notes of the pattern, stepping through the scale and landing on chord tones
    const style = bleak > 0.55 ? pick(['folk', 'sparse', 'ballad']) : r() < 0.55 + 0.25 * hope ? 'travis' : 'folk', P = PATTERNS[style];
    const topRole = P.parsed.flat().some((tk) => tk.role === 'T3') ? 'T3' : 'T2', mel = (0.45 + r() * 0.35) * (1 - 0.45 * bleak) + 0.1 * hope;
    const bpm = ({ travis: 98 + r() * 14, folk: 84 + r() * 12, sparse: 70, ballad: 74 }[style]) * (season === 'winter' ? 0.9 : 1) * (1 - 0.2 * bleak + 0.05 * hope);
    const e8 = 30 / bpm, vol = -10 + gauss(r) - 2 * bleak, ctx = this.ctx, t0 = ctx.currentTime + 0.3;
    let t = t0, melP = Math.round(66 + r() * 5 - 3 * bleak + 3 * hope);
    this.lastPiece = { key: Object.keys(KEYS).find((k) => KEYS[k] === K), chords: shapes, style, bpm: Math.round(bpm), bleak, hope };   // for the curious (and for testing)
    this._fadeIn(t0); this.drift = 0;
    const near = (p, set) => { let best = p, bd = 99; for (let q = p - 6; q <= p + 6; q++) if (set.includes(((q % 12) + 12) % 12) && Math.abs(q - p) < bd) { bd = Math.abs(q - p); best = q; } return best; };
    const place = (p) => (p >= 64 && p - 64 <= 12 ? [5, p - 64] : p >= 59 && p - 59 <= 7 ? [4, p - 59] : [5, Math.max(0, Math.min(12, p - 64))]);
    shapes.forEach((name, bar) => {
      const sh = SHAPES[name], tones = sh.map((f, s) => (f >= 0 ? (OPEN[s] + f) % 12 : -1)).filter((x) => x >= 0), last = bar === shapes.length - 1;
      const melody = (k, tok) => {
        if (tok.role !== topRole || (!last && r() > mel)) return null;
        const strong = k === 0 || k === 4;
        const target = last ? near(melP, [K.pc]) : strong ? near(melP + pick([-2, -1, 0, 1, 2, 3]), tones) : near(melP + pick([-2, -1, -1, 1, 1, 2]), scale);
        melP = Math.max(62, Math.min(77, target)); return place(melP);
      };
      t = this._bar(name, t, { pat: P, bpm, e8, base: vol + 1.5 * Math.sin(Math.PI * (bar + 0.5) / shapes.length), last, rit: bar === shapes.length - 2 ? 0.14 : 0, melody, hammer: 0.05 * (1 - bleak) });
    });
    // sometimes it ends on bell-like harmonics on the strings whose note belongs in the key
    if (r() < 0.25 * (1 - bleak) + 0.35 * hope) { let h = t + e8 * 2; for (const s of [3, 4, 2, 5]) if (scale.includes(OPEN[s] % 12) && r() < 0.8) { this._pluck(s, 'h', h, Math.pow(10, (vol - 3) / 20)); h += e8 * (0.8 + r() * 0.5); } t = h; }
    const end = t + e8 * 6 + 4, now = ctx.currentTime;
    this.out.gain.setValueAtTime(0.9, end - 3); this.out.gain.linearRampToValueAtTime(0, end);
    this.busy = true; this.until = end; return end - now;
  }
  /** every so often, a passage; sitting still brings one sooner */
  update(dt, { live, sitting, season, harm, full = 1 }) {
    // track the reservoir: a slow average, so the trend is whether it has been falling or rising over the last minute or so
    this.fullS = this.fullS ?? full; this.fullS += (full - this.fullS) * Math.min(1, dt / 40);
    const trend = (full - this.fullS) * 60;
    this.bleak = Math.max(0, Math.min(1, 0.4 * harm + 1.3 * (1 - full) - 1.5 * trend)); this.hope = Math.max(0, Math.min(1, 1.5 * trend));
    if (!this.on || !this.audio?.ready) return;
    this._init(); this._prerender(live ? 6 : 14);
    if (this.looping) return;
    if (this.busy) { if (this.ctx.currentTime > this.until) this.busy = false; return; }
    if (!live) return;
    this.wait -= dt * (sitting ? 2.5 : 1);
    if (this.wait <= 0 && !this._queue.length) { this.playGen(season, harm); this.wait = (80 + Math.random() * 110) * (1 + 0.5 * this.bleak); }   // a bleak park is quieter
  }
}
