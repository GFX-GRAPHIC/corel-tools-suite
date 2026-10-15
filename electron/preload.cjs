const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('corelAPI', {
  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  unmaximizeWindow: () => ipcRenderer.send('window-unmaximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window-toggle-always-on-top'),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-change', (_event, state) => callback(state));
  },

  // Dialogs
  openFiles: (options) => ipcRenderer.invoke('dialog:open-files', options),
  openDirectory: (options) => ipcRenderer.invoke('dialog:open-directory', options),
  selectExcelFile: () => ipcRenderer.invoke('dialog:select-excel-file'),

  // CorelDRAW Status & Info
  checkStatus: () => ipcRenderer.invoke('corel:check-status'),
  getRecentFiles: () => ipcRenderer.invoke('corel:get-recent-files'),
  openDocument: (filePath) => ipcRenderer.invoke('corel:open-document', filePath),

  // CorelDRAW Tools Automation
  executeNumerator: (payload) => ipcRenderer.invoke('corel:execute-numerator', payload),
  executeMerger: (payload) => ipcRenderer.invoke('corel:execute-merger', payload),
  executeConversion: (payload) => ipcRenderer.invoke('corel:execute-conversion', payload),
  executeColorReplace: (payload) => ipcRenderer.invoke('corel:execute-color-replace', payload),
  executeExtractColors: () => ipcRenderer.invoke('corel:execute-extract-colors'),
  executeResizeLayout: (payload) => ipcRenderer.invoke('corel:execute-resize-layout', payload),
  executeSplit: (payload) => ipcRenderer.invoke('corel:execute-split', payload),
  executeBatch: (payload) => ipcRenderer.invoke('corel:execute-batch', payload),
  executeUtility: (command) => ipcRenderer.invoke('corel:execute-utility', command),

  // Excel Parser
  parseExcelFile: (payload) => ipcRenderer.invoke('corel:parse-excel-file', payload),
});
