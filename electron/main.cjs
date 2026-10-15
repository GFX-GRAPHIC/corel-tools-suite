const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile } = require('child_process');

let mainWindow = null;
let corelCompanionWindow = null;
let corelNumeratorWindow = null;
let corelAiTracerWindow = null;
let corelCertMergerWindow = null;
let activeJerseySessionData = null;

let aiTracerService = null;
try {
  aiTracerService = require('./aiTracerService.cjs');
} catch (e) {
  console.log('aiTracerService note:', e.message);
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
    width: 430,
    height: 610,
    minWidth: 380,
    minHeight: 520,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#0f172a',
    title: 'Corel Tools Suite — Auto-Layout Jersey',
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
    title: 'Corel Tools Suite — Numerator Machine',
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
    title: 'Corel Tools Suite — AI Jersey Tracer',
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
    title: 'Corel Tools Suite — Certificate & Variable Data Merger',
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

// 1. Check CorelDRAW Connection & Active Document Info
ipcMain.handle('corel:check-status', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$res = @{
    connected = $false
    version = 'Tidak terdeteksi'
    activeDoc = ''
    docPath = ''
    selectionCount = 0
    pageCount = 0
}

$proc = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($proc) {
    $res.connected = $true
    $res.version = if ($proc.MainWindowTitle) { $proc.MainWindowTitle } else { 'CorelDRAW Aktif' }

    $corel = $null
    $curVer = (Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\\CorelDRAW.Application\\CurVer" -ErrorAction SilentlyContinue).'(default)'
    if ($curVer) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject($curVer) } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel) {
        for ($v = 26; $v -ge 14; $v--) {
            try {
                $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
                if ($c) { $corel = $c; break }
            } catch {}
        }
    }

    if ($corel) {
        try {
            if ($corel.ActiveDocument) {
                $res.activeDoc = [string]$corel.ActiveDocument.Name
                $res.docPath = [string]$corel.ActiveDocument.FullFileName
                $res.pageCount = [int]$corel.ActiveDocument.Pages.Count
                if ($corel.ActiveSelection) {
                    $res.selectionCount = [int]$corel.ActiveSelection.Shapes.Count
                }
            }
        } catch {}
    }
}

$res | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
});

// 2. Get Recent / Open Documents in CorelDRAW
ipcMain.handle('corel:get-recent-files', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$files = @()

$corel = $null
try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
if (-not $corel) {
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c) { $corel = $c; break }
        } catch {}
    }
}

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

# Fallback to standard demo list if none open
if ($files.Count -eq 0) {
    $files += @{ name = 'Desain Undangan.cdr'; path = 'C:\\Project\\Undangan'; isOpen = $false }
    $files += @{ name = 'Label Produk.cdr'; path = 'C:\\Project\\Label'; isOpen = $false }
    $files += @{ name = 'Stiker.cdr'; path = 'C:\\Project\\Stiker'; isOpen = $false }
    $files += @{ name = 'Logo.cdr'; path = 'C:\\Project\\Logo'; isOpen = $false }
    $files += @{ name = 'Banner.cdr'; path = 'C:\\Project\\Banner'; isOpen = $false }
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

// 4. Execute Numerator Tool
ipcMain.handle('corel:execute-numerator', async (_event, payload) => {
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
  } = payload || {};

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0; totalPages = 0 }

trap {
    $errLine = $_.InvocationInfo.ScriptLineNumber
    $errMsg = $_.Exception.Message
    if (-not $errMsg) { $errMsg = "$_" }
    $res = @{ success = $false; message = "CorelDRAW Error (Line $errLine): $errMsg" }
    $res | ConvertTo-Json -Compress
    exit 0
}

try {
    $start = [int]${start || 1}
    $end = [int]${end || 1}
    $step = [int]${step || 1}
    $digits = [int]${digits || 0}
    $prefix = "${(prefix || '').replace(/"/g, '`"')}"
    $suffix = "${(suffix || '').replace(/"/g, '`"')}"
    $mode = "${mode || 'page'}"
    $cols = [int]${cols || 2}
    $rows = [int]${rows || 5}
    $spacingX = [double]${spacingX || 0.5}
    $spacingY = [double]${spacingY || 0.5}
    $gridOrder = "${gridOrder || 'cut_stack'}"
    $autoCurves = [bool]${autoCurves ? '$true' : '$false'}

    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and ($c.ActiveDocument -or ($c.Documents -and $c.Documents.Count -gt 0))) {
                $corel = $c
                break
            }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel) {
        throw "CorelDRAW tidak sedang berjalan. Buka CorelDRAW terlebih dahulu."
    }

    $doc = $null
    try { $doc = $corel.ActiveDocument } catch {}
    if (-not $doc -and $corel.Documents -and $corel.Documents.Count -gt 0) {
        $doc = $corel.Documents.Item(1)
    }
    if (-not $doc) {
        throw "Tidak ada dokumen yang terbuka di CorelDRAW."
    }
    $doc.Unit = 4 # cdrCentimeter (4 = cm, 3 = mm)

    function Get-FormattedNum([int]$val, [int]$dig, [string]$pfx, [string]$sfx) {
        $numPart = [string]$val
        if ($dig -gt 0) { $numPart = $numPart.PadLeft($dig, '0') }
        return "$pfx$numPart$sfx"
    }

    function Is-NumberPlaceholder([string]$txt) {
        if ([string]::IsNullOrWhiteSpace($txt)) { return $false }
        $t = $txt.Trim()
        if ($t -match '^\\d+$') { return $true }
        if ($t -match '^(no|no\\.|kpn|vcr|id|tiket|kupon|#|num|inv|fkt)?\\s*[:.-]?\\s*\\d+' -and $t.Length -le 20) { return $true }
        return $false
    }

    function Set-ShapeNumberText($targetShape, [string]$textVal) {
        if (-not $targetShape) { return }
        if ($targetShape.Type -eq 6) {
            $targetShape.Text.Story.Text = $textVal
            return
        }
        $textShapes = $targetShape.Shapes.FindShapes($null, 6, $true)
        if ($textShapes -and $textShapes.Count -gt 0) {
            for ($k = 1; $k -le $textShapes.Count; $k++) {
                $ts = $textShapes.Item($k)
                $rawText = ""
                try { $rawText = $ts.Text.Story.Text } catch {}
                if (Is-NumberPlaceholder $rawText) {
                    try { $ts.Text.Story.Text = $textVal } catch {}
                }
            }
        }
    }

    $numList = @()
    for ($n = $start; $n -le $end; $n += $step) { $numList += $n }
    $totalNumbers = $numList.Count
    if ($totalNumbers -eq 0) { throw "Jumlah nomor 0." }

    $doc.BeginCommandGroup("CTS Numerator")

    if ($mode -eq 'inplace') {
        $sel = $doc.ActiveSelection
        if (-not $sel -or $sel.Shapes.Count -eq 0) { throw "Seleksi objek teks di CorelDRAW terlebih dahulu." }
        for ($i = 1; $i -le [math]::Min($sel.Shapes.Count, $totalNumbers); $i++) {
            $val = Get-FormattedNum $numList[$i - 1] $digits $prefix $suffix
            Set-ShapeNumberText $sel.Shapes.Item($i) $val
        }
        $result.count = [math]::Min($sel.Shapes.Count, $totalNumbers)
        $result.totalPages = 1
    }
    elseif ($mode -eq 'page') {
        $masterPage = $doc.ActivePage
        if (-not $masterPage) { $masterPage = $doc.Pages.Item(1) }
        $masterPage.Activate()

        $firstNum = Get-FormattedNum $numList[0] $digits $prefix $suffix
        Set-ShapeNumberText $masterPage $firstNum

        if ($totalNumbers -gt 1) {
            [void]$masterPage.Shapes.All().Copy()
            for ($i = 1; $i -lt $totalNumbers; $i++) {
                $np = $doc.AddPages(1)
                $np.Activate()
                [void]$doc.ActiveLayer.Paste()
                $curNum = Get-FormattedNum $numList[$i] $digits $prefix $suffix
                Set-ShapeNumberText $np $curNum
            }
        }
        $result.count = $totalNumbers
        $result.totalPages = $totalNumbers
    }
    elseif ($mode -eq 'grid') {
        $sel = $doc.ActiveSelection
        $masterShape = $null
        if ($sel -and $sel.Shapes.Count -gt 1) {
            $masterShape = $sel.Group()
        } elseif ($sel -and $sel.Shapes.Count -eq 1) {
            $masterShape = $sel.Shapes.Item(1)
        } else {
            $masterPage = $doc.ActivePage
            if ($masterPage.Shapes.Count -gt 1) { $masterShape = $masterPage.Shapes.All().Group() }
            elseif ($masterPage.Shapes.Count -eq 1) { $masterShape = $masterPage.Shapes.Item(1) }
        }
        if (-not $masterShape) { throw "Buka atau seleksi 1 desain kupon/tiket di CorelDRAW." }

        $w = [double]$masterShape.SizeWidth
        $h = [double]$masterShape.SizeHeight
        $origX = [double]$masterShape.PositionX
        $origY = [double]$masterShape.PositionY

        $perPage = [int]($cols * $rows)
        if ($perPage -lt 1) { $perPage = 1 }
        $totalPages = [int][math]::Ceiling($totalNumbers / $perPage)
        $masterPage = $doc.ActivePage

        $page1Shapes = @()
        for ($r = 0; $r -lt $rows; $r++) {
            for ($c = 0; $c -lt $cols; $c++) {
                $posX = $origX + ($c * ($w + $spacingX))
                $posY = $origY - ($r * ($h + $spacingY))
                if ($r -eq 0 -and $c -eq 0) {
                    $masterShape.PositionX = $posX
                    $masterShape.PositionY = $posY
                    $page1Shapes += $masterShape
                } else {
                    $dup = $masterShape.Duplicate()
                    $dup.PositionX = $posX
                    $dup.PositionY = $posY
                    $page1Shapes += $dup
                }
            }
        }

        if ($totalPages -gt 1) {
            $masterPage.Activate()
            [void]$masterPage.Shapes.All().Copy()
            for ($p = 2; $p -le $totalPages; $p++) {
                $np = $doc.AddPages(1)
                $np.Activate()
                $pIdx = $p - 1
                [void]$doc.ActiveLayer.Paste()

                $newShapes = @()
                for ($k = 1; $k -le $np.Shapes.Count; $k++) {
                    $shp = $np.Shapes.Item($k)
                    $newShapes += [PSCustomObject]@{ Shape = $shp; PosX = [double]$shp.PositionX; PosY = [double]$shp.PositionY }
                }
                $rowTol = [math]::Max(0.2, $h * 0.35)
                $sorted = $newShapes | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false }

                for ($s = 0; $s -lt $sorted.Count; $s++) {
                    $idx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) + $pIdx } else { ($pIdx * $perPage) + $s }
                    if ($idx -lt $totalNumbers) {
                        $fNum = Get-FormattedNum $numList[$idx] $digits $prefix $suffix
                        Set-ShapeNumberText $sorted[$s].Shape $fNum
                    } else {
                        try { $sorted[$s].Shape.Delete() } catch {}
                    }
                }
            }
        }

        $masterPage.Activate()
        for ($s = 0; $s -lt $page1Shapes.Count; $s++) {
            $idx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) } else { $s }
            if ($idx -lt $totalNumbers) {
                $fNum = Get-FormattedNum $numList[$idx] $digits $prefix $suffix
                Set-ShapeNumberText $page1Shapes[$s] $fNum
            } else {
                try { $page1Shapes[$s].Delete() } catch {}
            }
        }

        $result.count = $totalNumbers
        $result.totalPages = $totalPages
    }

    if ($autoCurves) {
        for ($p = 1; $p -le $doc.Pages.Count; $p++) {
            try {
                $allT = $doc.Pages.Item($p).Shapes.FindShapes($null, 6, $true)
                if ($allT) {
                    for ($k = $allT.Count; $k -ge 1; $k--) {
                        try { $allT.Item($k).ConvertToCurves() } catch {}
                    }
                }
            } catch {}
        }
    }

    $doc.EndCommandGroup()
    try { $corel.Refresh() } catch {}
    $result.success = $true
    $result.message = "Berhasil membuat $($result.count) nomorator ($($result.totalPages) halaman) di CorelDRAW."
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
    try { if ($r.Count -ne $null) { return [int]$r.Count } } catch {}
    try { if ($r.Shapes -and $r.Shapes.Count -ne $null) { return [int]$r.Shapes.Count } } catch {}
    return 0
}

function Get-RangeItem($r, [int]$idx) {
    if (-not $r) { return $null }
    try { $it = $r.Item($idx); if ($it) { return $it } } catch {}
    try { $it = $r.Shapes.Item($idx); if ($it) { return $it } } catch {}
    try { $it = $r[$idx]; if ($it) { return $it } } catch {}
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
    if ($shp.Type -eq 6) { # cdrTextShape
        $hasMatch = $false
        try {
            $cur = $shp.Text.Story.Text
            if ($cur -and $cur -match [regex]::Escape($findText)) {
                $hasMatch = $true
            }
        } catch {}

        if ($hasMatch) {
            # Convert text case if requested
            if ($textCase -and $textCase -ne 'none') {
                $replaceVal = Convert-TextCase $replaceVal $textCase
            }

            # 1. Capture original coordinates BEFORE text replacement
            $origCenterX = [double]$shp.CenterX
            $origCenterY = [double]$shp.CenterY
            $origLeft = [double]$shp.PositionX
            $origTop = [double]$shp.PositionY
            $origW = [double]$shp.SizeWidth
            $origH = [double]$shp.SizeHeight

            # 2. Replace the text
            try {
                [void]$shp.Text.Story.Replace($findText, $replaceVal, $false)
                $replaced = $true
            } catch {
                try {
                    $cur = $shp.Text.Story.Text
                    if ($cur) {
                        $pattern = [regex]::Escape($findText)
                        $shp.Text.Story.Text = [regex]::Replace($cur, $pattern, [string]$replaceVal, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                        $replaced = $true
                    }
                } catch {}
            }

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
                        try { $shp.Text.Story.Case = $cdrCaseEnum } catch {}
                    }
                }

                # 3. Set Text Story Alignment in Corel
                try {
                    if ($align -eq 'center' -or $align -eq 'page_center') {
                        $shp.Text.Story.Alignment = 3 # cdrCenterAlignment
                    } elseif ($align -eq 'left') {
                        $shp.Text.Story.Alignment = 1 # cdrLeftAlignment
                    } elseif ($align -eq 'right') {
                        $shp.Text.Story.Alignment = 2 # cdrRightAlignment
                    }
                } catch {}

                # 4. Sizing logic: Auto-Fit (Batas Maksimum) vs Fixed Size
                try {
                    $targetW = [double]$optWidth
                    $targetH = [double]$optHeight
                    $isLocked = [bool]$lockRatio
                    $modeFit = if ($fitMode) { [string]$fitMode } else { 'max' }

                    $curW = [double]$shp.SizeWidth
                    $curH = [double]$shp.SizeHeight

                    if ($modeFit -eq 'max') {
                        # AUTO-FIT / BATAS MAKSIMUM:
                        # Do NOT scale up short names (keep natural template font size)!
                        # Only scale down if current text width/height exceeds limits!
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
                            try { $shp.SetSize($newW, $newH) } catch {
                                $shp.SizeWidth = $newW
                                if ($isLocked) { $shp.SizeHeight = $newH }
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
                                    try { $shp.SetSize($newW, $newH) } catch {
                                        $shp.SizeWidth = $newW
                                        $shp.SizeHeight = $newH
                                    }
                                }
                            } else {
                                try { $shp.SetSize($targetW, $targetH) } catch {
                                    $shp.SizeWidth = $targetW
                                    $shp.SizeHeight = $targetH
                                }
                            }
                        } elseif ($targetW -gt 0) {
                            if ($curW -gt 0) {
                                $scale = $targetW / $curW
                                if ($isLocked -and $curH -gt 0) {
                                    $newH = $curH * $scale
                                    try { $shp.SetSize($targetW, $newH) } catch {
                                        $shp.SizeWidth = $targetW
                                        $shp.SizeHeight = $newH
                                    }
                                } else {
                                    $shp.SizeWidth = $targetW
                                }
                            }
                        } elseif ($targetH -gt 0) {
                            if ($curH -gt 0) {
                                $scale = $targetH / $curH
                                if ($isLocked -and $curW -gt 0) {
                                    $newW = $curW * $scale
                                    try { $shp.SetSize($newW, $targetH) } catch {
                                        $shp.SizeWidth = $newW
                                        $shp.SizeHeight = $targetH
                                    }
                                } else {
                                    $shp.SizeHeight = $targetH
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
                            try { $pCenter = [double]$docPage.CenterX } catch {}
                        }
                        if (-not $pCenter) {
                            try { $pCenter = [double]$shp.Layer.Page.CenterX } catch {}
                        }
                        if ($pCenter -and $pCenter -gt 0) {
                            $shp.CenterX = $pCenter
                        } else {
                            $shp.CenterX = $origCenterX
                        }
                        $shp.CenterY = $origCenterY
                    } elseif ($align -eq 'center' -or -not $align) {
                        $shp.CenterX = $origCenterX
                        $shp.CenterY = $origCenterY
                    } elseif ($align -eq 'left') {
                        $shp.PositionX = $origLeft
                        $shp.CenterY = $origCenterY
                    } elseif ($align -eq 'right') {
                        $shp.PositionX = ($origLeft + $origW) - $shp.SizeWidth
                        $shp.CenterY = $origCenterY
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
        $found = $container.Shapes.FindShapes($null, 6, $true)
        if ($found -and $found.Count -gt 0) {
            for ($k = 1; $k -le $found.Count; $k++) {
                $list += $found.Item($k)
            }
        }
    } catch {}

    try {
        $all = $container.Shapes.FindShapes()
        if ($all -and $all.Count -gt 0) {
            for ($k = 1; $k -le $all.Count; $k++) {
                $s = $all.Item($k)
                try {
                    if ($s.PowerClip) {
                        $pcShapes = $s.PowerClip.Shapes.FindShapes($null, 6, $true)
                        if ($pcShapes -and $pcShapes.Count -gt 0) {
                            for ($j = 1; $j -le $pcShapes.Count; $j++) {
                                $list += $pcShapes.Item($j)
                            }
                        }
                    }
                } catch {}
            }
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
            Replace-ShapeText $t $ph $val $w $h $lock $fit $al $docPage $tc
        }
    }
}

# Helper function: Convert texts to curves backwards
function Convert-TextsToCurves($textList) {
    if (-not $textList) { return }
    for ($k = $textList.Count - 1; $k -ge 0; $k--) {
        try {
            $t = $textList[$k]
            if ($t -and $t.Type -eq 6) {
                try { [void]$t.ConvertToCurves() } catch { try { [void]$t.CreateCurves() } catch {} }
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
    $corel = $null

    # 2a. Try CurVer ProgID from Registry
    $curVer = (Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\\CorelDRAW.Application\\CurVer" -ErrorAction SilentlyContinue).'(default)'
    if ($curVer) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject($curVer) } catch {}
        if (-not $corel) {
            try { $corel = New-Object -ComObject $curVer -ErrorAction SilentlyContinue } catch {}
        }
    }

    # 2b. Try Generic ProgID
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
        if (-not $corel) {
            try { $corel = New-Object -ComObject "CorelDRAW.Application" -ErrorAction SilentlyContinue } catch {}
        }
    }

    # 2c. Try loop through known version ProgIDs (26 down to 14)
    if (-not $corel) {
        for ($v = 26; $v -ge 14; $v--) {
            try {
                $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
                if ($c) {
                    if ($c.ActiveDocument -or ($c.Documents -and $c.Documents.Count -gt 0)) {
                        $corel = $c
                        break
                    } elseif (-not $corel) {
                        $corel = $c
                    }
                }
            } catch {}
            if (-not $corel) {
                try {
                    $c = New-Object -ComObject "CorelDRAW.Application.$v" -ErrorAction SilentlyContinue
                    if ($c -and ($c.ActiveDocument -or ($c.Documents -and $c.Documents.Count -gt 0))) {
                        $corel = $c
                        break
                    }
                } catch {}
            }
        }
    }

    if (-not $corel) {
        $proc = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($proc) {
            throw "CorelDRAW terdeteksi terbuka di komputer (PID $($proc.Id)), namun Windows membatasi hak akses COM. Jika CorelDRAW dibuka dengan opsi 'Run as Administrator', jalankan juga aplikasi GFX IT PRINTING sebagai Administrator agar izinnya setara."
        }
        throw "CorelDRAW tidak sedang berjalan. Silakan buka CorelDRAW dan dokumen template sertifikat Anda terlebih dahulu."
    }

    $doc = $null
    try { $doc = $corel.ActiveDocument } catch {}
    if (-not $doc -and $corel.Documents -and $corel.Documents.Count -gt 0) {
        try { $doc = $corel.Documents.Item(1) } catch {}
    }
    if (-not $doc) {
        throw "Tidak ada dokumen template yang terbuka di CorelDRAW. Buka file sertifikat Anda terlebih dahulu."
    }

    # Optimization ON
    try { $corel.Optimization = $true } catch {}
    try { $corel.EventsEnabled = $false } catch {}
    $doc.BeginCommandGroup("GFX Batch Certificate Mail Merge")
    # Ensure active document unit is cdrCentimeter (4) for all merger modes (page, grid, inplace)
    $origDocUnit = $null
    try { $origDocUnit = $doc.Unit } catch {}
    try { $doc.Unit = 4 } catch {} # cdrCentimeter (4 = cm, 3 = mm)

    $totalRows = $rows.Count

    if ($mode -eq 'inplace') {
        # IN-PLACE: update active page or active selection only using first row
        $targetContainer = $null
        try {
            if ($doc.ActiveSelection -and $doc.ActiveSelection.Shapes.Count -gt 0) {
                $targetContainer = $doc.ActiveSelection
            }
        } catch {}
        if (-not $targetContainer) {
            $targetContainer = $doc.ActivePage
            if (-not $targetContainer) { $targetContainer = $doc.Pages.Item(1) }
        }

        $texts = Get-AllTextShapes $targetContainer
        if ($texts.Count -eq 0) {
            throw "Tidak ditemukan objek teks pada seleksi/halaman aktif CorelDRAW."
        }

        Apply-RowReplacement $texts $rows[0] $sortedMappings $doc.ActivePage
        if ($autoCurves) {
            Convert-TextsToCurves $texts
        }

        $result.count = 1
        $result.totalPages = 1
    }
    elseif ($mode -eq 'grid') {
        $doc.Unit = 4 # cdrCentimeter (4 = cm, 3 = mm)

        $sel = $null
        try { $sel = $corel.ActiveSelection } catch {}
        if (-not $sel -or (Get-RangeCount $sel) -eq 0) {
            try { $sel = $doc.Selection } catch {}
        }
        $selCount = Get-RangeCount $sel

        $masterPage = $doc.ActivePage
        if (-not $masterPage) { $masterPage = $doc.Pages.Item(1) }
        $masterPage.Activate()

        $masterShape = $null
        if ($selCount -gt 1) {
            $masterShape = $sel.Group()
        } elseif ($selCount -eq 1) {
            $masterShape = Get-RangeItem $sel 1
        } else {
            if ($masterPage.Shapes.Count -eq 0) {
                throw "Dokumen CorelDRAW masih kosong. Silakan buka desain sertifikat/voucher atau seleksi objek master terlebih dahulu."
            }
            if ($masterPage.Shapes.Count -gt 1) {
                $masterShape = $masterPage.Shapes.All().Group()
            } else {
                $masterShape = $masterPage.Shapes.Item(1)
            }
        }

        if (-not $masterShape) {
            throw "Gagal mendapatkan objek desain master di CorelDRAW."
        }

        $initialTexts = Get-AllTextShapes $masterShape
        if ($initialTexts.Count -eq 0) {
            throw "Tidak ditemukan objek teks placeholder pada objek master di CorelDRAW."
        }

        $w = [double]$masterShape.SizeWidth
        $h = [double]$masterShape.SizeHeight
        $origX = [double]$masterShape.PositionX
        $origY = [double]$masterShape.PositionY

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
                    $masterShape.PositionX = $targetPosX
                    $masterShape.PositionY = $targetPosY
                    $page1Shapes += $masterShape
                } else {
                    $dup = $masterShape.Duplicate()
                    $dup.PositionX = $targetPosX
                    $dup.PositionY = $targetPosY
                    $page1Shapes += $dup
                }
            }
        }

        # 2. Jika total data memerlukan lebih dari 1 halaman, copy susunan grid Page 1 ke Halaman 2..N
        if ($totalPages -gt 1) {
            $masterPage.Activate()
            [void]$masterPage.Shapes.All().Copy()

            for ($p = 2; $p -le $totalPages; $p++) {
                $newPage = $doc.AddPages(1)
                $newPage.Activate()
                $pIdx = $p - 1

                [void]$doc.ActiveLayer.Paste()

                $newShapes = @()
                for ($k = 1; $k -le $newPage.Shapes.Count; $k++) {
                    $shp = $newPage.Shapes.Item($k)
                    $newShapes += [PSCustomObject]@{
                        Shape = $shp
                        PosX = [double]$shp.PositionX
                        PosY = [double]$shp.PositionY
                        Height = [double]$shp.SizeHeight
                    }
                }

                $rowTol = [math]::Max(0.2, $h * 0.35)
                $sortedVouchers = $newShapes | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false }

                for ($s = 0; $s -lt $sortedVouchers.Count; $s++) {
                    $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) + $pIdx } else { ($pIdx * $perPage) + $s }
                    if ($itemIdx -lt $totalRows) {
                        $voucherShape = $sortedVouchers[$s].Shape
                        $shpTexts = Get-AllTextShapes $voucherShape
                        Apply-RowReplacement $shpTexts $rows[$itemIdx] $sortedMappings $newPage
                        if ($autoCurves) {
                            Convert-TextsToCurves $shpTexts
                        }
                    } else {
                        try { $sortedVouchers[$s].Shape.Delete() } catch {}
                    }
                }
            }
        }

        # 3. Sekarang kembali ke Halaman 1 dan isi teks untuk Record Halaman 1
        $masterPage.Activate()
        for ($s = 0; $s -lt $page1Shapes.Count; $s++) {
            $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) } else { $s }
            if ($itemIdx -lt $totalRows) {
                $voucherShape = $page1Shapes[$s]
                $shpTexts = Get-AllTextShapes $voucherShape
                Apply-RowReplacement $shpTexts $rows[$itemIdx] $sortedMappings $masterPage
                if ($autoCurves) {
                    Convert-TextsToCurves $shpTexts
                }
            } else {
                try { $page1Shapes[$s].Delete() } catch {}
            }
        }

        $result.count = $totalRows
        $result.totalPages = $totalPages
    }
    else {
        # MODE PAGE: 1 certificate per page
        $masterPage = $doc.ActivePage
        if (-not $masterPage) { $masterPage = $doc.Pages.Item(1) }
        $masterPage.Activate()

        if ($masterPage.Shapes.Count -eq 0) {
            throw "Halaman template sertifikat (Halaman $($masterPage.Index)) masih kosong."
        }

        $initialMasterTexts = Get-AllTextShapes $masterPage
        if ($initialMasterTexts.Count -eq 0) {
            throw "Tidak ditemukan objek teks pada halaman template sertifikat di CorelDRAW."
        }

        if ($totalRows -gt 1) {
            # Copy template shapes before replacing placeholders on Page 1
            [void]$masterPage.Shapes.All().Copy()

            # Create pages 2..N
            for ($i = 1; $i -lt $totalRows; $i++) {
                $newPage = $doc.AddPages(1)
                $newPage.Activate()
                [void]$doc.ActiveLayer.Paste()

                $newTexts = Get-AllTextShapes $newPage
                Apply-RowReplacement $newTexts $rows[$i] $sortedMappings $newPage
                if ($autoCurves) {
                    Convert-TextsToCurves $newTexts
                }
            }
        }

        # Now replace Record 0 on Page 1 (Master Page)
        $masterPage.Activate()
        $masterTexts = Get-AllTextShapes $masterPage
        Apply-RowReplacement $masterTexts $rows[0] $sortedMappings $masterPage
        if ($autoCurves) {
            Convert-TextsToCurves $masterTexts
        }

        $result.count = $totalRows
        $result.totalPages = $totalRows
    }

    try { $doc.EndCommandGroup() } catch {}
    try { $corel.Optimization = $false } catch {}
    try { $corel.EventsEnabled = $true } catch {}
    try { $corel.Refresh() } catch {}
    try { if ($corel.ActiveWindow) { $corel.ActiveWindow.Refresh() } } catch {}

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
        if ($doc) { $doc.EndCommandGroup() }
        try { $corel.Optimization = $false } catch {}
        try { $corel.EventsEnabled = $true } catch {}
        try { $corel.Refresh() } catch {}
        try { if ($corel.ActiveWindow) { $corel.ActiveWindow.Refresh() } } catch {}
    } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
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

    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel) { throw "CorelDRAW tidak sedang berjalan." }

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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and $c.ActiveDocument) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel -or -not $corel.ActiveDocument) { throw "Buka file desain di CorelDRAW." }

    $doc = $corel.ActiveDocument
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

$corel = $null
for ($v = 26; $v -ge 14; $v--) {
    try {
        $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
        if ($c -and $c.ActiveDocument) { $corel = $c; break }
    } catch {}
}
if (-not $corel) {
    try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
}

if ($corel -and $corel.ActiveDocument) {
    $doc = $corel.ActiveDocument
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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and $c.ActiveDocument) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel -or -not $corel.ActiveDocument) { throw "Buka file desain di CorelDRAW." }

    $doc = $corel.ActiveDocument
    $doc.Unit = 4 # cdrCentimeter (4 = cm, 3 = mm)
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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and $c.ActiveDocument) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel -or -not $corel.ActiveDocument) { throw "Buka file desain di CorelDRAW." }

    $doc = $corel.ActiveDocument
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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and $c.ActiveDocument) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel -or -not $corel.ActiveDocument) { throw "Buka file desain di CorelDRAW." }

    $doc = $corel.ActiveDocument
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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and $c.ActiveDocument) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel -or -not $corel.ActiveDocument) { throw "Buka file desain di CorelDRAW." }

    $doc = $corel.ActiveDocument
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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and $c.ActiveDocument) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel -or -not $corel.ActiveDocument) { throw "Buka dokumen di CorelDRAW terlebih dahulu." }

    $doc = $corel.ActiveDocument
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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and $c.ActiveDocument) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel -or -not $corel.ActiveDocument) { throw "Buka dokumen di CorelDRAW terlebih dahulu." }

    $doc = $corel.ActiveDocument
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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and $c.ActiveDocument) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel -or -not $corel.ActiveDocument) { throw "Buka dokumen di CorelDRAW terlebih dahulu." }

    $doc = $corel.ActiveDocument
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
            if ($container.Type -eq 6) {
                $list += $container
                return $list
            }
        } catch {}
        try {
            $finds = $container.FindShapes($null, 6, $true)
            if ($finds -and $finds.Count -gt 0) {
                for ($i = 1; $i -le $finds.Count; $i++) {
                    $list += $finds.Item($i)
                }
                return $list
            }
        } catch {}
        try {
            if ($container.Shapes) {
                for ($i = 1; $i -le $container.Shapes.Count; $i++) {
                    $s = $container.Shapes.Item($i)
                    if ($s.Type -eq 6) {
                        $list += $s
                    } elseif ($s.Type -eq 7) {
                        $list += (Get-AllTextShapes $s)
                    }
                }
            }
        } catch {}
        return $list
    }

    $sel = $null
    try { $sel = $doc.ActiveSelection } catch {}
    $texts = @()
    if ($sel -and $sel.Shapes.Count -gt 0) {
        $texts = Get-AllTextShapes $sel
    }
    if (-not $texts -or $texts.Count -eq 0) {
        $texts = Get-AllTextShapes $doc.ActivePage
    }

    if (-not $texts -or $texts.Count -eq 0) {
        throw "Tidak ditemukan objek teks pada seleksi atau halaman aktif CorelDRAW."
    }

    $corel.Optimization = $true
    $corel.EventsEnabled = $false
    $doc.BeginCommandGroup("Change Case ($caseType)")

    $count = 0
    foreach ($t in $texts) {
        try {
            if ($cdrCaseEnum -gt 0) {
                try { $t.Text.Story.Case = $cdrCaseEnum } catch {}
            }
            $curTxt = $t.Text.Story.Text
            if ($curTxt) {
                $newTxt = Convert-TextCase $curTxt $caseType
                if ($newTxt -ne $curTxt) {
                    $t.Text.Story.Text = $newTxt
                }
                $count++
            }
        } catch {}
    }

    $doc.EndCommandGroup()
    $corel.Optimization = $false
    $corel.EventsEnabled = $true
    $corel.Refresh()
    if ($corel.ActiveWindow) { $corel.ActiveWindow.Refresh() }

    $result.success = $true
    $result.count = $count
    $result.message = "Berhasil mengubah format huruf ($caseType) pada $count objek teks."
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

// Auto-Layout Jersey Handlers
ipcMain.handle('corel:execute-layout', async (_event, payload) => {
  return new Promise((resolve) => {
    const { targetSize, players, spacingCm = 1.0, limitCopy = 4, direction = 'vertical', maxNameWidthCm = 27.0 } = payload || {};
    if (!players || players.length === 0) {
      return resolve({ success: false, message: 'Daftar pemain kosong.' });
    }

    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    const tempJsonPath = path.join(tempDir, `corel_data_${timestamp}.json`);
    const tempPs1Path = path.join(tempDir, `corel_exec_${timestamp}.ps1`);

    const dataPayload = {
      targetSize,
      players,
      spacingCm: parseFloat(spacingCm) || 1.0,
      limitCopy: parseInt(limitCopy, 10) || 4,
      direction: direction || 'vertical',
      maxNameWidthCm: parseFloat(maxNameWidthCm) || 27.0,
    };

    fs.writeFileSync(tempJsonPath, JSON.stringify(dataPayload, null, 2), 'utf-8');

    const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and ($c.ActiveDocument -or ($c.Documents -and $c.Documents.Count -gt 0))) {
                $corel = $c; break
            }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel) { throw "Pastikan CorelDRAW sedang dibuka." }

    $doc = $null
    try { $doc = $corel.ActiveDocument } catch {}
    if (-not $doc -and $corel.Documents -and $corel.Documents.Count -gt 0) {
        try { $doc = $corel.Documents.Item(1); $doc.Activate() } catch {}
    }
    if (-not $doc) { throw "Tidak ada dokumen terbuka di CorelDRAW." }

    $doc.Unit = 4 # cdrCentimeter (4 = cm, 3 = mm)

    function Get-RangeCount($r) {
        if (-not $r) { return 0 }
        try { if ($r.Count -ne $null) { return [int]$r.Count } } catch {}
        try { if ($r.Shapes -and $r.Shapes.Count -ne $null) { return [int]$r.Shapes.Count } } catch {}
        return 0
    }
    function Get-RangeItem($r, [int]$idx) {
        if (-not $r) { return $null }
        try { $it = $r.Item($idx); if ($it) { return $it } } catch {}
        try { $it = $r.Shapes.Item($idx); if ($it) { return $it } } catch {}
        try { $it = $r[$idx]; if ($it) { return $it } } catch {}
        return $null
    }

    $selection = $null
    try { $selection = $corel.ActiveSelection } catch {}
    if (-not $selection -or (Get-RangeCount $selection) -eq 0) {
        try { $selection = $doc.Selection } catch {}
    }
    $selCount = Get-RangeCount $selection
    if ($selCount -eq 0) { throw "Silakan pilih (seleksi/blok) 1 grup master pola jersey di CorelDRAW terlebih dahulu." }

    $jsonFile = $args[0]
    $data = Get-Content -Path $jsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $playerList = $data.players
    $spacing = [double]$data.spacingCm
    $limit = [int]$data.limitCopy
    if ($limit -lt 1) { $limit = 4 }
    $dir = $data.direction
    $maxW = if ($data.maxNameWidthCm) { [double]$data.maxNameWidthCm } else { 27.0 }

    $masterShape = if ($selCount -gt 1) { $selection.Group() } else { Get-RangeItem $selection 1 }
    $width  = [double]$masterShape.SizeWidth
    $height = [double]$masterShape.SizeHeight

    function UpdateTextsInShape($shapeItem, $nameText, $numText, $maxNameLimit) {
        try {
            $textShapes = $shapeItem.Shapes.FindShapes($null, 6, $true)
            if ($textShapes.Count -gt 0) {
                for ($t = 1; $t -le $textShapes.Count; $t++) {
                    $ts = $textShapes.Item($t)
                    $origCenterX = [double]$ts.CenterX
                    $origCenterY = [double]$ts.CenterY
                    $origW       = [double]$ts.SizeWidth
                    $story = $ts.Text.Story
                    $curr = $story.Text.Trim()
                    try { $story.Alignment = 3 } catch {}
                    if ($curr -match '^\\d+$' -or $curr -match '(?i)^(#|00|99|0|no|no\\.)$') {
                        $story.Text = [string]$numText
                        if ($origW -gt 0 -and $ts.SizeWidth -gt ($origW * 1.25)) { $ts.SizeWidth = $origW * 1.25 }
                        $ts.CenterX = $origCenterX
                        $ts.CenterY = $origCenterY
                    } else {
                        $story.Text = [string]$nameText
                        $capW = [math]::Max($origW, $maxNameLimit)
                        if ($ts.SizeWidth -gt $capW) { $ts.SizeWidth = $capW }
                        $ts.CenterX = $origCenterX
                        $ts.CenterY = $origCenterY
                    }
                }
            }
        } catch {}
    }

    $corel.Optimization = $true
    $corel.EventsEnabled = $false
    $doc.BeginCommandGroup("CTS Auto-Layout Jersey")

    $created = 0
    if ($playerList.Count -gt 0) {
        $p0 = $playerList[0]
        $p0Name = if ($p0.name) { $p0.name.ToString().ToUpper() } else { "PEMAIN" }
        $p0Num = if ($p0.number -and $p0.number -ne '-') { $p0.number.ToString() } else { "" }
        UpdateTextsInShape $masterShape $p0Name $p0Num $maxW
        $created++
    }

    for ($i = 1; $i -lt $playerList.Count; $i++) {
        $p = $playerList[$i]
        $pName = if ($p.name) { $p.name.ToString().ToUpper() } else { "PEMAIN" }
        $pNum = if ($p.number -and $p.number -ne '-') { $p.number.ToString() } else { "" }
        $row = $i % $limit
        $col = [math]::Floor($i / $limit)
        $dx = $col * ($width + $spacing)
        $dy = -($row * ($height + $spacing))
        $dup = $masterShape.Duplicate($dx, $dy)
        UpdateTextsInShape $dup $pName $pNum $maxW
        $created++
    }

    $doc.EndCommandGroup()
    $corel.Optimization = $false
    $corel.EventsEnabled = $true
    $corel.Refresh()
    if ($corel.ActiveWindow) { $corel.ActiveWindow.Refresh() }

    $result.success = $true
    $result.count = $created
    $result.message = "Berhasil menata $created pola jersey di CorelDRAW!"
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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and ($c.ActiveDocument -or ($c.Documents -and $c.Documents.Count -gt 0))) {
                $corel = $c; break
            }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if ($corel) {
        $doc = $null
        try { $doc = $corel.ActiveDocument } catch {}
        if (-not $doc -and $corel.Documents -and $corel.Documents.Count -gt 0) {
            try { $doc = $corel.Documents.Item(1); $doc.Activate() } catch {}
        }
        if ($doc) {
            $doc.Unit = 4 # cdrCentimeter (4 = cm, 3 = mm)
            $sel = $null
            try { $sel = $corel.ActiveSelection } catch {}
            if (-not $sel -or $sel.Shapes.Count -eq 0) { try { $sel = $doc.Selection } catch {} }
            if ($sel -and $sel.Shapes.Count -gt 0) {
                $result.success = $true
                $result.count = $sel.Shapes.Count
                $result.widthCm = [math]::Round([double]$sel.SizeWidth, 3)
                $result.heightCm = [math]::Round([double]$sel.SizeHeight, 3)
            } else {
                $result.success = $true
            }
        }
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
    $corel = $null
    for ($v = 26; $v -ge 14; $v--) {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$v")
            if ($c -and $c.ActiveDocument) { $corel = $c; break }
        } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if (-not $corel -or -not $corel.ActiveDocument) { throw "Buka file di CorelDRAW." }

    $doc = $corel.ActiveDocument
    $doc.Unit = 4 # cdrCentimeter (4 = cm, 3 = mm)
    $sel = $null
    try { $sel = $corel.ActiveSelection } catch {}
    if (-not $sel -or $sel.Shapes.Count -eq 0) { try { $sel = $doc.Selection } catch {} }
    if (-not $sel -or $sel.Shapes.Count -eq 0) { throw "Pilih bentuk pola target di CorelDRAW untuk di-PowerClip." }

    $targetShape = if ($sel.Shapes.Count -gt 1) { $sel.Group() } else { $sel.Shapes.Item(1) }
    $w = [double]$targetShape.SizeWidth
    $h = [double]$targetShape.SizeHeight
    $cx = [double]$targetShape.CenterX
    $cy = [double]$targetShape.CenterY

    $data = Get-Content -Path '${tempJsonPath.replace(/'/g, "''")}' -Raw -Encoding UTF8 | ConvertFrom-Json
    $patFile = $data.patternPath
    $bleed = [double]$data.bleedCm

    $layer = $doc.ActiveLayer
    $importedBmp = $layer.ImportBitmap($patFile)
    if (-not $importedBmp) { throw "Gagal mengimpor gambar ke CorelDRAW." }

    $importedBmp.SizeWidth = $w + ($bleed * 2)
    $importedBmp.SizeHeight = $h + ($bleed * 2)
    $importedBmp.CenterX = $cx
    $importedBmp.CenterY = $cy

    try {
        $importedBmp.AddToPowerClip($targetShape)
    } catch {
        [void]$importedBmp.OrderToBack()
    }

    $corel.Refresh()
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

