const { contextBridge, ipcRenderer } = require('electron');

// Safe context bridge for app-specific APIs
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
});

// Expose WebSocket API if needed (already available globally)
contextBridge.exposeInMainWorld('ws', window.WebSocket);
