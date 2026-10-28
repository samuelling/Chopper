# Ashland: third-party software, fonts and data

Ashland ships with the following. Every licence here allows free redistribution, including in a packaged desktop or
iPad app, as long as the attributions below stay with the game (the end credits carry the data credits too).

## Software

- **three.js** r186 (`vendor/three.module.js`, `vendor/three.core.js`). Copyright 2010-2026 three.js authors. MIT License.

## Fonts (`assets/fonts/`, full licence text in `assets/fonts/OFL.txt`)

All three are under the SIL Open Font License 1.1, taken from the Fontsource packages (latin subsets).

- **Bowlby One SC**. Copyright 2011 Vernon Adams, with Reserved Font Name "Bowlby".
- **Courier Prime** (bold). Copyright 2015 The Courier Prime Project Authors.
- **Spline Sans** (semibold). Copyright 2021 The Spline Sans Project Authors.

## Map and environmental data (baked into `src/`)

- **OpenStreetMap**: shoreline, islands, dam, beach, boat launch, parking, trails, roads, Cold Spring Brook, the
  spillway stream and footbridges, picnic sites (`src/ashland_data.js`, `src/ashland.js`). (c) OpenStreetMap
  contributors, available under the Open Database License (ODbL): https://www.openstreetmap.org/copyright
- **USGS 3DEP** elevation (`src/ashland_dem.js`). Public domain (U.S. Geological Survey).
- **NLCD 2021** land cover (`src/ashland_landcover.js`). Public domain (USGS / Multi-Resolution Land Characteristics
  Consortium).
- **LANDFIRE LF2024** forest canopy height and existing vegetation type (`src/ashland_canopy.js`,
  `src/ashland_species.js`). Public domain (USGS / U.S. Forest Service).
- **National Wetlands Inventory** (`src/ashland_wetlands.js`). Public domain (U.S. Fish and Wildlife Service).
- **MassWildlife inland water bathymetry**, distributed by MassGIS (`src/ashland_bathy.js`). Commonwealth of
  Massachusetts, MassGIS (Bureau of Geographic Information); free public data.

## Everything else

The game's code, models, sounds (synthesised at run time), writing and art are original to Ashland.
