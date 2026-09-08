const { app, BrowserWindow, globalShortcut, ipcMain, Menu, screen, shell } = require('electron');
const path = require('path');
const https = require('https');
const packageJson = require('./package.json');

let mainWindow = null;
let projectorWindow = null;

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/hernancussit/BingHo/releases/latest',
      headers: {
        'User-Agent': 'BingHo-Desktop-App'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`GitHub API status ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function compareVersions(v1, v2) {
  const clean = (v) => v.replace(/^v/, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
  const p1 = clean(v1);
  const p2 = clean(v2);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function createWindow() {
  const primaryDisplay = screen ? screen.getPrimaryDisplay() : null;
  const workArea = primaryDisplay ? primaryDisplay.workAreaSize : { width: 1280, height: 800 };
  const initialWidth = Math.min(1280, workArea.width);
  const initialHeight = Math.min(800, workArea.height);

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#060b18',
    autoHideMenuBar: true,
    title: 'BingHo - Tablero 1 al 90 (Operador)',
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  // Bloquear zoom involuntario por atajos o rueda de ratón
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  });

  // Deshabilitar la barra de menú completamente
  Menu.setApplicationMenu(null);

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.webContents.send('fullscreen-change', true);
    }
  });

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.webContents.send('fullscreen-change', false);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.close();
    }
  });
}

function getExternalDisplay() {
  if (!screen) return null;
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  return displays.find(d => d.id !== primaryDisplay.id && (d.bounds.x !== primaryDisplay.bounds.x || d.bounds.y !== primaryDisplay.bounds.y)) || null;
}

function openProjectorWindow() {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.show();
    projectorWindow.focus();
    return;
  }

  const externalDisplay = getExternalDisplay();
  const primaryDisplay = screen ? screen.getPrimaryDisplay() : null;

  const windowOptions = {
    backgroundColor: '#060b18',
    autoHideMenuBar: true,
    title: 'BingHo - Pantalla de Proyección',
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  };

  if (externalDisplay) {
    // Si hay pantalla secundaria (modo extendido de Windows), abrir directamente en ella en pantalla completa
    windowOptions.x = externalDisplay.bounds.x;
    windowOptions.y = externalDisplay.bounds.y;
    windowOptions.width = externalDisplay.bounds.width;
    windowOptions.height = externalDisplay.bounds.height;
    windowOptions.fullscreen = true;
  } else {
    // Si solo hay una pantalla (modo pruebas/previsualización)
    const workArea = primaryDisplay ? primaryDisplay.workAreaSize : { width: 1280, height: 800 };
    windowOptions.width = Math.min(1060, workArea.width - 40);
    windowOptions.height = Math.min(680, workArea.height - 40);
    windowOptions.x = Math.max(20, Math.floor((workArea.width - windowOptions.width) / 2) + 20);
    windowOptions.y = Math.max(20, Math.floor((workArea.height - windowOptions.height) / 2) + 20);
  }

  projectorWindow = new BrowserWindow(windowOptions);
  
  // Silenciar audio en proyector para que el sonido no se duplique con el del operador
  projectorWindow.webContents.setAudioMuted(true);

  projectorWindow.webContents.on('did-finish-load', () => {
    projectorWindow.webContents.setVisualZoomLevelLimits(1, 1);
  });

  projectorWindow.loadFile('index.html', { query: { mode: 'projector' } });

  projectorWindow.once('ready-to-show', () => {
    projectorWindow.show();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('projector-status-change', true);
    }
  });

  projectorWindow.on('enter-full-screen', () => {
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  projectorWindow.on('leave-full-screen', () => {
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.setAlwaysOnTop(false);
    }
  });

  projectorWindow.on('closed', () => {
    projectorWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('projector-status-change', false);
    }
  });
}

function closeProjectorWindow() {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.close();
    projectorWindow = null;
  }
}

function toggleProjectorWindow() {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    closeProjectorWindow();
    return false;
  } else {
    openProjectorWindow();
    return true;
  }
}

function toggleFullScreen(win = mainWindow) {
  if (win && !win.isDestroyed()) {
    const willBeFull = !win.isFullScreen();
    if (willBeFull) {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setFullScreen(true);
    } else {
      win.setFullScreen(false);
      win.setAlwaysOnTop(false);
    }
  }
}

// Handlers IPC
ipcMain.handle('toggle-fullscreen', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  toggleFullScreen(senderWin || mainWindow);
  return senderWin ? senderWin.isFullScreen() : false;
});

ipcMain.handle('is-fullscreen', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  return senderWin ? senderWin.isFullScreen() : false;
});

ipcMain.handle('toggle-projector', () => {
  return toggleProjectorWindow();
});

ipcMain.handle('is-projector-open', () => {
  return !!(projectorWindow && !projectorWindow.isDestroyed());
});

ipcMain.handle('close-projector', () => {
  closeProjectorWindow();
  return false;
});

// Sincronización bidireccional entre ventanas
ipcMain.on('sync-projector-state', (event, stateData) => {
  if (projectorWindow && !projectorWindow.isDestroyed() && event.sender !== projectorWindow.webContents) {
    projectorWindow.webContents.send('projector-state-updated', stateData);
  }
  if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
    mainWindow.webContents.send('projector-state-updated', stateData);
  }
});

ipcMain.on('sync-projector-event', (event, eventData) => {
  if (projectorWindow && !projectorWindow.isDestroyed() && event.sender !== projectorWindow.webContents) {
    projectorWindow.webContents.send('projector-event-received', eventData);
  }
});

// Comprobación de actualizaciones vía GitHub Releases
ipcMain.handle('check-for-updates', async () => {
  try {
    const release = await fetchLatestRelease();
    const currentVer = packageJson.version;
    const latestTag = release.tag_name || release.name || '';
    const cleanLatest = latestTag.replace(/^v/, '');
    
    const isNewer = compareVersions(cleanLatest, currentVer) > 0;
    
    let downloadUrl = release.html_url;
    if (Array.isArray(release.assets)) {
      const exeAsset = release.assets.find(a => a.name && a.name.endsWith('.exe'));
      if (exeAsset) {
        downloadUrl = exeAsset.browser_download_url;
      }
    }

    return {
      success: true,
      hasUpdate: isNewer,
      currentVersion: currentVer,
      latestVersion: cleanLatest,
      latestTag: latestTag,
      releaseTitle: release.name || latestTag,
      releaseNotes: release.body || 'Nuevas mejoras y correcciones disponibles.',
      downloadUrl: downloadUrl,
      releaseUrl: release.html_url
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      currentVersion: packageJson.version
    };
  }
});

ipcMain.handle('open-external-url', async (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

// Ciclo de vida Electron
app.whenReady().then(() => {
  createWindow();

  // Atajo F11 para alternar pantalla completa
  globalShortcut.register('F11', () => {
    const focused = BrowserWindow.getFocusedWindow() || mainWindow;
    toggleFullScreen(focused);
  });

  // Atajo F10 para alternar la segunda pantalla (proyector)
  globalShortcut.register('F10', () => {
    toggleProjectorWindow();
  });

  globalShortcut.register('Escape', () => {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused && focused.isFullScreen()) {
      focused.setFullScreen(false);
      focused.setAlwaysOnTop(false);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

