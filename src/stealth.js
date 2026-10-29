// How noticeable you are to wild animals right now.  Most wild animals here are wary of people and move off when one
// comes at them; how close you get depends on how you move and how dark it is.  Each animal keeps its own distances
// (a deer notices you from far further than a chipmunk); these factors scale them.
//   k:  the whole effect (still, sneaking, walking, running; and the light) for animals that do not judge it themselves
//   q:  sneaking and the light only, for animals that already tell a still person from a running one
//   move: how you move only (sneaking, walking, running), for night animals that judge the light (and the flashlight) themselves
export const STEALTH = { k: 1, q: 1, move: 1, light: 1, sneaking: false };
export function updateStealth({ speed = 0, sitting = false, sneaking = false, running = false, dark = 0 }) {
  const still = sitting || speed < 0.3;
  const move = running ? 1.5 : sneaking ? 0.6 : still ? 0.55 : 1;
  const light = 1 - 0.45 * dark;                       // night: animals notice you at about half the distance
  STEALTH.move = move; STEALTH.light = light; STEALTH.sneaking = sneaking;
  STEALTH.k = move * light; STEALTH.q = (sneaking ? 0.6 : 1) * light;
}
