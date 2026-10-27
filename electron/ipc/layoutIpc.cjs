/**
 * Auto-Layout Jersey IPC Handlers
 */
const { ipcMain } = require('electron');
const { createCorelCompanionWindow, getActiveJerseySessionData } = require('../services/windowManager.cjs');
const { executeLayout, executeResizeLayout } = require('../services/layoutService.cjs');

function registerLayoutIpc() {
  ipcMain.handle('corel:open-companion-tool', async (_event, data) => {
    try {
      const win = createCorelCompanionWindow(data);
      return { success: !!win };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal membuka jendela Companion.' };
    }
  });

  ipcMain.handle('corel:get-active-order-data', async () => {
    return getActiveJerseySessionData();
  });

  ipcMain.handle('corel:execute-layout', async (_event, payload) => {
    return await executeLayout(payload);
  });

  ipcMain.handle('corel:execute-resize-layout', async (_event, payload) => {
    return await executeResizeLayout(payload);
  });
}

module.exports = {
  registerLayoutIpc,
};
