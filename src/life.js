// A rough clock for the player: remaining life expectancy by age (a population average, US-style, both sexes, rounded).
// It is a device for the game's ending, not a prediction about anyone.  Only the birth year is ever asked for or kept.
const TABLE = [[0, 76.4], [10, 67.0], [20, 57.6], [30, 48.5], [40, 39.3], [50, 30.3], [60, 22.2], [70, 14.8], [80, 8.4], [90, 4.1], [100, 2.2]];
export function remainingYears(age) {
  const a = Math.max(0, Math.min(110, age));
  for (let i = 1; i < TABLE.length; i++) if (a <= TABLE[i][0]) { const [x0, y0] = TABLE[i - 1], [x1, y1] = TABLE[i]; return y0 + (y1 - y0) * (a - x0) / (x1 - x0); }
  return 2;
}
export const thisYear = () => new Date().getFullYear();
