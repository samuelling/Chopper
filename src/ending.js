// The two ways the game ends: your years run out (someone else walks it next), or the reservoir empties and stays empty.
// Both roll credits over the drone flight.  Figures are invented where they say so; the rest are counts of what you actually did.
import { RUN } from './run.js';
import { MEGAZINE_HTML, mountMegazine } from './megazine.js';
let stopMz = null;

const SPEED = parseFloat(new URLSearchParams(location.search).get('cspeed')) || 1;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const plural = (n, a, b = a + 's') => `${n} ${n === 1 ? a : b}`;

export function creditsHTML(kind, st) {
  const span = st.age0 == null ? '' : ` from age ${st.age0} to ${st.ageEnd}`;
  const blocks = [];
  if (kind === 'life') {
    blocks.push(['', `You walked here for ${plural(st.years, 'year')}${span}.`],
      ['', st.harm < 0.2 ? 'The park is in good shape. The birds will be loud in May.' : st.harm < 0.6 ? "The park is thinner than when you first came. It's still a good place to walk." : "The park is worn. It's still here."],
      ...(st.lake == null ? [] : [['', st.lake > 0.95 ? (st.measures ? 'The reservoir is full. The measures held.' : 'The reservoir is full.') : `The reservoir is at about ${Math.round(st.lake * 100)}%.`]]),
      ['', 'Someone else will walk it next.']);
  } else if (kind === 'silent') {
    blocks.push(['', 'The woods have gone quiet.'], ['', 'Most of the trees around the water are standing dead, and the birds, the deer and the frogs have mostly gone.'],
      ...(st.lake == null ? [] : [['', st.lake > 0.95 ? 'The reservoir is full. The water was saved; the woods were not.' : `The reservoir is at about ${Math.round(st.lake * 100)}%.`]]),
      ['', "This isn't a forecast for any real place. It's what this game does when the cost keeps going unpaid."]);
  } else {
    blocks.push(['', 'The reservoir is empty.'], ['', 'The herons and turtles have moved on, and the bass with them.'],
      ['', "This isn't a forecast for any real place. It's what this game does when the cost keeps going unpaid."]);
  }
  const mine = [];
  const add = (n, a, b) => { if (n > 0) mine.push(plural(n, a, b)); };
  add(st.years, 'year played', 'years played'); add(st.felled, 'tree felled', 'trees felled'); add(st.planted, 'seed planted', 'seeds planted'); add(st.litter, 'piece of litter picked up', 'pieces of litter picked up');
  add(st.fish, 'fish caught and let go', 'fish caught and let go'); add(st.species, 'species in your guide', 'species in your guide'); add(st.photos, 'photo', 'photos'); add(st.places, 'place named', 'places named'); add(st.ruins, 'ruin found', 'ruins found'); add(st.mapped, 'place found and put on your map', 'places found and put on your map'); add(st.moments, 'moment caught on camera', 'moments caught on camera'); add(st.built, 'thing built', 'things built'); add(st.measures, 'water measure installed', 'water measures installed');
  const ledger = `Harm ${Math.round(st.harm * 100)}% · Care ${Math.round(st.care * 100)}%${st.hours ? ` · ${Math.round(st.hours)} staff hours freed (invented figure)` : ''}`;
  const parts = [
    ...blocks.map(([h, t]) => `<p class="big">${esc(t)}</p>`),
    '<div class="gap"></div>', '<h2>Your years</h2>', ...mine.map((m) => `<p>${esc(m)}</p>`), `<p class="dim">${esc(ledger)}</p>`,
    '<div class="gap"></div>', '<h2>ASHLAND</h2>', '<p>A game about a real place</p><p>Ashland State Park, Massachusetts</p>',
    '<div class="gap"></div>', '<h2>Made by</h2>', '<p>Sam Ling, with Claude</p>',
    '<div class="gap"></div>', '<h2>The real part</h2>',
    '<p>Map and trails: OpenStreetMap contributors</p><p>Hills: USGS 3DEP lidar</p><p>Forest cover: NLCD 2021</p><p>Lake depth: MassWildlife and MassGIS</p>',
    '<div class="gap"></div>', '<h2>The invented part</h2>',
    '<p>The trees, rocks and benches, every animal and its habits, the data center over the ridge, the harm and care figures, and the end of the lake or of the woods.</p>',
    '<p>The coves, points, hills and swamps by name, the beaver lodge, the osprey nest, the sunken skiff and the old road under the water, the leads and who gives them, the rest of the hidden things and when they turn up, the park\u2019s page and what it pays.</p>',
    '<p class="dim">Life expectancy here is a rough population average used as a clock. It says nothing about you.</p>',
    '<div class="gap"></div>', '<p class="big">Thanks for walking it.</p>',
    // a full screen of empty space, so the megaZINE masthead and its QR end up alone on screen when the scroll stops
    '<div style="height:100vh"></div>', '<h2>Part of</h2>', MEGAZINE_HTML, '<div style="height:60vh"></div>',
  ];
  return parts.join('');
}

/** scrolls the credits, then shows the end buttons.  Returns a stop function. */
export function rollCredits(root, html, { onRestart, onStay, onMenu }) {
  stopMz?.();
  root.classList.remove('hidden');
  root.innerHTML = `<div class="crscroll">${html}</div><button class="crskip" data-cr-menu>Skip to the start menu</button><div class="crend" hidden><button data-cr-stay>Stay and watch</button><button data-cr-restart>Begin again</button></div>`;
  const sc = root.querySelector('.crscroll'), end = root.querySelector('.crend');
  stopMz = mountMegazine(root);
  let y = innerHeight, raf = 0, last = performance.now(), done = false;
  const tick = (now) => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    y -= 34 * SPEED * dt; sc.style.transform = `translateY(${y}px)`;
    // stop with the megaZINE masthead held a little above centre, so the QR can be scanned
    const mz = sc.querySelector('.mz'), stopAt = mz ? -(mz.offsetTop + mz.offsetHeight / 2 - innerHeight * 0.42) : -(sc.scrollHeight - innerHeight * 0.45);
    if (y <= stopAt) { y = stopAt; sc.style.transform = `translateY(${y}px)`; if (!done) { done = true; end.hidden = false; } }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  root.querySelector('[data-cr-restart]').addEventListener('click', () => { if (confirm('Begin again from Year One? Everything resets.')) { stopMz?.(); onRestart(); } });
  root.querySelector('[data-cr-stay]').addEventListener('click', () => { cancelAnimationFrame(raf); stopMz?.(); root.classList.add('hidden'); onStay?.(); });
  root.querySelector('[data-cr-menu]').addEventListener('click', (e) => { e.stopPropagation(); cancelAnimationFrame(raf); stopMz?.(); root.classList.add('hidden'); onMenu?.(); });
  return () => { cancelAnimationFrame(raf); stopMz?.(); };
}
