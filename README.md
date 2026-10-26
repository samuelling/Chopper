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
| Mouse | look. You carry your phone (map, heading and harm/care on its screen); **Q** cycles phone, axe and empty hands, and click swings the axe (a big tree takes several swings) |
| E | pick up litter; at the gatehouse on the dam (and only there) it works the drawdown gate instead |
| 1 / 2 / 3 | golden hour / morning mist / dusk |
| T | change season (also the Spring / Summer / Autumn / Winter buttons on the title and pause screens, or `?season=winter`) |
| P | phone (a home screen of app icons: Map, Park, Field Guide, Photos, Park Jobs, Clyde) |
| V | camera: narrows the view; click to photograph a tree, bird or animal in the frame |
| M | optional minimap: off, nearby, or whole park (also a Map button on the title and pause screens; north is up, the dam is at the bottom) |
| C | (phase two) make choices |
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

The edge of the playable park is a continuous chest-high dry-stone wall (a traced contour of the park-boundary field, stacked five courses high, too tall to jump), so the limit of the park is something you walk up to rather than an invisible barrier. The wall is an invented marker, not a survey of any real wall.

What is **not** real: the dam face and the area north of the survey, which are approximated, the gatehouse and spillway details, the helicopter wreck's exact position, and everything that sits on the land (individual trees, rocks, benches). Horizontal scale is `SCALE = 0.5` in `src/ashland.js` (set to 1 for true size; the lake is ~1.7 km long), and the map is rotated about 9 degrees so the dam runs along +x.

## The phone

**P** raises your phone: a Map tab (with heading), a Status tab (the harm/care gauge and figures), **Jobs** (Park Service Jobs: delegate tree work to the crew, who fell the trees over the next minute or two) and **Clyde**. Clyde is the AI assistant: at the end of each season you pick one of its offers (benches, a boardwalk, a kiosk, paperwork and so on), each showing its care and harm before you commit.

## Field Guide, camera and birdsong

You are a naturalist as much as anything. **V** raises a camera (narrow view, viewfinder); click to photograph the tree, bird, fish, turtle or squirrel in the middle of the frame. The first photo of each kind adds it to the **Guide** tab on the phone, with your own thumbnail. Songs and calls that you actually hear while walking (chickadee, cardinal, robin, wren, vireo, woodpecker, crow, jay, goose, hawk, spring peeper, bullfrog, cricket) are logged as you hear them, and can be replayed from the guide. Some species can only be collected by ear. Photos also go into an album (the Photos tab on the phone: a grid, then a full-size viewer with arrows, delete, and the species note; the newest 36 are kept, larger images at 480x320). The guide is saved in the browser (`ashland.guide`, `ashland.photos`) and cleared by "New game". The species are typical of a Massachusetts reservoir forest, **not** a survey of the real park; plants are not catalogued yet.

A gentle on-screen tutorial introduces the controls one at a time after the first landing (walk and look, hop, phone, camera, the rest), and clears itself as you do each thing. Esc opens the full list at any time.

## Being part of the place

- **Sit and wait (B):** crouch and stay still; the light moves on (mist, gold, dusk, night) and animals relax and come closer. Any step stands you up.
- **Deer** graze, freeze and watch you, and bolt with the white tail up; very still, they drift near. **Fox** (dawn, dusk, night), **chipmunks** (day), **frogs** on the shore (warm months), a **beaver** at dusk, **wood ducks** by day, **fireflies** at dusk in summer, **butterflies** and **dragonflies**, and **owls** and **coyotes** you mostly hear. All are invented behaviours of habitat-typical species, not survey data.
- **Weather:** spells of rain (and distant thunder in summer) and, in winter, snowfall. `?weather=rain` or `?weather=snow` forces it for testing.
- **Places (phone):** name any spot you stand on, just for you; they appear on your map. **Fog of war:** the map is dark until you have walked there. **Ruins** (cellar holes, a stone well, boundary stones; invented positions) are found by wandering near them. A **journal** logs it all.
- **Acts of care:** E picks up litter near the trails; every few pieces turns up a seed; G plants it as a sapling that takes many seasons to grow. The heron you keep seeing is noted.

## Fly-over

The title screen and season cards sit over a slow drone flight along the real reservoir's centre line, up one shore and back the other (`?noflyover=1` to turn it off). It stops when you click to begin.

## The shape of a playthrough

Part one is pure scenery: the first season is autumn, with no consequences and no AI question anywhere. Each season opens on a card showing only its name in the title font; the first one waits for a click, later ones hold a moment and the drone glides down to where you stand. After a full season of play (6 minutes by default, `?season_len=` seconds to change it) an interlude appears: what has changed, a footprint check-in the first time, and a choice (including making none). Consequences go live from the second season (winter), then spring, summer and around again. Felled trees, lake level and your choices carry across seasons (each season is a page reload). "New game" on the season card resets everything. URLs with `?season=`, `?auto=` or `?dev=1` skip all of this and keep the old direct controls (season picker, T key, C choices with `?phase=2`).

## Seasons

Four seasons share one world: spring leaf-out and blossom shrubs, deep-green summer, the original autumn, and a snowy winter (bare cel-shaded branches, snow caps on pines, snow on the ground with a trail that stays trampled where you walk). Ground litter only shows in autumn. Switching season reloads the page at your current spot, so felled trees and lake level reset (a live blend is a possible later step).

Wildlife follows the season (for example no turtles or fish in winter, geese passing through in spring and autumn). The birds (chickadee, blue jay, great blue heron, Canada goose, red-tailed hawk) are species typical of the habitat, **not** from a park survey.

Turtles bask on logs and rocks and slip into the water when you run past.

## Pressure (art experiment)

A single dial, **Pressure** (0-100%, pause menu or `?pressure=0.5`), stands in for how heavily AI and data-center use leans on a place. As it rises the reservoir is held lower, colours fade, and fish, turtles, songbirds, squirrels and geese show up less. It is **not a measurement**: the mapping is invented and exaggerated on purpose so the cost is visible. The harm is **lasting**: pressure builds damage over minutes, and turning the dial down only lets the park heal over about an hour. The unluckiest trees brown first and, at full harm, roughly 30% are gone (they stop blocking and can't be chopped), and they return slowly as the park recovers. `?damage=0.5` starts with existing harm. You tell the park about your AI use in three coarse ways (title and pause screens, "Your footprint"): a **typical day** tier, a **daily check-in** ("how much did you lean on AI today?"), or by letting the game **count a Claude Code log** (`~/.claude/projects/**/*.jsonl`, pick files or, in desktop Chrome/Edge, pick the folder once and re-check on later visits after a permission click). The browser totals tokens per day locally (input + output + cache writes, not cache reads) and keeps only the daily level; thresholds are invented and shown on screen. Nothing is uploaded. The log format is not a published interface, and claude.ai chat usage can't be read at all.

## Choices (phase two)

Once you have told the park about your AI use (or with `?phase=2`), a "C make choices" hint appears on the HUD card and **C** opens the pause menu with a choices panel. Every choice shows what it gives and what it costs before you commit. *AI* choices (survey the park, find a lookout, find a building site) add a one-time pulse of lasting harm and give a summary or a map and HUD marker. *Park* choices (harvest the nearest stand, hold off on AI today) act on the land. The benefits are placeholders until the real premise is set.

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
