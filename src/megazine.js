// The close of the credits: the megaZINE masthead, as on megazine.org.  The photocopied logo (toner plus a pink pass
// slipped out of register) and its eyeball QR code, which points at megazine.org: every dark module is an eye that
// drifts its gaze and blinks.  The QR sits on its own light paper sticker so it scans on the dark credits.
// The module pattern and the drawing are taken from the megazine.org masthead (megazinehq/megazinehq.github.io).
const ROWS = ['11111110111111011010101111111', '10000010100011100101001000001', '10111010100111000001101011101', '10111010011111001101001011101', '10111010011000001011101011101', '10000010100101011010101000001', '11111110101010101010101111111', '00000000110100001000100000000', '00111010111110010010011100111', '11110000111111000100001110101', '10011111001100111010011101000', '10100101101001110110011101010', '11011111011010100000010100111', '00101000001000011101111011011', '00011110110010110110110100000', '10111101100011000000111011011', '11111110011011110001000001111', '10100100110100010010011111111', '10001110100111110010101000100', '10100101010001000001101101000', '10011110101011010111111110100', '00000000100101111100100011001', '11111110011111010001101010000', '10000010001010110001100011000', '10111010110001011100111111110', '10111010110001101111110101000', '10111010101100011001111111010', '10000010011101111100100010010', '11111110011110001100001010100'];

export const MEGAZINE_HTML = `
  <a class="mz" href="https://megazine.org" target="_blank" rel="noopener" aria-label="megaZINE, at megazine.org">
    <div class="mzrow">
      <div class="mzqr" role="img" aria-label="QR code for megazine.org"></div>
      <div class="mzlogo" aria-hidden="true"><span class="ink">MEGA<span class="lc">zine</span></span><span class="mis">MEGA<span class="lc">zine</span></span></div>
    </div>
    <div class="mztag">Between money and doom</div>
    <div class="mzurl">megazine.org</div>
  </a>`;

/** draws the eyeball QR into the credits and keeps the eyes alive; returns a stop function */
export function mountMegazine(root) {
  const host = root.querySelector('.mzqr'); if (!host) return () => {};
  const N = ROWS.length, QZ = 2, S = 20, V = (N + 2 * QZ) * S;
  const PAPER = '#ECEDE9', TONER = '#18181B', PINK = '#F2369B', BLUE = '#0055B3', GOLD = '#94671A';
  const IRIS = [BLUE, BLUE, BLUE, BLUE, BLUE, PINK, PINK, PINK, PINK, GOLD, GOLD];
  let seed = 7;
  const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const U = (a, b) => a + (b - a) * rnd(), pick = (a) => a[Math.floor(rnd() * a.length)], f = (v) => Math.round(v * 10) / 10;
  const FIND = [[0, 0], [0, N - 7], [N - 7, 0]];
  const inFinder = (r, c) => FIND.some((p) => r >= p[0] && r < p[0] + 7 && c >= p[1] && c < p[1] + 7);
  const out = [], eyes = [];
  const eye = (cx, cy, R, o = {}) => {
    const iris = o.iris || pick(IRIS), ri = R * (o.ri || 0.62 * U(0.94, 1.06)), rp = ri * U(0.55, 0.64), k = eyes.length;
    let s = `<g><clipPath id="mzq${k}"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}"/></clipPath><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${TONER}"/><g clip-path="url(#mzq${k})">`;
    if (o.veins) for (let v = 0, nv = 2 + Math.floor(rnd() * 3); v < nv; v++) {
      const t = U(0, 6.283), P = (fr, d) => `${f(cx + R * fr * Math.cos(t + d))} ${f(cy + R * fr * Math.sin(t + d))}`;
      s += `<path d="M${P(0.98, 0)}Q${P(0.78, 0.3)} ${P(0.6, -0.1)}" fill="none" stroke="${PINK}" stroke-width="${f(R * 0.06)}" stroke-linecap="round"/>`;
    }
    s += `<g class="iris"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(ri)}" fill="${iris}"/>`;
    for (let j = 0; j < 10; j++) {
      const a = j * Math.PI / 5 + U(-0.1, 0.1);
      s += `<line x1="${f(cx + rp * 1.08 * Math.cos(a))}" y1="${f(cy + rp * 1.08 * Math.sin(a))}" x2="${f(cx + ri * 0.9 * Math.cos(a))}" y2="${f(cy + ri * 0.9 * Math.sin(a))}" stroke="${TONER}" stroke-opacity=".3" stroke-width="${f(R * 0.05)}"/>`;
    }
    s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp)}" fill="${TONER}"/><circle cx="${f(cx - rp * 0.38)}" cy="${f(cy - rp * 0.42)}" r="${f(Math.max(rp * 0.3, 0.9))}" fill="#FFF"/></g>`;
    const rest = o.lid || 0;
    s += `<rect class="lid" x="${f(cx - R)}" y="${f(cy - R)}" width="${f(2 * R)}" height="${f(2 * R)}" fill="${TONER}" style="transform:translateY(${f(-(1 - rest) * 2 * R)}px)"/></g></g>`;
    out.push(s); eyes.push({ x: cx, y: cy, R, m: (R - ri) * 0.85 + R * 0.06, rest, dx: 0, dy: 0 });
  };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (ROWS[r][c] === '1' && !inFinder(r, c)) eye((c + QZ + 0.5) * S, (r + QZ + 0.5) * S, S * U(0.5, 0.56), { veins: rnd() < 0.15, lid: pick([0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.4]) });
  for (const p of FIND) {
    const x = (p[1] + QZ) * S, y = (p[0] + QZ) * S, a = S * 0.9, b = S * 0.4;
    const ring = (x0, y0, w, rr) => `M${x0 + rr} ${y0}h${w - 2 * rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${w - 2 * rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}h${2 * rr - w}a${rr} ${rr} 0 0 1 ${-rr} ${-rr}v${2 * rr - w}a${rr} ${rr} 0 0 1 ${rr} ${-rr}z`;
    out.push(`<path fill-rule="evenodd" fill="${TONER}" d="${ring(x, y, 7 * S, a)}${ring(x + S, y + S, 5 * S, b)}"/>`);
    eye(x + 3.5 * S, y + 3.5 * S, S * 1.55, { iris: BLUE, veins: true, ri: 0.72 });
  }
  host.innerHTML = `<svg viewBox="0 0 ${V} ${V}" aria-hidden="true" focusable="false"><rect width="${V}" height="${V}" fill="${PAPER}"/>${out.join('')}</svg>`;
  const irises = host.querySelectorAll('.iris'), lids = host.querySelectorAll('.lid');
  const still = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // the eyes follow the pointer if there is one, otherwise a gaze point that wanders around the code
  let px = null, py = null, lastMove = -1e9, raf = 0, alive = true;
  const look = (e) => { px = e.clientX; py = e.clientY; lastMove = performance.now(); };
  addEventListener('pointermove', look, { passive: true });
  const frame = (t) => {
    if (!alive) return;
    const svg = host.firstChild, b = svg.getBoundingClientRect(), sc = b.width / V, idle = px === null || t - lastMove > 5000;
    const tx = idle ? b.left + b.width * (0.5 + 0.9 * Math.sin(t / 2300)) : px, ty = idle ? b.top + b.height * (0.5 + 0.7 * Math.sin(t / 1700 + 1)) : py;
    if (!(idle && still)) for (let i = 0; i < eyes.length; i++) {
      const e = eyes[i], dx = tx - (b.left + e.x * sc), dy = ty - (b.top + e.y * sc), d = Math.hypot(dx, dy) || 1;
      const reach = e.m * Math.min(1, d / (e.R * sc * 4 + 1)), k = still ? 1 : 0.22;
      const nx = e.dx + (dx / d * reach - e.dx) * k, ny = e.dy + (dy / d * reach - e.dy) * k;
      if (Math.abs(nx - e.dx) > 0.02 || Math.abs(ny - e.dy) > 0.02) { e.dx = nx; e.dy = ny; irises[i].setAttribute('transform', `translate(${f(nx)} ${f(ny)})`); }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const shut = (i, hold = 140) => { const L = lids[i], e = eyes[i]; if (!L) return; L.style.transform = 'translateY(0px)'; setTimeout(() => { L.style.transform = `translateY(${f(-(1 - e.rest) * 2 * e.R)}px)`; }, hold); };
  const timers = new Set(), every = (min, max, fn) => { const go = () => { const id = setTimeout(() => { timers.delete(id); if (alive) { fn(); go(); } }, min + Math.random() * (max - min)); timers.add(id); }; go(); };
  const small = [], big = []; eyes.forEach((e, i) => (e.R > S ? big : small).push(i));
  for (const i of big) every(2500, 6000, () => { shut(i, 170); if (Math.random() < 0.25) setTimeout(() => shut(i, 140), 380); });
  every(300, 900, () => { for (let n = 2 + Math.floor(Math.random() * 6); n--;) shut(small[Math.floor(Math.random() * small.length)]); });
  every(6000, 11000, () => { const o = eyes[small[Math.floor(Math.random() * small.length)]], all = Math.random() < 0.3; eyes.forEach((e, i) => setTimeout(() => shut(i, 150), all ? 0 : Math.hypot(e.x - o.x, e.y - o.y) * (still ? 0 : 0.9))); });
  // the logo slips in the copier now and then
  const logo = root.querySelector('.mzlogo');
  if (logo && !still) { logo.addEventListener('animationend', (e) => { if (e.target.classList.contains('mis')) logo.classList.remove('jit'); }); every(3500, 9000, () => { logo.classList.remove('jit'); void logo.offsetWidth; logo.classList.add('jit'); }); }
  return () => { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); removeEventListener('pointermove', look); };
}
