// The noticeboard: the back of the park sign by the beach is cork, and things get pinned to it as the seasons go.  Your
// own photos (the latest few, as prints, with the name pencilled under), and pieces of paper about what is going on in
// the park: a bird that has turned up, a rare plant someone swears they saw, shots heard in the woods, smoke, the water
// low, a hammock someone left out, a pencilled lead, the season's warnings, and from Year Two a public notice about a
// data center's water.  Nothing opens: you walk up to it and read it.  It is redrawn when what is on it changes.
import * as THREE from 'three';

const W = 2048, H = 1175;
const PAPER = ['#f6f1e4', '#fbf6df', '#f2efe8', '#fff9e8'], PINS = ['#c8352b', '#2f6fb3', '#e0b12c', '#3c8a4a', '#d9572b'];

export class NoticeBoard {
  /** at: the sign's centre {x, y, z, ry} (ry: which way its front faces); the board is its back face; gradientMap: the toon shading */
  constructor(scene, at, gradientMap) {
    this.at = at; this.sig = ''; this.imgs = new Map(); this.t = 0; this.seenIds = new Set();
    this.cv = document.createElement('canvas'); this.cv.width = W; this.cv.height = H;
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.58, 1.48), new THREE.MeshToonMaterial({ map: this.tex, gradientMap }));
    const ry = at.ry || 0; m.position.set(at.x - Math.sin(ry) * 0.046, at.y, at.z - Math.cos(ry) * 0.046); m.rotation.y = ry + Math.PI; m.frustumCulled = false; scene.add(m); this.mesh = m;
    this._draw([]);
  }
  /** each frame (cheap): every couple of seconds, gather what should be pinned; redraw if it changed */
  update(dt, you, gather) {
    if ((this.t -= dt) > 0) return; this.t = 2;
    if (Math.hypot(you.x - this.at.x, you.z - this.at.z) > 90 && this.sig) return;   // nobody near to see it change
    const items = gather().slice(0, 8), sig = items.map((i) => i.id).join('|');
    if (sig === this.sig) return;
    const fresh = items.filter((i) => i.kind !== 'photo' && !this.seenIds.has(i.id) && this.sig);   // (not on the first draw)
    for (const i of items) this.seenIds.add(i.id);
    this.sig = sig; this._draw(items);
    if (fresh.length) this.onNew?.(fresh);
  }
  _img(src) {
    if (this.imgs.has(src)) return this.imgs.get(src);
    const im = new Image(); im.onload = () => this._draw(this._last || []); im.src = src; this.imgs.set(src, im); return im;
  }
  _draw(items) {
    this._last = items;
    const c = this.cv.getContext('2d');
    // cork in a wooden frame
    c.fillStyle = '#4a3020'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#b8864f'; c.fillRect(60, 60, W - 120, H - 120);
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 9000; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(90,55,25,.35)' : 'rgba(230,190,130,.3)'; c.fillRect(60 + rnd() * (W - 120), 60 + rnd() * (H - 120), 2 + rnd() * 4, 2 + rnd() * 3); }
    c.save(); c.strokeStyle = 'rgba(30,18,8,.5)'; c.lineWidth = 10; c.strokeRect(65, 65, W - 130, H - 130); c.restore();
    if (!items.length) { this._paper(c, { id: 'empty', kind: 'note', title: 'Ashland State Park', body: 'Notices and lost & found.' }, W / 2 - 260, H / 2 - 160, 520, 320, -0.02, 0); this.tex.needsUpdate = true; return; }
    // slots: two rows of four, each paper tilted a little and pinned at the top
    const cols = 4, rows = items.length > 4 ? 2 : 1, mx = 190, my = 150, cw = (W - 2 * mx) / cols, ch = (H - 2 * my) / rows;
    items.forEach((it, k) => {
      const col = k % cols, row = (k / cols) | 0, h = ((String(it.id || '').length * 37 + k * 11) % 100) / 100;
      const w = it.kind === 'photo' ? 290 : 350, hh = it.kind === 'photo' ? 352 : 372;
      const x = mx + col * cw + (cw - w) / 2 + (h - 0.5) * 30, y = my + row * ch + (ch - hh) / 2 + (h - 0.5) * 24, rot = (h - 0.5) * 0.09;
      this._paper(c, it, x, y, w, hh, rot, k);
    });
    this.tex.needsUpdate = true;
  }
  _paper(c, it, x, y, w, h, rot, k) {
    c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot); c.translate(-w / 2, -h / 2);
    c.shadowColor = 'rgba(30,15,5,.45)'; c.shadowBlur = 14; c.shadowOffsetY = 6;
    c.fillStyle = it.kind === 'photo' ? '#fbfaf6' : it.color || PAPER[k % PAPER.length]; c.fillRect(0, 0, w, h);
    c.shadowColor = 'transparent';
    const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif', HAND = '"Bradley Hand", "Segoe Print", "Comic Sans MS", "Marker Felt", cursive';
    if (it.kind === 'photo') {
      const im = this._img(it.src); c.fillStyle = '#2a2622'; c.fillRect(22, 22, w - 44, w - 44);
      if (im.complete && im.naturalWidth) { const s = Math.max((w - 44) / im.naturalWidth, (w - 44) / im.naturalHeight), iw = im.naturalWidth * s, ih = im.naturalHeight * s; c.save(); c.beginPath(); c.rect(22, 22, w - 44, w - 44); c.clip(); c.drawImage(im, 22 + (w - 44 - iw) / 2, 22 + (w - 44 - ih) / 2, iw, ih); c.restore(); }
      c.fillStyle = '#3a3228'; c.font = `33px ${HAND}`; c.textAlign = 'center'; this._wrap(c, it.title, w / 2, w + 14, w - 26, 35, 2);
    } else {
      c.textAlign = 'left';
      if (it.head) { c.fillStyle = it.headColor || '#7a1f16'; c.fillRect(0, 36, w, 62); c.fillStyle = '#fff'; c.font = `700 32px ${FONT}`; c.fillText(it.head, 20, 78); }   // (below the pin)
      const top = it.head ? 146 : 84;
      c.fillStyle = '#231a12'; c.font = it.hand ? `36px ${HAND}` : `700 31px ${FONT}`;
      const ty = this._wrap(c, it.title, 22, top, w - 44, it.hand ? 40 : 37, 3);
      c.fillStyle = '#3d342b'; c.font = it.hand ? `29px ${HAND}` : `25px ${FONT}`;
      this._wrap(c, it.body || '', 22, ty + 12, w - 44, it.hand ? 34 : 31, it.head ? 6 : 7);
    }
    // the pin
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(w / 2 + 6, 24, 15, 0, 7); c.fill();
    c.fillStyle = PINS[(k * 3 + String(it.id || '').length) % PINS.length]; c.beginPath(); c.arc(w / 2, 18, 15, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(w / 2 - 5, 13, 5, 0, 7); c.fill();
    c.restore();
  }
  /** wrapped text from (x, y), up to `max` lines; returns the y after the last line */
  _wrap(c, text, x, y, maxW, lh, max) {
    const words = String(text).split(/\s+/); let line = '', n = 0;
    for (let i = 0; i < words.length; i++) {
      const t = line ? `${line} ${words[i]}` : words[i];
      if (c.measureText(t).width > maxW && line) { if (++n >= max) { c.fillText(`${line}…`, x, y); return y + lh; } c.fillText(line, x, y); y += lh; line = words[i]; } else line = t;
    }
    if (line) { c.fillText(line, x, y); y += lh; }
    return y;
  }
}
