# Chopper

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

## About the place (and what is approximate)

The layout follows documented facts: a roughly north–south reservoir with a dam and granite-stepped spillway at the north end feeding Cold Spring Brook, a swimming beach and entrance on the west shore, a gravel boat ramp at the south tip, a few small islands, and a flat loop trail around the shore. Horizontal scale is compressed to about half so the loop is a ten-minute walk.

**It is not survey data.** The OpenStreetMap/Overpass APIs were not reachable from the build environment, so the shoreline is a centre-line plus width profile with noise coves. Everything about the park lives in `src/ashland.js` (`CENTERLINE`, `HALF_WIDTH`, `ISLANDS`, anchors); replace `lakeSdf` or those tables with MassGIS / OSM-derived data to make it accurate.

## How it is built

- Three.js r186, vendored, ES modules, no bundler.
- Cel shading: toon materials with a stepped gradient, vertex-painted colour, and constant-pixel-width inverted-hull outlines.
- One heightfield drives everything (terrain mesh, water shader, player, props, trees).
- The forest streams in 64 m chunks with instanced trees and LOD; felled trees persist.
- Water is a depth-banded shader that follows `lake.level`, which is what the drawdown gate lowers.
- Sound is synthesised with WebAudio.

Debug: add `?auto=1` to skip the title screen, `&preset=1`, `&x=&z=&yaw=` to place the camera; `window.chopper` exposes internals.
