import { RUN } from './run.js';
import { Usage, LEVELS, TOKEN_STEPS, importLogFiles, pickLogFolder, recheckLogFolder, canPickFolder, hasSavedFolder } from './usage.js';

const fmt = (t) => (t >= 1e6 ? `${t / 1e6}M` : `${t / 1e3}k`);
const panelHTML = () => `
<div class="usage">
  <div class="uh">Your footprint</div>
  <small>An art experiment, not a measurement. You tell the park how much you lean on AI; its effects are invented and exaggerated on purpose. Harm done stays done, and the park heals slowly. Everything stays on this device. Lasting harm: <b data-harm-val>none</b></small>
  <div class="urow"><span>Typical day</span>${LEVELS.map((l, i) => `<button data-tier="${i}">${l.name}</button>`).join('')}</div>
  <div class="urow ask"><span data-ask>Today</span>${LEVELS.map((l, i) => `<button data-today="${i}">${l.name}</button>`).join('')}</div>
  <div class="urow"><span>Or count it</span>
    <label class="ubtn">Claude Code log files<input type="file" accept=".jsonl" multiple hidden data-logfiles></label>
    ${canPickFolder() ? '<button data-logfolder>Pick log folder</button><button data-logre hidden>Re-check folder</button>' : ''}
  </div>
  <small data-usage-note></small>
  ${RUN.dev ? '<details><summary>Manual dial (testing)</summary><label>Pressure <input type="range" min="0" max="100" value="0" data-pressure> <b data-pressure-val></b></label></details>' : ''}
</div>`;

export function initUsageUI(root = document, onChange) {
  root.querySelectorAll('[data-usage-panel]').forEach((el) => { el.innerHTML = panelHTML(); el.addEventListener('click', (e) => e.stopPropagation()); });
  const note = (t) => { root.querySelectorAll('[data-usage-note]').forEach((e) => { e.textContent = t; }); onChange?.(); };
  const refresh = () => {
    const today = Usage.todayLevel();
    root.querySelectorAll('[data-tier]').forEach((b) => b.classList.toggle('on', Usage.tier === +b.dataset.tier));
    root.querySelectorAll('[data-today]').forEach((b) => b.classList.toggle('on', today === +b.dataset.today));
    root.querySelectorAll('[data-ask]').forEach((e) => { e.textContent = today === undefined ? 'How much did you lean on AI today?' : 'Today'; e.parentElement.classList.toggle('pending', today === undefined); });
  };
  root.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', () => { Usage.setTier(+b.dataset.tier); refresh(); note(`Typical day: ${LEVELS[+b.dataset.tier].name}.`); }));
  root.querySelectorAll('[data-today]').forEach((b) => b.addEventListener('click', () => { Usage.checkin(+b.dataset.today); refresh(); note(`Today: ${LEVELS[+b.dataset.today].name}.`); }));
  const done = (n, what) => { refresh(); note(n > 0 ? `Counted ${n} day${n > 1 ? 's' : ''} from ${what}. Tokens per day: Light under ${fmt(TOKEN_STEPS[1])}, Medium to ${fmt(TOKEN_STEPS[2])}, Heavy to ${fmt(TOKEN_STEPS[3])}, Very heavy above ${fmt(TOKEN_STEPS[3])} (invented thresholds). Only the daily totals are kept.` : n === -1 ? 'Permission not granted.' : `No usage found in ${what}.`); };
  root.querySelectorAll('[data-logfiles]').forEach((inp) => inp.addEventListener('change', async () => { try { done(await importLogFiles([...inp.files]), 'the log files'); } catch (e) { note('Could not read that file: ' + e.message); } inp.value = ''; }));
  root.querySelectorAll('[data-logfolder]').forEach((b) => b.addEventListener('click', async () => { try { done(await pickLogFolder(), 'that folder'); root.querySelectorAll('[data-logre]').forEach((x) => { x.hidden = false; }); } catch { /* cancelled */ } }));
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
