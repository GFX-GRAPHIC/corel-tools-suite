/**
 * Numerator (Penomoran Otomatis) IPC Handlers
 */
const { ipcMain } = require('electron');
const { createCorelNumeratorWindow } = require('../services/windowManager.cjs');
const { executeNumerator } = require('../services/numeratorService.cjs');

function registerNumeratorIpc() {
  ipcMain.handle('corel:open-numerator-tool', async () => {
    try {
      const win = createCorelNumeratorWindow();
      return { success: !!win };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal membuka jendela Numerator.' };
    }
  });

  ipcMain.handle('corel:execute-numerator', async (_event, payload) => {
    return await executeNumerator(payload);
  });
}

module.exports = {
  registerNumeratorIpc,
};
