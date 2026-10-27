/**
 * Certificate & Variable Data Mail Merge IPC Handlers
 */
const { ipcMain } = require('electron');
const { createCorelCertMergerWindow } = require('../services/windowManager.cjs');
const { parseExcelFile, executeCertMerger, executeCertMergerWorkflow } = require('../services/certMergerService.cjs');
const runMerger = executeCertMerger || executeCertMergerWorkflow;

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
    return await runMerger(payload);
  });

  ipcMain.handle('corel:execute-merger', async (_event, payload) => {
    return await runMerger(payload);
  });
}

module.exports = {
  registerCertMergerIpc,
};
