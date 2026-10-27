/**
 * Tutorial Service
 * Handles YouTube video player window with verified HTTP referrer headers,
 * external link browsing, and file manager navigation.
 */
const fs = require('fs');
const { shell } = require('../core/electronBridge.cjs');
const { openTutorialPlayerWindow } = require('./windowManager.cjs');

function openTutorialPlayer(payload) {
  const { videoId, title } = payload || {};
  if (!videoId || typeof videoId !== 'string') {
    return { success: false, message: 'ID video YouTube tidak valid.' };
  }
  const win = openTutorialPlayerWindow(videoId, title);
  if (win) {
    return { success: true };
  }
  return { success: false, message: 'Gagal membuka jendela pemutar video tutorial.' };
}

function openExternalUrl(url) {
  if (!url || typeof url !== 'string') {
    return { success: false, message: 'URL tidak valid.' };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { success: false, message: 'Hanya protokol HTTP/HTTPS yang diizinkan.' };
  }
  try {
    shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message || 'Gagal membuka tautan di browser.' };
  }
}

function openFileInExplorer(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, message: 'Path file kosong.' };
  }
  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'File tidak ditemukan.' };
  }
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message || 'Gagal membuka File Explorer.' };
  }
}

module.exports = {
  openTutorialPlayer,
  openExternalUrl,
  openFileInExplorer,
};
