# Ashland

A cel-shaded, first-person wander through a recreation of **Ashland State Park, Massachusetts** in late October. Fell trees. Drain the reservoir. Look at the leaves.

Run it (no build step):

```
python3 -m http.server 8000     # then open http://localhost:8000
```

## Controls

| | |
|---|---|
| WASD / Shift / Space | walk / hurry / hop |
| Mouse, click | look, swing the axe (a big tree takes several swings) |
| E | at the gatehouse on the dam, open or close the drawdown gate |
| 1 / 2 / 3 | golden hour / morning mist / dusk |

## About the place (what is real, what is not)

The map is built from **real OpenStreetMap data** (© OpenStreetMap contributors, ODbL), exported with Overpass Turbo and stored in `data/ashland_osm.json` / `src/ashland_data.js`:
the reservoir shoreline and both islands, the dam, the beach, the boat launch, both parking lots, the loop trail and spur paths, service roads, and Cold Spring Brook below the dam.

What is **not** real: ground elevation (OSM has none, so hills and lake depth are invented), the gatehouse and spillway details, the helicopter wreck's exact position, and everything that sits on the land (trees, rocks, benches). Horizontal scale is `SCALE = 0.5` in `src/ashland.js` (set to 1 for true size; the lake is ~1.7 km long), and the map is rotated about 9 degrees so the dam runs along +x.

## How it is built

- Three.js r186, vendored, ES modules, no bundler.
- Cel shading: toon materials with a stepped gradient, vertex-painted colour, and constant-pixel-width inverted-hull outlines.
- One heightfield drives everything (terrain mesh, water shader, player, props, trees).
- The forest streams in 64 m chunks with instanced trees and LOD; felled trees persist.
- Water is a depth-banded shader that follows `lake.level`, which is what the drawdown gate lowers.
- Sound is synthesised with WebAudio.

Debug: add `?auto=1` to skip the title screen, `&preset=1`, `&x=&z=&yaw=` to place the camera; `window.chopper` exposes internals.
