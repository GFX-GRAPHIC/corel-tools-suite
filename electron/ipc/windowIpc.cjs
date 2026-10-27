/**
 * Window & Dialog IPC Handlers
 */
const { ipcMain, BrowserWindow, dialog } = require('electron');
const { getMainWindow } = require('../services/windowManager.cjs');

function registerWindowIpc() {
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (win) win.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });

  ipcMain.on('window-unmaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (win && win.isMaximized()) win.unmaximize();
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (win) win.close();
  });

  ipcMain.on('window-reload', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (win) win.reload();
  });

  ipcMain.handle('window-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    return win ? win.isMaximized() : false;
  });

  ipcMain.handle('window-toggle-always-on-top', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (win) {
      const current = win.isAlwaysOnTop();
      win.setAlwaysOnTop(!current);
      return !current;
    }
    return false;
  });

  ipcMain.handle('dialog:open-files', async (_event, options = {}) => {
    const mainWin = getMainWindow();
    const result = await dialog.showOpenDialog(mainWin, {
      title: options.title || 'Pilih File',
      properties: ['openFile', 'multiSelections'],
      filters: options.filters || [
        { name: 'CorelDRAW Files', extensions: ['cdr', 'cmx'] },
        { name: 'Semua File', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths || !result.filePaths.length) {
      return { success: false, files: [], filePaths: [] };
    }
    return { success: true, files: result.filePaths, filePaths: result.filePaths };
  });

  ipcMain.handle('dialog:open-directory', async (_event, options = {}) => {
    const mainWin = getMainWindow();
    const result = await dialog.showOpenDialog(mainWin, {
      title: options.title || 'Pilih Folder Tujuan',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths || !result.filePaths.length) {
      return { success: false, path: null };
    }
    return { success: true, path: result.filePaths[0] };
  });

  ipcMain.handle('dialog:select-excel-file', async () => {
    const mainWin = getMainWindow();
    const result = await dialog.showOpenDialog(mainWin, {
      title: 'Pilih File Data Excel / CSV',
      properties: ['openFile'],
      filters: [
        { name: 'File Excel & CSV', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'Semua File', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths.length) return { success: false };
    return { success: true, filePath: result.filePaths[0] };
  });
}

module.exports = {
  registerWindowIpc,
};
