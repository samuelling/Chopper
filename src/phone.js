// The phone: raise it (P) to check the map and compass, the harm/care gauge, and Clyde.  It borrows the HUD canvases while open.
import { PRESSURE } from './pressure.js';
import { CARE, fmt$ } from './care.js';
import { RUN } from './run.js';
import { JOBS, delegate } from './jobs.js';
import { GUIDE, ENTRIES, BY_ID } from './guide.js';
import { mountHudPanel } from './hud.js';
import { PLACES, JOURNAL } from './places.js';
import { FUND, SUPPLIES, MEASURES } from './fund.js';
import { Usage, LEVELS } from './usage.js';

const ic = (d, extra = '') => `<svg viewBox="0 0 48 48" width="34" height="34" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;
const APPS = [
  { id: 'compass', name: 'Compass', bg: 'linear-gradient(#5b6573,#2c313b)', svg: ic('<circle cx="24" cy="24" r="16"/><path d="M30 18l-4 9-8 3 4-9z" fill="#fff" stroke-width="2"/>') },
  { id: 'places', name: 'Places', bg: 'linear-gradient(#e56b6f,#a8374c)', svg: ic('<path d="M10 40V10l10 4 10-4 8 4v28l-8-4-10 4-10-4z"/><path d="M20 14v26M30 10v26"/>') },
  { id: 'journal', name: 'Journal', bg: 'linear-gradient(#b08968,#7f5539)', svg: ic('<rect x="11" y="7" width="26" height="34" rx="3"/><path d="M17 16h14M17 23h14M17 30h9"/>') },
  { id: 'status', name: 'Park', bg: 'linear-gradient(#e0884a,#b24a34)', svg: ic('<path d="M8 33a16 16 0 0132 0"/><path d="M24 33l8-11"/>', '<circle cx="24" cy="33" r="2.5" fill="#fff"/>') },
  { id: 'guide', name: 'Field Guide', bg: 'linear-gradient(#8fbf5a,#4f8a3a)', svg: ic('<path d="M10 38C10 20 22 9 40 9c0 18-11 30-30 29z"/><path d="M10 38C18 28 26 21 33 17"/>') },
  { id: 'jobs', name: 'Park Jobs', bg: 'linear-gradient(#7a8ea8,#455a78)', svg: ic('<rect x="8" y="16" width="32" height="22" rx="4"/><path d="M18 16v-4a3 3 0 013-3h6a3 3 0 013 3v4M8 26h32"/>') },
  { id: 'fund', name: 'Park Fund', bg: 'linear-gradient(#5fb08a,#2f7a5e)', svg: ic('<path d="M24 8v32"/><path d="M31 15c-2-3-5-4-8-4-4 0-7 2-7 6s3 5 8 6 8 3 8 7-3 6-8 6c-4 0-7-1-9-4"/>') },
  { id: 'tools', name: 'Tools', bg: 'linear-gradient(#6fa3b8,#3b6f8a)', svg: ic('<path d="M30 9a9 9 0 00-8 12L9 34a3.5 3.5 0 005 5l13-13a9 9 0 0012-8l-6 6-5-1-1-5z"/>') },
  { id: 'settings', name: 'Settings', bg: 'linear-gradient(#9a9aa3,#5d5d68)', svg: ic('<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>') },
];
const DOCK = [
  { id: 'map', name: 'Map', bg: 'linear-gradient(#4fb286,#2a7d6a)', svg: ic('<path d="M24 41s-12-11-12-20a12 12 0 0124 0c0 9-12 20-12 20z"/><circle cx="24" cy="21" r="4.5"/>') },
  { id: 'camera', name: 'Camera', bg: 'linear-gradient(#cfd3da,#8d929c)', svg: ic('<rect x="7" y="14" width="34" height="24" rx="5"/><circle cx="24" cy="26" r="7"/><path d="M17 14l3-5h8l3 5"/>').replace('#fff', '#2a2d35') },
  { id: 'photos', name: 'Photos', bg: 'linear-gradient(#f2c14e,#e0803c)', svg: ic('<circle cx="24" cy="24" r="4"/><path d="M24 20c-6-9 0-13 0-13s6 4 0 13zM28 24c9-6 13 0 13 0s-4 6-13 0zM24 28c6 9 0 13 0 13s-6-4 0-13zM20 24c-9 6-13 0-13 0s4-6 13 0z"/>'), badge: () => (GUIDE.photos.length || '') },
  { id: 'clyde', name: 'Clyde', bg: 'linear-gradient(#d98a6a,#a8503c)', svg: ic('<path d="M10 13h28a3 3 0 013 3v15a3 3 0 01-3 3H22l-8 7v-7h-4a3 3 0 01-3-3V16a3 3 0 013-3z"/>', '<circle cx="18" cy="23.5" r="1.8" fill="#fff"/><circle cx="25" cy="23.5" r="1.8" fill="#fff"/><circle cx="32" cy="23.5" r="1.8" fill="#fff"/>') },
];
const ALL = [...APPS, ...DOCK];
const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export class Phone {
  constructor({ fundCtx, discoveries, setWaypoint, onCamera, actions, audio, el, player, minimap, gauge, jobCtx, onOpen, onClose }) {
    Object.assign(this, { fundCtx, discoveries, setWaypoint, onCamera, actions, audio, el, player, minimap, gauge, jobCtx, onOpen, onClose, isOpen: false, tab: 'map' });
    el.addEventListener('click', (e) => { if (e.target === el) this.close(); });
    addEventListener('keydown', (e) => { if (this.isOpen && this.tab === 'photos') this._key?.(e); });
  }
  open(tab = 'home') {
    this.isOpen = true; this.tab = tab; this.onOpen?.();
    this.el.innerHTML = `<div class="phone"><div class="pbar"><button class="pback" data-home>\u2039</button><span class="pname" data-ph-name>Home</span><small data-ph-sub></small></div>
      <div class="pscroll" data-ph-body></div><div class="phomebar"><i data-home></i></div></div>`;
    this._finish();                                         // a close still fading out is cut short
    this.el.classList.remove('hidden', 'closing'); this.el.classList.add('enter'); void this.el.offsetWidth;   // starts as the small raised phone, then swells to fill the view
    requestAnimationFrame(() => this.el.classList.remove('enter'));
    this.el.querySelectorAll('[data-home]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.show('home'); }));
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
    const home = tab === 'home', pb = this.el.querySelector('.pbar'), nm = this.el.querySelector('[data-ph-name]');
    pb.classList.toggle('home', home); nm.textContent = home ? '' : (ALL.find((x) => x.id === tab)?.name || '');
    this.el.querySelector('.phone').classList.toggle('onhome', home);
    if (home) {
      const now = new Date(), clock = document.createElement('div');
      clock.innerHTML = `<div style="font-size:54px;font-weight:300;letter-spacing:.02em">${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}</div><div style="font-size:13px;opacity:.75;margin-top:-2px">${now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>`;
      clock.style.cssText = 'text-align:center;margin:6px 0 22px'; body.appendChild(clock);
      const grid = document.createElement('div'); grid.className = 'appgrid';
      const mkApp = (ap, lbl = true) => {
        const badge = ap.badge?.();
        const d = document.createElement('button'); d.className = 'app';
        d.innerHTML = `<span class="ico" style="background:${ap.bg}">${ap.svg}${badge ? `<em>${badge}</em>` : ''}</span>${lbl ? `<span class="lbl">${ap.name}</span>` : ''}`;
        d.addEventListener('click', (e) => { e.stopPropagation(); if (ap.id === 'camera') { this.close(); this.onCamera?.(); } else this.show(ap.id); });
        return d;
      };
      for (const ap of APPS) grid.appendChild(mkApp(ap));
      body.appendChild(grid);
      const dots = document.createElement('div'); dots.className = 'pdots'; dots.innerHTML = '<i class="on"></i>'; body.appendChild(dots);
      const dock = document.createElement('div'); dock.className = 'dock'; for (const ap of DOCK) dock.appendChild(mkApp(ap, false)); body.appendChild(dock);
    } else if (tab === 'places') {
      this._places(body);
    } else if (tab === 'journal') {
      const n = document.createElement('div'); n.className = 'bubble'; n.textContent = JOURNAL.list.length ? 'Your notes, newest first.' : 'Nothing yet. Walk, look, listen. What you find and name goes here.'; body.appendChild(n);
      for (const j of [...JOURNAL.list].reverse()) {
        const r = document.createElement('div'); r.style.cssText = 'background:#2d2a36;border-radius:10px;padding:9px 12px;margin-bottom:7px;font-size:13px;line-height:1.45';
        r.innerHTML = `<small style="opacity:.6;letter-spacing:.06em;text-transform:uppercase">${j.season} \u00b7 ${new Date(j.at).toLocaleDateString()}</small><br>${j.text.replace(/</g, '&lt;')}`; body.appendChild(r);
      }
    } else if (tab === 'compass') {
      const w = document.createElement('div'); w.style.cssText = 'text-align:center;padding-top:10px';
      w.innerHTML = `<div data-compass style="font-size:30px;font-weight:700;margin-bottom:14px"></div><div style="position:relative;width:240px;height:240px;margin:0 auto"><div data-dial style="position:absolute;inset:0;border-radius:50%;border:4px solid rgba(244,230,200,.6);background:#25222c"><b style="position:absolute;left:50%;top:6px;transform:translateX(-50%);color:#e0412e">N</b><b style="position:absolute;left:50%;bottom:6px;transform:translateX(-50%)">S</b><b style="position:absolute;top:50%;left:10px;transform:translateY(-50%)">W</b><b style="position:absolute;top:50%;right:10px;transform:translateY(-50%)">E</b></div><div style="position:absolute;left:50%;top:-12px;width:0;height:0;border:9px solid transparent;border-bottom:16px solid #ffd9a0;transform:translateX(-50%)"></div></div><div class="bubble" style="margin-top:22px">North is on the dial. The dam is south of the lake, the beach is on the east shore.</div>`;
      body.appendChild(w);
    } else if (tab === 'fund') {
      this._fund(body);
    } else if (tab === 'tools') {
      // everything the keyboard does that a touch screen has no key for (also handy with a keyboard)
      const A = this.actions, p = this.player;
      const mk = (label, sub, fn, keep) => { const b = document.createElement('div'); b.className = 'fsbtn'; b.style.cssText = 'margin:8px 0;text-align:left;padding:12px 16px'; b.innerHTML = `${label}<small style="display:block;opacity:.7;margin-top:3px;letter-spacing:0;text-transform:none">${sub}</small>`; b.addEventListener('click', (e) => { e.stopPropagation(); if (keep) { fn(); this.show('tools'); } else { this.close(); setTimeout(fn, 60); } }); body.appendChild(b); };
      const h = (t) => { const d = document.createElement('div'); d.className = 'bubble'; d.style.cssText = 'margin:14px 0 2px;opacity:.8'; d.textContent = t; body.appendChild(d); };
      h('In your hands');
      mk(p.carry === 'axe' ? '\u2713 Axe' : 'Axe', 'Chop. Swing with the big button.', () => A.carry('axe'));
      mk(p.carry === 'rod' ? '\u2713 Fishing rod' : 'Fishing rod', 'Cast with the big button, hold it to reel, steer the joystick to counter a run.', () => A.carry('rod'));
      mk(p.carry === 'none' ? '\u2713 Hands free' : 'Hands free', 'Put everything away.', () => A.carry('none'));
      h('Out in the park');
      mk(p.sitting ? 'Stand up' : 'Sit and wait', 'Stay still and the park carries on around you. Any step stands you up.', () => A.sit());
      mk('Pick up litter', 'Whatever is within reach.', () => A.pickUp());
      mk((RUN.s.saplingStock || 0) > 0 ? 'Plant a sapling' : 'Plant a seed', `In front of you. You have ${RUN.s.saplingStock || 0} saplings and ${RUN.s.seeds || 0} seeds; the Park Fund app sells more.`, () => A.plant());
      mk('On-screen map', 'Cycles: off, corner, bigger.', () => A.map(), true);
      if (A.phaseTwo()) mk('Choices', 'The harm-and-care choices, the check-in.', () => A.choices());
      const n = document.createElement('div'); n.className = 'bubble'; n.textContent = 'Camera and Map are on the home screen. Use climbs in and out of the boat and works the gate.'; body.appendChild(n);
    } else if (tab === 'settings') {
      const hp = document.createElement('div'); hp.className = 'usage'; hp.style.maxWidth = 'none'; body.appendChild(hp); mountHudPanel(hp);
      const c = document.querySelector('#paused .controls'); if (c) { const k = document.createElement('div'); k.className = 'controls'; k.style.cssText = 'margin-top:16px;font-size:12px;line-height:2'; k.innerHTML = c.innerHTML; body.appendChild(k); }
    } else if (tab === 'map') {
      const comp = document.createElement('div'); comp.className = 'compass'; comp.dataset.compass = ''; body.appendChild(comp);
      this._prevMap = this.minimap.mode; this.minimap.set('full');
      const cv = this._borrow(this.minimap); cv.style.display = 'block'; cv.style.border = '3px solid rgba(244,230,200,.6)'; body.appendChild(cv);
      const n = document.createElement('div'); n.className = 'bubble'; n.textContent = 'Gold dot: the gate. Yellow ring: a marker from Clyde, if you have one. The Tools app turns the corner map on and off.'; body.appendChild(n);
    } else if (tab === 'status') {
      if (RUN.phaseTwo || RUN.dev) {
        const cv = this._borrow(this.gauge); cv.style.display = 'block'; cv.style.width = '300px'; cv.style.height = '190px'; body.appendChild(cv);
        const n = document.createElement('div'); n.className = 'bubble';
        n.innerHTML = `Harm <b>${Math.round(PRESSURE.harm * 100)}%</b>: lake held ${Math.round(PRESSURE.drop * 100)}% lower, wildlife at ${Math.round(PRESSURE.life * 100)}%.<br>Care <b>${Math.round(CARE.value * 100)}%</b>: ${Math.round(CARE.hours)} staff hours freed, about ${fmt$(CARE.saved)} saved (illustrative), ${CARE.built.length} built.`;
        body.appendChild(n);
      } else { const n = document.createElement('div'); n.className = 'bubble'; n.textContent = 'Nothing to measure yet. The park is just the park.'; body.appendChild(n); }
    } else if (tab === 'guide') {
      const n = document.createElement('div'); n.className = 'bubble';
      n.innerHTML = `<b>Field Guide</b> &middot; ${GUIDE.count()} of ${ENTRIES.length} found.<br>Press V for the camera and photograph trees, birds and animals. Fish go in when you catch them (Q for the rod). Songs you hear go in too. These are species typical of a Massachusetts reservoir forest, not a survey of the real park.`;
      body.appendChild(n);
      for (const cat of ['Trees', 'Birds', 'Animals', 'Fish', 'Sounds']) {
        const h = document.createElement('h4'); h.textContent = cat; h.style.cssText = 'margin:14px 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.7'; body.appendChild(h);
        for (const e of ENTRIES.filter((x) => x.cat === cat)) {
          const d = GUIDE.d[e.id] || {}, row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:10px;align-items:center;background:#2d2a36;border-radius:10px;padding:8px;margin-bottom:6px;font-size:13px;line-height:1.35';
          const pic = d.thumb ? `<img src="${d.thumb}" style="width:72px;height:48px;border-radius:6px;object-fit:cover;flex:none">` : `<div style="width:72px;height:48px;border-radius:6px;background:#1d1b22;flex:none;display:grid;place-items:center;opacity:.5">${e.songOnly ? '\u266a' : '?'}</div>`;
          const known = GUIDE.found(e.id);
          row.dataset.id = e.id;
          row.innerHTML = `${pic}<div style="flex:1"><b>${known ? e.name : '???'}</b>${d.photos > 1 ? ` <small>\u00d7${d.photos}</small>` : ''}${d.caught ? ` <small>caught \u00d7${d.caught}, best ${d.best} in</small>` : ''}<br><small style="opacity:.8">${known ? e.blurb : (e.songOnly ? 'Listen for it.' : e.fish ? 'Catch it, or photograph it.' : 'Photograph it.')}</small></div>`;
          if (e.song && d.heard) { const b = document.createElement('button'); b.textContent = '\u25b6'; b.title = 'Play its song'; b.style.cssText = 'font:inherit;background:#3a3646;color:inherit;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:6px 10px;cursor:pointer'; b.addEventListener('click', (ev) => { ev.stopPropagation(); this.audio?.replay(e.song); }); row.appendChild(b); }
          if (d.photos) { row.style.cursor = 'pointer'; row.addEventListener('click', () => { const i = GUIDE.photos.filter((q) => q.id === e.id).length - 1; if (i >= 0) { this.tab = 'photos'; this.el.querySelector('[data-ph-name]').textContent = 'Photos'; this._photos(body, i, e.id); } }); }
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
  /** Park Fund: what AI help has saved the park, to spend on seeds, saplings and the lake */
  _fund(body) {
    body.innerHTML = '';
    const live = RUN.phaseTwo || RUN.dev, fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
    const top = document.createElement('div'); top.className = 'fundtop';
    top.innerHTML = `<div class="fbal">${fmt(FUND.balance)}</div><small>Money the park keeps because of the help you asked for: grants written, hours saved, timber sold, and each season's dividend from your AI use. Figures are invented.</small>`;
    body.appendChild(top);
    if (!live) { const n = document.createElement('div'); n.className = 'bubble'; n.textContent = 'The fund opens when Clyde does, after your first year here.'; body.appendChild(n); return; }
    const W = FUND.water(), holds = FUND.holds(), lv = Usage.level(), lvName = lv === null ? 'not set' : LEVELS[Math.round(lv)].name;
    const lake = document.createElement('div'); lake.className = 'flake';
    lake.innerHTML = `<div class="fl1"><span>Lake protection</span><b>${Math.round(W * holds * 100)}%</b></div><i><u style="width:${W * 100}%"></u><s style="width:${W * holds * 100}%"></s></i>
      <small>${Math.round(W * 100)}% installed. ${holds >= 0.999 ? `At your current use (${lvName}) it all holds: enough of it can save the lake outright.` : holds <= 0.001 ? `At ${lvName} use none of it holds: the lake drops faster than any of this can keep up.` : `At ${lvName} use only ${Math.round(holds * 100)}% of it holds. Ease off and it all works.`}</small>`;
    body.appendChild(lake);
    const sect = (t) => { const h = document.createElement('div'); h.className = 'uh'; h.style.margin = '16px 0 4px'; h.textContent = t; body.appendChild(h); };
    const card = (kind, title, lines, price, done, onBuy) => {
      const c = document.createElement('div'); c.className = `ccard fcard ${kind === 'AI' ? 'ai' : 'park'}${done ? ' done' : ''}`;
      c.innerHTML = `<div class="ctop"><span class="ctag">${kind === 'AI' ? 'AI' : 'PARK'}</span><b>${title}</b></div>${lines}<button class="cgo" ${done || FUND.balance < price ? 'disabled' : ''}>${done ? 'Installed' : `Buy \u00b7 ${fmt(price)}`}</button>`;
      c.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); if (done || FUND.balance < price) return; const r = onBuy(); this.fundCtx?.toast?.(r.msg, 3.2); this._fund(body); });
      body.appendChild(c);
    };
    sect('To plant');
    const p = this.player;
    for (const it of SUPPLIES) card('Park', it.title, `<div class="cone">${it.gain}</div>`, it.price, false, () => FUND.buySupply(it.id));
    const have = document.createElement('small'); have.style.cssText = 'display:block;opacity:.7;margin:2px 2px 0'; have.textContent = `In your pocket: ${RUN.s.seeds || 0} seeds, ${RUN.s.saplingStock || 0} saplings. Planted so far: ${RUN.s.planted || 0}.`; body.appendChild(have);
    sect('For the lake');
    for (const m of MEASURES) {
      const lines = `<div class="cone">${m.gain}</div><div class="chips"><span class="chip fx">+${Math.round(m.w * 100)}% lake protection${m.delay ? ' (from next season)' : ''}</span>${m.harm ? `<span class="chip harmchip">+${(m.harm * 100).toFixed(1)}% harm</span>` : ''}</div><div class="freal">${m.real}</div>`;
      card(m.kind, m.title, lines, m.price, FUND.has(m.id), () => FUND.buyMeasure(m.id, this.fundCtx));
    }
    const n = document.createElement('small'); n.style.cssText = 'display:block;opacity:.6;margin:12px 2px 0;line-height:1.45'; n.textContent = 'The practices are real. What each one does to this lake, and what it costs, is invented for the game.'; body.appendChild(n);
  }
  /** Places: names you give to spots, for you only (not official), plus the ruins you have found */
  _places(body) {
    body.innerHTML = '';
    const p = this.player, n = document.createElement('div'); n.className = 'bubble';
    n.textContent = 'Places are yours alone: name a spot where you are standing, and it shows on your map.'; body.appendChild(n);
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;margin-bottom:12px';
    const inp = document.createElement('input'); inp.placeholder = 'Name this spot'; inp.maxLength = 28;
    inp.style.cssText = 'flex:1;font:inherit;font-size:14px;padding:9px 10px;border-radius:10px;border:2px solid rgba(244,230,200,.35);background:#25222c;color:#f4e6c8;min-width:0';
    inp.addEventListener('keydown', (e) => { if (e.code === 'Escape') { inp.blur(); return; } e.stopPropagation(); if (e.code === 'Enter') add.click(); });
    const add = document.createElement('button'); add.className = 'choice sm'; add.textContent = 'Name it'; add.style.cssText = 'padding:0 14px;font-size:14px';
    add.addEventListener('click', (e) => { e.stopPropagation(); if (PLACES.add(inp.value, p.pos.x, p.pos.z)) this._places(body); });
    row.append(inp, add); body.appendChild(row);
    for (const pl of [...PLACES.list].reverse()) {
      const d = Math.round(Math.hypot(pl.x - p.pos.x, pl.z - p.pos.z));
      const r = document.createElement('div'); r.style.cssText = 'display:flex;align-items:center;gap:8px;background:#2d2a36;border-radius:10px;padding:9px 10px;margin-bottom:6px;font-size:14px';
      r.innerHTML = `<div style="flex:1;min-width:0"><b>${pl.name.replace(/</g, '&lt;')}</b><br><small style="opacity:.7">${d} m away \u00b7 ${pl.season}</small></div>`;
      const mk = (t, f) => { const b = document.createElement('button'); b.className = 'choice sm'; b.textContent = t; b.style.cssText = 'padding:6px 9px;font-size:13px'; b.addEventListener('click', (e) => { e.stopPropagation(); f(); }); return b; };
      r.append(mk('Mark', () => { this.setWaypoint?.(pl.x, pl.z, pl.name); }), mk('\u2715', () => { PLACES.remove(pl); this._places(body); }));
      body.appendChild(r);
    }
    const found = this.discoveries?.foundList() ?? [], total = this.discoveries?.items.length ?? 0;
    const h = document.createElement('h4'); h.textContent = `Found in the woods (${found.length} of ${total})`; h.style.cssText = 'margin:16px 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.7'; body.appendChild(h);
    for (const f of found) {
      const r = document.createElement('div'); r.style.cssText = 'background:#2d2a36;border-radius:10px;padding:9px 12px;margin-bottom:6px;font-size:13px;line-height:1.45';
      r.innerHTML = `<b>${f.kind === 'cellar' ? 'A cellar hole' : f.kind === 'well' ? 'A stone well' : 'A boundary stone'}</b>`;
      const mk = document.createElement('button'); mk.className = 'choice sm'; mk.textContent = 'Mark'; mk.style.cssText = 'float:right;padding:3px 9px;font-size:12px'; mk.addEventListener('click', (e) => { e.stopPropagation(); this.setWaypoint?.(f.x, f.z, 'Found'); }); r.prepend(mk);
      body.appendChild(r);
    }
    if (found.length < total) { const m = document.createElement('div'); m.style.cssText = 'font-size:12px;opacity:.55;margin:4px 2px'; m.textContent = 'Old things are scattered off the trails. Wander.'; body.appendChild(m); }
  }
  /** the album: a grid, and a full viewer you can thumb through (arrows, or the screen's left/right) */
  _photos(body, startIdx = null, only = null) {
    body.innerHTML = '';
    const all = GUIDE.photos.filter((p) => !only || p.id === only);
    if (startIdx != null && all.length) return this._viewer(body, all, Math.max(0, Math.min(all.length - 1, startIdx)), only);
    const n = document.createElement('div'); n.className = 'bubble';
    n.textContent = all.length ? `${GUIDE.photos.length} photo${GUIDE.photos.length === 1 ? '' : 's'}. Tap one to look closer.` : 'No photos yet. Open the Camera app (or press V) and photograph what is in the frame.';
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
    const dl = this.el.querySelector('[data-dial]'); if (dl) dl.style.transform = `rotate(${-b}deg)`;
    const s = this.el.querySelector('[data-ph-sub]'); if (s) s.textContent = `${Math.round(p.pos.y - 20)} m above the lake`;
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false; this.el.classList.add('closing');   // shrinks back toward the hand while the 3D phone lowers
    this._ct = setTimeout(() => this._finish(), 320);
    this.onClose?.();
  }
  _finish() {
    if (this._ct == null) return; clearTimeout(this._ct); this._ct = null;
    this._release(); this.el.classList.add('hidden'); this.el.classList.remove('closing'); this.el.innerHTML = '';
  }
}
