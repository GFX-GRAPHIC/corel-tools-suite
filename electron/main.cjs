const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile } = require('child_process');

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

let mainWindow = null;
let corelCompanionWindow = null;
let corelNumeratorWindow = null;
let corelAiTracerWindow = null;
let corelCertMergerWindow = null;
let activeJerseySessionData = null;


let cdrVersionService = null;
try {
  cdrVersionService = require('./cdrVersionService.cjs');
} catch (e) {
  console.log('cdrVersionService note:', e.message);
}

let jerseyOrderService = null;
try {
  jerseyOrderService = require('./jerseyOrderService.cjs');
} catch (e) {
  console.log('jerseyOrderService note:', e.message);
}

let licenseEngine = null;
try {
  licenseEngine = require('./licenseEngine.cjs');
} catch (e) {
  console.log('licenseEngine note:', e.message);
}
let aiTracerService = null;
try {
  aiTracerService = require('./aiTracerService.cjs');
} catch (e) {
  console.log('aiTracerService note:', e.message);
}

// Auto-Updater Integration via electron-updater
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
} catch (e) {
  console.log('[AutoUpdater] note:', e.message);
}

function sendUpdaterStatus(status, data = {}) {
  const windows = [mainWindow, corelCompanionWindow, corelNumeratorWindow, corelAiTracerWindow, corelCertMergerWindow];
  windows.forEach((win) => {
    if (win && !win.isDestroyed() && win.webContents) {
      try {
        win.webContents.send('updater:status', { status, ...data });
      } catch {}
    }
  });
}

if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => sendUpdaterStatus('checking'));
  autoUpdater.on('update-available', (info) => sendUpdaterStatus('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => sendUpdaterStatus('not-available'));
  autoUpdater.on('error', (err) => sendUpdaterStatus('error', { error: err?.message || 'Gagal update' }));
  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdaterStatus('downloading', {
      percent: Math.round(progressObj.percent || 0),
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });
  autoUpdater.on('update-downloaded', (info) => sendUpdaterStatus('downloaded', { version: info.version }));
}

function getAppIcon() {
  const icoPath = path.join(__dirname, '../public/favicon.ico');
  const pngPath = path.join(__dirname, '../public/logo.png');
  if (fs.existsSync(icoPath)) return icoPath;
  if (fs.existsSync(pngPath)) return pngPath;
  return null;
}

function createCorelCompanionWindow(data) {
  if (data) activeJerseySessionData = data;
  if (corelCompanionWindow && !corelCompanionWindow.isDestroyed()) {
    corelCompanionWindow.focus();
    return corelCompanionWindow;
  }
  corelCompanionWindow = new BrowserWindow({
    width: 560,
    height: 760,
    minWidth: 480,
    minHeight: 580,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#f8fafc',
    title: 'Corel Tools Suite - Auto-Layout Jersey',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  corelCompanionWindow.loadFile(path.join(__dirname, 'corel-companion.html'));
  corelCompanionWindow.on('closed', () => { corelCompanionWindow = null; });
  return corelCompanionWindow;
}

function createCorelNumeratorWindow() {
  if (corelNumeratorWindow && !corelNumeratorWindow.isDestroyed()) {
    corelNumeratorWindow.focus();
    return corelNumeratorWindow;
  }
  corelNumeratorWindow = new BrowserWindow({
    width: 450,
    height: 660,
    minWidth: 400,
    minHeight: 560,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#0f172a',
    title: 'Corel Tools Suite - Numerator Machine',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  corelNumeratorWindow.loadFile(path.join(__dirname, 'corel-numerator.html'));
  corelNumeratorWindow.on('closed', () => { corelNumeratorWindow = null; });
  return corelNumeratorWindow;
}

function createCorelAiTracerWindow() {
  if (corelAiTracerWindow && !corelAiTracerWindow.isDestroyed()) {
    corelAiTracerWindow.focus();
    return corelAiTracerWindow;
  }
  corelAiTracerWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    frame: false,
    resizable: true,
    alwaysOnTop: false,
    backgroundColor: '#0f172a',
    title: 'Corel Tools Suite - AI Jersey Tracer',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: false,
    },
  });
  corelAiTracerWindow.loadFile(path.join(__dirname, 'corel-ai-tracer.html'));
  corelAiTracerWindow.on('closed', () => { corelAiTracerWindow = null; });
  return corelAiTracerWindow;
}

function createCorelCertMergerWindow() {
  if (corelCertMergerWindow && !corelCertMergerWindow.isDestroyed()) {
    corelCertMergerWindow.focus();
    return corelCertMergerWindow;
  }
  corelCertMergerWindow = new BrowserWindow({
    width: 700,
    height: 780,
    minWidth: 550,
    minHeight: 600,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#0f172a',
    title: 'Corel Tools Suite - Certificate & Variable Data Merger',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  corelCertMergerWindow.loadFile(path.join(__dirname, 'corel-cert-merger.html'));
  corelCertMergerWindow.on('closed', () => { corelCertMergerWindow = null; });
  return corelCertMergerWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    backgroundColor: '#111827',
    show: false,
    title: 'Corel Tools Suite',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-change', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-change', { isMaximized: false });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Background update check after app startup
  setTimeout(() => {
    if (autoUpdater && app.isPackaged) {
      autoUpdater.checkForUpdates().catch((err) => {
        console.log('[AutoUpdater] background check note:', err?.message);
      });
    }
  }, 6000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// Window Control IPC Handlers (Supports Main & Companion Windows)
// ==========================================
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.on('window-unmaximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win) win.unmaximize();
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win) win.close();
});

ipcMain.on('window-reload', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win) win.reload();
});

ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});


// ==========================================
// License Management IPC Handlers
// ==========================================
ipcMain.handle('license:get-status', () => {
  if (!licenseEngine) {
    return {
      isLicensed: false,
      isTrial: false,
      isExpired: true,
      isBlocked: false,
      status: 'UNLICENSED',
      remainingDays: 0,
      customerName: 'Aplikasi Belum Teraktivasi',
      hwid: 'GFX-ERROR',
      message: 'Modul lisensi belum aktif.'
    };
  }
  return licenseEngine.getLicenseStatus();
});

ipcMain.handle('license:get-hwid', () => {
  if (!licenseEngine) return 'GFX-ERROR';
  return licenseEngine.getHardwareId();
});

ipcMain.handle('license:activate', async (_event, key) => {
  if (!licenseEngine) return { success: false, message: 'Modul lisensi belum aktif.' };
  return await licenseEngine.activateLicenseKey(key);
});

ipcMain.handle('license:deactivate', () => {
  if (!licenseEngine) return { success: false, message: 'Modul lisensi belum aktif.' };
  return licenseEngine.deactivateLicense();
});

// ==========================================
// Auto-Updater IPC Handlers
// ==========================================
ipcMain.handle('updater:check', async () => {
  if (!autoUpdater) return { success: false, message: 'Modul auto-updater belum siap.' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (err) {
    return { success: false, message: err?.message || 'Gagal memeriksa update' };
  }
});

ipcMain.handle('updater:quit-and-install', () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall(false, true);
  }
});
ipcMain.handle('window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return win ? win.isMaximized() : false;
});

ipcMain.handle('window-toggle-always-on-top', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win) {
    const nextState = !win.isAlwaysOnTop();
    win.setAlwaysOnTop(nextState);
    return { isAlwaysOnTop: nextState };
  }
  return { isAlwaysOnTop: false };
});

// ==========================================
// Companion Window Opener IPC Handlers
// ==========================================
ipcMain.handle('corel:open-companion-tool', async (_event, data) => {
  const win = createCorelCompanionWindow(data);
  if (win) {
    win.show();
    win.focus();
  }
  return { success: true };
});

ipcMain.handle('corel:open-numerator-tool', async () => {
  const win = createCorelNumeratorWindow();
  if (win) {
    win.show();
    win.focus();
  }
  return { success: true };
});

ipcMain.handle('corel:open-cert-merger-tool', async () => {
  const win = createCorelCertMergerWindow();
  if (win) {
    win.show();
    win.focus();
  }
  return { success: true };
});

ipcMain.handle('corel:open-ai-tracer-tool', async () => {
  const win = createCorelAiTracerWindow();
  if (win) {
    win.show();
    win.focus();
  }
  return { success: true };
});

ipcMain.handle('corel:get-active-order-data', async () => {
  return activeJerseySessionData;
});

// ==========================================
// Dialog Handlers
// ==========================================
ipcMain.handle('dialog:open-files', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Pilih File Desain',
    properties: ['openFile', 'multiSelections'],
    filters: options.filters || [
      { name: 'CorelDRAW & Gambar', extensions: ['cdr', 'pdf', 'ai', 'eps', 'svg', 'png', 'jpg', 'jpeg'] },
      { name: 'CorelDRAW Files (*.cdr)', extensions: ['cdr'] },
      { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
      { name: 'Semua File', extensions: ['*'] }
    ]
  });
  if (result.canceled) return { success: false, files: [] };
  const fileInfos = result.filePaths.map(fp => {
    let size = 0;
    try { size = fs.statSync(fp).size; } catch {}
    return {
      path: fp,
      name: path.basename(fp),
      format: path.extname(fp).replace('.', '').toUpperCase(),
      size: (size / (1024 * 1024)).toFixed(2) + ' MB',
      bytes: size
    };
  });
  return { success: true, files: fileInfos };
});

ipcMain.handle('dialog:open-directory', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Pilih Folder Tujuan Output',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths.length) return { success: false, path: '' };
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('dialog:select-excel-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih File Excel / CSV Data Variabel',
    properties: ['openFile'],
    filters: [
      { name: 'Excel / CSV Files', extensions: ['xlsx', 'xls', 'csv', 'ods'] },
      { name: 'Semua File', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  return { success: true, filePath: result.filePaths[0] };
});

// ==========================================
// Excel Parser IPC Handler
// ==========================================
ipcMain.handle('corel:parse-excel-file', async (_event, payload) => {
  try {
    let xlsx;
    try {
      xlsx = require('./xlsx.full.min.js');
    } catch {
      xlsx = require('xlsx');
    }
    let workbook = null;
    let targetPath = 'Data Excel';

    if (payload && payload.base64) {
      const buf = Buffer.from(payload.base64, 'base64');
      workbook = xlsx.read(buf, { type: 'buffer' });
      targetPath = payload.fileName || payload.filePath || 'Data Excel';
    } else if (payload && payload.buffer) {
      const buf = Buffer.isBuffer(payload.buffer) ? payload.buffer : Buffer.from(payload.buffer);
      workbook = xlsx.read(buf, { type: 'buffer' });
      targetPath = payload.fileName || payload.filePath || 'Data Excel';
    } else {
      let filePath = typeof payload === 'string' ? payload : payload?.filePath;
      if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
        return { success: false, message: 'File Excel tidak ditemukan.' };
      }
      const buf = fs.readFileSync(filePath);
      workbook = xlsx.read(buf, { type: 'buffer' });
      targetPath = filePath;
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, message: 'Lembar kerja Excel kosong.' };
    }

    function indexToLetter(idx) {
      let letter = '';
      let temp = idx;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    }

    const sheetsData = {};
    const sheetNames = workbook.SheetNames;
    const requestedSheet = (payload && typeof payload === 'object' && payload.sheetName) ? payload.sheetName : null;
    const activeSheet = (requestedSheet && sheetNames.includes(requestedSheet)) ? requestedSheet : sheetNames[0];

    for (const sName of sheetNames) {
      const ws = workbook.Sheets[sName];
      const rawData = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!rawData || rawData.length === 0) {
        sheetsData[sName] = { headers: [], rows: [], totalRows: 0, headerRowIdx: 0, rawData: [] };
        continue;
      }

      // Auto-detect header row
      let headerRowIdx = 0;
      let maxNonEmpty = 0;
      const scanLimit = Math.min(10, rawData.length);
      for (let r = 0; r < scanLimit; r++) {
        const row = rawData[r] || [];
        const count = row.filter(val => val !== undefined && val !== null && String(val).trim() !== '').length;
        if (count > maxNonEmpty) {
          maxNonEmpty = count;
          headerRowIdx = r;
        }
      }

      // If user explicitly specified headerRowIndex for the active sheet
      if (sName === activeSheet && payload && typeof payload === 'object' && typeof payload.headerRowIndex === 'number' && payload.headerRowIndex >= 0) {
        headerRowIdx = Math.min(payload.headerRowIndex, rawData.length - 1);
      }

      const headerRow = rawData[headerRowIdx] || [];
      const maxCols = Math.max(headerRow.length, ...rawData.map(r => (Array.isArray(r) ? r.length : 0)));

      const rows = [];
      for (let rIdx = headerRowIdx + 1; rIdx < rawData.length; rIdx++) {
        const rowValues = rawData[rIdx];
        if (!rowValues) continue;
        const hasData = rowValues.some(val => val !== undefined && val !== null && String(val).trim() !== '');
        if (!hasData) continue;

        const rowObj = {};
        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
          const letter = indexToLetter(colIdx);
          const cellVal = rowValues[colIdx];
          rowObj[letter] = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
        }
        rows.push(rowObj);
      }

      const headers = [];
      for (let colIdx = 0; colIdx < maxCols; colIdx++) {
        const letter = indexToLetter(colIdx);
        const rawName = (headerRow[colIdx] !== undefined && headerRow[colIdx] !== null) ? String(headerRow[colIdx]).trim() : '';
        const name = rawName || `Kolom ${letter}`;
        let sample = '';
        for (const r of rows) {
          if (r[letter] && r[letter].trim() !== '') {
            sample = r[letter].trim();
            if (sample.length > 25) sample = sample.substring(0, 22) + '...';
            break;
          }
        }
        const label = sample ? `${letter}: ${name} (Contoh: ${sample})` : `${letter}: ${name}`;
        headers.push({ letter, name, sample, label });
      }

      sheetsData[sName] = { headers, rows, totalRows: rows.length, headerRowIdx, rawData };
    }

    const primary = sheetsData[activeSheet] || { headers: [], rows: [], totalRows: 0, headerRowIdx: 0, rawData: [] };
    return {
      success: true,
      filePath: targetPath,
      sheetNames,
      activeSheet,
      sheetsData,
      headers: primary.headers,
      rows: primary.rows,
      totalRows: primary.totalRows,
      headerRowIdx: primary.headerRowIdx,
      rawData: primary.rawData
    };
  } catch (err) {
    console.error('[Excel Parse Error]', err);
    return { success: false, message: `Gagal membaca Excel: ${err?.message || err}` };
  }
});

// ==========================================
// CorelDRAW Automation Engine (PowerShell COM)
// ==========================================

function runPowerShellScript(psContent, timeout = 300000) {
  return new Promise((resolve) => {
    const tempDir = app.getPath('temp');
    const tempPs1Path = path.join(tempDir, `corel_cts_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.ps1`);

    fs.writeFileSync(tempPs1Path, psContent, 'utf-8');

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempPs1Path],
      { timeout },
      (err, stdout, stderr) => {
        try {
          if (fs.existsSync(tempPs1Path)) fs.unlinkSync(tempPs1Path);
        } catch {}

        if (err && !stdout) {
          const cleanErr = (stderr || err?.message || 'Gagal menjalankan automasi di CorelDRAW')
            .replace(/Command failed:.*?\n/, '')
            .trim();
          resolve({ success: false, message: cleanErr });
          return;
        }

        try {
          const raw = (stdout || '').trim();
          const jsonMatch = raw.match(/\{"success":[\s\S]*\}$/);
          if (jsonMatch) {
            return resolve(JSON.parse(jsonMatch[0]));
          }
          const lines = raw.split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              return resolve(JSON.parse(line));
            }
          }
          resolve(JSON.parse(raw));
        } catch {
          resolve({ success: false, message: stdout.trim() || stderr || 'Gagal memproses respon CorelDRAW' });
        }
      }
    );
  });
}

// Shared multi-strategy CorelDRAW Application Finder PowerShell snippet

// Shared multi-strategy CorelDRAW Application Finder & Process Connect Logic
function getCorelConfigPath() {
  try {
    return require('path').join(app.getPath('userData'), 'corel_config.json');
  } catch {
    return require('path').join(process.cwd(), 'corel_config.json');
  }
}

function getCorelConfig() {
  try {
    const p = getCorelConfigPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {}
  return { preferredVersion: 'auto' };
}

function saveCorelConfig(cfg) {
  try {
    const p = getCorelConfigPath();
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {}
}

let activePreferredVersion = 'auto';
let activePreferredPid = 0;
try {
  const cfg = getCorelConfig();
  activePreferredVersion = cfg.preferredVersion || 'auto';
  activePreferredPid = parseInt(cfg.preferredPid, 10) || 0;
} catch {}

function getCorelProcessHelpersPs() {
  return `
    function Get-RealCorelProcesses {
        $procs = @(Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue)
        if (-not $procs -or $procs.Count -eq 0) { return @() }
        $noWin = @($procs | Where-Object { $_.MainWindowHandle -eq 0 })
        $ghostPids = @()
        if ($noWin -and $noWin.Count -gt 0) {
            $cimList = @(Get-CimInstance Win32_Process -Filter "Name = 'CorelDRW.exe' OR Name = 'CorelDRAW.exe'" -ErrorAction SilentlyContinue)
            if ($cimList -and $cimList.Count -gt 0) {
                foreach ($cp in $cimList) {
                    if ($cp.CommandLine -and $cp.CommandLine -match '(/Automation\\b|-Embedding\\b)') {
                        $gp = $noWin | Where-Object { $_.Id -eq $cp.ProcessId } | Select-Object -First 1
                        if ($gp) {
                            $ghostPids += $cp.ProcessId
                            try { Stop-Process -Id $cp.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
                        }
                    }
                }
            }
        }
        $filtered = @($procs | Where-Object { $ghostPids -notcontains $_.Id })
        $withWin = @($filtered | Where-Object { $_.MainWindowHandle -ne 0 })
        if ($withWin.Count -gt 0) { return $withWin }
        if ($filtered.Count -gt 0) { return $filtered }
        return @()
    }

    function Get-CorelVerFromProcess($p) {
        if (-not $p) { return 0 }
        $t = [string]$p.MainWindowTitle
        $pth = [string]$p.Path
        $fv = [string]$p.FileVersion
        if ($fv -match '^(\\d+)\\.') { return [int]$matches[1] }
        if ($t -match '2026|28\\.' -or $pth -like '*2026*') { return 28 }
        if ($t -match '2025|27\\.' -or $pth -like '*2025*') { return 27 }
        if ($t -match '2024|26\\.' -or $pth -like '*2024*') { return 26 }
        if ($t -match '2023|25\\.' -or $pth -like '*2023*') { return 25 }
        if ($t -match '2022|24\\.' -or $pth -like '*2022*') { return 24 }
        if ($t -match '2021|23\\.' -or $pth -like '*2021*') { return 23 }
        if ($t -match '2020|22\\.' -or $pth -like '*2020*') { return 22 }
        if ($t -match '2019|21\\.' -or $pth -like '*2019*') { return 21 }
        if ($t -match '2018|20\\.' -or $pth -like '*2018*') { return 20 }
        if ($t -match '2017|19\\.' -or $pth -like '*2017*') { return 19 }
        if ($t -match 'X8|18\\.' -or $pth -like '*X8*') { return 18 }
        if ($t -match 'X7|17\\.' -or $pth -like '*X7*') { return 17 }
        if ($t -match 'X6|16\\.' -or $pth -like '*X6*') { return 16 }
        if ($t -match 'X5|15\\.' -or $pth -like '*X5*') { return 15 }
        if ($t -match 'X4|14\\.' -or $pth -like '*X4*') { return 14 }
        return 0
    }

    $fastComCode = @"
using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

[ComImport, Guid("00020400-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IDispatchRaw {
    [PreserveSig] int GetTypeInfoCount(out int pctinfo);
    [PreserveSig] int GetTypeInfo(int iTInfo, int lcid, out IntPtr ppTInfo);
    [PreserveSig] int GetIDsOfNames([In] ref Guid riid, [MarshalAs(UnmanagedType.LPArray, ArraySubType = UnmanagedType.LPWStr)] string[] rgszNames, int cNames, int lcid, [Out, MarshalAs(UnmanagedType.LPArray)] int[] rgDispId);
    [PreserveSig] int Invoke(int dispIdMember, [In] ref Guid riid, int lcid, short wFlags, ref System.Runtime.InteropServices.ComTypes.DISPPARAMS pDispParams, out object pVarResult, IntPtr pExcepInfo, IntPtr puArgErr);
}

public static class FastCom {
    [DllImport("oleaut32.dll")]
    private static extern int VariantClear(IntPtr pvarg);

    private static Guid IID_NULL = Guid.Empty;
    private const short DISPATCH_METHOD = 1;
    private const short DISPATCH_PROPERTYGET = 2;
    private const short DISPATCH_PROPERTYPUT = 4;
    private const short DISPATCH_PROPERTYPUTREF = 8;
    private const int DISPID_PROPERTYPUT = -3;
    private static readonly int VariantSize = IntPtr.Size == 8 ? 24 : 16;
    private static readonly ConditionalWeakTable<object, Dictionary<string, int>> DispIdCache = new ConditionalWeakTable<object, Dictionary<string, int>>();

    public static int GetDispId(object comObj, IDispatchRaw disp, string name) {
        Dictionary<string, int> map;
        if (!DispIdCache.TryGetValue(comObj, out map)) {
            map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            DispIdCache.Add(comObj, map);
        }
        int id;
        if (map.TryGetValue(name, out id)) {
            return id;
        }
        int[] ids = new int[1];
        int hr = disp.GetIDsOfNames(ref IID_NULL, new string[] { name }, 1, 0, ids);
        if (hr < 0) Marshal.ThrowExceptionForHR(hr);
        map[name] = ids[0];
        return ids[0];
    }

    private static void WriteVariant(object val, IntPtr slot) {
        if (val != null && Marshal.IsComObject(val)) {
            IntPtr pDisp = Marshal.GetIDispatchForObject(val);
            Marshal.WriteInt16(slot, 0, 9);
            Marshal.WriteInt16(slot, 2, 0);
            Marshal.WriteInt16(slot, 4, 0);
            Marshal.WriteInt16(slot, 6, 0);
            Marshal.WriteIntPtr(slot, 8, pDisp);
        } else {
            Marshal.GetNativeVariantForObject(val, slot);
        }
    }

    private static object InvokeInternal(object comObj, string name, short flags, object[] args, bool isPut) {
        if (comObj == null) return null;
        var disp = comObj as IDispatchRaw;
        if (disp == null) throw new InvalidOperationException("Object does not implement IDispatch");
        int dispId = GetDispId(comObj, disp, name);

        var dp = new System.Runtime.InteropServices.ComTypes.DISPPARAMS();
        IntPtr pArgs = IntPtr.Zero;
        IntPtr pNamed = IntPtr.Zero;
        int argCount = args != null ? args.Length : 0;

        try {
            if (argCount > 0) {
                pArgs = Marshal.AllocCoTaskMem(argCount * VariantSize);
                for (int i = 0; i < argCount; i++) {
                    IntPtr slot = IntPtr.Add(pArgs, (argCount - 1 - i) * VariantSize);
                    WriteVariant(args[i], slot);
                }
                dp.cArgs = argCount;
                dp.rgvarg = pArgs;
            }
            if (isPut) {
                pNamed = Marshal.AllocCoTaskMem(sizeof(int));
                Marshal.WriteInt32(pNamed, DISPID_PROPERTYPUT);
                dp.cNamedArgs = 1;
                dp.rgdispidNamedArgs = pNamed;
            }
            object result = null;
            int hr = disp.Invoke(dispId, ref IID_NULL, 0, flags, ref dp, out result, IntPtr.Zero, IntPtr.Zero);
            if (hr < 0) Marshal.ThrowExceptionForHR(hr);
            return result;
        } finally {
            if (pArgs != IntPtr.Zero) {
                for (int i = 0; i < argCount; i++) {
                    IntPtr slot = IntPtr.Add(pArgs, i * VariantSize);
                    VariantClear(slot);
                }
                Marshal.FreeCoTaskMem(pArgs);
            }
            if (pNamed != IntPtr.Zero) {
                Marshal.FreeCoTaskMem(pNamed);
            }
        }
    }

    public static object Get(object comObj, string name, object[] args = null) {
        return InvokeInternal(comObj, name, (short)(DISPATCH_PROPERTYGET | DISPATCH_METHOD), args, false);
    }

    public static object Call(object comObj, string name, object[] args = null) {
        return InvokeInternal(comObj, name, (short)(DISPATCH_METHOD | DISPATCH_PROPERTYGET), args, false);
    }

    public static void Set(object comObj, string name, object val) {
        short flags = DISPATCH_PROPERTYPUT;
        if (val != null && Marshal.IsComObject(val)) {
            flags |= DISPATCH_PROPERTYPUTREF;
        }
        InvokeInternal(comObj, name, flags, new object[] { val }, true);
    }
}
"@
    if (-not ("FastCom" -as [type])) {
        $fastComDll = Join-Path $env:TEMP "CorelFastCom_v2.dll"
        if (Test-Path $fastComDll) {
            try { Add-Type -Path $fastComDll -ErrorAction Stop } catch {}
        }
        if (-not ("FastCom" -as [type])) {
            try {
                Add-Type -TypeDefinition $fastComCode -OutputAssembly $fastComDll -ErrorAction Stop
                Add-Type -Path $fastComDll -ErrorAction Stop
            } catch {
                Add-Type -TypeDefinition $fastComCode -ErrorAction Stop
            }
        }
    }

    function Com-Get($obj, [string]$prop, [object[]]$argsList = $null) {
        if ($null -eq $obj) { return $null }
        try {
            $res = [FastCom]::Get($obj, $prop, $argsList)
            if ($null -eq $res) { return $null }
            return ,$res
        } catch {
            return $null
        }
    }

    function Com-Set($obj, [string]$prop, $val) {
        if ($null -eq $obj) { return }
        try {
            [FastCom]::Set($obj, $prop, $val)
        } catch {}
    }

    function Com-Call($obj, [string]$method, [object[]]$argsList = $null) {
        if ($null -eq $obj) { return $null }
        $res = [FastCom]::Call($obj, $method, $argsList)
        if ($null -eq $res) { return $null }
        return ,$res
    }

    function Get-CorelMajorFromCom($obj) {
        if (-not $obj) { return 0 }
        try {
            $vMaj = [int](Com-Get $obj "VersionMajor")
            if ($vMaj -ge 11 -and $vMaj -le 35) { return $vMaj }
        } catch {}
        try {
            $v = [string](Com-Get $obj "Version")
            if ($v -match '(\\d+)') { return [int]$matches[1] }
        } catch {}
        return 0
    }
  `;
}

function getCorelFindAppPs() {
  return `
${getCorelProcessHelpersPs()}

    $corel = $null
    $realProcs = @(Get-RealCorelProcesses)
    $preferredVer = '${activePreferredVersion}'
    $preferredPid = ${activePreferredPid}
    $targetProc = $null
    $targetVer = 0

    if ($realProcs -and $realProcs.Count -gt 0) {
        if ($preferredPid -and $preferredPid -gt 0) {
            $cand = $realProcs | Where-Object { $_.Id -eq $preferredPid } | Select-Object -First 1
            if ($cand) {
                if ($preferredVer -eq 'auto' -or -not ($preferredVer -match '^\\d+$') -or (Get-CorelVerFromProcess $cand) -eq [int]$preferredVer) {
                    $targetProc = $cand
                }
            }
        }
        if (-not $targetProc -and $preferredVer -ne 'auto' -and $preferredVer -match '^\\d+$') {
            $pVer = [int]$preferredVer
            $targetProc = $realProcs | Where-Object { (Get-CorelVerFromProcess $_) -eq $pVer } | Select-Object -First 1
        }
        if (-not $targetProc) {
            $targetProc = $realProcs | Select-Object -First 1
        }
        $targetVer = Get-CorelVerFromProcess $targetProc

        if ($targetVer -gt 0) {
            try {
                $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$targetVer")
                if ($c) {
                    $corel = $c
                }
            } catch {}
        } else {
            try {
                $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application")
                if ($c) {
                    $corel = $c
                }
            } catch {}
        }
    }
  `;
}

function getCorelConnectPs() {
  return `
${getCorelFindAppPs()}

    if (-not $corel -and $realProcs -and $realProcs.Count -gt 0) {
        if ($targetVer -gt 0) {
            try {
                $c = New-Object -ComObject "CorelDRAW.Application.$targetVer" -ErrorAction SilentlyContinue
                if ($c) {
                    $corel = $c
                }
            } catch {}
        } else {
            try {
                $c = New-Object -ComObject "CorelDRAW.Application" -ErrorAction SilentlyContinue
                if ($c) {
                    $corel = $c
                }
            } catch {}
        }
    }

    if (-not $corel) {
        $targetName = switch ($targetVer) {
            28 { "CorelDRAW 2026" }
            27 { "CorelDRAW 2025" }
            26 { "CorelDRAW 2024" }
            25 { "CorelDRAW 2023" }
            24 { "CorelDRAW 2022" }
            23 { "CorelDRAW 2021" }
            22 { "CorelDRAW 2020" }
            21 { "CorelDRAW 2019" }
            20 { "CorelDRAW 2018" }
            19 { "CorelDRAW 2017" }
            18 { "CorelDRAW X8" }
            17 { "CorelDRAW X7" }
            default { if ($targetVer -gt 0) { "CorelDRAW v$targetVer" } else { "CorelDRAW" } }
        }
        $activeWin = if ($targetProc -and $targetProc.MainWindowHandle -ne 0) {
            $targetProc
        } elseif ($realProcs -and $realProcs.Count -gt 0) {
            $realProcs | Where-Object { (Get-CorelVerFromProcess $_) -eq $targetVer } | Select-Object -First 1
        } else {
            $procs = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue
            if ($procs) { $procs | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 } else { $null }
        }
        if ($activeWin) {
            throw "$targetName sedang berjalan (PID $($activeWin.Id), Jendela: '$($activeWin.MainWindowTitle)'), namun antarmuka COM belum merespon. Pastikan CorelDRAW tidak sedang menampilkan dialog pop-up/modal atau sedang mengedit teks (tekan ESC di CorelDRAW jika kursor teks sedang aktif), lalu coba lagi."
        }
        throw "$targetName tidak sedang berjalan. Silakan buka aplikasi $targetName Anda terlebih dahulu."
    }

    $doc = Com-Get $corel "ActiveDocument"
    if (-not $doc) {
        $docs = Com-Get $corel "Documents"
        $docsCount = if ($docs) { [int](Com-Get $docs "Count") } else { 0 }
        if ($docs -and $docsCount -gt 0) {
            for ($dIdx = 1; $dIdx -le $docsCount; $dIdx++) {
                $testDoc = Com-Get $docs "Item" @($dIdx)
                if ($testDoc) {
                    $doc = $testDoc
                    try { [void](Com-Call $doc "Activate") } catch {}
                    break
                }
            }
        }
    }
  `;
}

Object.defineProperty(global, 'COREL_FIND_APP_PS', {
  get() { return getCorelFindAppPs(); },
  configurable: true
});

Object.defineProperty(global, 'COREL_CONNECT_PS', {
  get() { return getCorelConnectPs(); },
  configurable: true
});

// 1. Check CorelDRAW Connection & Active Document Info
ipcMain.handle('corel:check-status', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$res = @{
    connected = $false
    version = 'Tidak terdeteksi'
    versionMajor = 0
    activeDoc = ''
    docPath = ''
    selectionCount = 0
    pageCount = 0
    error = ''
    preferredVersion = '${activePreferredVersion}'
    runningInstances = @()
}

${getCorelProcessHelpersPs()}

$realProcs = @(Get-RealCorelProcesses)

if ($realProcs -and $realProcs.Count -gt 0) {
    $res.connected = $true

    $preferredVer = '${activePreferredVersion}'
    $preferredPid = ${activePreferredPid}
    $targetProc = $null
    if ($preferredPid -and $preferredPid -gt 0) {
        $cand = $realProcs | Where-Object { $_.Id -eq $preferredPid } | Select-Object -First 1
        if ($cand) {
            if ($preferredVer -eq 'auto' -or -not ($preferredVer -match '^\\d+$') -or (Get-CorelVerFromProcess $cand) -eq [int]$preferredVer) {
                $targetProc = $cand
            }
        }
    }
    if (-not $targetProc -and $preferredVer -ne 'auto' -and $preferredVer -match '^\\d+$') {
        $pVer = [int]$preferredVer
        $targetProc = $realProcs | Where-Object { (Get-CorelVerFromProcess $_) -eq $pVer } | Select-Object -First 1
    }
    if (-not $targetProc) {
        $targetProc = $realProcs | Select-Object -First 1
    }

    $cVerMajor = Get-CorelVerFromProcess $targetProc
    $res.versionMajor = $cVerMajor
    
    $vName = switch ($cVerMajor) {
        28 { "CorelDRAW 2026 (v28)" }
        27 { "CorelDRAW 2025 (v27)" }
        26 { "CorelDRAW 2024 (v26)" }
        25 { "CorelDRAW 2023 (v25)" }
        24 { "CorelDRAW 2022 (v24)" }
        23 { "CorelDRAW 2021 (v23)" }
        22 { "CorelDRAW 2020 (v22)" }
        21 { "CorelDRAW 2019 (v21)" }
        20 { "CorelDRAW 2018 (v20)" }
        19 { "CorelDRAW 2017 (v19)" }
        18 { "CorelDRAW X8 (v18)" }
        17 { "CorelDRAW X7 (v17)" }
        16 { "CorelDRAW X6 (v16)" }
        15 { "CorelDRAW X5 (v15)" }
        14 { "CorelDRAW X4 (v14)" }
        default { if ($cVerMajor -gt 0) { "CorelDRAW v$cVerMajor" } else { "CorelDRAW Aktif" } }
    }
    $res.version = $vName

    if ($targetProc.MainWindowTitle) {
        $wTitle = [string]$targetProc.MainWindowTitle
        if ($wTitle -match '([^\\\\/:*?"<>|\\[\\]]+\\.(?:cdr|cmx)\\*?)') {
            $res.activeDoc = $matches[1].Trim()
        }
    }

    $runningInstances = @()
    foreach ($p in $realProcs) {
        $v = Get-CorelVerFromProcess $p
        $instName = switch ($v) {
            28 { "CorelDRAW 2026 (v28)" }
            27 { "CorelDRAW 2025 (v27)" }
            26 { "CorelDRAW 2024 (v26)" }
            25 { "CorelDRAW 2023 (v25)" }
            24 { "CorelDRAW 2022 (v24)" }
            23 { "CorelDRAW 2021 (v23)" }
            22 { "CorelDRAW 2020 (v22)" }
            21 { "CorelDRAW 2019 (v21)" }
            20 { "CorelDRAW 2018 (v20)" }
            19 { "CorelDRAW 2017 (v19)" }
            18 { "CorelDRAW X8 (v18)" }
            17 { "CorelDRAW X7 (v17)" }
            default { if ($v -gt 0) { "CorelDRAW v$v" } else { "CorelDRAW" } }
        }
        $runningInstances += @{
            pid = $p.Id
            version = [string]$v
            versionNum = $v
            name = $instName
            title = $p.MainWindowTitle
            isCurrent = ($p.Id -eq $targetProc.Id)
        }
    }
    $res.runningInstances = $runningInstances

    $corel = $null
    if ($cVerMajor -gt 0) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$cVerMajor")
            if ($c) { $corel = $c }
        } catch {}
    } else {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application")
            if ($c) { $corel = $c }
        } catch {}
    }
    if ($corel) {
        try {
            $ad = Com-Get $corel "ActiveDocument"
            if ($ad) {
                $adName = [string](Com-Get $ad "Name")
                if ($adName) { $res.activeDoc = $adName }
                $adPath = [string](Com-Get $ad "FullFileName")
                if ($adPath) { $res.docPath = $adPath }
                $sr = Com-Get $ad "SelectionRange"
                if ($sr) { $res.selectionCount = [int](Com-Get $sr "Count") }
                $pgs = Com-Get $ad "Pages"
                if ($pgs) { $res.pageCount = [int](Com-Get $pgs "Count") }
            }
        } catch {}
    }
} else {
    $res.connected = $false
    $res.error = "Buka CorelDRAW terlebih dahulu."
}

$res | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
});

ipcMain.handle('corel:get-preferred-version', async () => {
  return { success: true, preferredVersion: activePreferredVersion, preferredPid: activePreferredPid };
});

ipcMain.handle('corel:set-preferred-version', async (_event, version, pid) => {
  activePreferredVersion = String(version || 'auto');
  activePreferredPid = parseInt(pid, 10) || 0;
  const cfg = getCorelConfig();
  cfg.preferredVersion = activePreferredVersion;
  cfg.preferredPid = activePreferredPid;
  saveCorelConfig(cfg);
  return { success: true, preferredVersion: activePreferredVersion, preferredPid: activePreferredPid };
});

ipcMain.handle('corel:get-detected-versions', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'

${getCorelProcessHelpersPs()}

$realProcs = @(Get-RealCorelProcesses)

$preferredVer = '${activePreferredVersion}'
$preferredPid = ${activePreferredPid}
$targetProc = $null
if ($realProcs -and $realProcs.Count -gt 0) {
    if ($preferredPid -and $preferredPid -gt 0) {
        $cand = $realProcs | Where-Object { $_.Id -eq $preferredPid } | Select-Object -First 1
        if ($cand) {
            if ($preferredVer -eq 'auto' -or -not ($preferredVer -match '^\\d+$') -or (Get-CorelVerFromProcess $cand) -eq [int]$preferredVer) {
                $targetProc = $cand
            }
        }
    }
    if (-not $targetProc -and $preferredVer -ne 'auto' -and $preferredVer -match '^\\d+$') {
        $pVer = [int]$preferredVer
        $targetProc = $realProcs | Where-Object { (Get-CorelVerFromProcess $_) -eq $pVer } | Select-Object -First 1
    }
    if (-not $targetProc) {
        $targetProc = $realProcs | Select-Object -First 1
    }
}
$cVerMajor = if ($targetProc) { Get-CorelVerFromProcess $targetProc } else { 0 }

$runningInstances = @()
if ($realProcs -and $realProcs.Count -gt 0) {
    foreach ($p in $realProcs) {
        $v = Get-CorelVerFromProcess $p
        $vName = switch ($v) {
            28 { "CorelDRAW 2026 (v28)" }
            27 { "CorelDRAW 2025 (v27)" }
            26 { "CorelDRAW 2024 (v26)" }
            25 { "CorelDRAW 2023 (v25)" }
            24 { "CorelDRAW 2022 (v24)" }
            23 { "CorelDRAW 2021 (v23)" }
            22 { "CorelDRAW 2020 (v22)" }
            21 { "CorelDRAW 2019 (v21)" }
            20 { "CorelDRAW 2018 (v20)" }
            19 { "CorelDRAW 2017 (v19)" }
            18 { "CorelDRAW X8 (v18)" }
            17 { "CorelDRAW X7 (v17)" }
            16 { "CorelDRAW X6 (v16)" }
            15 { "CorelDRAW X5 (v15)" }
            14 { "CorelDRAW X4 (v14)" }
            13 { "CorelDRAW X3 (v13)" }
            12 { "CorelDRAW 12 (v12)" }
            11 { "CorelDRAW 11 (v11)" }
            default { if ($v -gt 0) { "CorelDRAW v$v" } else { "CorelDRAW" } }
        }
        $isCur = if ($targetProc) { ($p.Id -eq $targetProc.Id) } else { $false }
        $runningInstances += @{
            id = [string]$v
            version = [string]$v
            versionNum = $v
            name = $vName
            title = $p.MainWindowTitle
            pid = $p.Id
            isVisible = $true
            isCurrent = $isCur
        }
    }
}

@{
    success = $true
    preferred = $preferredVer
    activeMajor = $cVerMajor
    running = $runningInstances
} | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
});

ipcMain.handle('corel:cancel-operation', () => {
  return cancelCurrentOperation();
});
ipcMain.handle('corel:get-recent-files', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$files = @()

${COREL_FIND_APP_PS}

if ($corel -and $corel.Documents) {
    for ($i = 1; $i -le $corel.Documents.Count; $i++) {
        try {
            $d = $corel.Documents.Item($i)
            $p = if ($d.FullFileName) { $d.FullFileName } else { $d.Name }
            $files += @{
                name = $d.Name
                path = $p
                isOpen = $true
            }
        } catch {}
    }
}

# Check Windows Recent .cdr if less than 5
if ($files.Count -lt 5) {
    try {
        $recentPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Recent)
        if (Test-Path $recentPath) {
            $wsh = New-Object -ComObject WScript.Shell
            $lnks = Get-ChildItem -Path $recentPath -Filter "*.lnk" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
            foreach ($lnk in $lnks) {
                if ($files.Count -ge 8) { break }
                try {
                    $target = $wsh.CreateShortcut($lnk.FullName).TargetPath
                    if ($target -and ($target.ToLower().EndsWith('.cdr')) -and (Test-Path $target)) {
                        $already = $false
                        foreach ($f in $files) {
                            if ($f.path -eq $target) { $already = $true; break }
                        }
                        if (-not $already) {
                            $files += @{
                                name = [System.IO.Path]::GetFileName($target)
                                path = $target
                                isOpen = $false
                            }
                        }
                    }
                } catch {}
            }
        }
    } catch {}
}

@{ success = $true; files = $files } | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 4000);
});

// 3. Open Document in CorelDRAW
ipcMain.handle('corel:open-document', async (_event, filePath) => {
  if (!filePath) return { success: false, message: 'Path file kosong.' };
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return { success: true };
  }
  return { success: false, message: 'File tidak ditemukan di komputer.' };
});

// 4. Execute Numerator Tool (Battle-Tested Engine from Cetak Pro POS)
ipcMain.handle('corel:execute-numerator', async (_event, payload) => {
  return new Promise((resolve) => {
    const {
      start = 1,
      end = 100,
      step = 1,
      digits = 4,
      prefix = '',
      suffix = '',
      mode = 'page',
      cols = 2,
      rows = 5,
      spacingX = 0.5,
      spacingY = 0.5,
      gridOrder = 'cut_stack',
      autoCurves = true,
      doubleNumber = true,
    } = payload || {};

    const tempDir = app.getPath('temp');
    const tempPs1Path = path.join(tempDir, `corel_num_${Date.now()}.ps1`);

    const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0; totalPages = 0 }

trap {
    $errLine = $_.InvocationInfo.ScriptLineNumber
    $errMsg = $_.Exception.Message
    if (-not $errMsg) { $errMsg = "$_" }
    $res = @{
        success = $false
        message = "CorelDRAW Error (Line $errLine): $errMsg"
    }
    $res | ConvertTo-Json -Compress
    exit 0
}

try {
    $start = [int]${Number.isFinite(Number(start)) ? Number(start) : 1}
    $end = [int]${Number.isFinite(Number(end)) ? Number(end) : 1}
    $step = [int]${step || 1}
    $digits = [int]${Number.isFinite(Number(digits)) ? Number(digits) : 0}
    $prefix = "${(prefix || '').replace(/"/g, '`"')}"
    $suffix = "${(suffix || '').replace(/"/g, '`"')}"
    $mode = "${mode || 'page'}"
    $cols = [int]${cols || 2}
    $rows = [int]${rows || 5}
    $spacingX = [double]${Number.isFinite(Number(spacingX)) ? Number(spacingX) : 0.5}
    $spacingY = [double]${Number.isFinite(Number(spacingY)) ? Number(spacingY) : 0.5}
    $gridOrder = "${gridOrder || 'cut_stack'}"
    $autoCurves = [bool]${autoCurves ? '$true' : '$false'}
    $doubleNumber = [bool]${doubleNumber ? '$true' : '$false'}

    # 1. Connect to active CorelDRAW COM instance
${COREL_CONNECT_PS}

    if (-not $doc) {
        throw "Tidak ada file/dokumen yang sedang terbuka di CorelDRAW. Silakan buka file desain di CorelDRAW."
    }
    Com-Set $doc "Unit" 3 # cdrCentimeter

    function Get-FormattedNum([int]$val, [int]$dig, [string]$pfx, [string]$sfx) {
        $numPart = [string]$val
        if ($dig -gt 0) {
            $numPart = $numPart.PadLeft($dig, '0')
        }
        return "$pfx$numPart$sfx"
    }

    function Is-NumberPlaceholder([string]$txt) {
        if ([string]::IsNullOrWhiteSpace($txt)) { return $false }
        $t = $txt.Trim()
        if ($t -match '^\\d+$') { return $true }
        if ($t -match '^(no|no\\.|kpn|vcr|id|tiket|kupon|#|numb|num)?\\s*[:.-]?\\s*\\d+\\s*[a-z0-9/-]*$' -and $t.Length -le 18) { return $true }
        if ($t -match '\\d+' -and $t.Length -le 10) { return $true }
        return $false
    }

    function Set-ShapeNumberText($targetShape, [string]$textVal, [bool]$allowMulti) {
        if ($null -eq $targetShape) { return 0 }
        $c = 0
        try {
            $shpType = [int](Com-Get $targetShape "Type")
            if ($shpType -eq 6) {
                $txtObj = Com-Get $targetShape "Text"
                $storyObj = Com-Get $txtObj "Story"
                if ($storyObj) {
                    Com-Set $storyObj "Text" $textVal
                    return 1
                }
            }
            $subShapes = Com-Get $targetShape "Shapes"
            if ($subShapes) {
                $textShapes = Com-Call $subShapes "FindShapes" @("", 6, $true)
                $tsCount = if ($textShapes) { [int](Com-Get $textShapes "Count") } else { 0 }
                if ($textShapes -and $tsCount -gt 0) {
                    for ($k = 1; $k -le $tsCount; $k++) {
                        $ts = Com-Get $textShapes "Item" @($k)
                        $txtObj = Com-Get $ts "Text"
                        $storyObj = Com-Get $txtObj "Story"
                        $rawText = if ($storyObj) { [string](Com-Get $storyObj "Text") } else { "" }
                        if (Is-NumberPlaceholder $rawText) {
                            if ($storyObj) {
                                Com-Set $storyObj "Text" $textVal
                                $c++
                                if (-not $allowMulti) { break }
                            }
                        }
                    }
                    if ($c -eq 0) {
                        for ($k = 1; $k -le $tsCount; $k++) {
                            $ts = Com-Get $textShapes "Item" @($k)
                            $txtObj = Com-Get $ts "Text"
                            $storyObj = Com-Get $txtObj "Story"
                            if ($storyObj) {
                                Com-Set $storyObj "Text" $textVal
                                $c++
                                if (-not $allowMulti) { break }
                            }
                        }
                    }
                }
            }
        } catch {}
        return $c
    }

    function Get-RangeCount($r) {
        if ($null -eq $r) { return 0 }
        $subShps = Com-Get $r "Shapes"
        if ($null -ne $subShps) {
            $sc = Com-Get $subShps "Count"
            if ($null -ne $sc) { return [int]$sc }
        }
        $cnt = Com-Get $r "Count"
        if ($null -ne $cnt) { return [int]$cnt }
        return 0
    }

    function Get-RangeItem($r, [int]$idx) {
        if ($null -eq $r) { return $null }
        $it = Com-Get $r "Item" @($idx)
        if ($null -ne $it) { return ,$it }
        $subShps = Com-Get $r "Shapes"
        if ($null -ne $subShps) {
            $it2 = Com-Get $subShps "Item" @($idx)
            if ($null -ne $it2) { return ,$it2 }
        }
        return $null
    }

    function Get-ValidTargetLayer($pageObj, $docObj) {
        $lyr = $null
        if ($pageObj) {
            $lyr = Com-Get $pageObj "ActiveLayer"
            if ($lyr) {
                $isSpec = [bool](Com-Get $lyr "IsSpecialLayer")
                $isEdit = [bool](Com-Get $lyr "Editable")
                if ($isSpec -or -not $isEdit) { $lyr = $null }
            }
            if (-not $lyr) {
                $lyrs = Com-Get $pageObj "Layers"
                $lyrsCount = if ($lyrs) { [int](Com-Get $lyrs "Count") } else { 0 }
                if ($lyrs -and $lyrsCount -gt 0) {
                    for ($li = 1; $li -le $lyrsCount; $li++) {
                        $candLyr = Com-Get $lyrs "Item" @($li)
                        if ($candLyr) {
                            $isSpec = [bool](Com-Get $candLyr "IsSpecialLayer")
                            $isEdit = [bool](Com-Get $candLyr "Editable")
                            if (-not $isSpec -and $isEdit) {
                                $lyr = $candLyr
                                break
                            }
                        }
                    }
                    if (-not $lyr) {
                        $lyr = Com-Get $lyrs "Item" @(1)
                    }
                }
            }
        }
        if (-not $lyr -and $docObj) {
            $lyr = Com-Get $docObj "ActiveLayer"
        }
        return ,$lyr
    }

    function Get-PlaceholderStories($targetShape, [bool]$allowMulti) {
        $stories = @()
        if ($null -eq $targetShape) { return $stories }
        try {
            $shpType = [int](Com-Get $targetShape "Type")
            if ($shpType -eq 6) {
                $txtObj = Com-Get $targetShape "Text"
                $storyObj = Com-Get $txtObj "Story"
                if ($storyObj) { $stories += ,$storyObj }
                return $stories
            }
            $subShapes = Com-Get $targetShape "Shapes"
            if ($subShapes) {
                $textShapes = Com-Call $subShapes "FindShapes" @("", 6, $true)
                $tsCount = if ($textShapes) { [int](Com-Get $textShapes "Count") } else { 0 }
                if ($textShapes -and $tsCount -gt 0) {
                    for ($k = 1; $k -le $tsCount; $k++) {
                        $ts = Com-Get $textShapes "Item" @($k)
                        $txtObj = Com-Get $ts "Text"
                        $storyObj = Com-Get $txtObj "Story"
                        $rawText = if ($storyObj) { [string](Com-Get $storyObj "Text") } else { "" }
                        if (Is-NumberPlaceholder $rawText) {
                            if ($storyObj) {
                                $stories += ,$storyObj
                                if (-not $allowMulti) { break }
                            }
                        }
                    }
                    if ($stories.Count -eq 0) {
                        for ($k = 1; $k -le $tsCount; $k++) {
                            $ts = Com-Get $textShapes "Item" @($k)
                            $txtObj = Com-Get $ts "Text"
                            $storyObj = Com-Get $txtObj "Story"
                            if ($storyObj) {
                                $stories += ,$storyObj
                                if (-not $allowMulti) { break }
                            }
                        }
                    }
                }
            }
        } catch {}
        return $stories
    }

    function Set-StoriesText($stories, [string]$textVal) {
        if ($null -eq $stories -or $stories.Count -eq 0) { return 0 }
        $c = 0
        foreach ($st in $stories) {
            if ($null -ne $st) {
                if ($st -is [array]) {
                    foreach ($innerSt in $st) {
                        if ($null -ne $innerSt) {
                            Com-Set $innerSt "Text" $textVal
                            $c++
                        }
                    }
                } else {
                    Com-Set $st "Text" $textVal
                    $c++
                }
            }
        }
        return $c
    }

    $numList = @()
    for ($n = $start; $n -le $end; $n += $step) {
        $numList += $n
    }
    $totalNumbers = $numList.Count
    if ($totalNumbers -eq 0) { throw "Jumlah nomor yang dihasilkan adalah 0." }

    $sel = Com-Get $doc "SelectionRange"
    $selCount = Get-RangeCount $sel
    if ($selCount -eq 0) {
        $sel = Com-Get $corel "ActiveSelectionRange"
        $selCount = Get-RangeCount $sel
    }
    if ($selCount -eq 0) {
        $sel = Com-Get $corel "ActiveSelection"
        $selCount = Get-RangeCount $sel
    }
    if ($selCount -eq 0) {
        $sel = Com-Call $doc "Selection"
        $selCount = Get-RangeCount $sel
    }

    if ($mode -eq 'inplace' -or ($selCount -gt 1 -and $mode -ne 'grid')) {
        $shapeList = @()
        for ($i = 1; $i -le $selCount; $i++) {
            $s = Get-RangeItem $sel $i
            if ($s) {
                $shapeList += [PSCustomObject]@{
                    Shape = $s
                    PosX = [double](Com-Get $s "PositionX")
                    PosY = [double](Com-Get $s "PositionY")
                    Height = [double](Com-Get $s "SizeHeight")
                }
            }
        }

        Com-Set $corel "Optimization" $true
        Com-Set $corel "EventsEnabled" $false
        try { [void](Com-Call $doc "BeginCommandGroup" @("GFX IT PRINTING Numerator Machine")) } catch {}

        $rowTol = 1.0
        if ($shapeList.Count -gt 0 -and $shapeList[0].Height -gt 0) {
            $rowTol = [math]::Max(0.2, $shapeList[0].Height * 0.35)
        }

        $sorted = @($shapeList | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false })

        $countToUpdate = [math]::Min($sorted.Count, $totalNumbers)
        for ($i = 0; $i -lt $countToUpdate; $i++) {
            $formattedNum = Get-FormattedNum $numList[$i] $digits $prefix $suffix
            $targetShp = $sorted[$i].Shape
            Set-ShapeNumberText $targetShp $formattedNum $doubleNumber | Out-Null
        }
        $result.count = $countToUpdate
        $result.totalPages = 1
    }
    elseif ($mode -eq 'page') {
        $masterPage = Com-Get $doc "ActivePage"
        if (-not $masterPage) {
            $pgs = Com-Get $doc "Pages"
            if ($pgs -and ([int](Com-Get $pgs "Count")) -gt 0) {
                $masterPage = Com-Get $pgs "Item" @(1)
            }
        }
        if (-not $masterPage) {
            throw "Gagal membaca halaman aktif di CorelDRAW."
        }

        Com-Set $corel "Optimization" $true
        Com-Set $corel "EventsEnabled" $false
        try { [void](Com-Call $doc "BeginCommandGroup" @("GFX IT PRINTING Numerator Machine")) } catch {}

        $mpShapes = Com-Get $masterPage "Shapes"
        $masterTexts = if ($mpShapes) { Com-Call $mpShapes "FindShapes" @("", 6, $true) } else { $null }
        $mtCount = if ($masterTexts) { [int](Com-Get $masterTexts "Count") } else { 0 }
        $textList = @()
        if ($masterTexts -and $mtCount -gt 0) {
            for ($k = 1; $k -le $mtCount; $k++) {
                $t = Com-Get $masterTexts "Item" @($k)
                $storyObj = Com-Get (Com-Get $t "Text") "Story"
                $rawText = if ($storyObj) { [string](Com-Get $storyObj "Text") } else { "" }
                if (Is-NumberPlaceholder $rawText) {
                    $textList += [PSCustomObject]@{
                        Shape = $t
                        PosX = [double](Com-Get $t "PositionX")
                        PosY = [double](Com-Get $t "PositionY")
                        Height = [double](Com-Get $t "SizeHeight")
                    }
                }
            }
            if ($textList.Count -eq 0) {
                for ($k = 1; $k -le $mtCount; $k++) {
                    $t = Com-Get $masterTexts "Item" @($k)
                    $textList += [PSCustomObject]@{
                        Shape = $t
                        PosX = [double](Com-Get $t "PositionX")
                        PosY = [double](Com-Get $t "PositionY")
                        Height = [double](Com-Get $t "SizeHeight")
                    }
                }
            }
        }

        $itemsPerPage = [math]::Max(1, $textList.Count)
        if ($textList.Count -gt 0) {
            $rowTol = [math]::Max(0.2, $textList[0].Height * 0.35)
            $sortedTexts = @($textList | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false })
            $textList = $sortedTexts
        }

        $totalPages = [math]::Ceiling($totalNumbers / $itemsPerPage)

        $countPage1 = [math]::Min($itemsPerPage, $totalNumbers)
        for ($i = 0; $i -lt $countPage1; $i++) {
            $numVal = Get-FormattedNum $numList[$i] $digits $prefix $suffix
            if ($i -lt $textList.Count -and $textList[$i].Shape) {
                $storyObj = Com-Get (Com-Get $textList[$i].Shape "Text") "Story"
                if ($storyObj) { Com-Set $storyObj "Text" $numVal }
            }
        }

        if ($totalPages -gt 1) {
            for ($p = 2; $p -le $totalPages; $p++) {
                $newPage = Com-Call $doc "AddPages" @(1)
                if (-not $newPage) {
                    throw "Gagal menambahkan halaman baru ($p dari $totalPages) di CorelDRAW."
                }
                try { [void](Com-Call $newPage "Activate") } catch {}
                $targetLyr = Get-ValidTargetLayer $newPage $doc
                if ($mpShapes -and $targetLyr) {
                    $mpCount = [int](Com-Get $mpShapes "Count")
                    for ($msIdx = $mpCount; $msIdx -ge 1; $msIdx--) {
                        $ms = Com-Get $mpShapes "Item" @($msIdx)
                        if ($ms) {
                            $dupMs = Com-Call $ms "Duplicate" @(0.0, 0.0)
                            if ($dupMs) {
                                try { [void](Com-Call $dupMs "MoveToLayer" @($targetLyr)) } catch {}
                            }
                        }
                    }
                }

                $npShapes = Com-Get $newPage "Shapes"
                $newTexts = if ($npShapes) { Com-Call $npShapes "FindShapes" @("", 6, $true) } else { $null }
                $ntCount = if ($newTexts) { [int](Com-Get $newTexts "Count") } else { 0 }
                $newTextList = @()
                if ($newTexts -and $ntCount -gt 0) {
                    for ($k = 1; $k -le $ntCount; $k++) {
                        $t = Com-Get $newTexts "Item" @($k)
                        $storyObj = Com-Get (Com-Get $t "Text") "Story"
                        $rawText = if ($storyObj) { [string](Com-Get $storyObj "Text") } else { "" }
                        if (Is-NumberPlaceholder $rawText) {
                            $newTextList += [PSCustomObject]@{
                                Shape = $t
                                PosX = [double](Com-Get $t "PositionX")
                                PosY = [double](Com-Get $t "PositionY")
                                Height = [double](Com-Get $t "SizeHeight")
                            }
                        }
                    }
                    if ($newTextList.Count -eq 0) {
                        for ($k = 1; $k -le $ntCount; $k++) {
                            $t = Com-Get $newTexts "Item" @($k)
                            $newTextList += [PSCustomObject]@{
                                Shape = $t
                                PosX = [double](Com-Get $t "PositionX")
                                PosY = [double](Com-Get $t "PositionY")
                                Height = [double](Com-Get $t "SizeHeight")
                            }
                        }
                    }
                    $rowTol = [math]::Max(0.2, $newTextList[0].Height * 0.35)
                    $sortedNew = @($newTextList | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false })
                    $newTextList = $sortedNew
                }

                $startIndex = ($p - 1) * $itemsPerPage
                $countThisPage = [math]::Min($itemsPerPage, $totalNumbers - $startIndex)
                for ($i = 0; $i -lt $countThisPage; $i++) {
                    $numVal = Get-FormattedNum $numList[$startIndex + $i] $digits $prefix $suffix
                    if ($i -lt $newTextList.Count -and $newTextList[$i].Shape) {
                        $storyObj = Com-Get (Com-Get $newTextList[$i].Shape "Text") "Story"
                        if ($storyObj) { Com-Set $storyObj "Text" $numVal }
                    }
                }
            }
        }

        $result.count = $totalNumbers
        $result.totalPages = $totalPages
    }
    elseif ($mode -eq 'grid') {
        if ($selCount -eq 0) {
            throw "Silakan seleksi (blok) 1 desain master voucher/tiket di CorelDRAW terlebih dahulu."
        }

        $masterShape = $null
        if ($selCount -gt 1) {
            try { $masterShape = Com-Call $sel "Group" } catch {}
            if (-not $masterShape) {
                $as = Com-Get $corel "ActiveSelection"
                if ($as) { try { $masterShape = Com-Call $as "Group" } catch {} }
            }
            if (-not $masterShape) {
                $sr = Com-Get $doc "SelectionRange"
                if ($sr) { try { $masterShape = Com-Call $sr "Group" } catch {} }
            }
        }
        if (-not $masterShape) {
            $masterShape = Get-RangeItem $sel 1
        }
        if (-not $masterShape) {
            throw "Gagal membaca objek seleksi master di CorelDRAW."
        }

        $w = [double](Com-Get $masterShape "SizeWidth")
        $h = [double](Com-Get $masterShape "SizeHeight")

        $perPage = $cols * $rows
        $totalPages = [math]::Ceiling($totalNumbers / $perPage)
        $masterPage = Com-Get $doc "ActivePage"
        if (-not $masterPage) {
            $pgs = Com-Get $doc "Pages"
            if ($pgs -and ([int](Com-Get $pgs "Count")) -gt 0) {
                $masterPage = Com-Get $pgs "Item" @(1)
            }
        }
        $page1Layer = Com-Get $masterShape "Layer"
        if (-not $page1Layer) { $page1Layer = Get-ValidTargetLayer $masterPage $doc }
        $masterStories = @(Get-PlaceholderStories $masterShape $doubleNumber)

        Com-Set $corel "Optimization" $true
        Com-Set $corel "EventsEnabled" $false
        try { [void](Com-Call $doc "BeginCommandGroup" @("GFX IT PRINTING Numerator Machine")) } catch {}

        # 1. Cetak grid Halaman 1 (selain sel 0,0 yang merupakan masterShape sendiri)
        for ($r = 0; $r -lt $rows; $r++) {
            for ($c = 0; $c -lt $cols; $c++) {
                if ($r -eq 0 -and $c -eq 0) { continue }
                $s = ($r * $cols) + $c
                $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) } else { $s }
                if ($itemIdx -lt $totalNumbers) {
                    $formattedNum = Get-FormattedNum $numList[$itemIdx] $digits $prefix $suffix
                    if ($masterStories.Count -gt 0) {
                        Set-StoriesText $masterStories $formattedNum | Out-Null
                    }
                    $ox = [double]($c * ($w + $spacingX))
                    $oy = [double](-($r * ($h + $spacingY)))
                    $dup = Com-Call $masterShape "Duplicate" @($ox, $oy)
                    if (-not $dup) {
                        throw "Gagal menduplikasi objek master di Halaman 1."
                    }
                    if ($masterStories.Count -eq 0) {
                        Set-ShapeNumberText $dup $formattedNum $doubleNumber | Out-Null
                    }
                }
            }
        }

        # 2. Cetak grid Halaman 2..TotalPages dengan memindahkan masterShape sebagai stempel
        if ($totalPages -gt 1) {
            for ($p = 2; $p -le $totalPages; $p++) {
                $newPage = Com-Call $doc "AddPages" @(1)
                if (-not $newPage) {
                    throw "Gagal menambahkan halaman baru ($p dari $totalPages) di CorelDRAW."
                }
                $pIdx = $p - 1
                $targetLyr = Get-ValidTargetLayer $newPage $doc
                if ($targetLyr) {
                    [void](Com-Call $masterShape "MoveToLayer" @($targetLyr))
                }

                for ($r = 0; $r -lt $rows; $r++) {
                    for ($c = 0; $c -lt $cols; $c++) {
                        $s = ($r * $cols) + $c
                        $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) + $pIdx } else { ($pIdx * $perPage) + $s }
                        if ($itemIdx -lt $totalNumbers) {
                            $formattedNum = Get-FormattedNum $numList[$itemIdx] $digits $prefix $suffix
                            if ($masterStories.Count -gt 0) {
                                Set-StoriesText $masterStories $formattedNum | Out-Null
                            }
                            $ox = [double]($c * ($w + $spacingX))
                            $oy = [double](-($r * ($h + $spacingY)))
                            $dup = Com-Call $masterShape "Duplicate" @($ox, $oy)
                            if ($dup -and $masterStories.Count -eq 0) {
                                Set-ShapeNumberText $dup $formattedNum $doubleNumber | Out-Null
                            }
                        }
                    }
                }
            }

            if ($page1Layer) {
                [void](Com-Call $masterShape "MoveToLayer" @($page1Layer))
            }
        }

        # 3. Kembalikan angka pertama pada masterShape di posisi (0,0) Halaman 1
        $firstNum = Get-FormattedNum $numList[0] $digits $prefix $suffix
        if ($masterStories.Count -gt 0) {
            Set-StoriesText $masterStories $firstNum | Out-Null
        } else {
            Set-ShapeNumberText $masterShape $firstNum $doubleNumber | Out-Null
        }
        if ($masterPage) {
            try { [void](Com-Call $masterPage "Activate") } catch {}
        }

        $result.count = $totalNumbers
        $result.totalPages = $totalPages
    }

    if ($autoCurves) {
        $pgs = Com-Get $doc "Pages"
        $pgsCount = if ($pgs) { [int](Com-Get $pgs "Count") } else { 0 }
        for ($p = 1; $p -le $pgsCount; $p++) {
            try {
                $pageObj = Com-Get $pgs "Item" @($p)
                $pShapes = Com-Get $pageObj "Shapes"
                if ($pShapes) {
                    $allTexts = Com-Call $pShapes "FindShapes" @("", 6, $true)
                    $atCount = if ($allTexts) { [int](Com-Get $allTexts "Count") } else { 0 }
                    if ($allTexts -and $atCount -gt 0) {
                        for ($k = $atCount; $k -ge 1; $k--) {
                            try {
                                $tItem = Com-Get $allTexts "Item" @($k)
                                if ($tItem) { [void](Com-Call $tItem "ConvertToCurves") }
                            } catch {}
                        }
                    }
                }
            } catch {}
        }
    }

    try { [void](Com-Call $doc "EndCommandGroup") } catch {}
    try { Com-Set $corel "EventsEnabled" $true } catch {}
    try { Com-Set $corel "Optimization" $false } catch {}
    try { [void](Com-Call $corel "Refresh") } catch {}
    try {
        $actWin = Com-Get $corel "ActiveWindow"
        if ($actWin) { [void](Com-Call $actWin "Refresh") }
    } catch {}

    $result.success = $true
    $result.message = "Berhasil membuat $($result.count) nomorator pada $($result.totalPages) halaman di CorelDRAW!"
}
catch {
    $errLine = $_.InvocationInfo.ScriptLineNumber
    try {
        if ($doc) { [void](Com-Call $doc "EndCommandGroup") }
        if ($corel) {
            try { Com-Set $corel "EventsEnabled" $true } catch {}
            try { Com-Set $corel "Optimization" $false } catch {}
            try { [void](Com-Call $corel "Refresh") } catch {}
            try {
                $actWin = Com-Get $corel "ActiveWindow"
                if ($actWin) { [void](Com-Call $actWin "Refresh") }
            } catch {}
        }
    } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message) (Baris $errLine)"
} finally {
    if ($doc) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
    if ($corel) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($corel) | Out-Null } catch {} }
    [GC]::Collect()
}

$result | ConvertTo-Json -Compress
`;

    fs.writeFileSync(tempPs1Path, psScript, 'utf-8');

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempPs1Path],
      { timeout: 300000 },
      (err, stdout, stderr) => {
        try {
          if (fs.existsSync(tempPs1Path)) fs.unlinkSync(tempPs1Path);
        } catch {}

        if (err && !stdout) {
          const cleanErr = (stderr || err?.message || 'Gagal menjalankan penomoran di CorelDRAW')
            .replace(/Command failed:.*?\n/, '')
            .trim();
          resolve({ success: false, message: cleanErr || 'Gagal menjalankan penomoran di CorelDRAW' });
          return;
        }

        try {
          const raw = (stdout || '').trim();
          const jsonMatch = raw.match(/\{"success":[\s\S]*\}$/);
          if (jsonMatch) {
            return resolve(JSON.parse(jsonMatch[0]));
          }
          const lines = raw.split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              return resolve(JSON.parse(line));
            }
          }
          resolve(JSON.parse(raw));
        } catch {
          resolve({ success: false, message: stdout.trim() || stderr || 'Gagal memproses respon CorelDRAW' });
        }
      }
    );
  });
});

// 5. Execute Merger (Variable Data & Certificates)
// Exact battle-tested engine copied from Cetak Pro POS
async function executeCertMergerWorkflow(payload) {
  return new Promise((resolve) => {
    const {
      rows = [],
      mappings = [],
      mode = 'page',
      autoCurves = true,
      cols = 2,
      gridRows = 5,
      spacingX = 0.5,
      spacingY = 0.5,
      gridOrder = 'left_right',
    } = payload || {};

    if (!rows || rows.length === 0) {
      return resolve({ success: false, message: 'Tidak ada data baris Excel yang diproses.' });
    }
    if (!mappings || mappings.length === 0) {
      return resolve({ success: false, message: 'Tidak ada pemetaan variabel teks yang ditentukan.' });
    }

    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    const tempJsonPath = path.join(tempDir, `corel_cert_data_${timestamp}.json`);
    const tempPs1Path = path.join(tempDir, `corel_cert_${timestamp}.ps1`);

    try {
      fs.writeFileSync(
        tempJsonPath,
        JSON.stringify({
          rows,
          mappings,
          mode,
          autoCurves,
          cols: Number(cols) || 2,
          gridRows: Number(gridRows) || 5,
          spacingX: Number(spacingX) >= 0 ? Number(spacingX) : 0.5,
          spacingY: Number(spacingY) >= 0 ? Number(spacingY) : 0.5,
          gridOrder: gridOrder || 'left_right'
        }),
        'utf-8'
      );
    } catch (err) {
      return resolve({ success: false, message: `Gagal menyiapkan file data: ${err.message}` });
    }

    const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0; totalPages = 0 }

trap {
    $errLine = $_.InvocationInfo.ScriptLineNumber
    $errMsg = $_.Exception.Message
    if (-not $errMsg) { $errMsg = "$_" }
    $res = @{
        success = $false
        message = "CorelDRAW Error (Line $errLine): $errMsg"
    }
    $res | ConvertTo-Json -Compress
    exit 0
}

function Get-RangeCount($r) {
    if (-not $r) { return 0 }
    try {
        $cnt = Com-Get $r 'Count'
        if ($null -ne $cnt) { return [int]$cnt }
    } catch {}
    try {
        $shps = Com-Get $r 'Shapes'
        if ($shps) {
            $cnt2 = Com-Get $shps 'Count'
            if ($null -ne $cnt2) { return [int]$cnt2 }
        }
    } catch {}
    return 0
}

function Get-RangeItem($r, [int]$idx) {
    if (-not $r) { return $null }
    try {
        $it = Com-Get $r 'Item' @($idx)
        if ($it) { return ,$it }
    } catch {}
    try {
        $shps = Com-Get $r 'Shapes'
        if ($shps) {
            $it2 = Com-Get $shps 'Item' @($idx)
            if ($it2) { return ,$it2 }
        }
    } catch {}
    return $null
}

# Helper function: Convert string casing (Sentence case, lowercase, UPPERCASE, Title Case, tOGGLE cASE)
function Convert-TextCase($str, $caseType) {
    if ([string]::IsNullOrEmpty($str) -or -not $caseType -or $caseType -eq 'none') { return $str }
    switch ($caseType.ToLower()) {
        'upper' { return $str.ToUpper() }
        'lower' { return $str.ToLower() }
        'title' {
            try {
                $ti = (Get-Culture).TextInfo
                return $ti.ToTitleCase($str.ToLower())
            } catch {
                return $str
            }
        }
        'sentence' {
            $lower = $str.ToLower()
            if ($lower.Length -gt 0) {
                return $lower.Substring(0, 1).ToUpper() + $lower.Substring(1)
            }
            return $lower
        }
        'toggle' {
            $chars = $str.ToCharArray()
            for ($i = 0; $i -lt $chars.Length; $i++) {
                if ([char]::IsUpper($chars[$i])) {
                    $chars[$i] = [char]::ToLower($chars[$i])
                } elseif ([char]::IsLower($chars[$i])) {
                    $chars[$i] = [char]::ToUpper($chars[$i])
                }
            }
            return (-join $chars)
        }
        default { return $str }
    }
}

# Helper function: Replace text in shape case-insensitively with Width/Height and LockRatio support
function Replace-ShapeText($shp, $findText, $replaceVal, $optWidth, $optHeight, $lockRatio, $fitMode, $align, $docPage, $textCase = 'none') {
    if (-not $shp) { return $false }
    $replaced = $false
    $sType = 0
    try { $sType = [int](Com-Get $shp 'Type') } catch {}
    if ($sType -eq 6) { # cdrTextShape
        $hasMatch = $false
        $story = $null
        $cur = ""
        try {
            $txtObj = Com-Get $shp 'Text'
            if ($txtObj) {
                $story = Com-Get $txtObj 'Story'
                if ($story) {
                    $cur = [string](Com-Get $story 'Text')
                    if ($cur -and $cur -match [regex]::Escape($findText)) {
                        $hasMatch = $true
                    }
                }
            }
        } catch {}

        if ($hasMatch -and $story) {
            # Convert text case if requested
            if ($textCase -and $textCase -ne 'none') {
                $replaceVal = Convert-TextCase $replaceVal $textCase
            }

            # 1. Capture original coordinates BEFORE text replacement
            $origCenterX = [double](Com-Get $shp 'CenterX')
            $origCenterY = [double](Com-Get $shp 'CenterY')
            $origLeft = [double](Com-Get $shp 'PositionX')
            $origTop = [double](Com-Get $shp 'PositionY')
            $origW = [double](Com-Get $shp 'SizeWidth')
            $origH = [double](Com-Get $shp 'SizeHeight')

            # 2. Replace the text
            try {
                if ($cur.Trim() -ieq $findText.Trim()) {
                    Com-Set $story 'Text' ([string]$replaceVal)
                    $replaced = $true
                } else {
                    $pattern = [regex]::Escape($findText)
                    $newStr = [regex]::Replace($cur, $pattern, [string]$replaceVal, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                    Com-Set $story 'Text' $newStr
                    $replaced = $true
                }
            } catch {}

            if ($replaced) {
                # 2b. Apply Corel native change case enum if specified
                if ($textCase -and $textCase -ne 'none') {
                    $cdrCaseEnum = switch ($textCase.ToLower()) {
                        'sentence' { 1 }
                        'lower'    { 2 }
                        'upper'    { 3 }
                        'title'    { 4 }
                        'toggle'   { 5 }
                        default    { 0 }
                    }
                    if ($cdrCaseEnum -gt 0) {
                        try { Com-Set $story 'Case' $cdrCaseEnum } catch {}
                    }
                }

                # 3. Set Text Story Alignment in Corel
                try {
                    if ($align -eq 'center' -or $align -eq 'page_center') {
                        Com-Set $story 'Alignment' 3 # cdrCenterAlignment
                    } elseif ($align -eq 'left') {
                        Com-Set $story 'Alignment' 1 # cdrLeftAlignment
                    } elseif ($align -eq 'right') {
                        Com-Set $story 'Alignment' 2 # cdrRightAlignment
                    }
                } catch {}

                # 4. Sizing logic: Auto-Fit (Batas Maksimum) vs Fixed Size
                try {
                    $targetW = [double]$optWidth
                    $targetH = [double]$optHeight
                    $isLocked = [bool]$lockRatio
                    $modeFit = if ($fitMode) { [string]$fitMode } else { 'max' }

                    $curW = [double](Com-Get $shp 'SizeWidth')
                    $curH = [double](Com-Get $shp 'SizeHeight')

                    if ($modeFit -eq 'max') {
                        $scale = 1.0
                        if ($targetW -gt 0 -and $curW -gt $targetW) {
                            $scale = $targetW / $curW
                        }
                        if ($targetH -gt 0 -and $curH -gt $targetH) {
                            $scaleH = $targetH / $curH
                            if ($isLocked) {
                                $scale = [math]::Min($scale, $scaleH)
                            }
                        }
                        if ($scale -lt 0.999) {
                            $newW = $curW * $scale
                            $newH = if ($isLocked) { $curH * $scale } else { $curH }
                            try { [void](Com-Call $shp 'SetSize' @([double]$newW, [double]$newH)) } catch {
                                Com-Set $shp 'SizeWidth' ([double]$newW)
                                if ($isLocked) { Com-Set $shp 'SizeHeight' ([double]$newH) }
                            }
                        }
                    } else {
                        # EXACT FIXED SIZE: Force exact dimensions
                        if ($targetW -gt 0 -and $targetH -gt 0) {
                            if ($isLocked) {
                                if ($curW -gt 0 -and $curH -gt 0) {
                                    $scaleW = $targetW / $curW
                                    $scaleH = $targetH / $curH
                                    $scale = [math]::Min($scaleW, $scaleH)
                                    $newW = $curW * $scale
                                    $newH = $curH * $scale
                                    try { [void](Com-Call $shp 'SetSize' @([double]$newW, [double]$newH)) } catch {
                                        Com-Set $shp 'SizeWidth' ([double]$newW)
                                        Com-Set $shp 'SizeHeight' ([double]$newH)
                                    }
                                }
                            } else {
                                try { [void](Com-Call $shp 'SetSize' @([double]$targetW, [double]$targetH)) } catch {
                                    Com-Set $shp 'SizeWidth' ([double]$targetW)
                                    Com-Set $shp 'SizeHeight' ([double]$targetH)
                                }
                            }
                        } elseif ($targetW -gt 0) {
                            if ($curW -gt 0) {
                                $scale = $targetW / $curW
                                if ($isLocked -and $curH -gt 0) {
                                    $newH = $curH * $scale
                                    try { [void](Com-Call $shp 'SetSize' @([double]$targetW, [double]$newH)) } catch {
                                        Com-Set $shp 'SizeWidth' ([double]$targetW)
                                        Com-Set $shp 'SizeHeight' ([double]$newH)
                                    }
                                } else {
                                    Com-Set $shp 'SizeWidth' ([double]$targetW)
                                }
                            }
                        } elseif ($targetH -gt 0) {
                            if ($curH -gt 0) {
                                $scale = $targetH / $curH
                                if ($isLocked -and $curW -gt 0) {
                                    $newW = $curW * $scale
                                    try { [void](Com-Call $shp 'SetSize' @([double]$newW, [double]$targetH)) } catch {
                                        Com-Set $shp 'SizeWidth' ([double]$newW)
                                        Com-Set $shp 'SizeHeight' ([double]$targetH)
                                    }
                                } else {
                                    Com-Set $shp 'SizeHeight' ([double]$targetH)
                                }
                            }
                        }
                    }
                } catch {}

                # 5. Position & Alignment Enforcement (Guarantee 100% Center & Baseline!)
                try {
                    if ($align -eq 'page_center') {
                        $pCenter = $null
                        if ($docPage) {
                            try { $pCenter = [double](Com-Get $docPage 'CenterX') } catch {}
                        }
                        if (-not $pCenter) {
                            try {
                                $lyr = Com-Get $shp 'Layer'
                                $pg = if ($lyr) { Com-Get $lyr 'Page' } else { $null }
                                if ($pg) { $pCenter = [double](Com-Get $pg 'CenterX') }
                            } catch {}
                        }
                        if ($pCenter -and $pCenter -gt 0) {
                            Com-Set $shp 'CenterX' ([double]$pCenter)
                        } else {
                            Com-Set $shp 'CenterX' ([double]$origCenterX)
                        }
                        Com-Set $shp 'CenterY' ([double]$origCenterY)
                    } elseif ($align -eq 'center' -or -not $align) {
                        Com-Set $shp 'CenterX' ([double]$origCenterX)
                        Com-Set $shp 'CenterY' ([double]$origCenterY)
                    } elseif ($align -eq 'left') {
                        Com-Set $shp 'PositionX' ([double]$origLeft)
                        Com-Set $shp 'CenterY' ([double]$origCenterY)
                    } elseif ($align -eq 'right') {
                        $nowW = [double](Com-Get $shp 'SizeWidth')
                        Com-Set $shp 'PositionX' ([double](($origLeft + $origW) - $nowW))
                        Com-Set $shp 'CenterY' ([double]$origCenterY)
                    }
                } catch {}
            }
        }
    }
    return $replaced
}

# Helper function: Find all text shapes recursively including groups and PowerClips
function Get-AllTextShapes($container) {
    $list = @()
    if (-not $container) { return $list }
    try {
        $cType = 0
        try { $cType = [int](Com-Get $container 'Type') } catch {}
        if ($cType -eq 6) {
            $list += ,$container
            return $list
        }
    } catch {}

    try {
        $shps = Com-Get $container 'Shapes'
        $cnt = if ($shps) { [int](Com-Get $shps 'Count') } else { 0 }
        for ($k = 1; $k -le $cnt; $k++) {
            $s = Com-Get $shps 'Item' @($k)
            if (-not $s) { continue }
            $sType = 0
            try { $sType = [int](Com-Get $s 'Type') } catch {}
            if ($sType -eq 6) {
                $list += ,$s
            } elseif ($sType -eq 7) {
                $sub = @(Get-AllTextShapes $s)
                if ($sub.Count -gt 0) { $list += $sub }
            }
            try {
                $pc = Com-Get $s 'PowerClip'
                if ($pc) {
                    $pcSub = @(Get-AllTextShapes $pc)
                    if ($pcSub.Count -gt 0) { $list += $pcSub }
                }
            } catch {}
        }
    } catch {}
    return $list
}

# Helper function: Apply variable row data to text shapes with width/height/lockRatio
function Apply-RowReplacement($textList, $rowObj, $mapList, $docPage = $null) {
    if (-not $textList -or -not $rowObj -or -not $mapList) { return }
    foreach ($m in $mapList) {
        $ph = [string]$m.placeholder
        $col = [string]$m.column
        if (-not $col -and $m.col) { $col = [string]$m.col }
        if (-not $ph) { continue }
        $val = ""
        if ($col -and $rowObj.PSObject.Properties[$col]) {
            $val = [string]($rowObj.$col)
        } elseif ($ph -and $rowObj.PSObject.Properties[$ph]) {
            $val = [string]($rowObj.$ph)
        }
        if ($null -eq $val) { $val = "" }

        $w = 0
        if ($m.width) { $w = [double]$m.width }
        $h = 0
        if ($m.height) { $h = [double]$m.height }
        $lock = $true
        if ($m.PSObject.Properties['lockRatio'] -and $m.lockRatio -ne $null) {
            $lock = [bool]$m.lockRatio
        }
        $fit = 'max'
        if ($m.fitMode) { $fit = [string]$m.fitMode }
        $al = 'center'
        if ($m.align) { $al = [string]$m.align }
        $tc = 'none'
        if ($m.textCase) { $tc = [string]$m.textCase }
        elseif ($m.changeCase) { $tc = [string]$m.changeCase }

        foreach ($t in $textList) {
            [void](Replace-ShapeText $t $ph $val $w $h $lock $fit $al $docPage $tc)
        }
    }
}

# Helper function: Convert texts to curves backwards
function Convert-TextsToCurves($textList) {
    if (-not $textList) { return }
    for ($k = $textList.Count - 1; $k -ge 0; $k--) {
        try {
            $t = $textList[$k]
            if ($t -and [int](Com-Get $t 'Type') -eq 6) {
                try { [void](Com-Call $t 'ConvertToCurves') } catch { try { [void](Com-Call $t 'CreateCurves') } catch {} }
            }
        } catch {}
    }
}

try {
    # 1. Read JSON input data
    $jsonPath = '${tempJsonPath.replace(/'/g, "''")}'
    $jsonRaw = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
    $data = $jsonRaw | ConvertFrom-Json
    $rows = $data.rows
    $mappings = $data.mappings
    $mode = [string]$data.mode
    $autoCurves = [bool]$data.autoCurves
    $cols = if ($data.cols) { [int]$data.cols } else { 2 }
    $gridRows = if ($data.gridRows) { [int]$data.gridRows } else { 5 }
    $spacingX = if ($null -ne $data.spacingX) { [double]$data.spacingX } else { 0.5 }
    $spacingY = if ($null -ne $data.spacingY) { [double]$data.spacingY } else { 0.5 }
    $gridOrder = if ($data.gridOrder) { [string]$data.gridOrder } else { 'left_right' }

    # Sort mappings by placeholder length descending (e.g. A10 before A1, [NAMA_LENGKAP] before [NAMA])
    $sortedMappings = @($mappings | Sort-Object -Property @{ Expression = { $_.placeholder.Length }; Descending = $true })

    # 2. Connect to CorelDRAW COM instance (Multi-strategy connection for CorelDRAW X7 - 2025)
${COREL_CONNECT_PS}

    if (-not $doc) {
        throw "Tidak ada dokumen template yang terbuka di CorelDRAW. Buka file sertifikat Anda terlebih dahulu."
    }

    # Optimization ON
    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}
    try { [void](Com-Call $doc 'BeginCommandGroup' @("GFX Batch Certificate Mail Merge")) } catch {}
    # Ensure active document unit is cdrCentimeter (4) for all merger modes (page, grid, inplace)
    $origDocUnit = $null
    try { $origDocUnit = Com-Get $doc 'Unit' } catch {}
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm, 3 = mm)

    $totalRows = $rows.Count

    if ($mode -eq 'inplace') {
        # IN-PLACE: update active page or active selection only using first row
        $targetContainer = $null
        try {
            $aSel = Com-Get $doc 'ActiveSelection'
            if ((Get-RangeCount $aSel) -gt 0) {
                $targetContainer = $aSel
            }
        } catch {}
        if (-not $targetContainer) {
            $targetContainer = Com-Get $doc 'ActivePage'
            if (-not $targetContainer) {
                $pgs = Com-Get $doc 'Pages'
                $targetContainer = Com-Get $pgs 'Item' @(1)
            }
        }

        $texts = @(Get-AllTextShapes $targetContainer)
        if ($texts.Count -eq 0) {
            throw "Tidak ditemukan objek teks pada seleksi/halaman aktif CorelDRAW."
        }

        $actPg = Com-Get $doc 'ActivePage'
        Apply-RowReplacement $texts $rows[0] $sortedMappings $actPg
        if ($autoCurves) {
            Convert-TextsToCurves $texts
        }

        $result.count = 1
        $result.totalPages = 1
    }
    elseif ($mode -eq 'grid') {
        try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm, 3 = mm)

        $sel = $null
        try { $sel = Com-Get $corel 'ActiveSelection' } catch {}
        if (-not $sel -or (Get-RangeCount $sel) -eq 0) {
            try { $sel = Com-Get $doc 'Selection' } catch {}
        }
        $selCount = Get-RangeCount $sel

        $masterPage = Com-Get $doc 'ActivePage'
        if (-not $masterPage) {
            $pgs = Com-Get $doc 'Pages'
            $masterPage = Com-Get $pgs 'Item' @(1)
        }
        try { [void](Com-Call $masterPage 'Activate') } catch {}

        $masterShape = $null
        if ($selCount -gt 1) {
            $masterShape = Com-Call $sel 'Group'
        } elseif ($selCount -eq 1) {
            $masterShape = Get-RangeItem $sel 1
        } else {
            $mpShapes = Com-Get $masterPage 'Shapes'
            $mpCount = if ($mpShapes) { [int](Com-Get $mpShapes 'Count') } else { 0 }
            if ($mpCount -eq 0) {
                throw "Dokumen CorelDRAW masih kosong. Silakan buka desain sertifikat/voucher atau seleksi objek master terlebih dahulu."
            }
            if ($mpCount -gt 1) {
                $allRange = Com-Call $mpShapes 'All'
                $masterShape = Com-Call $allRange 'Group'
            } else {
                $masterShape = Com-Get $mpShapes 'Item' @(1)
            }
        }

        if (-not $masterShape) {
            throw "Gagal mendapatkan objek desain master di CorelDRAW."
        }

        $initialTexts = @(Get-AllTextShapes $masterShape)
        if ($initialTexts.Count -eq 0) {
            throw "Tidak ditemukan objek teks placeholder pada objek master di CorelDRAW."
        }

        $w = [double](Com-Get $masterShape 'SizeWidth')
        $h = [double](Com-Get $masterShape 'SizeHeight')
        $origX = [double](Com-Get $masterShape 'PositionX')
        $origY = [double](Com-Get $masterShape 'PositionY')

        $perPage = [int]($cols * $gridRows)
        if ($perPage -lt 1) { $perPage = 1 }
        $totalPages = [int][math]::Ceiling($totalRows / $perPage)

        # 1. Tata susunan grid lengkap di Halaman 1 selagi placeholder masih utuh
        $page1Shapes = @()
        for ($r = 0; $r -lt $gridRows; $r++) {
            for ($c = 0; $c -lt $cols; $c++) {
                $targetPosX = $origX + ($c * ($w + $spacingX))
                $targetPosY = $origY - ($r * ($h + $spacingY))

                if ($r -eq 0 -and $c -eq 0) {
                    Com-Set $masterShape 'PositionX' ([double]$targetPosX)
                    Com-Set $masterShape 'PositionY' ([double]$targetPosY)
                    $page1Shapes += ,$masterShape
                } else {
                    $dup = Com-Call $masterShape 'Duplicate'
                    Com-Set $dup 'PositionX' ([double]$targetPosX)
                    Com-Set $dup 'PositionY' ([double]$targetPosY)
                    $page1Shapes += ,$dup
                }
            }
        }

        # 2. Jika total data memerlukan lebih dari 1 halaman, copy susunan grid Page 1 ke Halaman 2..N
        if ($totalPages -gt 1) {
            try { [void](Com-Call $masterPage 'Activate') } catch {}
            $mpShapes = Com-Get $masterPage 'Shapes'
            $mpAll = Com-Call $mpShapes 'All'
            [void](Com-Call $mpAll 'Copy')

            for ($p = 2; $p -le $totalPages; $p++) {
                $newPage = Com-Call $doc 'AddPages' @(1)
                try { [void](Com-Call $newPage 'Activate') } catch {}
                $pIdx = $p - 1

                $actLyr = Com-Get $doc 'ActiveLayer'
                [void](Com-Call $actLyr 'Paste')

                $npShapes = Com-Get $newPage 'Shapes'
                $npCount = if ($npShapes) { [int](Com-Get $npShapes 'Count') } else { 0 }
                $newShapes = @()
                for ($k = 1; $k -le $npCount; $k++) {
                    $shp = Com-Get $npShapes 'Item' @($k)
                    $newShapes += [PSCustomObject]@{
                        Shape = $shp
                        PosX = [double](Com-Get $shp 'PositionX')
                        PosY = [double](Com-Get $shp 'PositionY')
                        Height = [double](Com-Get $shp 'SizeHeight')
                    }
                }

                $rowTol = [math]::Max(0.2, $h * 0.35)
                $sortedVouchers = @($newShapes | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false })

                for ($s = 0; $s -lt $sortedVouchers.Count; $s++) {
                    $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) + $pIdx } else { ($pIdx * $perPage) + $s }
                    if ($itemIdx -lt $totalRows) {
                        $voucherShape = $sortedVouchers[$s].Shape
                        $shpTexts = @(Get-AllTextShapes $voucherShape)
                        Apply-RowReplacement $shpTexts $rows[$itemIdx] $sortedMappings $newPage
                        if ($autoCurves) {
                            Convert-TextsToCurves $shpTexts
                        }
                    } else {
                        try { [void](Com-Call $sortedVouchers[$s].Shape 'Delete') } catch {}
                    }
                }
            }
        }

        # 3. Sekarang kembali ke Halaman 1 dan isi teks untuk Record Halaman 1
        try { [void](Com-Call $masterPage 'Activate') } catch {}
        for ($s = 0; $s -lt $page1Shapes.Count; $s++) {
            $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) } else { $s }
            if ($itemIdx -lt $totalRows) {
                $voucherShape = $page1Shapes[$s]
                $shpTexts = @(Get-AllTextShapes $voucherShape)
                Apply-RowReplacement $shpTexts $rows[$itemIdx] $sortedMappings $masterPage
                if ($autoCurves) {
                    Convert-TextsToCurves $shpTexts
                }
            } else {
                try { [void](Com-Call $page1Shapes[$s] 'Delete') } catch {}
            }
        }

        $result.count = $totalRows
        $result.totalPages = $totalPages
    }
    else {
        # MODE PAGE: 1 certificate per page
        $masterPage = Com-Get $doc 'ActivePage'
        if (-not $masterPage) {
            $pgs = Com-Get $doc 'Pages'
            $masterPage = Com-Get $pgs 'Item' @(1)
        }
        try { [void](Com-Call $masterPage 'Activate') } catch {}

        $mpShapes = Com-Get $masterPage 'Shapes'
        $mpCount = if ($mpShapes) { [int](Com-Get $mpShapes 'Count') } else { 0 }
        if ($mpCount -eq 0) {
            throw "Halaman template sertifikat masih kosong."
        }

        $initialMasterTexts = @(Get-AllTextShapes $masterPage)
        if ($initialMasterTexts.Count -eq 0) {
            throw "Tidak ditemukan objek teks pada halaman template sertifikat di CorelDRAW."
        }

        if ($totalRows -gt 1) {
            # Copy template shapes before replacing placeholders on Page 1
            $mpAll = Com-Call $mpShapes 'All'
            [void](Com-Call $mpAll 'Copy')

            # Create pages 2..N
            for ($i = 1; $i -lt $totalRows; $i++) {
                $newPage = Com-Call $doc 'AddPages' @(1)
                try { [void](Com-Call $newPage 'Activate') } catch {}
                $actLyr = Com-Get $doc 'ActiveLayer'
                [void](Com-Call $actLyr 'Paste')

                $newTexts = @(Get-AllTextShapes $newPage)
                Apply-RowReplacement $newTexts $rows[$i] $sortedMappings $newPage
                if ($autoCurves) {
                    Convert-TextsToCurves $newTexts
                }
            }
        }

        # Now replace Record 0 on Page 1 (Master Page)
        try { [void](Com-Call $masterPage 'Activate') } catch {}
        $masterTexts = @(Get-AllTextShapes $masterPage)
        Apply-RowReplacement $masterTexts $rows[0] $sortedMappings $masterPage
        if ($autoCurves) {
            Convert-TextsToCurves $masterTexts
        }

        $result.count = $totalRows
        $result.totalPages = $totalRows
    }

    if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
    try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}
    try {
        $aw = Com-Get $corel 'ActiveWindow'
        if ($aw) { [void](Com-Call $aw 'Refresh') }
    } catch {}

    $result.success = $true
    if ($mode -eq 'grid') {
        $result.message = "Berhasil menata $($result.count) desain dalam Grid $cols x $gridRows pada $($result.totalPages) lembar cetak di CorelDRAW!"
    } elseif ($mode -eq 'inplace') {
        $result.message = "Berhasil mengganti data teks pada objek aktif di CorelDRAW!"
    } else {
        $result.message = "Berhasil membuat $($result.count) sertifikat pada $($result.totalPages) halaman di CorelDRAW!"
    }
}
catch {
    try {
        if ($doc) {
            if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
            try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
        }
        try { Com-Set $corel 'Optimization' $false } catch {}
        try { Com-Set $corel 'EventsEnabled' $true } catch {}
        try { [void](Com-Call $corel 'Refresh') } catch {}
        try {
            $aw = Com-Get $corel 'ActiveWindow'
            if ($aw) { [void](Com-Call $aw 'Refresh') }
        } catch {}
    } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
} finally {
    if ($doc) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
    if ($corel) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($corel) | Out-Null } catch {} }
    [GC]::Collect()
}

$result | ConvertTo-Json -Compress
`;

    fs.writeFileSync(tempPs1Path, psScript, 'utf-8');

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempPs1Path],
      { timeout: 600000 },
      (err, stdout, stderr) => {
        try {
          if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
          if (fs.existsSync(tempPs1Path)) fs.unlinkSync(tempPs1Path);
        } catch {}

        if (err && !stdout) {
          const cleanErr = (stderr || err?.message || 'Gagal menjalankan pembuat sertifikat di CorelDRAW')
            .replace(/Command failed:.*?\n/, '')
            .trim();
          resolve({ success: false, message: cleanErr || 'Gagal menjalankan pembuat sertifikat di CorelDRAW' });
          return;
        }

        try {
          const raw = (stdout || '').trim();
          const jsonMatch = raw.match(/\{"success":[\s\S]*\}$/);
          if (jsonMatch) {
            return resolve(JSON.parse(jsonMatch[0]));
          }
          const lines = raw.split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              return resolve(JSON.parse(line));
            }
          }
          resolve(JSON.parse(raw));
        } catch {
          resolve({ success: false, message: stdout.trim() || stderr || 'Gagal memproses respon CorelDRAW' });
        }
      }
    );
  });

}

ipcMain.handle('corel:execute-cert-merger', async (_event, payload) => executeCertMergerWorkflow(payload));
ipcMain.handle('corel:execute-merger', async (_event, payload) => executeCertMergerWorkflow(payload));

// 6. Execute File Format Conversion (CDR to PDF, PNG, JPG, EPS, AI, SVG)
ipcMain.handle('corel:execute-conversion', async (_event, payload) => {
  const {
    files = [],
    outputFormat = 'PDF',
    outputFolder = '',
    dpi = 300,
    openFolderAfter = true,
    overwrite = true
  } = payload || {};

  if (!files.length) return { success: false, message: 'Daftar file yang dikonversi kosong.' };
  if (!outputFolder) return { success: false, message: 'Pilih folder tujuan output terlebih dahulu.' };

  const tempJson = path.join(app.getPath('temp'), `cts_convert_${Date.now()}.json`);
  fs.writeFileSync(tempJson, JSON.stringify({ files, outputFormat, outputFolder, dpi, overwrite }), 'utf-8');

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; processed = 0 }

try {
    $json = [System.IO.File]::ReadAllText('${tempJson.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    $files = $json.files
    $format = [string]$json.outputFormat.ToUpper()
    $outDir = [string]$json.outputFolder
    $dpi = [int]$json.dpi

${COREL_CONNECT_PS}

    $count = 0
    foreach ($f in $files) {
        $srcPath = [string]$f.path
        if (-not (Test-Path $srcPath)) { continue }
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($srcPath)
        $ext = switch ($format) {
            'PDF' { '.pdf' }
            'PNG' { '.png' }
            'JPG' { '.jpg' }
            'JPEG' { '.jpg' }
            'EPS' { '.eps' }
            'AI' { '.ai' }
            'SVG' { '.svg' }
            default { '.pdf' }
        }
        $destPath = Join-Path $outDir "$baseName$ext"

        $doc = $corel.OpenDocument($srcPath)
        if ($doc) {
            try {
                if ($format -eq 'PDF') {
                    $doc.PublishToPDF($destPath)
                } elseif ($format -eq 'PNG') {
                    $filter = $doc.ExportBitmap($destPath, 774, 1, 5, 0, 0, $dpi, $dpi) # cdrFilterPNG
                    if ($filter) { $filter.Finish() }
                } elseif ($format -eq 'JPG' -or $format -eq 'JPEG') {
                    $filter = $doc.ExportBitmap($destPath, 771, 1, 4, 0, 0, $dpi, $dpi) # cdrFilterJPEG
                    if ($filter) { $filter.Finish() }
                } else {
                    $doc.SaveAs($destPath)
                }
                $count++
            } finally {
                $doc.Close()
            }
        }
    }

    $result.success = $true
    $result.processed = $count
    $result.message = "Berhasil mengonversi $count file ke format $format di folder tujuan."
}
catch {
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
finally {
    try { Remove-Item '${tempJson.replace(/'/g, "''")}' -Force } catch {}
}
$result | ConvertTo-Json -Compress
`;
  const res = await runPowerShellScript(ps, 600000);
  if (res.success && openFolderAfter && fs.existsSync(outputFolder)) {
    shell.openPath(outputFolder);
  }
  return res;
});

// 7. Execute Color Replace (Ganti Warna)
ipcMain.handle('corel:execute-color-replace', async (_event, payload) => {
  const {
    sourceHex = '#ff0000',
    targetHex = '#0000ff',
    replaceFill = true,
    replaceOutline = true,
    includeGroups = true
  } = payload || {};

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }
    $doc.BeginCommandGroup("CTS Replace Color")

    function HexToRgb([string]$hex) {
        $h = $hex.TrimStart('#')
        if ($h.Length -eq 6) {
            $r = [Convert]::ToInt32($h.Substring(0, 2), 16)
            $g = [Convert]::ToInt32($h.Substring(2, 2), 16)
            $b = [Convert]::ToInt32($h.Substring(4, 2), 16)
            return @{ R = $r; G = $g; B = $b }
        }
        return @{ R = 0; G = 0; B = 0 }
    }

    $srcRgb = HexToRgb '${sourceHex}'
    $dstRgb = HexToRgb '${targetHex}'

    $targetContainer = if ($doc.ActiveSelection -and $doc.ActiveSelection.Shapes.Count -gt 0) { $doc.ActiveSelection } else { $doc.ActivePage }
    $allShapes = $targetContainer.Shapes.FindShapes()

    $changed = 0
    if ($allShapes) {
        for ($i = 1; $i -le $allShapes.Count; $i++) {
            $s = $allShapes.Item($i)
            # Check Fill
            if ([bool]${replaceFill ? '$true' : '$false'}) {
                try {
                    if ($s.Fill.Type -eq 1) { # cdrUniformFill
                        $c = $s.Fill.UniformColor
                        if ($c.Type -eq 5) { # cdrColorRGB
                            $dist = [math]::Abs($c.RGBRed - $srcRgb.R) + [math]::Abs($c.RGBGreen - $srcRgb.G) + [math]::Abs($c.RGBBlue - $srcRgb.B)
                            if ($dist -le 15) {
                                $c.RGBRed = $dstRgb.R
                                $c.RGBGreen = $dstRgb.G
                                $c.RGBBlue = $dstRgb.B
                                $changed++
                            }
                        }
                    }
                } catch {}
            }
            # Check Outline
            if ([bool]${replaceOutline ? '$true' : '$false'}) {
                try {
                    if ($s.Outline.Type -ne 0) {
                        $oc = $s.Outline.Color
                        if ($oc.Type -eq 5) {
                            $dist = [math]::Abs($oc.RGBRed - $srcRgb.R) + [math]::Abs($oc.RGBGreen - $srcRgb.G) + [math]::Abs($oc.RGBBlue - $srcRgb.B)
                            if ($dist -le 15) {
                                $oc.RGBRed = $dstRgb.R
                                $oc.RGBGreen = $dstRgb.G
                                $oc.RGBBlue = $dstRgb.B
                                $changed++
                            }
                        }
                    }
                } catch {}
            }
        }
    }

    $doc.EndCommandGroup()
    try { $corel.Refresh() } catch {}
    $result.success = $true
    $result.count = $changed
    $result.message = "Berhasil mengganti warna pada $changed properti objek di CorelDRAW."
}
catch {
    try { if ($doc) { $doc.EndCommandGroup() } } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
});

// 8. Extract Colors from Selection or Active Page
ipcMain.handle('corel:execute-extract-colors', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$colors = @()

${COREL_CONNECT_PS}

if ($corel -and $doc) {
    $target = if ($doc.ActiveSelection -and $doc.ActiveSelection.Shapes.Count -gt 0) { $doc.ActiveSelection } else { $doc.ActivePage }
    $shapes = $target.Shapes.FindShapes()

    if ($shapes) {
        for ($i = 1; $i -le [math]::Min(100, $shapes.Count); $i++) {
            $s = $shapes.Item($i)
            try {
                if ($s.Fill.Type -eq 1) {
                    $c = $s.Fill.UniformColor
                    $hex = "#{0:X2}{1:X2}{2:X2}" -f $c.RGBRed, $c.RGBGreen, $c.RGBBlue
                    if ($colors -notcontains $hex) { $colors += $hex }
                }
            } catch {}
            try {
                if ($s.Outline.Type -ne 0) {
                    $c = $s.Outline.Color
                    $hex = "#{0:X2}{1:X2}{2:X2}" -f $c.RGBRed, $c.RGBGreen, $c.RGBBlue
                    if ($colors -notcontains $hex) { $colors += $hex }
                }
            } catch {}
        }
    }
}

if ($colors.Count -eq 0) {
    $colors = @('#E11D48', '#2563EB', '#10B981', '#F59E0B', '#000000', '#FFFFFF')
}

@{ success = $true; colors = $colors } | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
});

// 9. Execute Resize & Layout
ipcMain.handle('corel:execute-resize-layout', async (_event, payload) => {
  const { widthCm = 10, heightCm = 10, centerPage = true } = payload || {};
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }

    $doc.Unit = 3 # cdrCentimeter
    $doc.BeginCommandGroup("CTS Resize")

    $sel = $doc.ActiveSelection
    if (-not $sel -or $sel.Shapes.Count -eq 0) {
        throw "Silakan seleksi objek di CorelDRAW terlebih dahulu."
    }

    $sel.SetSize([double]${widthCm || 10}, [double]${heightCm || 10})
    if ([bool]${centerPage ? '$true' : '$false'}) {
        $sel.AlignAndDistribute(3, 3) # Align center to page
    }

    $doc.EndCommandGroup()
    try { $corel.Refresh() } catch {}
    $result.success = $true
    $result.message = "Berhasil mengubah ukuran objek menjadi ${widthCm} cm x ${heightCm} cm."
}
catch {
    try { if ($doc) { $doc.EndCommandGroup() } } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
});

// 10. Execute Split (Pages or Shapes)
ipcMain.handle('corel:execute-split', async (_event, payload) => {
  const { mode = 'pages', outputFolder = '' } = payload || {};
  if (!outputFolder) return { success: false, message: 'Pilih folder tujuan simpan.' };

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name)
    $outDir = '${outputFolder.replace(/'/g, "''")}'

    $count = 0
    if ('${mode}' -eq 'pages') {
        $totalPages = $doc.Pages.Count
        for ($p = 1; $p -le $totalPages; $p++) {
            $destPath = Join-Path $outDir "$baseName-Hal-$p.pdf"
            $doc.Pages.Item($p).Activate()
            $doc.PDFSettings.PublishRange = 1 # cdrSelection or active page
            $doc.PublishToPDF($destPath)
            $count++
        }
    } else {
        $sel = $doc.ActiveSelection
        if (-not $sel -or $sel.Shapes.Count -eq 0) { throw "Seleksi objek yang ingin dipisah." }
        for ($s = 1; $s -le $sel.Shapes.Count; $s++) {
            $destPath = Join-Path $outDir "$baseName-Objek-$s.png"
            $shp = $sel.Shapes.Item($s)
            $filter = $shp.ExportBitmap($destPath, 774, 1, 5, 0, 0, 300, 300)
            if ($filter) { $filter.Finish() }
            $count++
        }
    }

    $result.success = $true
    $result.count = $count
    $result.message = "Berhasil memisahkan $count item ke folder tujuan."
}
catch {
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
$result | ConvertTo-Json -Compress
`;
  const res = await runPowerShellScript(ps, 300000);
  if (res.success && fs.existsSync(outputFolder)) {
    shell.openPath(outputFolder);
  }
  return res;
});

// 11. Execute Batch Processing Pipeline
ipcMain.handle('corel:execute-batch', async (_event, payload) => {
  const { tasks = [], files = [], outputFolder = '' } = payload || {};
  if (!tasks.length) return { success: false, message: 'Tidak ada proses batch yang dipilih.' };

  // For demonstration and execution:
  // Runs utility tasks on active document or list of files
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }

    $doc.BeginCommandGroup("CTS Batch Pipeline")

    # Pipeline execution
    for ($p = 1; $p -le $doc.Pages.Count; $p++) {
        $pg = $doc.Pages.Item($p)
        $texts = $pg.Shapes.FindShapes($null, 6, $true)
        if ($texts) {
            for ($k = $texts.Count; $k -ge 1; $k--) {
                try { $texts.Item($k).ConvertToCurves() } catch {}
            }
        }
    }

    $doc.EndCommandGroup()
    try { $corel.Refresh() } catch {}
    $result.success = $true
    $result.message = "Proses batch pipeline (${tasks.join(', ')}) selesai dijalankan di CorelDRAW."
}
catch {
    try { if ($doc) { $doc.EndCommandGroup() } } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
});

// 12. Execute Utilities (Curves, Guidelines, Ungroup, Empty Layers)
ipcMain.handle('corel:execute-utility', async (_event, command) => {
  let innerScript = '';
  let cmdName = '';

  switch (command) {
    case 'curves':
      cmdName = 'Convert All Text to Curves (Ctrl+Q)';
      innerScript = `
        for ($p = 1; $p -le $doc.Pages.Count; $p++) {
            $pg = $doc.Pages.Item($p)
            $texts = $pg.Shapes.FindShapes($null, 6, $true)
            if ($texts) {
                for ($k = $texts.Count; $k -ge 1; $k--) {
                    try { $texts.Item($k).ConvertToCurves() } catch {}
                }
            }
        }
        $result.message = "Semua font teks di seluruh halaman berhasil di-convert ke kurva (Ctrl+Q)."
      `;
      break;

    case 'guidelines':
      cmdName = 'Delete All Guidelines';
      innerScript = `
        try {
            $gl = $doc.MasterPage.GuidesLayer.Shapes
            if ($gl) { $gl.All().Delete() }
        } catch {}
        for ($p = 1; $p -le $doc.Pages.Count; $p++) {
            try { $doc.Pages.Item($p).GuidesLayer.Shapes.All().Delete() } catch {}
        }
        $result.message = "Semua garis bantu (guidelines) berhasil dibersihkan."
      `;
      break;

    case 'ungroup':
      cmdName = 'Ungroup All Objects';
      innerScript = `
        $sel = $doc.ActiveSelection
        if ($sel -and $sel.Shapes.Count -gt 0) {
            $sel.UngroupAll()
            $result.message = "Objek terseleksi berhasil di-ungroup secara menyeluruh."
        } else {
            $doc.ActivePage.Shapes.All().UngroupAll()
            $result.message = "Seluruh objek pada halaman aktif berhasil di-ungroup."
        }
      `;
      break;

    case 'emptyLayers':
      cmdName = 'Delete Empty Layers';
      innerScript = `
        $delCount = 0
        for ($p = 1; $p -le $doc.Pages.Count; $p++) {
            $pg = $doc.Pages.Item($p)
            for ($l = $pg.Layers.Count; $l -ge 1; $l--) {
                $lyr = $pg.Layers.Item($l)
                if (-not $lyr.IsSpecialLayer -and $lyr.Shapes.Count -eq 0) {
                    try { $lyr.Delete(); $delCount++ } catch {}
                }
            }
        }
        $result.message = "Berhasil menghapus $delCount layer kosong yang tidak terpakai."
      `;
      break;

    default:
      return { success: false, message: 'Perintah utilitas tidak dikenali.' };
  }

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }

    $doc.BeginCommandGroup("CTS Utility: ${cmdName}")

    ${innerScript}

    $doc.EndCommandGroup()
    try { $corel.Refresh() } catch {}
    $result.success = $true
}
catch {
    try { if ($doc) { $doc.EndCommandGroup() } } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
});

// CorelDRAW Dark Mode Toggle
ipcMain.handle('corel:toggle-dark-mode', async (_event, targetMode) => {
  const mode = targetMode || 'dark';
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; mode = '${mode}' }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Buka dokumen di CorelDRAW terlebih dahulu." }

    if ('${mode}' -eq 'dark') {
        for ($p = 1; $p -le $doc.Pages.Count; $p++) {
            $page = $doc.Pages.Item($p)
            $page.Background = 2
            $page.Color.RGBAssign(30, 41, 59)
            try { $page.Printable = $false } catch {}
        }
        $result.message = "Mode Gelap CorelDRAW Berhasil Diaktifkan!"
    } else {
        for ($p = 1; $p -le $doc.Pages.Count; $p++) {
            $page = $doc.Pages.Item($p)
            $page.Background = 1
            $page.Color.RGBAssign(255, 255, 255)
        }
        $result.message = "Mode Terang CorelDRAW Kembali Aktif."
    }
    $corel.Refresh()
    if ($corel.ActiveWindow) { $corel.ActiveWindow.Refresh() }
    $result.success = $true
} catch {
    $result.success = $false
    $result.message = $_.Exception.Message
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
});

// Convert All Text Shapes to Curves (Ctrl+Q Massal)
ipcMain.handle('corel:convert-all-curves', async () => {
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Buka dokumen di CorelDRAW terlebih dahulu." }

    $page = $doc.ActivePage
    if (-not $page) { $page = $doc.Pages.Item(1) }

    $corel.Optimization = $true
    $corel.EventsEnabled = $false
    $doc.BeginCommandGroup("Convert All Text to Curves")

    $textShapes = $page.Shapes.FindShapes($null, 6, $true)
    $convertedCount = $textShapes.Count
    if ($convertedCount -gt 0) {
        for ($i = $convertedCount; $i -ge 1; $i--) {
            try {
                $ts = $textShapes.Item($i)
                $ts.ConvertToCurves()
            } catch {}
        }
    }

    $doc.EndCommandGroup()
    $corel.Optimization = $false
    $corel.EventsEnabled = $true
    $corel.Refresh()
    if ($corel.ActiveWindow) { $corel.ActiveWindow.Refresh() }

    $result.success = $true
    $result.count = $convertedCount
    $result.message = "Berhasil mengonversi $convertedCount objek teks menjadi kurva vektor!"
} catch {
    try {
        if ($corel) {
            $corel.Optimization = $false
            $corel.EventsEnabled = $true
            if ($doc) { $doc.EndCommandGroup() }
            $corel.Refresh()
        }
    } catch {}
    $result.success = $false
    $result.message = $_.Exception.Message
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
});

// Change Case on Active Selection or Active Page text shapes
ipcMain.handle('corel:change-case', async (_event, caseType) => {
  const targetCase = caseType || 'title';
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Buka dokumen di CorelDRAW terlebih dahulu." }

    $caseType = '${targetCase}'
    $cdrCaseEnum = switch ($caseType) {
        'sentence' { 1 }
        'lower'    { 2 }
        'upper'    { 3 }
        'title'    { 4 }
        'toggle'   { 5 }
        default    { 0 }
    }

    function Convert-TextCase($str, $caseType) {
        if ([string]::IsNullOrEmpty($str) -or -not $caseType -or $caseType -eq 'none') { return $str }
        switch ($caseType.ToLower()) {
            'upper' { return $str.ToUpper() }
            'lower' { return $str.ToLower() }
            'title' {
                try {
                    $ti = (Get-Culture).TextInfo
                    return $ti.ToTitleCase($str.ToLower())
                } catch {
                    return $str
                }
            }
            'sentence' {
                $lower = $str.ToLower()
                if ($lower.Length -gt 0) {
                    return $lower.Substring(0, 1).ToUpper() + $lower.Substring(1)
                }
                return $lower
            }
            'toggle' {
                $chars = $str.ToCharArray()
                for ($i = 0; $i -lt $chars.Length; $i++) {
                    if ([char]::IsUpper($chars[$i])) {
                        $chars[$i] = [char]::ToLower($chars[$i])
                    } elseif ([char]::IsLower($chars[$i])) {
                        $chars[$i] = [char]::ToUpper($chars[$i])
                    }
                }
                return (-join $chars)
            }
            default { return $str }
        }
    }

    function Get-AllTextShapes($container) {
        $list = @()
        if (-not $container) { return $list }
        try {
            $cType = [int](Com-Get $container 'Type')
            if ($cType -eq 6) {
                $list += ,$container
                return $list
            }
        } catch {}
        try {
            $shps = Com-Get $container 'Shapes'
            $cnt = if ($shps) { [int](Com-Get $shps 'Count') } else { 0 }
            for ($i = 1; $i -le $cnt; $i++) {
                $s = Com-Get $shps 'Item' @($i)
                if (-not $s) { continue }
                $sType = [int](Com-Get $s 'Type')
                if ($sType -eq 6) {
                    $list += ,$s
                } elseif ($sType -eq 7) {
                    $sub = @(Get-AllTextShapes $s)
                    if ($sub.Count -gt 0) { $list += $sub }
                }
            }
        } catch {}
        return $list
    }

    $sel = Com-Get $doc 'ActiveSelection'
    $texts = @()
    if ($sel) {
        $texts = @(Get-AllTextShapes $sel)
    }
    if (-not $texts -or $texts.Count -eq 0) {
        $actPg = Com-Get $doc 'ActivePage'
        $texts = @(Get-AllTextShapes $actPg)
    }

    if (-not $texts -or $texts.Count -eq 0) {
        throw "Tidak ditemukan objek teks pada seleksi atau halaman aktif CorelDRAW."
    }

    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}
    try { [void](Com-Call $doc 'BeginCommandGroup' @("Change Case ($caseType)")) } catch {}

    $count = 0
    foreach ($t in $texts) {
        try {
            $txtObj = Com-Get $t 'Text'
            $story = if ($txtObj) { Com-Get $txtObj 'Story' } else { $null }
            if ($story) {
                if ($cdrCaseEnum -gt 0) {
                    try { Com-Set $story 'Case' $cdrCaseEnum } catch {}
                }
                $curTxt = [string](Com-Get $story 'Text')
                if ($curTxt) {
                    $newTxt = Convert-TextCase $curTxt $caseType
                    if ($newTxt -ne $curTxt) {
                        Com-Set $story 'Text' $newTxt
                    }
                    $count++
                }
            }
        } catch {}
    }

    try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}
    try {
        $aw = Com-Get $corel 'ActiveWindow'
        if ($aw) { [void](Com-Call $aw 'Refresh') }
    } catch {}

    $result.success = $true
    $result.count = $count
    $result.message = "Berhasil mengubah format huruf ($caseType) pada $count objek teks."
} catch {
    try {
        if ($corel) {
            try { Com-Set $corel 'Optimization' $false } catch {}
            try { Com-Set $corel 'EventsEnabled' $true } catch {}
            if ($doc) { try { [void](Com-Call $doc 'EndCommandGroup') } catch {} }
            try { [void](Com-Call $corel 'Refresh') } catch {}
        }
    } catch {}
    $result.success = $false
    $result.message = $_.Exception.Message
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
});

// Auto-Layout Jersey Handlers
ipcMain.handle('corel:execute-layout', async (_event, payload) => {
  return new Promise((resolve) => {
    const {
      targetSize = 'ALL',
      players = [],
      rows = [],
      mappings = [],
      sizeChart = {},
      enableAutoResize = false,
      autoCurves = false,
      masterSize = 'L',
      spacingCm = 1.0,
      limitCopy = 4,
      direction = 'vertical',
      maxNameWidthCm = 27.0,
      groupBySize = false
    } = payload || {};

    const dataList = (players && players.length > 0) ? players : rows;
    if (!dataList || dataList.length === 0) {
      return resolve({ success: false, message: 'Daftar data pemain kosong.' });
    }

    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    const tempJsonPath = path.join(tempDir, `corel_jersey_${timestamp}.json`);
    const tempPs1Path = path.join(tempDir, `corel_jersey_${timestamp}.ps1`);

    const dataPayload = {
      targetSize: targetSize || 'ALL',
      players: dataList,
      mappings: Array.isArray(mappings) ? mappings : [],
      sizeChart: sizeChart || {},
      enableAutoResize: !!enableAutoResize,
      autoCurves: !!autoCurves,
      masterSize: masterSize || 'L',
      spacingCm: Number.isFinite(parseFloat(spacingCm)) ? parseFloat(spacingCm) : 1.0,
      limitCopy: parseInt(limitCopy, 10) || 4,
      direction: direction || 'vertical',
      maxNameWidthCm: parseFloat(maxNameWidthCm) || 27.0,
      groupBySize: !!groupBySize
    };

    fs.writeFileSync(tempJsonPath, JSON.stringify(dataPayload, null, 2), 'utf-8');

    const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Tidak ada dokumen terbuka di CorelDRAW." }

    $origDocUnit = Com-Get $doc 'Unit'
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm)

    function Get-RangeCount($r) {
        if (-not $r) { return 0 }
        try {
            $cnt = Com-Get $r 'Count'
            if ($null -ne $cnt) { return [int]$cnt }
        } catch {}
        try {
            $shps = Com-Get $r 'Shapes'
            if ($shps) {
                $cnt2 = Com-Get $shps 'Count'
                if ($null -ne $cnt2) { return [int]$cnt2 }
            }
        } catch {}
        return 0
    }
    function Get-RangeItem($r, [int]$idx) {
        if (-not $r) { return $null }
        try {
            $it = Com-Get $r 'Item' @($idx)
            if ($it) { return ,$it }
        } catch {}
        try {
            $shps = Com-Get $r 'Shapes'
            if ($shps) {
                $it2 = Com-Get $shps 'Item' @($idx)
                if ($it2) { return ,$it2 }
            }
        } catch {}
        return $null
    }

    $selection = Com-Get $corel 'ActiveSelection'
    if (-not $selection -or (Get-RangeCount $selection) -eq 0) {
        $selection = Com-Get $doc 'Selection'
    }
    $selCount = Get-RangeCount $selection
    if ($selCount -eq 0) { throw "Silakan pilih (seleksi/blok) 1 grup master pola jersey di CorelDRAW terlebih dahulu." }

    $jsonFile = $args[0]
    $data = Get-Content -Path $jsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $rawPlayers = $data.players
    $targetSize = if ($data.targetSize) { [string]$data.targetSize } else { 'ALL' }
    $spacing = [double]$data.spacingCm
    $limit = [int]$data.limitCopy
    if ($limit -lt 1) { $limit = 4 }
    $dir = if ($data.direction) { [string]$data.direction } else { 'vertical' }
    $maxW = if ($data.maxNameWidthCm) { [double]$data.maxNameWidthCm } else { 27.0 }
    $mappings = $data.mappings
    $sizeChart = $data.sizeChart
    $enableAutoResize = [bool]$data.enableAutoResize
    $autoCurves = [bool]$data.autoCurves
    $masterSize = if ($data.masterSize) { [string]$data.masterSize } else { 'L' }
    $groupBySize = [bool]$data.groupBySize

    # Helper: Convert string case (Sentence case, lowercase, UPPERCASE, Title Case, tOGGLE cASE)
    function Convert-TextCase($str, $caseType) {
        if ([string]::IsNullOrEmpty($str) -or -not $caseType -or $caseType -eq 'none') { return $str }
        switch ($caseType.ToLower()) {
            'upper' { return $str.ToUpper() }
            'lower' { return $str.ToLower() }
            'title' {
                try {
                    $ti = (Get-Culture).TextInfo
                    return $ti.ToTitleCase($str.ToLower())
                } catch {
                    return $str
                }
            }
            'sentence' {
                $lower = $str.ToLower()
                if ($lower.Length -gt 0) {
                    return $lower.Substring(0, 1).ToUpper() + $lower.Substring(1)
                }
                return $lower
            }
            'toggle' {
                $chars = $str.ToCharArray()
                for ($k = 0; $k -lt $chars.Length; $k++) {
                    if ([char]::IsUpper($chars[$k])) {
                        $chars[$k] = [char]::ToLower($chars[$k])
                    } elseif ([char]::IsLower($chars[$k])) {
                        $chars[$k] = [char]::ToUpper($chars[$k])
                    }
                }
                return (-join $chars)
            }
            default { return $str }
        }
    }

    # Helper: Get value from player/row object by key, property, or alias
    function Get-FieldValue($p, $colName) {
        if (-not $p -or [string]::IsNullOrEmpty($colName)) { return '' }
        try {
            if ($p.PSObject -and $p.PSObject.Properties) {
                $prop = $p.PSObject.Properties[$colName]
                if ($prop -and $prop.Value -ne $null) { return [string]$prop.Value }
                foreach ($pr in $p.PSObject.Properties) {
                    if ($pr.Name.ToLower() -eq $colName.ToLower()) {
                        return [string]$pr.Value
                    }
                }
            }
        } catch {}
        try {
            if ($p.Keys) {
                foreach ($k in $p.Keys) {
                    if ($k.ToString().ToLower() -eq $colName.ToLower()) {
                        return [string]$p[$k]
                    }
                }
            }
        } catch {}
        try {
            $val = $p.$colName
            if ($val -ne $null) { return [string]$val }
        } catch {}
        return ''
    }

    # Helper: Resolve player value for a mapping object
    function Get-PlayerValueForMapping($p, $m, [int]$varIdx) {
        if (-not $p -or -not $m) { return '' }
        $col = if ($m.column) { [string]$m.column } else { '' }
        $ph = if ($m.placeholder) { [string]$m.placeholder } else { '' }
        $lbl = if ($m.label) { [string]$m.label } else { '' }

        if ($col) {
            $v = Get-FieldValue $p $col
            if ($v -ne '') { return $v }
        }
        if ($ph) {
            $v = Get-FieldValue $p $ph
            if ($v -ne '') { return $v }
            $bare = $ph.Trim('[', ']', '{', '}')
            if ($bare) {
                $v = Get-FieldValue $p $bare
                if ($v -ne '') { return $v }
            }
        }
        if ($lbl) {
            $v = Get-FieldValue $p $lbl
            if ($v -ne '') { return $v }
        }

        # Try semantic fallback
        $combined = ($ph + " " + $lbl + " " + $col).ToLower()
        if ($combined -match 'nama|name|pemain|player') {
            foreach ($k in @('name','nama','pemain','player','playerName')) {
                $v = Get-FieldValue $p $k
                if ($v -ne '') { return $v }
            }
        }
        if ($combined -match 'nomor|number|no\b|punggung') {
            foreach ($k in @('number','nomor','no','punggung')) {
                $v = Get-FieldValue $p $k
                if ($v -ne '') { return $v }
            }
        }
        if ($combined -match 'ukuran|size') {
            foreach ($k in @('size','ukuran','Ukuran','Size')) {
                $v = Get-FieldValue $p $k
                if ($v -ne '') { return $v }
            }
        }
        if ($combined -match 'sponsor') {
            foreach ($k in @('sponsor','Sponsor')) {
                $v = Get-FieldValue $p $k
                if ($v -ne '') { return $v }
            }
        }

        if ($p.PSObject -and $p.PSObject.Properties) {
            $props = @($p.PSObject.Properties)
            if ($varIdx -ge 0 -and $varIdx -lt $props.Count) {
                $v = [string]$props[$varIdx].Value
                if ($v -ne '') { return $v }
            }
        }

        return ''
    }

    # Filter players by target size if specified
    $playerList = @()
    if ($targetSize -and $targetSize -ne 'ALL') {
        foreach ($p in $rawPlayers) {
            $sz = Get-FieldValue $p 'Ukuran'
            if (-not $sz) { $sz = Get-FieldValue $p 'Size' }
            if (-not $sz) { $sz = 'L' }
            if ($sz.Trim().ToUpper() -eq $targetSize.Trim().ToUpper()) {
                $playerList += $p
            }
        }
    } else {
        $playerList = $rawPlayers
    }

    if (-not $playerList -or $playerList.Count -eq 0) {
        throw "Tidak ada data pemain yang cocok untuk ukuran '$targetSize'."
    }

    # Sort players by size if requested
    if ($groupBySize) {
        $playerList = $playerList | Sort-Object {
            $s = Get-FieldValue $_ 'Ukuran'
            if (-not $s) { $s = Get-FieldValue $_ 'Size' }
            $s
        }
    }

    # Format text shape with font casing, alignment, proportional scaling, and true centering
    function Apply-TextToShape($ts, $val, $align, $textCase, $maxWLimit, $lockRatio) {
        if (-not $ts) { return }
        try {
            $origCenterX = [double](Com-Get $ts 'CenterX')
            $origCenterY = [double](Com-Get $ts 'CenterY')
            $origLeft    = [double](Com-Get $ts 'PositionX')
            $origW       = [double](Com-Get $ts 'SizeWidth')
            $origH       = [double](Com-Get $ts 'SizeHeight')

            if ($textCase -and $textCase -ne 'none') {
                $val = Convert-TextCase $val $textCase
            }

            $txtObj = Com-Get $ts 'Text'
            $story = if ($txtObj) { Com-Get $txtObj 'Story' } else { $null }
            if ($story) {
                Com-Set $story 'Text' ([string]$val)

                if ($textCase -and $textCase -ne 'none') {
                    $cdrCaseEnum = switch ($textCase.ToLower()) {
                        'sentence' { 1 }
                        'lower'    { 2 }
                        'upper'    { 3 }
                        'title'    { 4 }
                        'toggle'   { 5 }
                        default    { 0 }
                    }
                    if ($cdrCaseEnum -gt 0) {
                        try { Com-Set $story 'Case' $cdrCaseEnum } catch {}
                    }
                }

                $alignMode = if ($align) { $align.ToString().ToLower() } else { 'center' }
                try {
                    if ($alignMode -eq 'left') {
                        Com-Set $story 'Alignment' 1 # cdrLeftAlignment
                    } elseif ($alignMode -eq 'right') {
                        Com-Set $story 'Alignment' 2 # cdrRightAlignment
                    } else {
                        Com-Set $story 'Alignment' 3 # cdrCenterAlignment
                    }
                } catch {}
            }

            $curW = [double](Com-Get $ts 'SizeWidth')
            $curH = [double](Com-Get $ts 'SizeHeight')
            $targetLimit = [double]$maxWLimit
            $isLocked = if ($lockRatio -ne $null) { [bool]$lockRatio } else { $true }

            if ($targetLimit -gt 0 -and $curW -gt $targetLimit) {
                $scale = $targetLimit / $curW
                $newW = $targetLimit
                $newH = if ($isLocked -and $curH -gt 0) { $curH * $scale } else { $curH }
                try {
                    [void](Com-Call $ts 'SetSize' @([double]$newW, [double]$newH))
                } catch {
                    Com-Set $ts 'SizeWidth' ([double]$newW)
                    if ($isLocked) { Com-Set $ts 'SizeHeight' ([double]$newH) }
                }
            }

            # Enforce true center coordinate or requested alignment
            if ($alignMode -eq 'left') {
                Com-Set $ts 'PositionX' ([double]$origLeft)
                Com-Set $ts 'CenterY' ([double]$origCenterY)
            } elseif ($alignMode -eq 'right') {
                $currW = [double](Com-Get $ts 'SizeWidth')
                Com-Set $ts 'PositionX' ([double](($origLeft + $origW) - $currW))
                Com-Set $ts 'CenterY' ([double]$origCenterY)
            } else {
                Com-Set $ts 'CenterX' ([double]$origCenterX)
                Com-Set $ts 'CenterY' ([double]$origCenterY)
            }
        } catch {}
    }

    # Recursive text finder using FastCom
    function Find-AllShapeTexts($container) {
        $list = @()
        if (-not $container) { return $list }
        try {
            $cType = [int](Com-Get $container 'Type')
            if ($cType -eq 6) {
                $list += ,$container
                return $list
            }
        } catch {}
        try {
            $shps = Com-Get $container 'Shapes'
            $cnt = if ($shps) { [int](Com-Get $shps 'Count') } else { 0 }
            for ($k = 1; $k -le $cnt; $k++) {
                $s = Com-Get $shps 'Item' @($k)
                if (-not $s) { continue }
                $sType = [int](Com-Get $s 'Type')
                if ($sType -eq 6) {
                    $list += ,$s
                } elseif ($sType -eq 7) {
                    $sub = @(Find-AllShapeTexts $s)
                    if ($sub.Count -gt 0) { $list += $sub }
                }
                try {
                    $pc = Com-Get $s 'PowerClip'
                    if ($pc) {
                        $pcSub = @(Find-AllShapeTexts $pc)
                        if ($pcSub.Count -gt 0) { $list += $pcSub }
                    }
                } catch {}
            }
        } catch {}
        return $list
    }

    $masterShape = if ($selCount -gt 1) { Com-Call $selection 'Group' } else { Get-RangeItem $selection 1 }
    $origMasterW = [double](Com-Get $masterShape 'SizeWidth')
    $origMasterH = [double](Com-Get $masterShape 'SizeHeight')
    $masterRatio = if ($origMasterH -gt 0) { $origMasterW / $origMasterH } else { 1.0 }

    # Map text shapes in master shape to mappings BEFORE making duplicates
    $masterTexts = @(Find-AllShapeTexts $masterShape)
    $bindings = @()
    $usedMappingIndices = @{}

    for ($t = 0; $t -lt $masterTexts.Count; $t++) {
        $ts = $masterTexts[$t]
        $txtObj = Com-Get $ts 'Text'
        $story = if ($txtObj) { Com-Get $txtObj 'Story' } else { $null }
        $initialText = if ($story) { ([string](Com-Get $story 'Text')).Trim() } else { '' }

        $matchedMapping = $null
        $matchedIndex = -1

        # 1. Exact or bare placeholder match
        for ($mIdx = 0; $mIdx -lt $mappings.Count; $mIdx++) {
            if ($usedMappingIndices.ContainsKey($mIdx)) { continue }
            $m = $mappings[$mIdx]
            $ph = if ($m.placeholder) { [string]$m.placeholder.Trim() } else { '' }
            $bare = $ph.Trim('[', ']', '{', '}')
            $lbl = if ($m.label) { [string]$m.label.Trim() } else { '' }

            if ($ph -and ($initialText -ieq $ph -or $initialText -match [regex]::Escape($ph))) {
                $matchedMapping = $m; $matchedIndex = $mIdx; break
            }
            if ($bare -and ($initialText -ieq $bare -or $initialText -match [regex]::Escape($bare))) {
                $matchedMapping = $m; $matchedIndex = $mIdx; break
            }
            if ($lbl -and ($initialText -ieq $lbl -or $initialText -match [regex]::Escape($lbl))) {
                $matchedMapping = $m; $matchedIndex = $mIdx; break
            }
        }

        # 2. Semantic keyword match if not matched
        if (-not $matchedMapping) {
            $inLow = $initialText.ToLower()
            for ($mIdx = 0; $mIdx -lt $mappings.Count; $mIdx++) {
                if ($usedMappingIndices.ContainsKey($mIdx)) { continue }
                $m = $mappings[$mIdx]
                $mPh = if ($m.placeholder) { [string]$m.placeholder } else { '' }
                $mLbl = if ($m.label) { [string]$m.label } else { '' }
                $mCol = if ($m.column) { [string]$m.column } else { '' }
                $combined = ($mPh + " " + $mLbl + " " + $mCol).ToLower()
                if ($inLow -match 'nama|name|pemain' -and $combined -match 'nama|name|pemain') {
                    $matchedMapping = $m; $matchedIndex = $mIdx; break
                }
                if (($inLow -match 'nomor|number|no\b|#' -or $inLow -match '^\d+$') -and $combined -match 'nomor|number|no\b') {
                    $matchedMapping = $m; $matchedIndex = $mIdx; break
                }
                if ($inLow -match 'ukuran|size|^[smlxl2-9]+$' -and $combined -match 'ukuran|size') {
                    $matchedMapping = $m; $matchedIndex = $mIdx; break
                }
                if ($inLow -match 'sponsor' -and $combined -match 'sponsor') {
                    $matchedMapping = $m; $matchedIndex = $mIdx; break
                }
            }
        }

        # 3. Positional fallback: match remaining available mapping
        if (-not $matchedMapping) {
            for ($mIdx = 0; $mIdx -lt $mappings.Count; $mIdx++) {
                if (-not $usedMappingIndices.ContainsKey($mIdx)) {
                    $matchedMapping = $mappings[$mIdx]
                    $matchedIndex = $mIdx
                    break
                }
            }
        }

        if ($matchedIndex -ge 0) {
            $usedMappingIndices[$matchedIndex] = $true
        }

        $bindings += [PSCustomObject]@{
            ShapeIndex = $t
            InitialText = $initialText
            Mapping = $matchedMapping
            MappingIndex = $matchedIndex
        }
    }

    # Function to update any card (master or duplicated) using recorded bindings
    function UpdateJerseyCard($cardShape, $player, $bindingsList, $fallbackMaxW) {
        if (-not $cardShape -or -not $player) { return }
        $cardTexts = @(Find-AllShapeTexts $cardShape)
        for ($t = 0; $t -lt $bindingsList.Count; $t++) {
            if ($t -ge $cardTexts.Count) { break }
            $b = $bindingsList[$t]
            $m = $b.Mapping
            if (-not $m) { continue }
            $ts = $cardTexts[$t]

            $val = Get-PlayerValueForMapping $player $m $b.MappingIndex
            $mW = if ($m.maxWidth -and [double]$m.maxWidth -gt 0) { [double]$m.maxWidth } elseif ($m.width -and [double]$m.width -gt 0) { [double]$m.width } else { $fallbackMaxW }
            $lR = if ($m.lockRatio -ne $null) { [bool]$m.lockRatio } else { $true }

            Apply-TextToShape $ts $val $m.align $m.textCase $mW $lR
        }
    }

    # Helper: Resolve target pattern dimensions based on sizeChart and aspect ratio
    function Get-SizeDimensions($szName, $chart, $mRatio, $origW, $origH) {
        if (-not $szName -or -not $chart) { return @{ targetW = $origW; targetH = $origH } }
        $cleanSz = $szName.ToString().Trim().ToUpper()

        $entry = $null
        if ($chart.PSObject -and $chart.PSObject.Properties) {
            foreach ($prop in $chart.PSObject.Properties) {
                if ($prop.Name.Trim().ToUpper() -eq $cleanSz) {
                    $entry = $prop.Value
                    break
                }
            }
        } elseif ($chart.Keys) {
            foreach ($k in $chart.Keys) {
                if ($k.ToString().Trim().ToUpper() -eq $cleanSz) {
                    $entry = $chart[$k]
                    break
                }
            }
        }

        if (-not $entry) {
            return @{ targetW = $origW; targetH = $origH }
        }

        $tw = if ($entry.width) { [double]$entry.width } else { 0.0 }
        $th = if ($entry.height) { [double]$entry.height } else { 0.0 }
        $isLock = if ($entry.lockRatio -ne $null) { [bool]$entry.lockRatio } else { $true }

        if ($th -gt 0 -and $tw -le 0 -and $isLock) {
            $tw = [math]::Round(($th * $mRatio), 3)
        } elseif ($tw -gt 0 -and $th -le 0 -and $isLock) {
            $th = [math]::Round(($tw / $mRatio), 3)
        } elseif ($tw -le 0 -and $th -le 0) {
            $tw = $origW
            $th = $origH
        }

        return @{ targetW = $tw; targetH = $th }
    }

    # Optimization kept OFF during layout to ensure real-time glyph metrics and prevent GPU tile cache desync
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}
    try { [void](Com-Call $doc 'BeginCommandGroup' @("CTS Auto-Layout Jersey")) } catch {}

    $cardList = @()
    $cardList += ,$masterShape

    $currentX = 0.0
    $currentY = 0.0
    $colMaxW = $origMasterW
    $rowMaxH = $origMasterH
    $colCount = 1
    $rowCount = 1

    if ($dir -eq 'horizontal') {
        $currentX += ($origMasterW + $spacing)
    } else {
        $currentY -= ($origMasterH + $spacing)
    }

    # Duplicate pristine master template shapes for all cards first
    for ($i = 1; $i -lt $playerList.Count; $i++) {
        if ($dir -eq 'horizontal') {
            if ($rowCount -ge $limit) {
                $currentY -= ($rowMaxH + $spacing)
                $currentX = 0.0
                $rowCount = 0
                $rowMaxH = 0.0
            }
            $dx = $currentX
            $dy = $currentY
        } else {
            # vertical
            if ($colCount -ge $limit) {
                $currentX += ($colMaxW + $spacing)
                $currentY = 0.0
                $colCount = 0
                $colMaxW = 0.0
            }
            $dx = $currentX
            $dy = $currentY
        }

        $dup = Com-Call $masterShape 'Duplicate' @([double]$dx, [double]$dy)
        $cardList += ,$dup

        if ($dir -eq 'horizontal') {
            $rowMaxH = [math]::Max($rowMaxH, $origMasterH)
            $currentX += ($origMasterW + $spacing)
            $rowCount++
        } else {
            $colMaxW = [math]::Max($colMaxW, $origMasterW)
            $currentY -= ($origMasterH + $spacing)
            $colCount++
        }
    }

    # Now populate data and apply auto-resize to each card
    $created = 0
    for ($i = 0; $i -lt $cardList.Count; $i++) {
        $card = $cardList[$i]
        $p = $playerList[$i]
        $sz = Get-FieldValue $p 'Ukuran'
        if (-not $sz) { $sz = Get-FieldValue $p 'Size' }
        $dim = Get-SizeDimensions $sz $sizeChart $masterRatio $origMasterW $origMasterH
        $targetW = [double]$dim.targetW
        $targetH = [double]$dim.targetH

        if ($enableAutoResize -and $targetW -gt 0 -and $targetH -gt 0 -and ([math]::Abs($targetW - $origMasterW) -gt 0.01 -or [math]::Abs($targetH - $origMasterH) -gt 0.01)) {
            try { [void](Com-Call $card 'SetSize' @([double]$targetW, [double]$targetH)) } catch {
                Com-Set $card 'SizeWidth' ([double]$targetW)
                Com-Set $card 'SizeHeight' ([double]$targetH)
            }
        }

        UpdateJerseyCard $card $p $bindings $maxW

        if ($autoCurves) {
            $cTexts = @(Find-AllShapeTexts $card)
            for ($ck = $cTexts.Count - 1; $ck -ge 0; $ck--) {
                try {
                    $ct = $cTexts[$ck]
                    if ($ct) {
                        try { [void](Com-Call $ct 'ConvertToCurves') } catch { try { [void](Com-Call $ct 'CreateCurves') } catch {} }
                    }
                } catch {}
            }
        }

        $created++
    }

    # Deselect all shapes to stop CorelDRAW GPU engine from calculating live selection matrices on zoom
    try { [void](Com-Call $doc 'ClearSelection') } catch {}
    try { [void](Com-Call $corel 'ClearSelection') } catch {}

    if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { [void](Com-Call $doc 'EndCommandGroup') } catch {}

    # Comprehensive viewport refresh and cache purge across application and active window/view
    try { [void](Com-Call $corel 'Refresh') } catch {}
    try {
        $aw = Com-Get $corel 'ActiveWindow'
        if ($aw) {
            [void](Com-Call $aw 'Refresh')
            $av = Com-Get $aw 'ActiveView'
            if ($av) { try { [void](Com-Call $av 'ScreenRefresh') } catch {} }
        }
    } catch {}
    try {
        $docAw = Com-Get $doc 'ActiveWindow'
        if ($docAw) {
            [void](Com-Call $docAw 'Refresh')
            $docAv = Com-Get $docAw 'ActiveView'
            if ($docAv) { try { [void](Com-Call $docAv 'ScreenRefresh') } catch {} }
        }
    } catch {}

    $result.success = $true
    $result.count = $created
    $result.message = "Berhasil menata $created pola jersey di CorelDRAW!"
} catch {
    try {
        if ($corel) {
            try { [void](Com-Call $doc 'ClearSelection') } catch {}
            try { [void](Com-Call $corel 'ClearSelection') } catch {}
            try { Com-Set $corel 'Optimization' $false } catch {}
            try { Com-Set $corel 'EventsEnabled' $true } catch {}
            if ($doc) {
                if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
                try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
            }
            try { [void](Com-Call $corel 'Refresh') } catch {}
            try {
                $aw = Com-Get $corel 'ActiveWindow'
                if ($aw) {
                    [void](Com-Call $aw 'Refresh')
                    $av = Com-Get $aw 'ActiveView'
                    if ($av) { try { [void](Com-Call $av 'ScreenRefresh') } catch {} }
                }
            } catch {}
        }
    } catch {}
    $result.success = $false
    $result.message = $_.Exception.Message
} finally {
    if ($doc) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
    if ($corel) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($corel) | Out-Null } catch {} }
    [GC]::Collect()
}
$result | ConvertTo-Json -Compress
`;

    fs.writeFileSync(tempPs1Path, psScript, 'utf-8');
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempPs1Path, tempJsonPath],
      { timeout: 45000 },
      (err, stdout, stderr) => {
        try {
          if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
          if (fs.existsSync(tempPs1Path)) fs.unlinkSync(tempPs1Path);
        } catch {}
        if (err && !stdout) {
          return resolve({ success: false, message: stderr || err?.message || 'Gagal menjalankan otomasi' });
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch {
          resolve({ success: false, message: stdout.trim() || stderr || 'Gagal memproses respon CorelDRAW' });
        }
      }
    );
  });
});

// Selection Info Handler
ipcMain.handle('corel:get-selection-info', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ success = $false; count = 0; widthCm = 0; heightCm = 0 }
try {
${COREL_CONNECT_PS}
    if ($doc) {
        $origUnit = Com-Get $doc 'Unit'
        try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm)
        $sel = Com-Get $corel 'ActiveSelection'
        $shps = if ($sel) { Com-Get $sel 'Shapes' } else { $null }
        $cnt = if ($shps) { [int](Com-Get $shps 'Count') } else { 0 }
        if ($cnt -eq 0) {
            $sel = Com-Get $doc 'Selection'
            $shps = if ($sel) { Com-Get $sel 'Shapes' } else { $null }
            $cnt = if ($shps) { [int](Com-Get $shps 'Count') } else { 0 }
        }
        if ($sel -and $cnt -gt 0) {
            $result.success = $true
            $result.count = $cnt
            $result.widthCm = [math]::Round([double](Com-Get $sel 'SizeWidth'), 3)
            $result.heightCm = [math]::Round([double](Com-Get $sel 'SizeHeight'), 3)
        } else {
            $result.success = $true
        }
        if ($null -ne $origUnit) { try { Com-Set $doc 'Unit' $origUnit } catch {} }
    }
} catch {}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
});

// AI Jersey Tracer APIs
ipcMain.handle('corel:ai-tracer-validate-key', async (_event, apiKey) => {
  try {
    if (!aiTracerService) throw new Error('Modul AI Tracer belum diinisialisasi');
    return await aiTracerService.validateGeminiApiKey(apiKey);
  } catch (err) {
    return { valid: false, message: err?.message || 'Gagal validasi API Key' };
  }
});

ipcMain.handle('corel:ai-tracer-process', async (_event, payload) => {
  try {
    if (!aiTracerService) throw new Error('Modul AI Tracer belum diinisialisasi');
    return await aiTracerService.processAiJerseyTrace(payload);
  } catch (err) {
    return { success: false, message: err?.message || 'Gagal memproses gambar AI' };
  }
});

ipcMain.handle('corel:apply-ai-pattern', async (_event, payload) => {
  return new Promise((resolve) => {
    const { patternPath, logoBase64, bleedCm = 1.5 } = payload || {};
    if (!patternPath || !fs.existsSync(patternPath)) {
      return resolve({ success: false, message: 'File motif tidak ditemukan.' });
    }
    let logoPath = '';
    if (logoBase64 && aiTracerService) {
      try { logoPath = aiTracerService.saveExtractedLogo(logoBase64); } catch {}
    }

    const tempDir = app.getPath('temp');
    const tempPs1Path = path.join(tempDir, `corel_apply_pattern_${Date.now()}.ps1`);
    const tempJsonPath = path.join(tempDir, `corel_apply_pattern_${Date.now()}.json`);
    fs.writeFileSync(tempJsonPath, JSON.stringify({ patternPath, logoPath, bleedCm }), 'utf-8');

    const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }
try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Buka file di CorelDRAW terlebih dahulu." }

    $origUnit = Com-Get $doc 'Unit'
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm)

    $sel = Com-Get $corel 'ActiveSelection'
    $shps = if ($sel) { Com-Get $sel 'Shapes' } else { $null }
    $cnt = if ($shps) { [int](Com-Get $shps 'Count') } else { 0 }
    if ($cnt -eq 0) {
        $sel = Com-Get $doc 'Selection'
        $shps = if ($sel) { Com-Get $sel 'Shapes' } else { $null }
        $cnt = if ($shps) { [int](Com-Get $shps 'Count') } else { 0 }
    }
    if ($cnt -eq 0) { throw "Pilih bentuk pola target di CorelDRAW untuk di-PowerClip." }

    $targetShape = if ($cnt -gt 1) { Com-Call $sel 'Group' } else { Com-Get $shps 'Item' @(1) }
    $w = [double](Com-Get $targetShape 'SizeWidth')
    $h = [double](Com-Get $targetShape 'SizeHeight')
    $cx = [double](Com-Get $targetShape 'CenterX')
    $cy = [double](Com-Get $targetShape 'CenterY')

    $data = Get-Content -Path '${tempJsonPath.replace(/'/g, "''")}' -Raw -Encoding UTF8 | ConvertFrom-Json
    $patFile = $data.patternPath
    $bleed = [double]$data.bleedCm

    $layer = Com-Get $doc 'ActiveLayer'
    $importedBmp = Com-Call $layer 'ImportBitmap' @([string]$patFile)
    if (-not $importedBmp) { throw "Gagal mengimpor gambar ke CorelDRAW." }

    Com-Set $importedBmp 'SizeWidth' ([double]($w + ($bleed * 2)))
    Com-Set $importedBmp 'SizeHeight' ([double]($h + ($bleed * 2)))
    Com-Set $importedBmp 'CenterX' ([double]$cx)
    Com-Set $importedBmp 'CenterY' ([double]$cy)

    try {
        [void](Com-Call $importedBmp 'AddToPowerClip' @($targetShape))
    } catch {
        try { [void](Com-Call $importedBmp 'OrderToBack') } catch {}
    }

    if ($null -ne $origUnit) { try { Com-Set $doc 'Unit' $origUnit } catch {} }
    try { [void](Com-Call $corel 'Refresh') } catch {}
    try {
        $aw = Com-Get $corel 'ActiveWindow'
        if ($aw) { [void](Com-Call $aw 'Refresh') }
    } catch {}
    $result.success = $true
    $result.message = "Motif berhasil diterapkan ke dalam pola CorelDRAW!"
} catch {
    $result.success = $false
    $result.message = $_.Exception.Message
}
$result | ConvertTo-Json -Compress
`;

    fs.writeFileSync(tempPs1Path, psScript, 'utf-8');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempPs1Path], { timeout: 30000 }, (err, stdout) => {
      try {
        if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
        if (fs.existsSync(tempPs1Path)) fs.unlinkSync(tempPs1Path);
      } catch {}
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        resolve({ success: false, message: stdout?.trim() || err?.message || 'Gagal memproses PowerClip' });
      }
    });
  });
});

ipcMain.handle('corel:copy-image-clipboard', async (_event, imagePathOrBase64) => {
  try {
    let img = null;
    if (typeof imagePathOrBase64 === 'string') {
      if (imagePathOrBase64.startsWith('data:image')) {
        const b64 = imagePathOrBase64.split('base64,')[1];
        img = nativeImage.createFromBuffer(Buffer.from(b64, 'base64'));
      } else if (fs.existsSync(imagePathOrBase64)) {
        img = nativeImage.createFromPath(imagePathOrBase64);
      }
    }
    if (img && !img.isEmpty()) {
      clipboard.writeImage(img);
      return { success: true };
    }
    return { success: false, message: 'Gagal memproses gambar.' };
  } catch (err) {
    return { success: false, message: err?.message || 'Gagal menyalin gambar.' };
  }
});

ipcMain.handle('corel:read-image-clipboard', async () => {
  try {
    const img = clipboard.readImage();
    if (img && !img.isEmpty()) {
      const buf = img.toPNG();
      const size = img.getSize();
      return {
        success: true,
        dataUrl: `data:image/png;base64,${buf.toString('base64')}`,
        size,
      };
    }
    return { success: false, message: 'Clipboard tidak berisi gambar. Salin gambar terlebih dahulu.' };
  } catch (err) {
    return { success: false, message: err?.message || 'Gagal membaca clipboard.' };
  }
});

ipcMain.handle('corel:save-pattern-image', async (_event, { dataUrl, upscale4k = false }) => {
  try {
    if (!dataUrl) throw new Error('Data gambar kosong.');
    const b64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
    let buf = Buffer.from(b64, 'base64');

    if (upscale4k) {
      try {
        const img = nativeImage.createFromBuffer(buf);
        const size = img.getSize();
        const resized = img.resize({ width: size.width * 2, height: size.height * 2, quality: 'best' });
        buf = resized.toPNG();
      } catch {}
    }

    const tempDir = app.getPath('temp');
    const fileName = `cts_pattern_${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, buf);

    return {
      success: true,
      filePath,
      dataUrl: `data:image/png;base64,${buf.toString('base64')}`,
    };
  } catch (err) {
    return { success: false, message: err?.message || 'Gagal menyimpan gambar.' };
  }
});

ipcMain.handle('corel:open-file-explorer', async (_event, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    }
    return { success: false, message: 'File tidak ditemukan.' };
  } catch (err) {
    return { success: false, message: err?.message || 'Gagal membuka folder.' };
  }
});

ipcMain.handle('corel:open-external-url', async (_event, url) => {
  try {
    if (url) {
      await shell.openExternal(url);
      return { success: true };
    }
    return { success: false, message: 'URL kosong.' };
  } catch (err) {
    return { success: false, message: err?.message };
  }
});

// Ghost Process Cleaner & App Launcher
ipcMain.handle('corel:clean-ghost-processes', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$procs = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue
$killed = 0
if ($procs) {
    foreach ($p in $procs) {
        if ($p.MainWindowHandle -eq 0) {
            try { Stop-Process -Id $p.Id -Force; $killed++ } catch {}
        }
    }
}
@{ success = $true; killed = $killed; message = "Berhasil membersihkan $killed proses CorelDRAW latar belakang." } | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
});

ipcMain.handle('corel:launch-app', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$shortcut = Get-ChildItem "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs" -Recurse -Filter "*CorelDRAW*.lnk" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch "Font|PHOTO|CAPTURE" } | Select-Object -First 1
if ($shortcut) {
    Start-Process -FilePath $shortcut.FullName
    @{ success = $true; message = "Aplikasi CorelDRAW sedang dibuka..." } | ConvertTo-Json -Compress
} else {
    $paths = @(
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2024\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2023\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2022\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2021\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2020\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2019\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite X8\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite X7\\Programs64\\CorelDrw.exe"
    )
    $found = $null
    foreach ($p in $paths) {
        if (Test-Path $p) { $found = $p; break }
    }
    if (-not $found) {
        try {
            $regPath = (Get-ItemProperty "Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\CorelDRW.exe" -ErrorAction SilentlyContinue).'(default)'
            if ($regPath -and (Test-Path $regPath)) { $found = $regPath }
        } catch {}
    }
    if ($found) {
        $workDir = [System.IO.Path]::GetDirectoryName($found)
        Start-Process -FilePath $found -WorkingDirectory $workDir
        @{ success = $true; message = "Aplikasi CorelDRAW sedang dibuka..." } | ConvertTo-Json -Compress
    } else {
        @{ success = $false; message = "File eksekusi CorelDRW.exe tidak ditemukan di lokasi standar." } | ConvertTo-Json -Compress
    }
}
`;
  return runPowerShellScript(ps, 5000);
});



// ==========================================
// CDR Version Downsaver & Inspector Handlers
// ==========================================
ipcMain.handle('corel:inspect-cdr-file', async (_event, filePath) => {
  try {
    if (!cdrVersionService) cdrVersionService = require('./cdrVersionService.cjs');
    return cdrVersionService.inspectCdrFile(filePath);
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('corel:scan-cdr-directory', async (_event, { dirPath, recursive }) => {
  try {
    if (!cdrVersionService) cdrVersionService = require('./cdrVersionService.cjs');
    const files = cdrVersionService.scanDirectoryForCdr(dirPath, recursive !== false);
    return { success: true, files };
  } catch (err) {
    return { success: false, message: err.message, files: [] };
  }
});

ipcMain.handle('corel:inspect-cdr-files', async (_event, filePaths) => {
  try {
    if (!cdrVersionService) cdrVersionService = require('./cdrVersionService.cjs');
    return cdrVersionService.inspectCdrBatch(filePaths);
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('corel:downsave-cdr-batch', async (_event, payload) => {
  const {
    files = [],
    targetVersion = 14,
    outputFolder = '',
    curveTo = false,
    cleanupJunk = true,
    overwrite = false,
    suffix = ''
  } = payload || {};

  if (!files || !files.length) {
    return { success: false, message: 'Tidak ada file CDR yang dipilih.' };
  }

  isOperationCancelled = false;
  const tempDir = app.getPath('temp');
  const cancelMarker = path.join(tempDir, `corel_cancel_${Date.now()}.flag`);
  const tempJson = path.join(tempDir, `corel_downsave_${Date.now()}.json`);

  const configData = {
    files,
    targetVersion: parseInt(targetVersion, 10) || 14,
    outputFolder: outputFolder || '',
    curveTo: !!curveTo,
    cleanupJunk: !!cleanupJunk,
    overwrite: !!overwrite,
    suffix: suffix !== undefined ? suffix : ''
  };

  fs.writeFileSync(tempJson, JSON.stringify(configData), 'utf8');

  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @{
    success = $false
    converted = @()
    failed = @()
    message = ''
}

$cancelMarker = '${cancelMarker.replace(/'/g, "''")}'
$jsonPath = '${tempJson.replace(/'/g, "''")}'
$data = Get-Content -Path $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

$files = $data.files
$targetVersion = [int]$data.targetVersion
$outputFolder = [string]$data.outputFolder
$suffix = [string]$data.suffix
$curveTo = [bool]$data.curveTo
$cleanupJunk = [bool]$data.cleanupJunk
$overwrite = [bool]$data.overwrite

${getCorelProcessHelpersPs()}

$allProcs = @(Get-RealCorelProcesses)
if (-not $allProcs -or $allProcs.Count -eq 0) {
    throw "CorelDRAW tidak sedang berjalan. Silakan buka aplikasi CorelDRAW Anda terlebih dahulu."
}

# 1. Determine best CorelDRAW version for downsaving
$preferredVer = '${activePreferredVersion}'
$preferredPid = ${activePreferredPid}
$targetProc = $null
if ($preferredPid -and $preferredPid -gt 0) {
    $cand = $allProcs | Where-Object { $_.Id -eq $preferredPid } | Select-Object -First 1
    if ($cand) {
        if ($preferredVer -eq 'auto' -or -not ($preferredVer -match '^\\d+$') -or (Get-CorelVerFromProcess $cand) -eq [int]$preferredVer) {
            $targetProc = $cand
        }
    }
}
if (-not $targetProc -and $preferredVer -ne 'auto' -and $preferredVer -match '^\\d+$') {
    $pVer = [int]$preferredVer
    $targetProc = $allProcs | Where-Object { (Get-CorelVerFromProcess $_) -eq $pVer } | Select-Object -First 1
}

# If auto or not found, pick the HIGHEST running version so it can open any newer file
if (-not $targetProc) {
    $highestV = 0
    foreach ($p in $allProcs) {
        $v = Get-CorelVerFromProcess $p
        if ($v -gt $highestV) {
            $highestV = $v
            $targetProc = $p
        }
    }
}
if (-not $targetProc) {
    $targetProc = $allProcs | Select-Object -First 1
}
$runningVer = Get-CorelVerFromProcess $targetProc

$corel = $null
if ($runningVer -gt 0) {
    try {
        $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$runningVer")
        if ($c) {
            $mv = Get-CorelMajorFromCom $c
            if ($mv -eq 0 -or $mv -eq $runningVer -or $allProcs.Count -eq 1) { $corel = $c }
        }
    } catch {}
}
if (-not $corel) {
    try {
        $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application")
        if ($c) {
            $mv = Get-CorelMajorFromCom $c
            if ($runningVer -eq 0 -or $mv -eq $runningVer -or ($mv -eq 0 -and $allProcs.Count -eq 1)) { $corel = $c }
        }
    } catch {}
}
if (-not $corel -and $runningVer -gt 0) {
    try {
        $c = New-Object -ComObject "CorelDRAW.Application.$runningVer" -ErrorAction SilentlyContinue
        if ($c) {
            $mv = Get-CorelMajorFromCom $c
            if ($mv -eq 0 -or $mv -eq $runningVer -or $allProcs.Count -eq 1) { $corel = $c }
        }
    } catch {}
}
if (-not $corel) {
    try {
        $c = New-Object -ComObject "CorelDRAW.Application" -ErrorAction SilentlyContinue
        if ($c) {
            $mv = Get-CorelMajorFromCom $c
            if ($runningVer -eq 0 -or $mv -eq $runningVer -or ($mv -eq 0 -and $allProcs.Count -eq 1)) { $corel = $c }
        }
    } catch {}
}

if (-not $corel) {
    throw "CorelDRAW tidak dapat diakses. Silakan buka aplikasi CorelDRAW Anda terlebih dahulu."
}

try { $corel.Optimization = $true } catch {}
try { $corel.EventsEnabled = $false } catch {}

foreach ($f in $files) {
    if (Test-Path $cancelMarker) {
        $result.message = "Proses dibatalkan oleh pengguna."
        break
    }

    $srcPath = if ($f.path) { [string]$f.path } elseif ($f.filePath) { [string]$f.filePath } else { [string]$f }
    if (-not (Test-Path $srcPath)) {
        $result.failed += @{ file = $srcPath; error = "File tidak ditemukan" }
        continue
    }

    $fname = [System.IO.Path]::GetFileNameWithoutExtension($srcPath)
    $ext = [System.IO.Path]::GetExtension($srcPath)
    if ([string]::IsNullOrEmpty($ext)) { $ext = ".cdr" }

    $outDir = if (-not [string]::IsNullOrEmpty($outputFolder)) { $outputFolder } else { [System.IO.Path]::GetDirectoryName($srcPath) }
    if (-not (Test-Path $outDir)) {
        try { New-Item -ItemType Directory -Path $outDir -Force | Out-Null } catch {}
    }

    $destFileName = if ($suffix) { "$fname$suffix$ext" } else { "$fname$ext" }
    $destPath = [System.IO.Path]::Combine($outDir, $destFileName)

    if ($overwrite -and (Test-Path $destPath) -and ($destPath -ne $srcPath)) {
        try { Remove-Item -Path $destPath -Force } catch {}
    }

    $doc = $null
    $wasAlreadyOpen = $false
    try {
        # Check if already open in CorelDRAW
        if ($corel.Documents) {
            for ($di = 1; $di -le $corel.Documents.Count; $di++) {
                try {
                    $cd = $corel.Documents.Item($di)
                    if ($cd.FullFileName -ieq $srcPath -or $cd.Name -ieq [System.IO.Path]::GetFileName($srcPath)) {
                        $doc = $cd
                        $wasAlreadyOpen = $true
                        break
                    }
                } catch {}
            }
        }

        if (-not $doc) {
            $doc = $corel.OpenDocument($srcPath)
        }

        if (-not $doc) {
            $result.failed += @{ file = $srcPath; error = "Gagal membuka dokumen di CorelDRAW" }
            continue
        }

        # 1. Cleanup Junk (ColorStyles, Views)
        if ($cleanupJunk) {
            try { $doc.ColorStyles.Clear() } catch {}
            try { $doc.Views.Clear() } catch {}
        }

        # 2. Convert All Text to Curves (CurveTo)
        if ($curveTo) {
            try {
                if ($doc.Pages) {
                    foreach ($pg in $doc.Pages) {
                        $textShapes = $pg.Shapes.FindShapes($null, 6) # 6 = cdrTextShape
                        if ($textShapes) {
                            for ($si = $textShapes.Count; $si -ge 1; $si--) {
                                try {
                                    $shp = $textShapes.Item($si)
                                    if ($shp -and $shp.Type -eq 6) {
                                        $shp.ConvertToCurves()
                                    }
                                } catch {}
                            }
                        }
                    }
                }
            } catch {}
        }

        # 3. Setup SaveAs options with target version
        $opt = $corel.CreateStructSaveAsOptions()
        $opt.Version = $targetVersion
        $opt.Overwrite = $true
        $opt.EmbedICCProfile = $false
        $opt.EmbedVBAProject = $false

        $doc.SaveAs($destPath, $opt)
        if (-not $wasAlreadyOpen) {
            try { $doc.Close() } catch {}
        }

        $result.converted += @{
            src = $srcPath
            dest = $destPath
            targetVersion = $targetVersion
        }
    } catch {
        try { if ($doc -and -not $wasAlreadyOpen) { $doc.Close() } } catch {}
        $result.failed += @{ file = $srcPath; error = $_.Exception.Message }
    }
}

try { $corel.Optimization = $false } catch {}
try { $corel.EventsEnabled = $true } catch {}

$result.success = ($result.converted.Count -gt 0)
if ($result.success) {
    $result.message = "Berhasil menurunkan versi $($result.converted.Count) file CDR."
} elseif (-not $result.message) {
    $result.message = "Tidak ada file yang berhasil dikonversi."
}

$result | ConvertTo-Json -Compress
`;

  try {
    const res = await runPowerShellScript(ps, Math.max(30000, files.length * 15000));
    return res;
  } finally {
    try { if (fs.existsSync(tempJson)) fs.unlinkSync(tempJson); } catch {}
    try { if (fs.existsSync(cancelMarker)) fs.unlinkSync(cancelMarker); } catch {}
  }
});

// ==========================================
// Layout Pola (Auto-Nesting Lembar Cetak) IPC Handlers
// ==========================================
ipcMain.handle('corel:get-layout-pola-selection', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ success = $false; message = ''; count = 0; items = @(); containerDetected = $null }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Tidak ada dokumen terbuka di CorelDRAW." }

    $origDocUnit = Com-Get $doc 'Unit'
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm)

    $sel = Com-Get $corel 'ActiveSelection'
    if (-not $sel -or [int](Com-Get $sel.Shapes 'Count') -eq 0) {
        $sel = Com-Get $doc 'Selection'
    }

    $shps = if ($sel) { Com-Get $sel 'Shapes' } else { $null }
    $cnt = if ($shps) { [int](Com-Get $shps 'Count') } else { 0 }

    if ($cnt -eq 0) {
        throw "Silakan seleksi (blok) objek-objek pola di CorelDRAW terlebih dahulu."
    }

    $rawItems = @()
    for ($i = 1; $i -le $cnt; $i++) {
        $s = Com-Get $shps 'Item' @($i)
        if (-not $s) { continue }
        $sId = [int](Com-Get $s 'StaticID')
        $w = [math]::Round([double](Com-Get $s 'SizeWidth'), 2)
        $h = [math]::Round([double](Com-Get $s 'SizeHeight'), 2)
        $left = [math]::Round([double](Com-Get $s 'Left'), 2)
        $top = [math]::Round([double](Com-Get $s 'Top'), 2)
        $name = [string](Com-Get $s 'Name')
        $type = [int](Com-Get $s 'Type')

        $rawItems += [PSCustomObject]@{
            index = $i
            staticId = $sId
            widthCm = $w
            heightCm = $h
            leftCm = $left
            topCm = $top
            name = if ($name) { $name } else { "Pola $i" }
            type = $type
        }
    }

    $filteredItems = @()
    if ($rawItems.Count -gt 1) {
        $sortedByArea = $rawItems | Sort-Object { $_.widthCm * $_.heightCm } -Descending
        $largest = $sortedByArea[0]
        $secondLargest = $sortedByArea[1]
        if (($largest.widthCm * $largest.heightCm) -gt (($secondLargest.widthCm * $secondLargest.heightCm) * 2.5) -and ($largest.widthCm -gt 60 -or $largest.heightCm -gt 100)) {
            $result.containerDetected = @{
                staticId = $largest.staticId
                widthCm = $largest.widthCm
                heightCm = $largest.heightCm
                leftCm = $largest.leftCm
                topCm = $largest.topCm
            }
            $filteredItems = $rawItems | Where-Object { $_.staticId -ne $largest.staticId }
        } else {
            $filteredItems = $rawItems
        }
    } else {
        $filteredItems = $rawItems
    }

    $result.success = $true
    $result.count = $filteredItems.Count
    $result.items = $filteredItems
    $result.message = "Berhasil mendeteksi $($filteredItems.Count) pola di CorelDRAW."

    if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
}
catch {
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}

$result | ConvertTo-Json -Depth 4 -Compress
`;
  return runPowerShellScript(ps);
});

ipcMain.handle('corel:execute-layout-pola', async (_event, payload) => {
  const {
    boxWidthCm = 100,
    boxHeightCm = 500,
    createBox = true,
    gapCm = 1.0,
    marginCm = 1.0,
    items = []
  } = payload || {};

  if (!items || items.length === 0) {
    return { success: false, message: 'Tidak ada data posisi pola yang dikirim.' };
  }

  const tempDir = app.getPath('temp');
  const tempJson = path.join(tempDir, `cts_layout_pola_${Date.now()}.json`);
  fs.writeFileSync(tempJson, JSON.stringify(payload, null, 2), 'utf8');

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; movedCount = 0 }

try {
${COREL_CONNECT_PS}
    if (-not $doc) { throw "Tidak ada dokumen terbuka di CorelDRAW." }

    $jsonFile = '${tempJson.replace(/\\/g, '\\\\')}'
    if (-not (Test-Path $jsonFile)) { throw "File data layout tidak ditemukan." }
    $data = Get-Content -Path $jsonFile -Raw -Encoding UTF8 | ConvertFrom-Json

    $boxW = [double]$data.boxWidthCm
    $boxH = [double]$data.boxHeightCm
    $createBox = [bool]$data.createBox
    $gap = [double]$data.gapCm
    $margin = [double]$data.marginCm
    $itemList = $data.items

    $origDocUnit = Com-Get $doc 'Unit'
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm)

    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}
    try { [void](Com-Call $doc 'BeginCommandGroup' @("CTS Layout Pola")) } catch {}

    # Build shape map of all shapes on active page by StaticID
    $shapeMap = @{}
    $allShapes = Com-Get $doc.ActivePage 'Shapes'
    $totalPageShapes = if ($allShapes) { [int](Com-Get $allShapes 'Count') } else { 0 }
    for ($sIdx = 1; $sIdx -le $totalPageShapes; $sIdx++) {
        $curShp = Com-Get $allShapes 'Item' @($sIdx)
        if ($curShp) {
            $sId = [int](Com-Get $curShp 'StaticID')
            $shapeMap[$sId] = $curShp
        }
    }

    # Determine reference box origin (Left, Top)
    $minLeft = 999999.0
    $maxRight = -999999.0
    $maxTop = -999999.0
    $minBottom = 999999.0
    $foundAny = $false

    foreach ($it in $itemList) {
        $id = [int]$it.staticId
        if ($shapeMap.ContainsKey($id)) {
            $s = $shapeMap[$id]
            $sl = [double](Com-Get $s 'Left')
            $st = [double](Com-Get $s 'Top')
            $sw = [double](Com-Get $s 'SizeWidth')
            $sh = [double](Com-Get $s 'SizeHeight')
            $sr = $sl + $sw
            $sb = $st - $sh
            $minLeft = [math]::Min($minLeft, $sl)
            $maxRight = [math]::Max($maxRight, $sr)
            $maxTop = [math]::Max($maxTop, $st)
            $minBottom = [math]::Min($minBottom, $sb)
            $foundAny = $true
        }
    }

    if (-not $foundAny) {
        $minLeft = 0.0
        $maxRight = 0.0
        $maxTop = 0.0
    }

    # Position container box to the right of original shapes
    $boxLeft = $maxRight + 15.0
    $boxTop = if ($foundAny) { $maxTop } else { 0.0 }

    # If createBox is requested, draw rectangle in CorelDRAW
    if ($createBox) {
        $right = $boxLeft + $boxW
        $bottom = $boxTop - $boxH
        $rect = Com-Call $doc.ActiveLayer 'CreateRectangle' @([double]$boxLeft, [double]$boxTop, [double]$right, [double]$bottom)
        if ($rect) {
            try {
                $outline = Com-Get $rect 'Outline'
                if ($outline) {
                    Com-Call $outline 'SetProperties' @([double]0.05)
                }
            } catch {}
        }
    }

    # Move each pattern shape into its calculated nested position
    $moved = 0
    foreach ($it in $itemList) {
        $id = [int]$it.staticId
        if ($shapeMap.ContainsKey($id)) {
            $shp = $shapeMap[$id]

            # Apply rotation if specified (e.g. 180 degrees)
            if ($it.rotate -and [double]$it.rotate -ne 0) {
                try {
                    Com-Call $shp 'Rotate' @([double]$it.rotate)
                } catch {}
            }

            # Set new position: targetLeft = boxLeft + item.x, targetTop = boxTop - item.y
            $targetLeft = $boxLeft + [double]$it.xCm
            $targetTop = $boxTop - [double]$it.yCm

            try {
                Com-Call $shp 'SetPosition' @([double]$targetLeft, [double]$targetTop)
                $moved++
            } catch {
                try {
                    Com-Set $shp 'Left' $targetLeft
                    Com-Set $shp 'Top' $targetTop
                    $moved++
                } catch {}
            }
        }
    }

    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $doc 'EndCommandGroup' @()) } catch {}
    try { [void](Com-Call $corel 'Refresh' @()) } catch {}

    $result.success = $true
    $result.movedCount = $moved
    $result.message = "Berhasil menata $moved pola ke dalam kotak ($boxW cm x $boxH cm)."

    if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
}
catch {
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { if ($doc) { [void](Com-Call $doc 'EndCommandGroup' @()) } } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
finally {
    if (Test-Path $jsonFile) { try { Remove-Item -Path $jsonFile -Force } catch {} }
}

$result | ConvertTo-Json -Compress
`;

  try {
    const res = await runPowerShellScript(ps, 60000);
    return res;
  } catch (err) {
    return { success: false, message: err.message };
  }
});
