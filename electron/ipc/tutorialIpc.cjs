/**
 * Tutorial & Navigation IPC Handlers
 */
const { ipcMain } = require('electron');
const { openTutorialPlayer, openExternalUrl, openFileInExplorer } = require('../services/tutorialService.cjs');

function registerTutorialIpc() {
  ipcMain.handle('corel:open-tutorial-player', async (_event, payload) => {
    return openTutorialPlayer(payload);
  });

  ipcMain.handle('corel:open-external-url', async (_event, url) => {
    return openExternalUrl(url);
  });

  ipcMain.handle('corel:open-file-explorer', async (_event, filePath) => {
    return openFileInExplorer(filePath);
  });
}

module.exports = {
  registerTutorialIpc,
};
