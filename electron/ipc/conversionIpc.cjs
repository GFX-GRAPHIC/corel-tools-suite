/**
 * Conversion IPC Handlers
 */
const { ipcMain } = require('electron');
const { executeConversion } = require('../services/conversionService.cjs');

function registerConversionIpc() {
  ipcMain.handle('corel:execute-conversion', async (_event, payload) => {
    return await executeConversion(payload);
  });
}

module.exports = {
  registerConversionIpc,
};
