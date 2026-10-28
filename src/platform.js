// Where the game is running, in one place, so it can ship later as a desktop app (Mac, Windows) or an iPad app without
// the rest of the code caring.  The web build needs nothing from this; a wrapper only has to set window.ashlandApp.
//
// A desktop or iPad wrapper (Electron, Tauri, Capacitor; see PACKAGING.md) may expose, before the game loads:
//   window.ashlandApp = { kind: 'electron' | 'tauri' | 'capacitor', openExternal(url), quit() }
// openExternal opens a link in the system browser (an app's own window should never navigate away from the game), and
// quit closes the app (a browser tab has no need of it).

const W = typeof window !== 'undefined' ? window : {};
const bridge = W.ashlandApp || null;
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;

// iPadOS Safari reports itself as a Mac; a Mac with more than one touch point is an iPad
const iPad = /iPad/.test(ua) || (touch && /Mac/.test(navigator.platform || ''));
const phone = /iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua));
const androidTablet = /Android/.test(ua) && !/Mobile/.test(ua);

export const PLATFORM = {
  /** 'electron' | 'tauri' | 'capacitor' inside a packaged app, else null */
  app: bridge?.kind || (W.__TAURI__ ? 'tauri' : W.Capacitor?.isNativePlatform?.() ? 'capacitor' : null),
  /** added to a home screen (iPad / iPhone / Android) or installed as a web app */
  standalone: !!(W.matchMedia?.('(display-mode: standalone)').matches || W.matchMedia?.('(display-mode: fullscreen)').matches || W.navigator?.standalone),
  iPad, phone, tablet: iPad || androidTablet,
  touch,
  /** a keyboard and a mouse or trackpad are likely at hand (an iPad with a Magic Keyboard says so too) */
  finePointer: !!W.matchMedia?.('(any-pointer: fine)').matches,
};

/** on a tablet you can choose touch controls or keyboard and mouse (remembered on this device) */
export const CONTROLS_KEY = 'ashland.controls';
export function controlsPref() { try { return localStorage.getItem(CONTROLS_KEY); } catch { return null; } }
export function setControlsPref(v) { try { localStorage.setItem(CONTROLS_KEY, v); } catch {} }

/** open a link outside the game: the system browser in an app, a new tab on the web */
export function openExternal(url) {
  if (bridge?.openExternal) { bridge.openExternal(url); return; }
  const cap = W.Capacitor?.Plugins?.Browser; if (cap) { cap.open({ url }); return; }   // the iPad app: an in-app Safari sheet
  W.open?.(url, '_blank', 'noopener');
}
/** close the app (only offered inside a packaged app) */
export const canQuit = !!bridge?.quit;
export function quitApp() { bridge?.quit?.(); }

// every link that would leave the game goes through openExternal, so a packaged app never loses its window to a web page
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a[href^="http"]'); if (!a || !PLATFORM.app) return;
    e.preventDefault(); openExternal(a.href);
  }, true);
  document.documentElement.dataset.platform = PLATFORM.app || (PLATFORM.tablet ? 'tablet' : PLATFORM.phone ? 'phone' : 'web');
}

// offline play for the web build (sw.js); a packaged app loads from disk and has no need of it
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !PLATFORM.app && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
