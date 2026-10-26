// The phone: raise it (P) to check the map and compass, the harm/care gauge, and Clyde.  It borrows the HUD canvases while open.
import { PRESSURE } from './pressure.js';
import { CARE, fmt$ } from './care.js';
import { RUN } from './run.js';
import { JOBS, delegate } from './jobs.js';

const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export class Phone {
  constructor({ el, player, minimap, gauge, jobCtx, onOpen, onClose }) {
    Object.assign(this, { el, player, minimap, gauge, jobCtx, onOpen, onClose, isOpen: false, tab: 'map' });
    el.addEventListener('click', (e) => { if (e.target === el) this.close(); });
  }
  open(tab = this.tab) {
    this.isOpen = true; this.tab = tab; this.onOpen?.();
    this.el.innerHTML = `<div class="phone"><div class="pbar"><span class="pname">Phone</span><small data-ph-sub></small></div>
      <div class="ptabs"><button data-tab="map">Map</button><button data-tab="status">Status</button><button data-tab="jobs">Jobs</button><button data-tab="clyde">Clyde</button></div>
      <div class="pscroll" data-ph-body></div></div>`;
    this.el.classList.remove('hidden');
    this.el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.show(b.dataset.tab); }));
    this.show(tab);
  }
  _release() {
    for (const [o, key] of [[this.minimap, 'cv'], [this.gauge, 'cv']]) {
      const cv = o[key]; if (!cv._home) continue;
      cv._home.parent.appendChild(cv); cv.style.cssText = cv._home.css; cv._home = null;
    }
    if (this._prevMap) { this.minimap.set(this._prevMap); this._prevMap = null; }
  }
  _borrow(o) { const cv = o.cv; if (!cv._home) cv._home = { parent: cv.parentElement, css: cv.style.cssText }; return cv; }
  show(tab) {
    this.tab = tab; this._release();
    const body = this.el.querySelector('[data-ph-body]'); body.innerHTML = '';
    this.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'map') {
      const comp = document.createElement('div'); comp.className = 'compass'; comp.dataset.compass = ''; body.appendChild(comp);
      this._prevMap = this.minimap.mode; this.minimap.set('full');
      const cv = this._borrow(this.minimap); cv.style.display = 'block'; cv.style.border = '3px solid rgba(244,230,200,.6)'; body.appendChild(cv);
      const n = document.createElement('div'); n.className = 'bubble'; n.textContent = 'Gold dot: the gate. Yellow ring: a marker from Clyde, if you have one. Press M for the on-screen map.'; body.appendChild(n);
    } else if (tab === 'status') {
      if (RUN.phaseTwo || RUN.dev) {
        const cv = this._borrow(this.gauge); cv.style.display = 'block'; cv.style.width = '300px'; cv.style.height = '190px'; body.appendChild(cv);
        const n = document.createElement('div'); n.className = 'bubble';
        n.innerHTML = `Harm <b>${Math.round(PRESSURE.harm * 100)}%</b>: lake held ${Math.round(PRESSURE.drop * 100)}% lower, wildlife at ${Math.round(PRESSURE.life * 100)}%.<br>Care <b>${Math.round(CARE.value * 100)}%</b>: ${Math.round(CARE.hours)} staff hours freed, about ${fmt$(CARE.saved)} saved (illustrative), ${CARE.built.length} built.`;
        body.appendChild(n);
      } else { const n = document.createElement('div'); n.className = 'bubble'; n.textContent = 'Nothing to measure yet. The park is just the park.'; body.appendChild(n); }
    } else if (tab === 'jobs') {
      const n = document.createElement('div'); n.className = 'bubble'; n.textContent = 'Park Service Jobs. Delegate work to the crew; they do it over the next minute or two.'; body.appendChild(n);
      for (const j of JOBS) {
        const b = document.createElement('button'); b.className = 'choice';
        b.innerHTML = `<b>❖ ${j.title}</b><span>Gives: ${j.gain}</span><span class="cost">${j.note}</span>`;
        b.addEventListener('click', (e) => { e.stopPropagation(); note.textContent = delegate(j, this.jobCtx); });
        body.appendChild(b);
      }
      var note = document.createElement('small'); note.style.display = 'block'; note.style.marginTop = '8px'; body.appendChild(note);
    } else {
      const n = document.createElement('div'); n.className = 'bubble';
      n.textContent = RUN.phaseTwo ? "Nothing to ask right now. I'll check in when the season turns." : "Clyde isn't set up yet. Come back when the season turns.";
      body.appendChild(n);
    }
    this.update();
  }
  update() {
    if (!this.isOpen) return;
    const p = this.player, b = ((Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw)) * 180 / Math.PI) + 360) % 360;
    const c = this.el.querySelector('[data-compass]'); if (c) c.textContent = `HEADING ${Math.round(b)}° ${dirs[Math.round(b / 45) % 8]}`;
    const s = this.el.querySelector('[data-ph-sub]'); if (s) s.textContent = `${Math.round(p.pos.y - 20)} m above the lake`;
  }
  close() {
    if (!this.isOpen) return;
    this._release(); this.isOpen = false; this.el.classList.add('hidden'); this.el.innerHTML = ''; this.onClose?.();
  }
}
