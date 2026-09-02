const { contextBridge, ipcRenderer } = require('electron');

// Exponer métodos seguros a la ventana del renderer
contextBridge.exposeInMainWorld('electronAPI', {
  toggleFullScreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  onFullScreenChange: (callback) => {
    ipcRenderer.on('fullscreen-change', (_event, isFullScreen) => callback(isFullScreen));
  }
});
