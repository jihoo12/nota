const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nota', {
  platform: process.platform,
  openMarkdownDirectory: () => ipcRenderer.invoke('group:openMarkdownDirectory'),
  saveMarkdownDirectory: (group) => ipcRenderer.invoke('group:saveMarkdownDirectory', group),
});
