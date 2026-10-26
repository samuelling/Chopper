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
  addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !e.repeat) toggleFullscreen(); });
  const upd = () => { document.body.classList.toggle('fs', isFullscreen()); onChange?.(isFullscreen()); };
  document.addEventListener('fullscreenchange', upd);
  document.addEventListener('webkitfullscreenchange', upd);
}
