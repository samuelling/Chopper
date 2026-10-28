// What the game sees of the app (src/platform.js reads window.ashlandApp): open a link in the browser, and quit.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ashlandApp', {
  kind: 'electron',
  openExternal: (url) => ipcRenderer.send('ashland:open', String(url)),
  quit: () => ipcRenderer.send('ashland:quit'),
});
