// Fullscreen toggle. iPhone Safari has no element fullscreen; there we point people to Add to Home Screen.
const root = document.documentElement;
const reqFn = root.requestFullscreen || root.webkitRequestFullscreen;
export const fullscreenSupported = !!reqFn;
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

export async function toggleFullscreen() {
  if (!fullscreenSupported) return false;
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      await reqFn.call(root);
      try { await screen.orientation?.lock?.('landscape'); } catch (e) { /* not allowed on this device */ }
    }
  } catch (e) { return false; }
  return true;
}

export function initFullscreen({ mobile, onChange }) {
  const buttons = document.querySelectorAll('[data-fullscreen]');
  for (const b of buttons) {
    if (!fullscreenSupported) { b.style.display = 'none'; continue; }
    const act = (e) => { e.preventDefault(); e.stopPropagation(); toggleFullscreen(); };
    b.addEventListener('click', act);
    b.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    b.addEventListener('touchend', (e) => { act(e); });
  }
  if (!fullscreenSupported && mobile) {
    const n = document.getElementById('fsnote'); if (n) n.classList.add('show');
  }
  // (no key for it: F sat too close to the season and light keys; the buttons on the title and pause screens do it)
  // a season turn reloads the page, and a browser always drops fullscreen on reload and only lets it back after a click or key.
  // So remember it on the way out, and take the first click or key of the new season (the one that captures the mouse anyway) to restore it.
  addEventListener('beforeunload', () => { try { sessionStorage.setItem('ashland.fs', isFullscreen() ? '1' : '0'); } catch {} });
  let want = false; try { want = sessionStorage.getItem('ashland.fs') === '1'; } catch {}
  if (want && fullscreenSupported && !mobile) {
    const back = (e) => {
      if (e.type === 'keydown' && e.code === 'Escape') return;
      removeEventListener('mousedown', back, true); removeEventListener('keydown', back, true);
      if (!isFullscreen()) reqFn.call(root)?.catch?.(() => {});
    };
    addEventListener('mousedown', back, true); addEventListener('keydown', back, true);
  }
  const upd = () => { document.body.classList.toggle('fs', isFullscreen()); onChange?.(isFullscreen()); };
  document.addEventListener('fullscreenchange', upd);
  document.addEventListener('webkitfullscreenchange', upd);
}
