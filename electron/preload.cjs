const { contextBridge, ipcRenderer, webUtils } = require('electron');

const api = {
  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  unmaximizeWindow: () => ipcRenderer.send('window-unmaximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window-toggle-always-on-top'),
  tracerToggleAlwaysOnTop: () => ipcRenderer.invoke('window-toggle-always-on-top'),
  reloadWindow: () => ipcRenderer.send('window-reload'),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-change', (_event, state) => callback(state));
  },

  // Dialogs
  openFiles: (options) => ipcRenderer.invoke('dialog:open-files', options),
  openDirectory: (options) => ipcRenderer.invoke('dialog:open-directory', options),
  selectExcelFile: () => ipcRenderer.invoke('dialog:select-excel-file'),
  dialogSelectExcelFile: () => ipcRenderer.invoke('dialog:select-excel-file'),
  dialogSelectExportFolder: () => ipcRenderer.invoke('dialog:open-directory'),
  selectCorelExeDialog: () => ipcRenderer.invoke('dialog:select-corel-exe'),
  corelSelectCorelExeDialog: () => ipcRenderer.invoke('dialog:select-corel-exe'),
  autoRegisterCorel: () => ipcRenderer.invoke('corel:auto-register'),
  corelAutoRegister: () => ipcRenderer.invoke('corel:auto-register'),
  registerCorelCustomPath: (filePath) => ipcRenderer.invoke('corel:register-custom-path', filePath),
  corelRegisterCustomPath: (filePath) => ipcRenderer.invoke('corel:register-custom-path', filePath),

  // CorelDRAW Status & Info
  checkStatus: () => ipcRenderer.invoke('corel:check-status'),
  corelCheckStatus: () => ipcRenderer.invoke('corel:check-status'),
  getRecentFiles: () => ipcRenderer.invoke('corel:get-recent-files'),
  openDocument: (filePath) => ipcRenderer.invoke('corel:open-document', filePath),
  corelGetSelectionInfo: () => ipcRenderer.invoke('corel:get-selection-info'),
  corelGetActiveOrderData: () => ipcRenderer.invoke('corel:get-active-order-data'),
  forceKillAllCorel: () => ipcRenderer.invoke('corel:force-kill-all'),
  cleanGhostProcesses: () => ipcRenderer.invoke('corel:clean-ghost-processes'),
  corelCleanGhostProcesses: () => ipcRenderer.invoke('corel:clean-ghost-processes'),
  launchCorelApp: () => ipcRenderer.invoke('corel:launch-app'),
  corelLaunchApp: () => ipcRenderer.invoke('corel:launch-app'),
  cancelOperation: () => ipcRenderer.invoke('corel:cancel-operation'),
  corelCancelOperation: () => ipcRenderer.invoke('corel:cancel-operation'),
  getPreferredCorelVersion: () => ipcRenderer.invoke('corel:get-preferred-version'),
  setPreferredCorelVersion: (ver, pid) => ipcRenderer.invoke('corel:set-preferred-version', ver, pid),
  getDetectedCorelVersions: () => ipcRenderer.invoke('corel:get-detected-versions'),

  // Companion Windows
  corelOpenCompanionTool: (data) => ipcRenderer.invoke('corel:open-companion-tool', data),
  corelOpenNumeratorTool: () => ipcRenderer.invoke('corel:open-numerator-tool'),
  corelOpenCertMergerTool: () => ipcRenderer.invoke('corel:open-cert-merger-tool'),
  corelOpenAiTracerTool: () => ipcRenderer.invoke('corel:open-ai-tracer-tool'),

  // Automation Handlers
  executeNumerator: (payload) => ipcRenderer.invoke('corel:execute-numerator', payload),
  corelExecuteNumerator: (payload) => ipcRenderer.invoke('corel:execute-numerator', payload),

  executeMerger: (payload) => ipcRenderer.invoke('corel:execute-cert-merger', payload),
  corelExecuteCertMerger: (payload) => ipcRenderer.invoke('corel:execute-cert-merger', payload),

  executeLayout: (payload) => ipcRenderer.invoke('corel:execute-layout', payload),
  corelExecuteLayout: (payload) => ipcRenderer.invoke('corel:execute-layout', payload),

  corelToggleDarkMode: (mode) => ipcRenderer.invoke('corel:toggle-dark-mode', mode),
  corelConvertAllCurves: () => ipcRenderer.invoke('corel:convert-all-curves'),
  changeCase: (caseType) => ipcRenderer.invoke('corel:change-case', caseType),
  corelChangeCase: (caseType) => ipcRenderer.invoke('corel:change-case', caseType),

  executeConversion: (payload) => ipcRenderer.invoke('corel:execute-conversion', payload),
  executeColorReplace: (payload) => ipcRenderer.invoke('corel:execute-color-replace', payload),
  executeExtractColors: () => ipcRenderer.invoke('corel:execute-extract-colors'),
  executeResizeLayout: (payload) => ipcRenderer.invoke('corel:execute-resize-layout', payload),
  executeSplit: (payload) => ipcRenderer.invoke('corel:execute-split', payload),
  executeBatch: (payload) => ipcRenderer.invoke('corel:execute-batch', payload),
  executeUtility: (command) => ipcRenderer.invoke('corel:execute-utility', command),

  corelBatchExportSelection: (payload) => ipcRenderer.invoke('corel:batch-export-selection', payload),
  corelExportNextSelection: (payload) => ipcRenderer.invoke('corel:export-next-selection', payload),

  // Excel Parser
  parseExcelFile: (payload) => ipcRenderer.invoke('corel:parse-excel-file', payload),
  corelParseExcelFile: (payload) => ipcRenderer.invoke('corel:parse-excel-file', payload),

  // AI Jersey Tracer APIs
  aiTracerValidateKey: (apiKey) => ipcRenderer.invoke('corel:ai-tracer-validate-key', apiKey),
  aiTracerProcess: (payload) => ipcRenderer.invoke('corel:ai-tracer-process', payload),
  corelApplyAiPattern: (payload) => ipcRenderer.invoke('corel:apply-ai-pattern', payload),
  copyImageToClipboard: (payload) => ipcRenderer.invoke('corel:copy-image-clipboard', payload),
  readImageFromClipboard: () => ipcRenderer.invoke('corel:read-image-clipboard'),
  savePatternImage: (payload) => ipcRenderer.invoke('corel:save-pattern-image', payload),
  openExternalUrl: (url) => ipcRenderer.invoke('corel:open-external-url', url),
  openFileInExplorer: (filePath) => ipcRenderer.invoke('corel:open-file-explorer', filePath),
  onTracerClipboardReady: (callback) => {
    ipcRenderer.on('tracer:clipboard-image-ready', () => callback());
  },

  // Order Sorter, Google Lens & AI APIs
  scanGoogleLens: (payload) => ipcRenderer.invoke('corel:scan-google-lens', payload),
  aiParseJerseyText: (payload) => ipcRenderer.invoke('corel:ai-parse-jersey-text', payload),
  aiScanJerseyImage: (payload) => ipcRenderer.invoke('corel:ai-scan-jersey-image', payload),
  ocrImageToText: (payload) => ipcRenderer.invoke('corel:ocr-image-to-text', payload),
  exportOrderExcel: (payload) => ipcRenderer.invoke('corel:export-order-excel', payload),
  saveComparisonImage: (payload) => ipcRenderer.invoke('corel:save-comparison-image', payload),
  showSaveDialog: (options) => ipcRenderer.invoke('corel:show-save-dialog', options),

  // CDR Version Converter & Inspector APIs
  inspectCdrFile: (filePath) => ipcRenderer.invoke('corel:inspect-cdr-file', filePath),
  inspectCdrFiles: (filePaths) => ipcRenderer.invoke('corel:inspect-cdr-files', filePaths),
  scanCdrDirectory: (dirPath, recursive) => ipcRenderer.invoke('corel:scan-cdr-directory', { dirPath, recursive }),
  downsaveCdrBatch: (payload) => ipcRenderer.invoke('corel:downsave-cdr-batch', payload),

  // File Utilities
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
      return file?.path || '';
    } catch {
      return file?.path || '';
    }
  },

  // License Management APIs
  licenseGetStatus: () => ipcRenderer.invoke('license:get-status'),
  licenseGetHwid: () => ipcRenderer.invoke('license:get-hwid'),
  licenseActivate: (key) => ipcRenderer.invoke('license:activate', key),
  licenseDeactivate: () => ipcRenderer.invoke('license:deactivate'),
  onLicenseBlocked: (callback) => {
    ipcRenderer.on('license:blocked', (_event, data) => callback(data));
  },

  // Auto-Updater APIs
  onUpdaterStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('updater:status', handler);
    return () => ipcRenderer.removeListener('updater:status', handler);
  },
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterInstall: () => ipcRenderer.invoke('updater:quit-and-install'),

  // Application Info
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
};

// Expose on both names for full backward & forward compatibility
contextBridge.exposeInMainWorld('corelAPI', api);
contextBridge.exposeInMainWorld('electronAPI', api);
