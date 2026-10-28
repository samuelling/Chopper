# Packaging Ashland (Mac, Windows, iPad), free

Not shipped yet. This is what is in place, and the steps for when it is time.

## What is ready now

- **Self-contained.** Nothing loads from the internet: three.js is in `vendor/`, the three fonts are in
  `assets/fonts/` (SIL Open Font License), and the map and environmental data are baked into `src/`. The one outside
  link is megazine.org in the credits.
- **A clean build.** `npm run build` (Node 18+, no dependencies) writes `dist/`: only the files the game runs on, about
  4 MB, with a version stamp (`dist/version.json`). Screenshots, source data and notes stay out. Every package below
  starts from `dist/`.
- **Installable on iPad and phones, and playable offline.** `manifest.webmanifest` (fullscreen, landscape, icons) and a
  network-first service worker (`sw.js`, web only). On an iPad: Safari, then Share and Add to Home Screen. It opens
  fullscreen with its own icon and plays offline after the first visit.
- **One platform layer.** `src/platform.js` says where the game is running (web, iPad or other tablet, phone, or a
  packaged app) and holds the hooks an app needs: links open in the system browser, and there is a Quit button in the
  pause menu. A wrapper only has to set `window.ashlandApp = { kind, openExternal(url), quit() }`.
- **iPad tuning.** iPads are detected even though iPadOS Safari reports itself as a Mac. They get touch controls, a
  slightly sharper render than phones, and a dashboard that stays clear of rounded corners and the home indicator. The
  pause menu can switch a tablet to keyboard and mouse (for an iPad with a Magic Keyboard or trackpad), and the choice
  is remembered.
- **Icons.** `assets/icons/`: an SVG master, a 1024 px PNG for app stores and installers, and the web sizes (512,
  maskable 512, 192, 180 for iOS, 32 favicon).
- **Notices.** `THIRD_PARTY.md` lists every licence (three.js MIT, fonts OFL, OpenStreetMap ODbL, and public-domain
  USGS, USFWS and MassGIS data). All of them allow free redistribution with attribution, and the credits already carry
  it.

## Mac and Windows: Electron (set up in `packaging/electron/`)

Electron is the recommended wrapper. It bundles the same Chromium the game is built and tested in, so WebGL, pointer
lock (mouse look), fullscreen, the File System Access picker for Claude Code logs, and saving all behave as on the
web. The lighter option, Tauri, uses the system web view. On a Mac that is WKWebView, where pointer lock is known to
fail ("Pointer lock requires the window to have focus"; wry issue #445). That rules it out for a mouse-look game unless
it is fixed.

The wrapper is about 60 lines: `main.cjs` serves `dist/` from a private `app://` origin (ES modules load, saves
persist), sends links to the system browser, and exposes open-link and quit to the game through `preload.cjs`.
Checked in this repo's test environment: the game loads in Electron 45, detects the app, and shows Quit, with no
errors.

    cd packaging/electron
    npm install
    npm start            # builds dist/ and runs the app
    npm run dist:mac     # .dmg (universal: Apple silicon and Intel), on a Mac
    npm run dist:win     # NSIS installer, on Windows (or a Windows CI runner)

The installer is about 100 MB, mostly Chromium. The game itself is 4 MB.

**Signing, so people are not warned off:**
- *Mac.* Without signing and notarization, macOS refuses to open the app until the player overrides it in System
  Settings. Signing needs an Apple Developer Program membership ($99 a year). electron-builder signs and notarizes once
  the certificate and credentials are in the environment.
- *Windows.* An unsigned installer gets a SmartScreen warning ("Windows protected your PC"). A code-signing
  certificate, or Azure Trusted Signing, removes it. The Microsoft Store is another route: registration is now free for
  individual developers, and the Store signs the package.

**Where to give it away:** itch.io and GitHub Releases (free, any build), the Microsoft Store (free for individuals),
and the Mac App Store (needs the $99 membership and sandboxing). Steam charges $100 per game.

## iPad

1. **Now, free:** the home-screen web app above. There is no store, review or fee. It updates itself whenever there is
   a connection.
2. **App Store, later:** wrap `dist/` with Capacitor (`npx cap add ios`; set `window.ashlandApp` with `kind:
   'capacitor'` and an `openExternal` that uses the Browser plugin). It needs a Mac with Xcode and the $99 Apple
   membership. The game is free, so there is no in-app purchase work to do.

Things to check on a real iPad before either: frame rate on older models (`setPixelRatio` in `main.js` caps tablets at
1.4), audio starting on the first tap, and pointer lock with a trackpad in keyboard-and-mouse mode.

## Before a release

- Choose a licence for the game's own code and art (the repo has none yet; the third-party licences above are fine
  for any choice).
- Bump `version` in `package.json` and `packaging/electron/package.json`.
- The dev and testing aids (`?dev=1`, `?skipto=`, `?fire=`, the 9-1-1 and d-r-o-n-e codes) do no harm in a release.
  An app has no address bar, so the URL ones cannot be reached anyway.
