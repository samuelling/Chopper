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
| T | change season (also the Spring / Summer / Autumn / Winter buttons on the title and pause screens, or `?season=winter`) |
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

## Seasons

Four seasons share one world: spring leaf-out and blossom shrubs, deep-green summer, the original autumn, and a snowy winter (bare cel-shaded branches, snow caps on pines, snow on the ground with a trail that stays trampled where you walk). Ground litter only shows in autumn. Switching season reloads the page at your current spot, so felled trees and lake level reset (a live blend is a possible later step).

Wildlife follows the season (for example no turtles or fish in winter, geese passing through in spring and autumn). The birds (chickadee, blue jay, great blue heron, Canada goose, red-tailed hawk) are species typical of the habitat, **not** from a park survey.

Turtles bask on logs and rocks and slip into the water when you run past.

## Pressure (art experiment)

A single dial, **Pressure** (0-100%, pause menu or `?pressure=0.5`), stands in for how heavily AI and data-center use leans on a place. As it rises the reservoir is held lower, colours fade, and fish, turtles, songbirds, squirrels and geese show up less. It is **not a measurement**: the mapping is invented and exaggerated on purpose so the cost is visible. The idea for later phases is a coarse, consented, locally-computed usage number feeding the same dial; nothing is sent anywhere.

## Sound

All audio is synthesised with WebAudio, no sample files. The ambience changes by season (spring peepers and song, summer crickets and cicadas, autumn wind and crows, winter near-silence). Footsteps depend on the surface: paving on the dam and ramp, gravel in the lots, sand on the beach, mud in wetlands, dirt on trails, leaves in autumn, crunchy snow in winter, grass otherwise. Only checked for errors in a headless browser, so tune it by ear.

## How it is built

- Three.js r186, vendored, ES modules, no bundler.
- Cel shading: toon materials with a stepped gradient, vertex-painted colour, and constant-pixel-width inverted-hull outlines.
- One heightfield drives everything (terrain mesh, water shader, player, props, trees).
- The forest streams in 64 m chunks with instanced trees and LOD; felled trees persist.
- Water is a depth-banded shader that follows `lake.level`, which is what the drawdown gate lowers.
- Sound is synthesised with WebAudio.

Debug: add `?auto=1` to skip the title screen, `&preset=1`, `&x=&z=&yaw=` to place the camera; `window.chopper` exposes internals.


## Terrain editing (for future building)

The ground is editable at runtime. `flattenArea(x, z, r, {y, blend})` in `src/world.js` levels a circular site and blends it into the surrounding slope, updating `groundY`, the shader height texture, the mesh normals and the slope-based colouring together (`editTerrain(x0, z0, x1, z1, fn)` is the general version). `ChunkManager.clearArea(x, z, r)` keeps trees, props, walls and their colliders out of the site and regenerates the affected chunks. `window.chopper.buildSite(x, z, r)` does both. The lake basin itself is left alone, so don't plan sites on the shoreline.
