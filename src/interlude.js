// The end-of-season interlude: what has changed, a footprint check-in (first time), and a choice.  Then the next season.
// All wording lives here so it is easy to rewrite once the premise is set.
import { RUN, INTRO } from './run.js';
import { PRESSURE } from './pressure.js';
import { Usage, LEVELS } from './usage.js';
import { renderChoices, pickChoices } from './choices.js';
import { CARE, fmt$ } from './care.js';
import { SEASON_DEF } from './season.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const PULSE = 0.12;                    // lasting harm added at each interlude, scaled by your footprint level

export function showInterlude(el, ctx, onContinue) {
  const first = RUN.n === INTRO - 1;   // the end of the first year
  const need = first;                  // the first interlude asks how much you lean on AI
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="phone clyde">
      <div class="pbar"><span class="pname">Clyde</span><small>${cap(RUN.season)} has passed</small></div>
      <div class="pscroll">
        <div class="bubble" data-i-text></div>
        ${need ? '<div data-usage-panel2></div>' : ''}
        <div data-i-changes></div>
        <div data-i-choices class="usage"></div>
        <div class="go inactive" data-i-go>Continue to ${cap(RUN.next)}</div>
      </div>
    </div>`;
  const text = el.querySelector('[data-i-text]');
  text.textContent = first
    ? "Hi, I'm Clyde. You have now seen the park through a whole year, and until now it was only a park. I can take on the paperwork, the plans and the upkeep it never had staff for, and every request I answer uses real energy and water somewhere else. Tell me how much you lean on AI, then pick one thing."
    : 'The season turned. Here is what the park carries from what you did and what you asked of me. Pick one thing.';
  const go = el.querySelector('[data-i-go]');
  let chose = false, said = !need || Usage.level() !== null;
  const ready = () => go.classList.toggle('inactive', !(chose && said));
  const changes = el.querySelector('[data-i-changes]');
  const showChanges = () => {
    const l = Usage.level(); if (l === null) { changes.innerHTML = ''; return; }
    const lv = LEVELS[Math.round(l)].name;
    const p = PULSE * LEVELS[Math.round(l)].p;
    changes.innerHTML = `<small>Your footprint: <b>${lv}</b>. This turn adds ${(p * 100).toFixed(1)}% lasting harm, and the park keeps taking harm while you play at this level (${Math.round(CARE.shield * 100)}% slower thanks to early warning). <b>Harm ${Math.round(PRESSURE.harm * 100)}%</b>${CARE.buffer > 0 ? ` (lasting ${Math.round(PRESSURE.damage * 100)}%, softened by upkeep)` : ''}${CARE.recover > 0 ? `, healing ${(1 + CARE.recover).toFixed(2).replace(/\.?0+$/, '')}x faster` : ''}: lake held ${Math.round(PRESSURE.drop * 100)}% lower, wildlife at ${Math.round(PRESSURE.life * 100)}%, colour at ${Math.round(PRESSURE.saturate * 100)}%. <b>Care ${Math.round(CARE.value * 100)}%</b>: ${Math.round(CARE.hours)} staff hours freed, about ${fmt$(CARE.saved)} saved (illustrative, invented figures), ${CARE.built.length} thing${CARE.built.length === 1 ? '' : 's'} built.</small>`;
  };
  if (need) {
    const mount = el.querySelector('[data-usage-panel2]'); mount.setAttribute('data-usage-panel', '');
    ctx.mountUsage(mount, () => { said = Usage.level() !== null; showChanges(); ready(); });
  }
  showChanges();
  const ch = el.querySelector('[data-i-choices]');
  renderChoices(ch, ctx, () => { chose = true; skip.disabled = true; skip.style.opacity = '.35'; ready(); showChanges(); }, pickChoices(RUN.n));
  var skip = document.createElement('button'); skip.className = 'choice'; skip.innerHTML = '<b>Make no choice</b><span>That is a choice too. Nothing changes, nothing is given.</span>';
  skip.addEventListener('click', (e) => { e.stopPropagation(); if (skip.disabled) return; chose = true; ch.querySelectorAll('[data-choice]').forEach((o) => { o.disabled = true; o.style.opacity = '.35'; }); ch.querySelector('[data-choice-note]').textContent = 'You let the season pass.'; ready(); });
  ch.insertBefore(skip, ch.querySelector('[data-choice-note]'));
  ready();
  go.addEventListener('click', (e) => {
    e.stopPropagation();
    if (go.classList.contains('inactive')) return;
    const l = Usage.level();
    onContinue(l !== null ? PULSE * LEVELS[Math.round(l)].p : 0);
  });
  el.addEventListener('click', (e) => e.stopPropagation());
}
