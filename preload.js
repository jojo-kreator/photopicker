'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const h = (_e, v) => cb(v);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('api', {
  authStatus: () => ipcRenderer.invoke('auth:status'),
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  scan: (args) => ipcRenderer.invoke('scan', args),
  pickFolder: () => ipcRenderer.invoke('pickFolder'),
  download: (args) => ipcRenderer.invoke('download', args),
  cancel: () => ipcRenderer.invoke('cancel'),
  openFolder: (p) => ipcRenderer.invoke('openFolder', p),
  onScanProgress: on('scan:progress'),
  onDownloadProgress: on('download:progress'),
});
