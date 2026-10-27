/**
 * Corel Tools Suite - Main Process Entry Point
 * Refactored Modular Architecture:
 * - electron/core: Connection, process management, PowerShell runner, environment
 * - electron/services: Domain services for Numerator, Layout, Pola, Cert Merger, Conversion, Utilities
 * - electron/ipc: Domain IPC routers
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { isProd } = require('./core/env.cjs');
const logger = require('./core/logger.cjs');
const { getCorelConnectPs, getCorelFindAppPs } = require('./core/corelConnection.cjs');
const {
  setMainWindow,
  getMainWindow,
  getAppIcon,
} = require('./services/windowManager.cjs');
const { initAutoUpdater, checkForUpdates } = require('./services/licenseService.cjs');
const { registerAllIpc } = require('./ipc/registerAllIpc.cjs');

// Backward compatibility globals for legacy scripts
Object.defineProperty(global, 'COREL_FIND_APP_PS', {
  get() { return getCorelFindAppPs(); },
  configurable: true
});
Object.defineProperty(global, 'COREL_CONNECT_PS', {
  get() { return getCorelConnectPs(); },
  configurable: true
});

// Process-level exception handling
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', reason);
});

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWin = getMainWindow();
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1260,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    backgroundColor: '#111827',
    show: false,
    title: 'Corel Tools Suite',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  setMainWindow(win);

  win.loadFile(path.join(__dirname, '../src/index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.on('maximize', () => {
    win.webContents.send('window-state-change', { isMaximized: true });
  });

  win.on('unmaximize', () => {
    win.webContents.send('window-state-change', { isMaximized: false });
  });

  win.on('closed', () => {
    setMainWindow(null);
  });

  return win;
}

// App Lifecycle
app.whenReady().then(() => {
  // 1. Register all domain IPC routers
  registerAllIpc();

  // 2. Initialize Auto-Updater
  initAutoUpdater();

  // 3. Create Main Window
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  // Background update check after app startup
  setTimeout(() => {
    if (isProd) {
      checkForUpdates().catch((err) => {
        logger.debug('AutoUpdater', 'Background update check note:', err?.message);
      });
    }
  }, 6000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
