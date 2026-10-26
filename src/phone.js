// The phone: raise it (P) to check the map and compass, the harm/care gauge, and Clyde.  It borrows the HUD canvases while open.
import { PRESSURE } from './pressure.js';
import { CARE, fmt$ } from './care.js';
import { RUN } from './run.js';
import { JOBS, delegate } from './jobs.js';
import { GUIDE, ENTRIES, BY_ID } from './guide.js';

const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export class Phone {
  constructor({ audio, el, player, minimap, gauge, jobCtx, onOpen, onClose }) {
    Object.assign(this, { audio, el, player, minimap, gauge, jobCtx, onOpen, onClose, isOpen: false, tab: 'map' });
    el.addEventListener('click', (e) => { if (e.target === el) this.close(); });
    addEventListener('keydown', (e) => { if (this.isOpen && this.tab === 'photos') this._key?.(e); });
  }
  open(tab = this.tab) {
    this.isOpen = true; this.tab = tab; this.onOpen?.();
    this.el.innerHTML = `<div class="phone"><div class="pbar"><span class="pname">Phone</span><small data-ph-sub></small></div>
      <div class="ptabs"><button data-tab="map">Map</button><button data-tab="status">Status</button><button data-tab="guide">Guide</button><button data-tab="photos">Photos</button><button data-tab="jobs">Jobs</button><button data-tab="clyde">Clyde</button></div>
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
    } else if (tab === 'guide') {
      const n = document.createElement('div'); n.className = 'bubble';
      n.innerHTML = `<b>Field Guide</b> &middot; ${GUIDE.count()} of ${ENTRIES.length} found.<br>Press V for the camera and photograph trees, birds and animals. Songs you hear go in too. These are species typical of a Massachusetts reservoir forest, not a survey of the real park.`;
      body.appendChild(n);
      for (const cat of ['Trees', 'Birds', 'Animals', 'Sounds']) {
        const h = document.createElement('h4'); h.textContent = cat; h.style.cssText = 'margin:14px 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.7'; body.appendChild(h);
        for (const e of ENTRIES.filter((x) => x.cat === cat)) {
          const d = GUIDE.d[e.id] || {}, row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:10px;align-items:center;background:#2d2a36;border-radius:10px;padding:8px;margin-bottom:6px;font-size:13px;line-height:1.35';
          const pic = d.thumb ? `<img src="${d.thumb}" style="width:72px;height:48px;border-radius:6px;object-fit:cover;flex:none">` : `<div style="width:72px;height:48px;border-radius:6px;background:#1d1b22;flex:none;display:grid;place-items:center;opacity:.5">${e.songOnly ? '\u266a' : '?'}</div>`;
          const known = GUIDE.found(e.id);
          row.dataset.id = e.id;
          row.innerHTML = `${pic}<div style="flex:1"><b>${known ? e.name : '???'}</b>${d.photos > 1 ? ` <small>\u00d7${d.photos}</small>` : ''}<br><small style="opacity:.8">${known ? e.blurb : (e.songOnly ? 'Listen for it.' : 'Photograph it.')}</small></div>`;
          if (e.song && d.heard) { const b = document.createElement('button'); b.textContent = '\u25b6'; b.title = 'Play its song'; b.style.cssText = 'font:inherit;background:#3a3646;color:inherit;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:6px 10px;cursor:pointer'; b.addEventListener('click', (ev) => { ev.stopPropagation(); this.audio?.replay(e.song); }); row.appendChild(b); }
          if (d.photos) { row.style.cursor = 'pointer'; row.addEventListener('click', () => { const i = GUIDE.photos.filter((q) => q.id === e.id).length - 1; if (i >= 0) { this.tab = 'photos'; this.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === 'photos')); this._photos(body, i, e.id); } }); }
          body.appendChild(row);
        }
      }
    } else if (tab === 'photos') {
      this._photos(body);
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
  /** the album: a grid, and a full viewer you can thumb through (arrows, or the screen's left/right) */
  _photos(body, startIdx = null, only = null) {
    body.innerHTML = '';
    const all = GUIDE.photos.filter((p) => !only || p.id === only);
    if (startIdx != null && all.length) return this._viewer(body, all, Math.max(0, Math.min(all.length - 1, startIdx)), only);
    const n = document.createElement('div'); n.className = 'bubble';
    n.textContent = all.length ? `${GUIDE.photos.length} photo${GUIDE.photos.length === 1 ? '' : 's'}. Tap one to look closer.` : 'No photos yet. Press V to raise the camera and click to photograph what is in the frame.';
    body.appendChild(n);
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px';
    [...all].reverse().forEach((p) => {
      const i = all.indexOf(p), im = document.createElement('img'); im.src = p.thumb || p.data;
      im.style.cssText = 'width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:6px;cursor:pointer;display:block';
      im.addEventListener('click', (e) => { e.stopPropagation(); this._photos(body, i, only); });
      grid.appendChild(im);
    });
    body.appendChild(grid);
  }
  _viewer(body, all, i, only) {
    const p = all[i], e = BY_ID[p.id] || { name: p.id, blurb: '' };
    const wrap = document.createElement('div');
    wrap.innerHTML = `<img src="${p.data}" style="width:100%;border-radius:10px;display:block"><div style="margin:10px 2px 4px"><b>${e.name}</b><br><small style="opacity:.75">${p.season} \u00b7 ${new Date(p.at).toLocaleDateString()} \u00b7 ${i + 1} of ${all.length}</small></div><div style="font-size:13px;opacity:.85;line-height:1.45;margin:6px 2px 10px">${e.blurb || ''}</div>`;
    const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px;justify-content:space-between';
    const mk = (t, f, dim) => { const b = document.createElement('button'); b.className = 'choice'; b.textContent = t; b.style.cssText = 'flex:1;padding:9px 6px;font-size:14px;' + (dim ? 'opacity:.35;pointer-events:none' : ''); b.addEventListener('click', (ev) => { ev.stopPropagation(); f(); }); return b; };
    bar.append(mk('\u2190', () => this._photos(body, i - 1, only), i === 0), mk('All photos', () => this._photos(body, null, only)), mk('Delete', () => { GUIDE.removePhoto(p); const rest = all.filter((q) => q !== p); rest.length ? this._photos(body, Math.min(i, rest.length - 1), only) : this._photos(body, null, only); }), mk('\u2192', () => this._photos(body, i + 1, only), i === all.length - 1));
    wrap.appendChild(bar); body.appendChild(wrap);
    this._key = (ev) => { if (ev.code === 'ArrowLeft' && i > 0) this._photos(body, i - 1, only); if (ev.code === 'ArrowRight' && i < all.length - 1) this._photos(body, i + 1, only); };
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
