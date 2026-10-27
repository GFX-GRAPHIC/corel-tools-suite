/**
 * License & Auto-Updater Service
 * Wraps licenseEngine and manages portable & installer updates.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const { app } = require('../core/electronBridge.cjs');
const { isPortable } = require('../core/env.cjs');
const { sendUpdaterStatus } = require('./windowManager.cjs');

let licenseEngine = null;
try {
  licenseEngine = require('../licenseEngine.cjs');
} catch (e) {
  console.log('[licenseService] Note: licenseEngine not loaded:', e.message);
}

let autoUpdater = null;
let portableDownloadedPath = null;
let portableTargetVersion = null;
let isPortableDownloading = false;

try {
  autoUpdater = require('electron-updater').autoUpdater;
  if (isPortable) {
    autoUpdater.autoDownload = false;
  } else {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
  }
} catch (e) {
  console.log('[AutoUpdater] note:', e.message);
}

function initAutoUpdater() {
  if (!autoUpdater) return;
  autoUpdater.on('checking-for-update', () => sendUpdaterStatus('checking', {}, isPortable));
  autoUpdater.on('update-available', (info) => {
    if (isPortable) {
      sendUpdaterStatus('portable-available', { version: info.version }, isPortable);
      downloadPortableUpdate(info.version);
    } else {
      sendUpdaterStatus('available', { version: info.version }, isPortable);
    }
  });
  autoUpdater.on('update-not-available', () => sendUpdaterStatus('not-available', {}, isPortable));
  autoUpdater.on('error', (err) => sendUpdaterStatus('error', { error: err?.message || 'Gagal update' }, isPortable));
  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdaterStatus('downloading', {
      percent: Math.round(progressObj.percent || 0),
      transferred: progressObj.transferred,
      total: progressObj.total,
    }, isPortable);
  });
  autoUpdater.on('update-downloaded', (info) => sendUpdaterStatus('downloaded', { version: info.version }, isPortable));
}

function downloadPortableUpdate(version) {
  if (isPortableDownloading) return;
  isPortableDownloading = true;

  const downloadUrl = `https://github.com/GFX-GRAPHIC/corel-tools-suite/releases/download/v${version}/Corel-Tools-Suite-${version}-Portable.exe`;
  const tempPath = path.join(app.getPath('temp'), `Corel-Tools-Suite-${version}-Portable-Update.exe`);

  sendUpdaterStatus('downloading', { percent: 0, transferred: 0, total: 0, version }, isPortable);

  function doDownload(targetUrl, redirectCount = 0) {
    if (redirectCount > 5) {
      isPortableDownloading = false;
      sendUpdaterStatus('portable-available', { version, error: 'Terlalu banyak pengalihan (redirect)' }, isPortable);
      return;
    }

    try {
      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 CorelToolsSuite' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doDownload(res.headers.location, redirectCount + 1);
        }
        if (res.statusCode !== 200) {
          isPortableDownloading = false;
          sendUpdaterStatus('portable-available', { version }, isPortable);
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        let lastReport = 0;
        const fileStream = fs.createWriteStream(tempPath);

        res.on('data', (chunk) => {
          received += chunk.length;
          const now = Date.now();
          if (now - lastReport > 250 || received === total) {
            lastReport = now;
            const percent = total > 0 ? Math.round((received / total) * 100) : 0;
            sendUpdaterStatus('downloading', { percent, transferred: received, total, version }, isPortable);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            isPortableDownloading = false;
            if (total > 0 && received < total) {
              try { fs.unlinkSync(tempPath); } catch {}
              sendUpdaterStatus('portable-available', { version, error: 'Unduhan terputus di tengah jalan' }, isPortable);
              return;
            }
            if (received < 50000000) {
              try { fs.unlinkSync(tempPath); } catch {}
              sendUpdaterStatus('portable-available', { version, error: 'Ukuran file pembaruan tidak valid' }, isPortable);
              return;
            }
            portableDownloadedPath = tempPath;
            portableTargetVersion = version;
            sendUpdaterStatus('downloaded', { version, isPortable: true }, isPortable);
          });
        });

        fileStream.on('error', () => {
          isPortableDownloading = false;
          try { fs.unlinkSync(tempPath); } catch {}
          sendUpdaterStatus('portable-available', { version }, isPortable);
        });
      });

      req.on('error', () => {
        isPortableDownloading = false;
        sendUpdaterStatus('portable-available', { version }, isPortable);
      });
    } catch {
      isPortableDownloading = false;
      sendUpdaterStatus('portable-available', { version }, isPortable);
    }
  }

  doDownload(downloadUrl);
}

function installPortableUpdate() {
  if (!portableDownloadedPath || !fs.existsSync(portableDownloadedPath)) {
    return false;
  }

  const targetExe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  const runnerScriptPath = path.join(app.getPath('temp'), 'corel-portable-update-runner.ps1');

  const runnerContent = [
    `$parentPid = ${process.pid}`,
    `$targetExe = '${targetExe.replace(/'/g, "''")}'`,
    `$newExe = '${portableDownloadedPath.replace(/'/g, "''")}'`,
    `$selfScript = $MyInvocation.MyCommand.Path`,
    '',
    'try {',
    '    $proc = Get-Process -Id $parentPid -ErrorAction SilentlyContinue',
    '    if ($proc) {',
    '        $proc.WaitForExit(30000)',
    '    }',
    '} catch {}',
    '',
    'Start-Sleep -Milliseconds 800',
    '',
    'try {',
    '    Copy-Item -Path $newExe -Destination $targetExe -Force -ErrorAction Stop',
    '    Remove-Item -Path $newExe -Force -ErrorAction SilentlyContinue',
    '} catch {',
    '    try { Move-Item -Path $newExe -Destination $targetExe -Force -ErrorAction SilentlyContinue } catch {}',
    '}',
    '',
    'try {',
    '    Start-Process -FilePath $targetExe',
    '} catch {}',
    '',
    'if ($selfScript -and (Test-Path $selfScript)) {',
    '    Start-Sleep -Milliseconds 500',
    '    try { Remove-Item -Path $selfScript -Force -ErrorAction SilentlyContinue } catch {}',
    '}'
  ].join('\r\n');

  try {
    fs.writeFileSync(runnerScriptPath, runnerContent, 'utf-8');
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass',
      '-File', runnerScriptPath
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    app.exit(0);
    return true;
  } catch (err) {
    return false;
  }
}

function getLicenseStatus() {
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
}

function getHardwareId() {
  if (!licenseEngine) return 'GFX-ERROR';
  return licenseEngine.getHardwareId();
}

async function activateLicenseKey(key) {
  if (!licenseEngine) return { success: false, message: 'Modul lisensi belum aktif.' };
  return await licenseEngine.activateLicenseKey(key);
}

function deactivateLicense() {
  if (!licenseEngine) return { success: false, message: 'Modul lisensi belum aktif.' };
  return licenseEngine.deactivateLicense();
}

async function checkForUpdates() {
  if (!autoUpdater) return { success: false, message: 'Modul auto-updater belum siap.' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (err) {
    return { success: false, message: err?.message || 'Gagal memeriksa update' };
  }
}

function quitAndInstallUpdate() {
  if (isPortable && portableDownloadedPath && fs.existsSync(portableDownloadedPath)) {
    installPortableUpdate();
    return;
  }
  if (autoUpdater) {
    autoUpdater.quitAndInstall();
  }
}

module.exports = {
  initAutoUpdater,
  getLicenseStatus,
  getHardwareId,
  activateLicenseKey,
  deactivateLicense,
  checkForUpdates,
  quitAndInstallUpdate,
};
