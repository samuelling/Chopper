// Ashland as a desktop app (Mac and Windows), with Electron: the same Chromium the game is built and tested in, so
// WebGL, pointer lock, fullscreen and saving all behave as on the web.  It serves the built game (../../dist, made by
// `npm run build` at the top) from a private app:// origin, so ES modules load and saves persist between launches.
const { app, BrowserWindow, protocol, net, shell, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
const GAME = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.join(__dirname, '..', '..', 'dist');
const external = (url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); };

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname); if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(GAME, p));
    if (!file.startsWith(GAME)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  ipcMain.on('ashland:open', (_e, url) => external(url));
  ipcMain.on('ashland:quit', () => app.quit());
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 600, backgroundColor: '#1c1517', title: 'Ashland', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },   // sound from the start, no click needed
  });
  // links leave in the system browser; the game window never navigates away from the game
  win.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); external(url); } });
  win.loadURL('app://ashland/index.html');
});
app.on('window-all-closed', () => app.quit());
