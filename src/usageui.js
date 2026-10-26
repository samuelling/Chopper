import { RUN } from './run.js';
import { PRESSURE } from './pressure.js';
import { Usage, LEVELS, TOKEN_STEPS, importLogFiles, pickLogFolder, recheckLogFolder, canPickFolder, hasSavedFolder } from './usage.js';

const fmt = (t) => (t >= 1e6 ? `${t / 1e6}M` : `${t / 1e3}k`);
// Chrome/Edge can remember a folder (File System Access API); every other desktop browser gets a plain folder chooser that reads the .jsonl files inside it once
const folderBtns = () => canPickFolder()
  ? '<button data-logfolder>Pick log folder</button><button data-logre hidden>Re-check folder</button>'
  : '<label class="ubtn">Pick log folder<input type="file" webkitdirectory hidden data-logfiles></label>';
// the check-in knob: "how much of your Claude limit have you used?" 0-100%, read off claude.ai Settings > Usage; mapped to None..Very heavy (invented bands)
const knobLevel = (pct) => (pct <= 0 ? 0 : Math.min(4, Math.ceil(pct / 25)));
const knobHTML = () => `<div class="knobrow">
  <div class="knob" tabindex="0" role="slider" aria-label="Share of your Claude limit used" aria-valuemin="0" aria-valuemax="100" data-knob><div class="kneedle"></div><div class="kticks"></div></div>
  <div class="kread"><b data-kpct>turn me</b><span data-klevel></span><small>Take a peek at Settings &rarr; Usage on claude.ai, then turn the knob to how much of your limit you have used.</small></div></div>`;
const dbgHTML = '<details class="dbg"><summary>Debug: what the game has stored</summary><pre data-usage-debug></pre></details>';
const panelHTML = () => `
<div class="usage">
  <div class="uh">Your footprint</div>
  <small>An art experiment, not a measurement. You tell the park how much you lean on AI; its effects are invented and exaggerated on purpose. Harm done stays done, and the park heals slowly. Everything stays on this device. Lasting harm: <b data-harm-val>none</b></small>
  <div class="urow"><span>Typical day</span>${LEVELS.map((l, i) => `<button data-tier="${i}">${l.name}</button>`).join('')}</div>
  <div class="urow ask"><span data-ask>Today</span>${knobHTML()}</div>
  <details class="dbg adv"><summary>Advanced: count a Claude Code log instead</summary><div class="urow">
    <label class="ubtn">Claude Code log files<input type="file" accept=".jsonl" multiple hidden data-logfiles></label>
    ${folderBtns()}
  </div></details>
  <small data-usage-note></small>
  ${dbgHTML}
  ${RUN.dev ? '<details><summary>Manual dial (testing)</summary><label>Pressure <input type="range" min="0" max="100" value="0" data-pressure> <b data-pressure-val></b></label></details>' : ''}
</div>`;

// just the log-linking row, for the opening menu (nothing is judged or applied to the park until the end of the first year)
const logOnlyHTML = () => `<div class="urow"><span>Link it now</span>
    <label class="ubtn">Claude Code log files<input type="file" accept=".jsonl" multiple hidden data-logfiles></label>
    ${folderBtns()}
  </div><small data-usage-note></small>${dbgHTML}`;

export function initUsageUI(root = document, onChange) {
  root.querySelectorAll('[data-knob-panel]').forEach((el) => { el.innerHTML = `<div class="uh">Today's check-in</div>${knobHTML()}<small data-usage-note></small>${dbgHTML}`; el.addEventListener("click", (e) => e.stopPropagation()); });
  root.querySelectorAll('[data-log-panel]').forEach((el) => { el.innerHTML = logOnlyHTML(); el.addEventListener('click', (e) => e.stopPropagation()); });
  root.querySelectorAll('[data-usage-panel]').forEach((el) => { el.innerHTML = panelHTML(); el.addEventListener('click', (e) => e.stopPropagation()); });
  const note = (t) => { root.querySelectorAll('[data-usage-note]').forEach((e) => { e.textContent = t; }); onChange?.(); };
  const dbg = () => {
    const days = Object.keys(Usage.days).sort(), lv = Usage.level();
    const txt = [`typical-day tier: ${Usage.tier === null ? 'not set' : LEVELS[Usage.tier].name}`,
      `level used now: ${lv === null ? 'none' : `${lv.toFixed(2)} (${LEVELS[Math.round(lv)].name})`}`, `pressure target: ${Math.round(PRESSURE.target * 100)}%`,
      days.length ? 'days:' : 'days: none yet', ...days.slice(-14).map((k) => `  ${k}  ${LEVELS[Usage.days[k]].name}  (${Usage.source[k] || '?'})`)].join('\n');
    root.querySelectorAll('[data-usage-debug]').forEach((e) => { e.textContent = txt; });
  };
  // ---- the knob
  const setKnob = (pct, commit) => {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    root.querySelectorAll('[data-knob]').forEach((k) => { k.style.setProperty('--ang', `${-135 + pct * 2.7}deg`); k.setAttribute('aria-valuenow', pct); });
    root.querySelectorAll('[data-kpct]').forEach((e) => { e.textContent = `${pct}% of your limit`; });
    root.querySelectorAll('[data-klevel]').forEach((e) => { e.textContent = `\u2192 ${LEVELS[knobLevel(pct)].name}`; });
    if (commit) { Usage.checkin(knobLevel(pct), `limit:${pct}%`); refresh(); note(`Today: ${pct}% of your limit used, counted as ${LEVELS[knobLevel(pct)].name}.`); }
  };
  const syncKnob = () => { const m = /^limit:(\d+)%/.exec(Usage.source[Usage.today()] || ''); if (m) setKnob(+m[1], false); };
  root.querySelectorAll('[data-knob]').forEach((k) => {
    let drag = false, last = 0;
    const from = (e) => { const r = k.getBoundingClientRect(); let a = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI; if (a > 135 || a < -135) a = a > 0 ? 135 : -135; return (a + 135) / 2.7; };
    k.addEventListener('pointerdown', (e) => { drag = true; k.setPointerCapture(e.pointerId); last = from(e); setKnob(last, false); e.preventDefault(); });
    k.addEventListener('pointermove', (e) => { if (!drag) return; last = from(e); setKnob(last, false); });
    const up = () => { if (!drag) return; drag = false; setKnob(last, true); };
    k.addEventListener('pointerup', up); k.addEventListener('pointercancel', up);
    k.addEventListener('keydown', (e) => { const cur = +(k.getAttribute('aria-valuenow') || 0), d = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key]; if (d) { e.preventDefault(); e.stopPropagation(); setKnob(cur + d, true); } });
  });
  const refresh = () => {
    dbg(); syncKnob();
    const today = Usage.todayLevel();
    root.querySelectorAll('[data-tier]').forEach((b) => b.classList.toggle('on', Usage.tier === +b.dataset.tier));
    root.querySelectorAll('[data-today]').forEach((b) => b.classList.toggle('on', today === +b.dataset.today));
    root.querySelectorAll('[data-ask]').forEach((e) => { e.textContent = today === undefined ? 'How much did you lean on AI today?' : 'Today'; e.parentElement.classList.toggle('pending', today === undefined); });
  };
  root.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', () => { Usage.setTier(+b.dataset.tier); refresh(); note(`Typical day: ${LEVELS[+b.dataset.tier].name}.`); }));
  root.querySelectorAll('[data-today]').forEach((b) => b.addEventListener('click', () => { Usage.checkin(+b.dataset.today); refresh(); note(`Today: ${LEVELS[+b.dataset.today].name}.`); }));
  const done = (n, what) => { refresh(); note(n > 0 ? `Counted ${n} day${n > 1 ? 's' : ''} from ${what}. Tokens per day: Light under ${fmt(TOKEN_STEPS[1])}, Medium to ${fmt(TOKEN_STEPS[2])}, Heavy to ${fmt(TOKEN_STEPS[3])}, Very heavy above ${fmt(TOKEN_STEPS[3])} (invented thresholds). Only the daily totals are kept.` : n === -1 ? 'Permission not granted.' : `No usage found in ${what}.`); };
  root.querySelectorAll('[data-logfiles]').forEach((inp) => inp.addEventListener('change', async () => { try { done(await importLogFiles([...inp.files]), 'the log files'); } catch (e) { note('Could not read that file: ' + e.message); } inp.value = ''; }));
  root.querySelectorAll('[data-logfolder]').forEach((b) => b.addEventListener('click', async () => { try { done(await pickLogFolder(), 'that folder'); root.querySelectorAll('[data-logre]').forEach((x) => { x.hidden = false; }); } catch (e) { if (e && e.name !== 'AbortError') note('This page was not allowed to open the folder picker (a blocked or embedded page). Use "Claude Code log files" instead and select the .jsonl files.'); } }));
  root.querySelectorAll('[data-logre]').forEach((b) => b.addEventListener('click', async () => { const n = await recheckLogFolder(true); if (n !== null) done(n, 'the saved folder'); }));
  refresh();
  Usage.apply();
  // a remembered folder: re-check silently if the browser still grants access, else offer a one-click re-check
  hasSavedFolder().then(async (has) => {
    if (!has) return;
    root.querySelectorAll('[data-logre]').forEach((x) => { x.hidden = false; });
    try { const n = await recheckLogFolder(false); if (n > 0) done(n, 'the saved folder'); } catch {}
  });
}
