// The two ways the game ends: your years run out (someone else walks it next), or the reservoir empties and stays empty.
// Both roll credits over the drone flight.  Figures are invented where they say so; the rest are counts of what you actually did.
import { RUN } from './run.js';

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
  } else {
    blocks.push(['', 'The reservoir is empty.'], ['', 'The herons and turtles have moved on, and the bass with them.'],
      ['', "This isn't a forecast for any real place. It's what this game does when the cost keeps going unpaid."]);
  }
  const mine = [];
  const add = (n, a, b) => { if (n > 0) mine.push(plural(n, a, b)); };
  add(st.years, 'year played', 'years played'); add(st.felled, 'tree felled', 'trees felled'); add(st.planted, 'seed planted', 'seeds planted'); add(st.litter, 'piece of litter picked up', 'pieces of litter picked up');
  add(st.fish, 'fish caught and let go', 'fish caught and let go'); add(st.species, 'species in your guide', 'species in your guide'); add(st.photos, 'photo', 'photos'); add(st.places, 'place named', 'places named'); add(st.ruins, 'ruin found', 'ruins found'); add(st.built, 'thing built', 'things built'); add(st.measures, 'water measure installed', 'water measures installed');
  const ledger = `Harm ${Math.round(st.harm * 100)}% · Care ${Math.round(st.care * 100)}%${st.hours ? ` · ${Math.round(st.hours)} staff hours freed (invented figure)` : ''}`;
  const parts = [
    ...blocks.map(([h, t]) => `<p class="big">${esc(t)}</p>`),
    '<div class="gap"></div>', '<h2>Your years</h2>', ...mine.map((m) => `<p>${esc(m)}</p>`), `<p class="dim">${esc(ledger)}</p>`,
    '<div class="gap"></div>', '<h2>ASHLAND</h2>', '<p>A game about a real place</p><p>Ashland State Park, Massachusetts</p>',
    '<div class="gap"></div>', '<h2>Made by</h2>', '<p>Sam Ling, with Claude</p>',
    '<div class="gap"></div>', '<h2>The real part</h2>',
    '<p>Map and trails: OpenStreetMap contributors</p><p>Hills: USGS 3DEP lidar</p><p>Forest cover: NLCD 2021</p><p>Lake depth: MassWildlife and MassGIS</p>',
    '<div class="gap"></div>', '<h2>The invented part</h2>',
    '<p>The trees, rocks and benches, every animal and its habits, the data center over the ridge, the harm and care figures, and the end of the lake.</p>',
    '<p class="dim">Life expectancy here is a rough population average used as a clock. It says nothing about you.</p>',
    '<div class="gap"></div>', '<p class="big">Thanks for walking it.</p>', '<div class="gap"></div>',
    '<h2>Part of MEGAzine</h2>', '<p>Between money and doom</p>', '<p><a href="https://megazine.org" target="_blank" rel="noopener" style="color:inherit;pointer-events:auto">megazine.org</a></p>', '<div class="gap"></div>',
  ];
  return parts.join('');
}

/** scrolls the credits, then shows the end buttons.  Returns a stop function. */
export function rollCredits(root, html, { onRestart, onStay }) {
  root.classList.remove('hidden');
  root.innerHTML = `<div class="crscroll">${html}</div><div class="crend" hidden><button data-cr-stay>Stay and watch</button><button data-cr-restart>Begin again</button></div>`;
  const sc = root.querySelector('.crscroll'), end = root.querySelector('.crend');
  let y = innerHeight, raf = 0, last = performance.now(), done = false;
  const tick = (now) => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    y -= 34 * SPEED * dt; sc.style.transform = `translateY(${y}px)`;
    if (!done && y < -(sc.scrollHeight - innerHeight * 0.45)) { done = true; end.hidden = false; }
    if (!done) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  root.querySelector('[data-cr-restart]').addEventListener('click', () => { if (confirm('Begin again from Year One? Everything resets.')) onRestart(); });
  root.querySelector('[data-cr-stay]').addEventListener('click', () => { root.classList.add('hidden'); onStay?.(); });
  return () => cancelAnimationFrame(raf);
}
