// The end-of-season interlude: what has changed, a footprint check-in (first time), and a choice.  Then the next season.
// All wording lives here so it is easy to rewrite once the premise is set.
import { RUN, INTRO } from './run.js';
import { PRESSURE } from './pressure.js';
import { Usage, LEVELS } from './usage.js';
import { renderChoices, pickChoices } from './choices.js';
import { CARE, fmt$ } from './care.js';
import { SEASON_DEF } from './season.js';
import { FUND } from './fund.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const PULSE = 0.12;                    // lasting harm added at each interlude, scaled by your footprint level

export const CLYDE_ICON = '<svg viewBox="0 0 48 48" width="22" height="22" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13h28a3 3 0 013 3v15a3 3 0 01-3 3H22l-8 7v-7h-4a3 3 0 01-3-3V16a3 3 0 013-3z"/></svg>';
const INTRO_LINES = [
  "Hi, I'm Clyde. You've now seen the park through a whole year, and until now it was only a park.",
  'I can take on the paperwork, the plans and the upkeep it never had staff for.',
  'Every request I answer uses real energy and water somewhere else.',
  "And somewhere else is closer than you'd think. There's a data center just over the ridge, one of the ones that runs me, and it draws on the same groundwater that keeps this reservoir full.",
  'So first, honestly: how much do you lean on AI in your own life?',
];

export function showInterlude(el, ctx, onContinue) {
  const first = RUN.n === INTRO - 1;   // the end of the first year: Clyde is new, so meet it in three steps
  const need = first;                  // the first interlude asks how much you lean on AI
  el.classList.remove('hidden');
  const now = new Date(), clock = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
  const pbar = (back) => `<div class="pbar">${back ? '<button class="pback" data-i-back>\u2039</button>' : ''}<span class="pname">Clyde</span><small>${cap(RUN.season)} has passed</small></div>`;
  const decide = `<div class="pscroll">
        <div class="bubble" data-i-text></div>
        <div data-i-changes></div>
        <div data-i-choices class="usage"></div>
        <div class="go inactive" data-i-go>Continue to ${cap(RUN.next)}</div>
      </div>`;
  el.innerHTML = first ? `
    <div class="phone clyde steps">
      <div class="istep lock on" data-step="0">
        <div class="lockclock">${clock}</div><div class="lockdate">The end of Year One</div>
        <div class="notif" data-i-notif><div class="nicon">${CLYDE_ICON}</div><div class="ntext"><div class="nhead"><b>CLYDE</b><span>now</span></div><b>Hi, I'm Clyde.</b><div>You've seen the park through a whole year. I can help look after it. Can we talk?</div></div></div>
        <div class="tapgo">Tap to open</div>
      </div>
      <div class="istep" data-step="1">${pbar(false)}
        <div class="pscroll"><div data-i-chat></div><div class="ihide" data-i-usagewrap><div data-usage-panel2></div><div class="go inactive" data-i-next>Next</div></div></div>
      </div>
      <div class="istep" data-step="2">${pbar(true)}${decide}</div>
      <div class="idots hide"><i class="on"></i><i></i><i></i></div>
    </div>` : `
    <div class="phone clyde">${pbar(false)}${decide}</div>`;
  const text = el.querySelector('[data-i-text]');
  text.textContent = first
    ? 'Thank you. Now pick one thing for the park. Each card shows what it gives and what it costs before you commit. What I save the park goes into a fund: spend it in the Park Fund app on your phone, on trees to plant and on ways to keep water in the lake.'
    : 'The season turned. Here is what the park carries from what you did and what you asked of me. Pick one thing.';
  if (first) {
    const steps = [...el.querySelectorAll('.istep')], dots = [...el.querySelectorAll('.idots i')];
    const goStep = (i) => { steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('back', k < i); }); dots.forEach((d, k) => d.classList.toggle('on', k === i)); el.querySelector('.idots').classList.toggle('hide', i === 0); steps[i].querySelector('.pscroll')?.scrollTo?.(0, 0); if (i === 1) chat(); };
    // the notification arrives a beat after the screen lights, with a soft chime
    setTimeout(() => { el.querySelector('[data-i-notif]')?.classList.add('in'); ctx.audio?.notify?.(); }, 650);
    steps[0].addEventListener('click', (e) => { e.stopPropagation(); goStep(1); });
    // Clyde types its introduction one message at a time; tapping the chat skips ahead
    let typed = false, timers = [];
    const chatEl = el.querySelector('[data-i-chat]'), uw = el.querySelector('[data-i-usagewrap]');
    const finish = () => { timers.forEach(clearTimeout); timers = []; chatEl.innerHTML = INTRO_LINES.map((l) => `<div class="bubble">${l}</div>`).join(''); uw.classList.remove('ihide'); typed = true; };
    function chat() {
      if (typed) return;
      chatEl.innerHTML = '<div class="bubble typing"><i></i><i></i><i></i></div>';
      let t = 0;
      INTRO_LINES.forEach((l, k) => {
        t += 500 + l.length * 16;
        timers.push(setTimeout(() => {
          const ty = chatEl.querySelector('.typing'); const bub = document.createElement('div'); bub.className = 'bubble pop'; bub.textContent = l;
          chatEl.insertBefore(bub, ty); if (k === INTRO_LINES.length - 1) { ty.remove(); uw.classList.remove('ihide'); typed = true; }
          bub.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        }, t));
      });
    }
    chatEl.addEventListener('click', (e) => { e.stopPropagation(); if (!typed) finish(); });
    const next = el.querySelector('[data-i-next]');
    const nextReady = () => next.classList.toggle('inactive', Usage.level() === null);
    next.addEventListener('click', (e) => { e.stopPropagation(); if (!next.classList.contains('inactive')) goStep(2); });
    el.querySelector('[data-i-back]').addEventListener('click', (e) => { e.stopPropagation(); goStep(1); });
    el._nextReady = nextReady;
  }
  const go = el.querySelector('[data-i-go]');
  let chose = false, said = !need || Usage.level() !== null;
  const ready = () => go.classList.toggle('inactive', !(chose && said));
  const changes = el.querySelector('[data-i-changes]');
  const showChanges = () => {
    const l = Usage.level(); if (l === null) { changes.innerHTML = ''; return; }
    const lv = LEVELS[Math.round(l)].name;
    const p = PULSE * LEVELS[Math.round(l)].p;
    const div = FUND.dividend(), fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
    changes.innerHTML = `<div class="istats"><span>Footprint <b>${lv}</b></span><span class="r">This turn <b>+${(p * 100).toFixed(1)}%</b> harm</span><span class="r">Harm <b>${Math.round(PRESSURE.harm * 100)}%</b></span><span class="g">Care <b>${Math.round(CARE.value * 100)}%</b></span><span class="g">Fund <b>${fmt(FUND.balance)}</b>${div ? ` (+${fmt(div)} this season)` : ''}</span><span class="b">Lake protection <b>${Math.round(FUND.guard() * 100)}%</b></span></div><small class="ifund">Spend the fund any time in the Park Fund app on your phone (${document.body.classList.contains('mobile') ? 'the Phone button' : 'press P'}): seeds, saplings and ten ways to keep water in the lake.</small><details class="iwhy"><summary>What that means</summary><small>Your footprint: <b>${lv}</b>. This turn adds ${(p * 100).toFixed(1)}% lasting harm, and the park keeps taking harm while you play at this level (${Math.round(CARE.shield * 100)}% slower thanks to early warning). <b>Harm ${Math.round(PRESSURE.harm * 100)}%</b>${CARE.buffer > 0 ? ` (lasting ${Math.round(PRESSURE.damage * 100)}%, softened by upkeep)` : ''}${CARE.recover > 0 ? `, healing ${(1 + CARE.recover).toFixed(2).replace(/\.?0+$/, '')}x faster` : ''}: lake held ${Math.round(PRESSURE.drop * 100)}% lower, wildlife at ${Math.round(PRESSURE.life * 100)}%, colour at ${Math.round(PRESSURE.saturate * 100)}%. <b>Care ${Math.round(CARE.value * 100)}%</b>: ${Math.round(CARE.hours)} staff hours freed, about ${fmt$(CARE.saved)} saved (illustrative, invented figures), ${CARE.built.length} thing${CARE.built.length === 1 ? '' : 's'} built.</small></details>`;
  };
  if (need) {
    const mount = el.querySelector('[data-usage-panel2]'); mount.setAttribute('data-usage-panel', '');
    ctx.mountUsage(mount, () => { said = Usage.level() !== null; showChanges(); ready(); el._nextReady?.(); });
    el._nextReady?.();
  }
  showChanges();
  const ch = el.querySelector('[data-i-choices]');
  renderChoices(ch, ctx, () => { chose = true; skip.disabled = true; skip.style.opacity = '.35'; ready(); showChanges(); }, pickChoices(RUN.n));
  var skip = document.createElement('button'); skip.className = 'cskip'; skip.innerHTML = '<b>Make no choice</b><span>That is a choice too. Nothing changes, nothing is given.</span>';
  skip.addEventListener('click', (e) => { e.stopPropagation(); if (skip.disabled) return; chose = true; ch.querySelectorAll('[data-choice]').forEach((o) => { o.disabled = true; o.style.opacity = '.35'; }); ch.querySelector('[data-choice-note]').textContent = 'You let the season pass.'; ready(); });
  ch.insertBefore(skip, ch.querySelector('[data-choice-note]'));
  // only a few of Clyde's options come up each season; say where the rest are, so a missing one is not mistaken for a bug
  const more = document.createElement('small'); more.className = 'chmore';
  more.textContent = `These are this season's picks. Every option, the bench and the boardwalk included, is always in the menu under Choices (${document.body.classList.contains('mobile') ? '\u2630, or Phone \u2192 Tools \u2192 Choices' : 'press C'}). Anything that needs dry ground goes on the nearest dry ground if you are facing water.`;
  ch.insertBefore(more, ch.querySelector('[data-choice-note]'));
  ready();
  go.addEventListener('click', (e) => {
    e.stopPropagation();
    if (go.classList.contains('inactive')) return;
    const l = Usage.level();
    onContinue(l !== null ? PULSE * LEVELS[Math.round(l)].p : 0);
  });
  el.addEventListener('click', (e) => e.stopPropagation());
}
