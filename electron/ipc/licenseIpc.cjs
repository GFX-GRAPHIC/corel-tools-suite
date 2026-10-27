/**
 * License & App Update IPC Handlers
 */
const { ipcMain } = require('electron');
const { getAppVersion } = require('../core/env.cjs');
const {
  getLicenseStatus,
  getHardwareId,
  activateLicenseKey,
  deactivateLicense,
  checkForUpdates,
  quitAndInstallUpdate,
} = require('../services/licenseService.cjs');

function registerLicenseIpc() {
  ipcMain.handle('app:get-version', () => getAppVersion());

  ipcMain.handle('license:get-status', () => getLicenseStatus());

  ipcMain.handle('license:get-hwid', () => getHardwareId());

  ipcMain.handle('license:activate', async (_event, key) => activateLicenseKey(key));

  ipcMain.handle('license:deactivate', () => deactivateLicense());

  ipcMain.handle('updater:check', async () => checkForUpdates());

  ipcMain.handle('updater:quit-and-install', () => quitAndInstallUpdate());
}

module.exports = {
  registerLicenseIpc,
};
