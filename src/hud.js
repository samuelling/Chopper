// Dashboard HUD: the harm/care gauge, plus show/hide for every dashboard item (H toggles them all).
import { PRESSURE } from './pressure.js';
import { CARE } from './care.js';
import { RUN } from './run.js';

export const ITEMS = [
  { id: 'card', label: 'Status card', sel: '#hud .card' },
  { id: 'gauge', label: 'Harm / care gauge', sel: '#gauge' },
  { id: 'map', label: 'Map', sel: '#minimap' },
  { id: 'hints', label: 'Key hints and light name', sel: '#hint, #mood' },
  { id: 'season', label: 'Season bar and waypoint', sel: '#seasonbar, #waypoint' },
];
const KEY = 'ashland.hud';
let hidden = {}; try { hidden = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
// the game starts with a clean screen (the phone is the dashboard); H or the pause menu brings the HUD back, and that choice is then remembered
try { if (!RUN.dev && !localStorage.getItem(KEY + '2')) { hidden = { all: true }; localStorage.setItem(KEY + '2', '1'); } } catch {}
const style = document.createElement('style'); document.head.appendChild(style);
function apply() {
  style.textContent = ITEMS.filter((i) => hidden[i.id] || hidden.all).map((i) => `${i.sel.split(',').map((s) => s.trim()).join(', ')} { display:none !important; }`).join('\n');
  try { localStorage.setItem(KEY, JSON.stringify(hidden)); } catch {}
  document.querySelectorAll('[data-hud-item]').forEach((b) => { const off = hidden[b.dataset.hudItem] || hidden.all; b.textContent = `${ITEMS.find((i) => i.id === b.dataset.hudItem).label}: ${off ? 'hidden' : 'shown'}`; b.classList.toggle('on', !off); });
  document.querySelectorAll('[data-hud-all]').forEach((b) => { b.textContent = hidden.all ? 'Show dashboard (H)' : 'Hide dashboard (H)'; });
}
export const HUD = {
  show(id) { hidden[id] = false; hidden.all = false; apply(); },
  toggleAll() { hidden.all = !hidden.all; apply(); },
  visible(id) { return !(hidden[id] || hidden.all); },
};
export function initHud() {
  document.querySelectorAll('[data-hud-panel]').forEach((el) => {
    el.innerHTML = `<div class="uh">Dashboard</div><div class="urow">${ITEMS.map((i) => `<button data-hud-item="${i.id}"></button>`).join('')}<button data-hud-all></button></div>`;
    el.addEventListener('click', (e) => e.stopPropagation());
  });
  document.querySelectorAll('[data-hud-item]').forEach((b) => b.addEventListener('click', () => { hidden[b.dataset.hudItem] = !hidden[b.dataset.hudItem]; hidden.all = false; apply(); }));
  document.querySelectorAll('[data-hud-all]').forEach((b) => b.addEventListener('click', () => HUD.toggleAll()));
  addEventListener('keydown', (e) => { if (e.code === 'KeyH' && !e.repeat) HUD.toggleAll(); });
  apply();
}

// ---- the odometer: a half-dial from HARM (left) to CARE (right); the needle shows where the park sits -----------------
export class Gauge {
  constructor(parent) {
    const c = document.createElement('canvas'); c.id = 'gauge'; c.width = 300; c.height = 190;
    c.style.cssText = 'position:absolute;left:18px;top:176px;width:150px;height:95px;display:none';
    parent.appendChild(c); this.cv = c; this.ctx = c.getContext('2d'); this.v = 0; this.on = false;
  }
  setVisible(on) { this.on = on; this.cv.style.display = on ? 'block' : 'none'; }
  update(dt) {
    if (!this.on) return;
    const target = Math.max(-1, Math.min(1, (CARE.value - PRESSURE.harm) * 2.2));
    this.v += (target - this.v) * Math.min(1, dt * 2.5);
    const c = this.ctx, W = 300, cx = 150, cy = 150, R = 118;
    c.clearRect(0, 0, W, 190);
    // dial face
    for (let i = 0; i < 60; i++) {
      const a0 = Math.PI + (i / 60) * Math.PI, a1 = Math.PI + ((i + 1) / 60) * Math.PI, t = i / 59;
      const col = t < 0.5 ? `rgb(${200 - t * 60},${70 + t * 140},${50 + t * 40})` : `rgb(${170 - (t - 0.5) * 220},${150 + (t - 0.5) * 40},${70 + (t - 0.5) * 60})`;
      c.beginPath(); c.arc(cx, cy, R, a0, a1 + 0.01); c.arc(cx, cy, R - 24, a1 + 0.01, a0, true); c.closePath(); c.fillStyle = col; c.fill();
    }
    c.strokeStyle = 'rgba(244,230,200,.8)'; c.lineWidth = 2;
    for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2)); c.lineTo(cx + Math.cos(a) * (R + (i % 5 ? 7 : 12)), cy + Math.sin(a) * (R + (i % 5 ? 7 : 12))); c.stroke(); }
    c.fillStyle = 'rgba(244,230,200,.95)'; c.font = '600 20px serif'; c.textAlign = 'left'; c.fillText('HARM', 6, 184); c.textAlign = 'right'; c.fillText('CARE', 294, 184);
    // needle
    const a = Math.PI + ((this.v + 1) / 2) * Math.PI;
    c.save(); c.translate(cx, cy); c.rotate(a);
    c.fillStyle = '#f4e6c8'; c.strokeStyle = '#2b1d1a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(R - 6, 0); c.lineTo(0, 7); c.lineTo(-14, 0); c.lineTo(0, -7); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.beginPath(); c.arc(cx, cy, 9, 0, 6.3); c.fillStyle = '#2b1d1a'; c.fill();
  }
}
