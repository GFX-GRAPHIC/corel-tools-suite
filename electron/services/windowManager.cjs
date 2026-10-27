/**
 * Window Manager Service
 * Manages lifecycle, creation, focus, and state of all application windows.
 */
const { BrowserWindow } = require('../core/electronBridge.cjs');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let corelCompanionWindow = null;
let corelNumeratorWindow = null;
let corelAiTracerWindow = null;
let corelCertMergerWindow = null;
let corelLayoutPolaWindow = null;
let corelLayoutPolaPreviewWindow = null;
let corelTutorialPlayerWindow = null;

let layoutPolaSharedState = null;
let activeJerseySessionData = null;

function getAppIcon() {
  const icoPath = path.join(__dirname, '../../public/favicon.ico');
  const pngPath = path.join(__dirname, '../../public/logo.png');
  if (fs.existsSync(icoPath)) return icoPath;
  if (fs.existsSync(pngPath)) return pngPath;
  return null;
}

function setMainWindow(win) {
  mainWindow = win;
}

function getMainWindow() {
  return mainWindow;
}

function getAllAppWindows() {
  return [
    mainWindow,
    corelCompanionWindow,
    corelNumeratorWindow,
    corelAiTracerWindow,
    corelCertMergerWindow,
    corelLayoutPolaWindow,
    corelLayoutPolaPreviewWindow,
  ].filter(w => w && !w.isDestroyed());
}

function sendUpdaterStatus(status, data = {}, isPortableApp = false) {
  getAllAppWindows().forEach((win) => {
    try {
      win.webContents.send('updater:status', { status, isPortable: isPortableApp, ...data });
    } catch {}
  });
}

function createCorelCompanionWindow(data) {
  if (data) activeJerseySessionData = data;
  if (corelCompanionWindow && !corelCompanionWindow.isDestroyed()) {
    corelCompanionWindow.focus();
    return corelCompanionWindow;
  }
  corelCompanionWindow = new BrowserWindow({
    width: 560,
    height: 760,
    minWidth: 480,
    minHeight: 580,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#f8fafc',
    title: 'Corel Tools Suite - Auto-Layout Jersey',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  corelCompanionWindow.loadFile(path.join(__dirname, '../corel-companion.html'));
  corelCompanionWindow.on('closed', () => { corelCompanionWindow = null; });
  return corelCompanionWindow;
}

function createCorelNumeratorWindow() {
  if (corelNumeratorWindow && !corelNumeratorWindow.isDestroyed()) {
    corelNumeratorWindow.focus();
    return corelNumeratorWindow;
  }
  corelNumeratorWindow = new BrowserWindow({
    width: 450,
    height: 660,
    minWidth: 400,
    minHeight: 560,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#0f172a',
    title: 'Corel Tools Suite - Numerator Machine',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  corelNumeratorWindow.loadFile(path.join(__dirname, '../corel-numerator.html'));
  corelNumeratorWindow.on('closed', () => { corelNumeratorWindow = null; });
  return corelNumeratorWindow;
}

function createCorelAiTracerWindow() {
  if (corelAiTracerWindow && !corelAiTracerWindow.isDestroyed()) {
    corelAiTracerWindow.focus();
    return corelAiTracerWindow;
  }
  corelAiTracerWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    frame: false,
    resizable: true,
    alwaysOnTop: false,
    backgroundColor: '#0f172a',
    title: 'Corel Tools Suite - AI Jersey Tracer',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: false,
    },
  });
  corelAiTracerWindow.loadFile(path.join(__dirname, '../corel-ai-tracer.html'));
  corelAiTracerWindow.on('closed', () => { corelAiTracerWindow = null; });
  return corelAiTracerWindow;
}

function createCorelCertMergerWindow() {
  if (corelCertMergerWindow && !corelCertMergerWindow.isDestroyed()) {
    corelCertMergerWindow.focus();
    return corelCertMergerWindow;
  }
  corelCertMergerWindow = new BrowserWindow({
    width: 700,
    height: 780,
    minWidth: 550,
    minHeight: 600,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#0f172a',
    title: 'Corel Tools Suite - Certificate & Variable Data Merger',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  corelCertMergerWindow.loadFile(path.join(__dirname, '../corel-cert-merger.html'));
  corelCertMergerWindow.on('closed', () => { corelCertMergerWindow = null; });
  return corelCertMergerWindow;
}

function createCorelLayoutPolaWindow() {
  if (corelLayoutPolaWindow && !corelLayoutPolaWindow.isDestroyed()) {
    corelLayoutPolaWindow.focus();
    return corelLayoutPolaWindow;
  }
  corelLayoutPolaWindow = new BrowserWindow({
    width: 580,
    height: 820,
    minWidth: 480,
    minHeight: 600,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#0f172a',
    title: 'Corel Tools Suite - Layout Pola',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  corelLayoutPolaWindow.loadFile(path.join(__dirname, '../corel-layout-pola.html'));
  corelLayoutPolaWindow.on('closed', () => {
    corelLayoutPolaWindow = null;
    if (corelLayoutPolaPreviewWindow && !corelLayoutPolaPreviewWindow.isDestroyed()) {
      corelLayoutPolaPreviewWindow.close();
    }
  });
  return corelLayoutPolaWindow;
}

function createCorelLayoutPolaPreviewWindow() {
  if (corelLayoutPolaPreviewWindow && !corelLayoutPolaPreviewWindow.isDestroyed()) {
    corelLayoutPolaPreviewWindow.focus();
    return corelLayoutPolaPreviewWindow;
  }
  corelLayoutPolaPreviewWindow = new BrowserWindow({
    width: 1050,
    height: 780,
    minWidth: 700,
    minHeight: 520,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#0b0f19',
    title: 'Corel Tools Suite - Monitor Preview Layout Pola',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  corelLayoutPolaPreviewWindow.loadFile(path.join(__dirname, '../corel-layout-pola-preview.html'));
  corelLayoutPolaPreviewWindow.on('closed', () => {
    corelLayoutPolaPreviewWindow = null;
    if (corelLayoutPolaWindow && !corelLayoutPolaWindow.isDestroyed()) {
      try { corelLayoutPolaWindow.webContents.send('layout-pola:preview-closed'); } catch {}
    }
  });
  return corelLayoutPolaPreviewWindow;
}

function openTutorialPlayerWindow(videoId, title) {
  if (!videoId || typeof videoId !== 'string') return null;
  const safeId = videoId.replace(/[^\w-]/g, '').slice(0, 11);
  if (!safeId) return null;

  const windowTitle = title ? `Video Tutorial - ${title}` : 'Video Tutorial - Corel Tools Suite';

  if (corelTutorialPlayerWindow && !corelTutorialPlayerWindow.isDestroyed()) {
    corelTutorialPlayerWindow.focus();
    corelTutorialPlayerWindow.setTitle(windowTitle);
    corelTutorialPlayerWindow.loadURL(`https://www.youtube-nocookie.com/embed/${safeId}?autoplay=1&rel=0`, {
      httpReferrer: 'https://www.google.com/'
    });
    return corelTutorialPlayerWindow;
  }

  corelTutorialPlayerWindow = new BrowserWindow({
    width: 960,
    height: 580,
    minWidth: 480,
    minHeight: 320,
    backgroundColor: '#0f172a',
    title: windowTitle,
    icon: getAppIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  corelTutorialPlayerWindow.loadURL(`https://www.youtube-nocookie.com/embed/${safeId}?autoplay=1&rel=0`, {
    httpReferrer: 'https://www.google.com/'
  });

  corelTutorialPlayerWindow.on('closed', () => {
    corelTutorialPlayerWindow = null;
  });

  return corelTutorialPlayerWindow;
}

module.exports = {
  getAppIcon,
  setMainWindow,
  getMainWindow,
  getAllAppWindows,
  sendUpdaterStatus,
  createCorelCompanionWindow,
  createCorelNumeratorWindow,
  createCorelAiTracerWindow,
  createCorelCertMergerWindow,
  createCorelLayoutPolaWindow,
  createCorelLayoutPolaPreviewWindow,
  openTutorialPlayerWindow,
  getLayoutPolaSharedState: () => layoutPolaSharedState,
  setLayoutPolaSharedState: (s) => { layoutPolaSharedState = s; },
  getActiveJerseySessionData: () => activeJerseySessionData,
  setActiveJerseySessionData: (d) => { activeJerseySessionData = d; },
  getLayoutPolaWindow: () => corelLayoutPolaWindow,
  getLayoutPolaPreviewWindow: () => corelLayoutPolaPreviewWindow,
};
