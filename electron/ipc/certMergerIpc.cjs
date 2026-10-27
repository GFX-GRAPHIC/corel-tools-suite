/**
 * Certificate & Variable Data Mail Merge IPC Handlers
 */
const { ipcMain } = require('electron');
const { createCorelCertMergerWindow } = require('../services/windowManager.cjs');
const { parseExcelFile, executeCertMergerWorkflow } = require('../services/certMergerService.cjs');

function registerCertMergerIpc() {
  ipcMain.handle('corel:open-cert-merger-tool', async () => {
    try {
      const win = createCorelCertMergerWindow();
      return { success: !!win };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal membuka jendela Cetak Sertifikat.' };
    }
  });

  ipcMain.handle('corel:parse-excel-file', async (_event, payload) => {
    return parseExcelFile(payload);
  });

  ipcMain.handle('corel:execute-cert-merger', async (_event, payload) => {
    return await executeCertMergerWorkflow(payload);
  });

  ipcMain.handle('corel:execute-merger', async (_event, payload) => {
    return await executeCertMergerWorkflow(payload);
  });
}

module.exports = {
  registerCertMergerIpc,
};
