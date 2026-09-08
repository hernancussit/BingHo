const { app, BrowserWindow, globalShortcut, ipcMain, Menu, screen, shell, dialog } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const packageJson = require('./package.json');

let mainWindow = null;
let projectorWindow = null;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.bingho.tablero');
}

// ==========================================================================
// CONTROL DE INSTANCIA ÚNICA (PREVENIR DUPLICADOS Y GESTIONAR CIERRE)
// ==========================================================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Ya existe otra instancia de BingHo ejecutándose
  app.whenReady().then(() => {
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['Cerrar', 'Cancelar'],
      defaultId: 0,
      cancelId: 1,
      title: 'BingHo - Aplicación ya en ejecución',
      message: 'BingHo ya se encuentra en ejecución',
      detail: 'Se ha detectado otra instancia de BingHo abierta en segundo plano.\n\nHaz clic en "Cerrar" para terminar los procesos abiertos y vuelve a intentar iniciar la app de nuevo en unos segundos.'
    });

    if (choice === 0) {
      try {
        const currentPid = process.pid;
        if (process.platform === 'win32') {
          try {
            execSync(`taskkill /F /IM BingHo.exe /FI "PID ne ${currentPid}"`, { stdio: 'ignore' });
          } catch (_) {
            execSync('taskkill /F /IM BingHo.exe', { stdio: 'ignore' });
          }
        }
      } catch (err) {
        console.error('Error terminando procesos de BingHo:', err);
      }
    }

    app.exit(0);
  });
} else {
  app.on('second-instance', () => {
    // Si se intenta abrir otra instancia, enfocar y restaurar la ventana del operador
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/hernancussit/BingHo/releases/latest',
      headers: {
        'User-Agent': 'BingHo-Desktop-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const release = JSON.parse(data);
            if (release && (release.tag_name || release.name)) {
              return resolve(release);
            }
            reject(new Error('No se encontró información de versión válida.'));
          } catch (e) {
            reject(e);
          }
        } else {
          // Fallback al listado general de releases si /latest falla
          fallbackFetchAllReleases().then(resolve).catch(reject);
        }
      });
    }).on('error', () => {
      fallbackFetchAllReleases().then(resolve).catch(reject);
    });
  });
}

function fallbackFetchAllReleases() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/hernancussit/BingHo/releases?per_page=10',
      headers: {
        'User-Agent': 'BingHo-Desktop-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const releases = JSON.parse(data);
            if (Array.isArray(releases) && releases.length > 0) {
              const published = releases.filter(r => !r.draft);
              if (published.length > 0) {
                published.sort((a, b) => compareVersions(b.tag_name || b.name, a.tag_name || a.name));
                return resolve(published[0]);
              }
            }
            reject(new Error('No se encontraron versiones publicadas en el repositorio.'));
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
    title: `BingHo v${packageJson.version} - Por Hernán Cussit (Operador)`,
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
    title: `BingHo v${packageJson.version} - Pantalla de Proyección`,
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

// Información de versión y autor
ipcMain.handle('get-app-info', () => {
  const ver = packageJson.version;
  const build = packageJson.buildNumber || 1;
  return {
    version: ver,
    buildNumber: build,
    buildTimestamp: packageJson.buildTimestamp || '',
    displayVersion: `v${ver} (b${build})`,
    author: 'Hernán Cussit',
    title: `BingHo v${ver} (Build ${build}) - Por Hernán Cussit`
  };
});

// Comprobación de actualizaciones vía GitHub Releases (con verificación de Build y Timestamp)
ipcMain.handle('check-for-updates', async () => {
  try {
    const release = await fetchLatestRelease();
    const currentVer = packageJson.version;
    const currentBuild = packageJson.buildNumber || 1;
    const currentBuildTime = packageJson.buildTimestamp ? new Date(packageJson.buildTimestamp).getTime() : 0;

    const latestTag = release.tag_name || release.name || '';
    const cleanLatest = latestTag.replace(/^v/, '');
    
    // 1. Comparación semántica de versión base (ej: 0.9.8 > 0.9.7)
    const verCmp = compareVersions(cleanLatest, currentVer);
    let isNewer = verCmp > 0;
    
    // 2. Si la versión base es igual o no es menor, verificar Build Number o Timestamp de publicación
    if (verCmp >= 0 && !isNewer) {
      // Extraer posible build number del tag o título de la release (ej: Build 15, b15, .15)
      const buildMatch = (latestTag + ' ' + (release.name || '')).match(/(?:build|b)[.\s-]?(\d+)/i);
      if (buildMatch) {
        const remoteBuild = parseInt(buildMatch[1], 10);
        if (!isNaN(remoteBuild) && remoteBuild > currentBuild) {
          isNewer = true;
        }
      }

      // Comparar timestamp de los assets subidos o de la release de GitHub vs build local
      let latestRemoteTime = 0;
      if (release.published_at) latestRemoteTime = Math.max(latestRemoteTime, new Date(release.published_at).getTime());
      if (release.updated_at) latestRemoteTime = Math.max(latestRemoteTime, new Date(release.updated_at).getTime());
      if (Array.isArray(release.assets)) {
        release.assets.forEach(a => {
          if (a.updated_at) latestRemoteTime = Math.max(latestRemoteTime, new Date(a.updated_at).getTime());
          if (a.created_at) latestRemoteTime = Math.max(latestRemoteTime, new Date(a.created_at).getTime());
        });
      }

      if (!isNewer && latestRemoteTime > 0 && currentBuildTime > 0) {
        // Si hay una actualización o assets subidos con posterioridad al build local
        if (latestRemoteTime > (currentBuildTime + 5000)) {
          isNewer = true;
        }
      }
    }
    
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
      currentBuild: currentBuild,
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
      currentVersion: packageJson.version,
      currentBuild: packageJson.buildNumber || 1
    };
  }
});

function downloadFileWithProgress(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    function get(currentUrl) {
      https.get(currentUrl, {
        headers: {
          'User-Agent': 'BingHo-Desktop-App',
          'Accept': 'application/octet-stream'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Error de descarga HTTP ${res.statusCode}`));
        }

        const total = parseInt(res.headers['content-length'], 10) || 0;
        let downloaded = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (total > 0 && onProgress) {
            const percent = Math.min(100, Math.round((downloaded / total) * 100));
            onProgress(percent, downloaded, total);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => resolve(destPath));
        });

        fileStream.on('error', (err) => {
          try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) {}
          reject(err);
        });
      }).on('error', (err) => {
        try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) {}
        reject(err);
      });
    }

    get(url);
  });
}

// Descarga e instalación automática in-app de la nueva versión
ipcMain.handle('download-and-install-update', async (event, downloadUrl) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  try {
    const tempDir = app.getPath('temp');
    const updateExePath = path.join(tempDir, `BingHo_Update_${Date.now()}.exe`);

    await downloadFileWithProgress(downloadUrl, updateExePath, (percent, downloaded, total) => {
      if (senderWin && !senderWin.isDestroyed()) {
        senderWin.webContents.send('update-download-progress', {
          percent,
          downloaded,
          total,
          downloadedMB: (downloaded / (1024 * 1024)).toFixed(1),
          totalMB: (total / (1024 * 1024)).toFixed(1)
        });
      }
    });

    // Determinar la ruta del ejecutable a reemplazar
    const targetExe = process.env.BINGHO_PORTABLE_EXE || process.env.PORTABLE_EXECUTABLE_FILE;

    if (targetExe && fs.existsSync(targetExe)) {
      // Crear script .BAT en el directorio temporal para esperar el cierre de BingHo, reemplazar el EXE y relanzarlo
      const scriptPath = path.join(tempDir, `bingho_updater_${Date.now()}.bat`);
      const batContent = `@echo off
setlocal
:: Esperar 2 segundos a que el proceso BingHo libere el archivo EXE
timeout /t 2 /nobreak > nul
:: Reemplazar el ejecutable original por la nueva versión descargada
copy /y "${updateExePath}" "${targetExe}" > nul
del "${updateExePath}" > nul
:: Iniciar la versión actualizada de BingHo
start "" "${targetExe}"
:: Autoeliminar este script
(goto) 2>nul & del "%~f0"
exit
`;
      fs.writeFileSync(scriptPath, batContent, 'utf8');

      const installerProcess = spawn('cmd.exe', ['/c', scriptPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      installerProcess.unref();

      setTimeout(() => {
        app.quit();
      }, 400);

      return { success: true, restarting: true };
    } else {
      // En modo desarrollo o si no se detecta la ruta original, iniciar directamente el nuevo EXE descargado
      const newProcess = spawn(updateExePath, [], {
        detached: true,
        stdio: 'ignore'
      });
      newProcess.unref();

      setTimeout(() => {
        app.quit();
      }, 400);

      return { success: true, restarting: true };
    }
  } catch (err) {
    return { success: false, error: err.message };
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
if (gotTheLock) {
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
}


