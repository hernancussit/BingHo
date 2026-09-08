const { contextBridge, ipcRenderer } = require('electron');

// Exponer métodos seguros a la ventana del renderer
contextBridge.exposeInMainWorld('electronAPI', {
  toggleFullScreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  onFullScreenChange: (callback) => {
    ipcRenderer.on('fullscreen-change', (_event, isFullScreen) => callback(isFullScreen));
  },
  
  // APIs de Segunda Pantalla / Proyector
  toggleProjector: () => ipcRenderer.invoke('toggle-projector'),
  isProjectorOpen: () => ipcRenderer.invoke('is-projector-open'),
  closeProjector: () => ipcRenderer.invoke('close-projector'),
  onProjectorStatusChange: (callback) => {
    ipcRenderer.on('projector-status-change', (_event, isOpen) => callback(isOpen));
  },
  
  // Sincronización entre ventanas (Operador <-> Proyector)
  sendStateSync: (stateData) => ipcRenderer.send('sync-projector-state', stateData),
  onStateSync: (callback) => {
    ipcRenderer.on('projector-state-updated', (_event, stateData) => callback(stateData));
  },
  sendEventSync: (eventData) => ipcRenderer.send('sync-projector-event', eventData),
  onEventSync: (callback) => {
    ipcRenderer.on('projector-event-received', (_event, eventData) => callback(eventData));
  },

  // Actualizador desde GitHub
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadAndInstallUpdate: (url) => ipcRenderer.invoke('download-and-install-update', url),
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_event, data) => callback(data));
  },
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url)
});

