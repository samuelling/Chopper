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
| F | toggle fullscreen (also a button on the title/pause screens, and on the phone HUD) |

## On a phone

Phones and tablets are detected automatically (or force it with `?mobile=1`; `?desktop=1` forces the desktop version). You get an on-screen joystick (left thumb), drag-to-look (right side), SWING / HOP / USE buttons and a sun button for the light, plus a lighter renderer: smaller shadow map, shorter draw distance, less leaf litter, lower pixel ratio. The title screen says it is best played on a desktop. Landscape works best.

## About the place (what is real, what is not)

The map is built from **real OpenStreetMap data** (© OpenStreetMap contributors, ODbL), exported with Overpass Turbo and stored in `data/ashland_osm.json` / `src/ashland_data.js`:
the reservoir shoreline and both islands, the dam, the beach, the boat launch, both parking lots, the loop trail and spur paths, service roads, and Cold Spring Brook below the dam.

The hills use **real USGS 3DEP lidar elevation** (public domain), 15 m grid in `src/ashland_dem.js`, measured relative to the reservoir surface (66.2 m) and vertically scaled by 0.6 (`VS` in `src/world.js`).

Where trees grow comes from **real NLCD 2021 land cover** (public domain, `src/ashland_landcover.js`): deciduous, evergreen and mixed forest, woody wetland, and cleared or developed land set tree density and the pine-versus-hardwood mix. Tree species follow the **real LANDFIRE forest type** (`src/ashland_species.js`) and the **real National Wetlands Inventory** (`src/ashland_wetlands.js`) decides where the swamps, marshes and ponds are: red-maple swamp, open marsh with cattails, boggy ground. Tree height follows **real LANDFIRE 2024 canopy height** (USGS/USFS, `src/ashland_canopy.js`), so taller stands in the real park have taller trees here. Individual tree positions within those areas are still scattered procedurally.

The lakebed follows the **real MassWildlife depth survey** of Ashland Reservoir (contours up to 48 ft, MassGIS; `src/ashland_bathy.js`), scaled with the same 0.6 vertical factor as the hills.

Pond life (sunfish, bass and painted turtles) is invented, cel-shaded like everything else, and only appears while the lake is full. The gray squirrels (they dart between pauses and scamper up the nearest tree if you get close) and the beaver-gnawed stumps along the shore are invented too: the stumps are scattered procedurally near the water, with no survey of real beaver activity behind them.

What is **not** real: the dam face and the area north of the survey, which are approximated, the gatehouse and spillway details, the helicopter wreck's exact position, and everything that sits on the land (individual trees, rocks, benches). Horizontal scale is `SCALE = 0.5` in `src/ashland.js` (set to 1 for true size; the lake is ~1.7 km long), and the map is rotated about 9 degrees so the dam runs along +x.

## How it is built

- Three.js r186, vendored, ES modules, no bundler.
- Cel shading: toon materials with a stepped gradient, vertex-painted colour, and constant-pixel-width inverted-hull outlines.
- One heightfield drives everything (terrain mesh, water shader, player, props, trees).
- The forest streams in 64 m chunks with instanced trees and LOD; felled trees persist.
- Water is a depth-banded shader that follows `lake.level`, which is what the drawdown gate lowers.
- Sound is synthesised with WebAudio.

Debug: add `?auto=1` to skip the title screen, `&preset=1`, `&x=&z=&yaw=` to place the camera; `window.chopper` exposes internals.
