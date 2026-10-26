// "Care": the other half of the ledger.  Harm is what the park loses; care is what it gains from the help you ask for
// (visitors served, upkeep done, staff stretched).  The numbers are illustrative, not measured.
import { RUN } from './run.js';

const S = () => RUN.s;
for (const [k, v] of Object.entries({ care: 0, saved: 0, hours: 0, shield: 0, built: [], sightings: [] })) if (S()[k] === undefined) S()[k] = v;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const CARE = {
  get value() { return S().care; },
  get saved() { return S().saved; },
  get hours() { return S().hours; },
  get shield() { return S().shield; },
  get built() { return S().built; },
  get sightings() { return S().sightings; },
  add(x) { S().care = clamp01(S().care + x); },
  gain({ care = 0, saved = 0, hours = 0, shield = 0 }) { this.add(care); S().saved += saved; S().hours += hours; S().shield = Math.min(0.6, S().shield + shield); },
};
export const fmt$ = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
