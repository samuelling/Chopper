// Optional HUD minimap.  M (or the Map button) cycles off -> local -> whole park.  North is up (the dam is at the bottom).
// Drawn from the real heightfield and OSM lines the game already uses, so it is exactly as accurate as the game world.
import { groundY, sdfAt } from './world.js';
import { WORLD, TRAIL_LINES, ROAD_LINES, GATE } from './ashland.js';
import { SEASON, SEASON_DEF } from './season.js';

const MODES = ['off', 'local', 'full'];
const LOCAL_SPAN = 340;                                  // metres across in local mode
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

export class Minimap {
  constructor(lake, player) {
    this.lake = lake; this.player = player;
    let m = 'off'; try { m = localStorage.getItem('ashland.map') || 'off'; } catch {}
    this.mode = MODES.includes(m) ? m : 'off';
    const W = WORLD.maxX - WORLD.minX, D = WORLD.maxZ - WORLD.minZ;
    const res = Math.min(1, 900 / Math.max(W, D) * 1.0) ;          // pixels per metre (capped so the base stays small)
    this.res = Math.max(0.35, res);
    this.bw = Math.ceil(W * this.res); this.bh = Math.ceil(D * this.res);
    this.hs = new Float32Array(this.bw * this.bh);
    this.inb = new Uint8Array(this.bw * this.bh);       // inside the reservoir basin (so the brook valley below the dam is not 'water')
    this.base = document.createElement('canvas'); this.base.width = this.bw; this.base.height = this.bh;
    this.water = document.createElement('canvas'); this.water.width = this.bw; this.water.height = this.bh;
    this._buildHeights(); this._paintLand(); this._paintWater(true);
    // fog of war: the park is dark paper until you have walked there (remembered between visits)
    this.fog = document.createElement('canvas'); this.fog.width = this.bw; this.fog.height = this.bh; this.pins = [];
    { const f = this.fog.getContext('2d'); f.fillStyle = 'rgba(20,24,27,.95)'; f.fillRect(0, 0, this.bw, this.bh);
      try { const u = localStorage.getItem('ashland.fog'); if (u) { const im = new Image(); im.onload = () => { if (im.width === this.bw && im.height === this.bh) { f.globalCompositeOperation = 'copy'; f.drawImage(im, 0, 0); f.globalCompositeOperation = 'source-over'; } }; im.src = u; } } catch {} }
    this._fogT = 0; this._fogP = null;
    const c = document.createElement('canvas'); c.id = 'minimap'; c.width = c.height = 220;
    c.style.cssText = 'position:absolute;left:18px;bottom:18px;top:auto;right:auto;width:220px;height:220px;border-radius:50%;border:3px solid rgba(244,230,200,.75);box-shadow:0 2px 14px rgba(0,0,0,.45);display:none;background:#222';
    document.getElementById('hud').appendChild(c);
    this.cv = c; this.ctx = c.getContext('2d');
    this.set(this.mode);
  }
  set(mode) {
    this.mode = mode; try { localStorage.setItem('ashland.map', mode); } catch {}
    this.cv.style.display = mode === 'off' ? 'none' : 'block';
    this.cv.style.borderRadius = mode === 'full' ? '10px' : '50%';
    this.cv.style.height = mode === 'full' ? `${Math.round(220 * this.bh / this.bw) || 220}px` : '220px';
    if (mode === 'full') { this.cv.width = 260; this.cv.height = Math.round(260 * this.bh / this.bw); this.cv.style.width = '260px'; this.cv.style.height = `${this.cv.height}px`; }
    else { this.cv.width = this.cv.height = 220; this.cv.style.width = this.cv.style.height = '220px'; }
    document.querySelectorAll('[data-minimap]').forEach((b) => { b.textContent = `Map: ${mode === 'off' ? 'off' : mode === 'local' ? 'nearby' : 'whole park'}`; });
  }
  setMarker(x, z, label) { this.marker = x == null ? null : { x, z, label }; }
  cycle() { this.set(MODES[(MODES.indexOf(this.mode) + 1) % 3]); }
  // world (x,z) -> base pixel; z up on screen
  px(x) { return (x - WORLD.minX) * this.res; }
  py(z) { return (WORLD.maxZ - z) * this.res; }
  _buildHeights() {
    for (let j = 0; j < this.bh; j++) { const z = WORLD.maxZ - (j + 0.5) / this.res; for (let i = 0; i < this.bw; i++) { const x = WORLD.minX + (i + 0.5) / this.res; this.hs[j * this.bw + i] = groundY(x, z); this.inb[j * this.bw + i] = sdfAt(x, z) < 1.5 ? 1 : 0; } }
  }
  _paintLand() {
    const { bw, bh, hs } = this, ctx = this.base.getContext('2d'), img = ctx.createImageData(bw, bh), d = img.data;
    const g = hex(SEASON === 'winter' ? '#e6ecf0' : (SEASON_DEF.ground?.[0] ?? '#9a6a34'));
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const k = j * bw + i, h = hs[k];
      const hx = hs[k + (i < bw - 1 ? 1 : 0)] - hs[k - (i > 0 ? 1 : 0)], hz = hs[k + (j < bh - 1 ? bw : 0)] - hs[k - (j > 0 ? bw : 0)];
      const shade = 0.82 + Math.max(-0.3, Math.min(0.3, (hx * -0.6 + hz * 0.6) * 0.07)) + Math.max(0, Math.min(0.18, (h - 20) * 0.006));
      d[k * 4] = Math.min(255, g[0] * shade); d[k * 4 + 1] = Math.min(255, g[1] * shade); d[k * 4 + 2] = Math.min(255, g[2] * shade); d[k * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineCap = ctx.lineJoin = 'round';
    const line = (pts, w, col) => { ctx.beginPath(); pts.forEach((p, n) => (n ? ctx.lineTo(this.px(p[0]), this.py(p[1])) : ctx.moveTo(this.px(p[0]), this.py(p[1])))); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); };
    for (const l of ROAD_LINES) line(l, 2.2, 'rgba(70,60,55,.85)');
    for (const l of TRAIL_LINES) line(l, 1.3, 'rgba(240,222,170,.95)');
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(this.px(GATE.x), this.py(GATE.z), 3.2, 0, 6.3); ctx.fill();
  }
  _paintWater(force) {
    const lv = this.lake.level;
    if (!force && Math.abs(lv - (this._lv ?? 1e9)) < 0.08) return;
    this._lv = lv;
    const { bw, bh, hs } = this, ctx = this.water.getContext('2d'), img = ctx.createImageData(bw, bh), d = img.data;
    for (let k = 0; k < bw * bh; k++) {
      const dep = lv - hs[k];
      if (dep > 0 && this.inb[k]) { const t = Math.min(1, dep / 8); d[k * 4] = 70 - 30 * t; d[k * 4 + 1] = 140 - 50 * t; d[k * 4 + 2] = 170 - 30 * t; d[k * 4 + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
  }
  _reveal(x, z) {
    if (this._fogP && Math.hypot(x - this._fogP.x, z - this._fogP.z) < 6) return;
    this._fogP = { x, z }; this._fogDirty = true;
    const f = this.fog.getContext('2d'), r = 60 * this.res, cx = this.px(x), cy = this.py(z), g = f.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    f.globalCompositeOperation = 'destination-out'; f.fillStyle = g; f.beginPath(); f.arc(cx, cy, r, 0, 6.3); f.fill(); f.globalCompositeOperation = 'source-over';
  }
  update(dt = 0.016) {
    this._reveal(this.player.pos.x, this.player.pos.z);
    this._fogT += dt; if (this._fogT > 20 && this._fogDirty) { this._fogT = 0; this._fogDirty = false; try { localStorage.setItem('ashland.fog', this.fog.toDataURL('image/png')); } catch {} }
    if (this.mode === 'off' && !this.hold) return;
    this._lt = (this._lt || 0) + 1; if (this._lt % 30 === 0) this._paintWater(false);
    const c = this.ctx, W = this.cv.width, H = this.cv.height, p = this.player;
    c.clearRect(0, 0, W, H);
    let sx, sy, sw, sh;
    if (this.mode === 'local') {
      const half = LOCAL_SPAN / 2 * this.res;
      sx = this.px(p.pos.x) - half; sy = this.py(p.pos.z) - half; sw = sh = half * 2;
    } else { sx = 0; sy = 0; sw = this.bw; sh = this.bh; }
    // clip the source to the base and place it, so the edge of the world shows as empty
    const k = W / sw;
    c.fillStyle = '#1d2326'; c.fillRect(0, 0, W, H);
    c.drawImage(this.base, sx, sy, sw, sh, 0, 0, W, H);
    c.drawImage(this.water, sx, sy, sw, sh, 0, 0, W, H);
    c.drawImage(this.fog, sx, sy, sw, sh, 0, 0, W, H);
    const mx = (this.px(p.pos.x) - sx) * k, my = (this.py(p.pos.z) - sy) * k;
    if (this.marker) {
      let ox = (this.px(this.marker.x) - sx) * k, oy = (this.py(this.marker.z) - sy) * k;
      const cx = W / 2, cy = H / 2, inside = ox > 8 && oy > 8 && ox < W - 8 && oy < H - 8;
      if (!inside) { const dx = ox - cx, dy = oy - cy, t = this.mode === 'local' ? (W / 2 - 12) / (Math.hypot(dx, dy) || 1) : Math.min((W / 2 - 12) / Math.abs(dx || 1e-6), (H / 2 - 12) / Math.abs(dy || 1e-6)); ox = cx + dx * t; oy = cy + dy * t; }
      c.lineWidth = 3; c.strokeStyle = '#ffd24a'; c.fillStyle = 'rgba(255,210,74,.35)'; c.beginPath(); c.arc(ox, oy, inside ? 8 : 5, 0, 6.3); c.fill(); c.stroke();
    }
    // your named places and what you have found
    for (const pin of this.pins) {
      const ox = (this.px(pin.x) - sx) * k, oy = (this.py(pin.z) - sy) * k;
      if (ox < 4 || oy < 4 || ox > W - 4 || oy > H - 4) continue;
      c.fillStyle = pin.found ? '#9ad08a' : '#ffd9a0'; c.strokeStyle = '#2a1f24'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ox, oy - 7); c.lineTo(ox + 5, oy); c.lineTo(ox, oy + 7); c.lineTo(ox - 5, oy); c.closePath(); c.fill(); c.stroke();
      if (this.mode === 'full' && pin.name) { c.font = '600 11px serif'; c.textAlign = 'left'; c.lineWidth = 3; c.strokeStyle = 'rgba(20,16,14,.85)'; c.strokeText(pin.name, ox + 8, oy + 4); c.fillStyle = '#f4e6c8'; c.fillText(pin.name, ox + 8, oy + 4); }
    }
    // view cone + arrow (forward in world is (-sin yaw, -cos yaw); screen y is flipped)
    const a = Math.atan2(Math.cos(p.yaw), -Math.sin(p.yaw));
    c.save(); c.translate(mx, my); c.rotate(a);
    c.fillStyle = 'rgba(255,240,200,.28)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 38, -0.6, 0.6); c.closePath(); c.fill();
    c.fillStyle = '#ffefc2'; c.strokeStyle = '#3a2a22'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, 6); c.lineTo(-3, 0); c.lineTo(-6, -6); c.closePath(); c.fill(); c.stroke();
    c.restore();
    c.fillStyle = 'rgba(244,230,200,.9)'; c.font = '11px serif'; c.fillText('N', W / 2 - 3, 12);
  }
}
