'use strict';
// Ponte segura entre as páginas e o processo principal (window.desktop).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  sendState: (s) => ipcRenderer.send('state', s),
  command: (c) => ipcRenderer.send('command', c),
  toggleMini: () => ipcRenderer.send('toggle-mini'),
  attention: () => ipcRenderer.send('attention'),
  setTheme: (t) => ipcRenderer.send('theme', t),
  setPrefs: (p) => ipcRenderer.send('prefs', p),
  pickDir: () => ipcRenderer.invoke('pick-dir'),
  writeBackup: (dir, json) => ipcRenderer.invoke('write-backup', { dir, json }),
  shortcutStatus: () => ipcRenderer.invoke('shortcut-status'),
  setZoom: (z) => ipcRenderer.send('set-zoom', z),
  getZoom: () => ipcRenderer.invoke('get-zoom'),
  syncRead: (dir) => ipcRenderer.invoke('sync-read', dir),
  syncWrite: (dir, json) => ipcRenderer.invoke('sync-write', { dir, json }),
  exportPdf: (html, name) => ipcRenderer.invoke('export-pdf', { html, name }),
  onZoom: (fn) => ipcRenderer.on('zoom', (_e, z) => fn(z)),
  onCommand: (fn) => ipcRenderer.on('command', (_e, c) => fn(c)),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  onMiniState: (fn) => ipcRenderer.on('mini-state', (_e, v) => fn(v)),
  // ponte com o Leitor de Estudos
  bridgeData: (d) => ipcRenderer.send('bridge-data', d),
  bridgeAck: (r) => ipcRenderer.send('bridge-ack', r),
  bridgeOpen: (req) => ipcRenderer.send('bridge-open', req),
  bridgeStatus: () => ipcRenderer.invoke('bridge-status'),
  onBridge: (fn) => ipcRenderer.on('bridge', (_e, m) => fn(m)),
});
