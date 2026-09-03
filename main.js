const { app, BrowserWindow, globalShortcut, ipcMain, Menu, screen } = require('electron');
const path = require('path');

let mainWindow = null;

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
    title: 'BingHo - Tablero 1 al 90',
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
      // En Windows, setAlwaysOnTop('screen-saver') evita que la barra de tareas tape el fondo
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
  });
}

function toggleFullScreen() {
  if (mainWindow) {
    const willBeFull = !mainWindow.isFullScreen();
    if (willBeFull) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setFullScreen(true);
    } else {
      mainWindow.setFullScreen(false);
      mainWindow.setAlwaysOnTop(false);
    }
  }
}

// Handlers IPC
ipcMain.handle('toggle-fullscreen', () => {
  toggleFullScreen();
  return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.handle('is-fullscreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

// Ciclo de vida Electron
app.whenReady().then(() => {
  createWindow();

  // Atajo F11 para alternar pantalla completa
  globalShortcut.register('F11', () => {
    toggleFullScreen();
  });

  globalShortcut.register('Escape', () => {
    if (mainWindow && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
      mainWindow.setAlwaysOnTop(false);
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
