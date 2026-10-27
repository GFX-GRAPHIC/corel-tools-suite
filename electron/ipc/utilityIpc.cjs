/**
 * Utility IPC Handlers
 */
const { ipcMain } = require('electron');
const {
  checkStatus,
  getPreferredVersion,
  setPreferredVersion,
  getDetectedVersions,
  cancelOperation,
  getRecentFiles,
  openDocument,
  cleanGhostProcesses,
  launchApp,
  getSelectionInfo,
  convertAllCurves,
  changeCase,
  executeColorReplace,
  executeExtractColors,
  executeSplit,
  executeBatch,
  executeUtility,
  toggleDarkMode,
} = require('../services/utilityService.cjs');

function registerUtilityIpc() {
  ipcMain.handle('corel:check-status', async () => checkStatus());

  ipcMain.handle('corel:get-preferred-version', async () => getPreferredVersion());

  ipcMain.handle('corel:set-preferred-version', async (_event, version, pid) => setPreferredVersion(version, pid));

  ipcMain.handle('corel:get-detected-versions', async () => getDetectedVersions());

  ipcMain.handle('corel:cancel-operation', () => cancelOperation());

  ipcMain.handle('corel:get-recent-files', async () => getRecentFiles());

  ipcMain.handle('corel:open-document', async (_event, filePath) => openDocument(filePath));

  ipcMain.handle('corel:clean-ghost-processes', async () => cleanGhostProcesses());

  ipcMain.handle('corel:launch-app', async () => launchApp());

  ipcMain.handle('corel:get-selection-info', async () => getSelectionInfo());

  ipcMain.handle('corel:convert-all-curves', async () => convertAllCurves());

  ipcMain.handle('corel:change-case', async (_event, caseType) => changeCase(caseType));

  ipcMain.handle('corel:execute-color-replace', async (_event, payload) => executeColorReplace(payload));

  ipcMain.handle('corel:execute-extract-colors', async () => executeExtractColors());

  ipcMain.handle('corel:execute-split', async (_event, payload) => executeSplit(payload));

  ipcMain.handle('corel:execute-batch', async (_event, payload) => executeBatch(payload));

  ipcMain.handle('corel:execute-utility', async (_event, command) => executeUtility(command));

  ipcMain.handle('corel:toggle-dark-mode', async (_event, targetMode) => toggleDarkMode(targetMode));
}

module.exports = {
  registerUtilityIpc,
};
