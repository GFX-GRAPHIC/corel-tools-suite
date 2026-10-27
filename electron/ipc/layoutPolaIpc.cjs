/**
 * Layout Pola (Auto-Nesting Lembar Cetak) IPC Handlers
 */
const { ipcMain } = require('electron');
const {
  createCorelLayoutPolaWindow,
  createCorelLayoutPolaPreviewWindow,
  getLayoutPolaSharedState,
  setLayoutPolaSharedState,
  getLayoutPolaWindow,
  getLayoutPolaPreviewWindow,
} = require('../services/windowManager.cjs');
const { getLayoutPolaSelection, executeLayoutPola } = require('../services/layoutPolaService.cjs');

function registerLayoutPolaIpc() {
  ipcMain.handle('corel:open-layout-pola-tool', async () => {
    try {
      const win = createCorelLayoutPolaWindow();
      return { success: !!win };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal membuka jendela Layout Pola.' };
    }
  });

  ipcMain.handle('corel:get-layout-pola-selection', async () => {
    return await getLayoutPolaSelection();
  });

  ipcMain.handle('corel:execute-layout-pola', async (_event, payload) => {
    return await executeLayoutPola(payload);
  });

  ipcMain.handle('corel:layout-pola-open-detached-preview', (_event, state) => {
    try {
      setLayoutPolaSharedState(state || null);
      const previewWin = createCorelLayoutPolaPreviewWindow();
      if (previewWin) {
        if (state) {
          previewWin.webContents.once('did-finish-load', () => {
            try { previewWin.webContents.send('layout-pola:sync-from-companion', state); } catch {}
          });
        }
        return { success: true };
      }
      return { success: false, message: 'Gagal membuat jendela monitor preview' };
    } catch (err) {
      return { success: false, message: err?.message || 'Error membuka detached preview' };
    }
  });

  ipcMain.handle('corel:layout-pola-close-detached-preview', () => {
    const previewWin = getLayoutPolaPreviewWindow();
    if (previewWin && !previewWin.isDestroyed()) {
      previewWin.close();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('corel:layout-pola-sync-to-preview', (_event, data) => {
    setLayoutPolaSharedState(data || null);
    const previewWin = getLayoutPolaPreviewWindow();
    if (previewWin && !previewWin.isDestroyed()) {
      try {
        previewWin.webContents.send('layout-pola:sync-from-companion', data);
        return { success: true };
      } catch (err) {
        return { success: false, message: err?.message };
      }
    }
    return { success: false, notOpened: true };
  });

  ipcMain.handle('corel:layout-pola-action-from-preview', (_event, action, data) => {
    const polaWin = getLayoutPolaWindow();
    if (polaWin && !polaWin.isDestroyed()) {
      try {
        polaWin.webContents.send('layout-pola:action-from-preview', { action, data });
        return { success: true };
      } catch (err) {
        return { success: false, message: err?.message };
      }
    }
    return { success: false, companionNotOpen: true };
  });

  ipcMain.handle('corel:layout-pola-resize-companion', (_event, isExpanded) => {
    const polaWin = getLayoutPolaWindow();
    if (polaWin && !polaWin.isDestroyed()) {
      try {
        const [w, h] = polaWin.getSize();
        if (isExpanded) {
          if (w < 1180) polaWin.setSize(1220, Math.max(h, 840));
        } else {
          polaWin.setSize(580, h);
        }
        return { success: true };
      } catch (err) {
        return { success: false, message: err?.message };
      }
    }
    return { success: false };
  });
}

module.exports = {
  registerLayoutPolaIpc,
};
