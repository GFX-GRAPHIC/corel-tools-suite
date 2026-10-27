/**
 * Electron Bridge
 * Provides safe abstraction for Electron APIs (app, shell, BrowserWindow)
 * with robust fallbacks for headless unit testing in pure Node.js environments.
 */
const os = require('os');
const path = require('path');

let electron = null;
try {
  electron = require('electron');
} catch (e) {
  // Headless Node environment
}

const app = (electron && electron.app) ? electron.app : {
  getPath: (name) => {
    if (name === 'temp') return os.tmpdir();
    if (name === 'userData') return path.join(os.homedir(), '.corel-tools-suite');
    return os.tmpdir();
  },
  isPackaged: false,
  getVersion: () => {
    try {
      return require('../../package.json').version;
    } catch {
      return '1.1.4';
    }
  },
  exit: (code = 0) => {
    if (process.env.NODE_ENV !== 'test') process.exit(code);
  },
  quit: () => {
    if (process.env.NODE_ENV !== 'test') process.exit(0);
  },
  requestSingleInstanceLock: () => true,
  whenReady: () => Promise.resolve(),
  on: () => {},
};

const shell = (electron && electron.shell) ? electron.shell : {
  openPath: (p) => Promise.resolve(),
  openExternal: (url) => Promise.resolve(),
  showItemInFolder: (p) => {},
};

const nativeImage = (electron && electron.nativeImage) ? electron.nativeImage : {
  createFromPath: () => ({ isEmpty: () => true }),
  createFromBuffer: () => ({ isEmpty: () => true }),
};

const clipboard = (electron && electron.clipboard) ? electron.clipboard : {
  readImage: () => ({ isEmpty: () => true, toPNG: () => Buffer.alloc(0), getSize: () => ({ width: 0, height: 0 }) }),
  writeImage: () => {},
};

const BrowserWindow = (electron && electron.BrowserWindow) ? electron.BrowserWindow : class MockBrowserWindow {
  constructor() {
    this.webContents = {
      send: () => {},
      once: () => {},
    };
  }
  loadFile() {}
  loadURL() {}
  show() {}
  focus() {}
  minimize() {}
  maximize() {}
  unmaximize() {}
  close() {}
  reload() {}
  isMaximized() { return false; }
  isMinimized() { return false; }
  isDestroyed() { return false; }
  isAlwaysOnTop() { return false; }
  setAlwaysOnTop() {}
  setTitle() {}
  getSize() { return [800, 600]; }
  setSize() {}
  on() {}
  once() {}
  static fromWebContents() { return null; }
  static getAllWindows() { return []; }
};

const ipcMain = (electron && electron.ipcMain) ? electron.ipcMain : {
  handle: () => {},
  on: () => {},
  emit: () => {},
  removeHandler: () => {},
};

const dialog = (electron && electron.dialog) ? electron.dialog : {
  showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
  showSaveDialog: () => Promise.resolve({ canceled: true, filePath: '' }),
};

module.exports = {
  electron,
  app,
  shell,
  nativeImage,
  clipboard,
  BrowserWindow,
  ipcMain,
  dialog,
};
