/**
 * PowerShell Script Runner for CorelDRAW Automation
 * Executes PS scripts reliably, handles temp files, timeouts, and JSON results safely.
 */
const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const { app } = require('./electronBridge.cjs');
const logger = require('./logger.cjs');

let activeChildProcess = null;
let activeTempPs1Path = null;
let activeResolve = null;

function getCancelFlagPath() {
  try {
    return path.join(app.getPath('temp'), 'corel_cts_cancel.flag');
  } catch {
    return path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'corel_cts_cancel.flag');
  }
}

function cancelCurrentOperation() {
  const flagPath = getCancelFlagPath();
  try {
    fs.writeFileSync(flagPath, 'CANCEL', 'utf-8');
  } catch {}

  if (activeChildProcess && activeChildProcess.pid) {
    const pid = activeChildProcess.pid;
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {}
    try {
      activeChildProcess.kill('SIGKILL');
    } catch {}
    activeChildProcess = null;
  }

  if (activeTempPs1Path && fs.existsSync(activeTempPs1Path)) {
    try { fs.unlinkSync(activeTempPs1Path); } catch {}
    activeTempPs1Path = null;
  }

  if (activeResolve) {
    const res = activeResolve;
    activeResolve = null;
    res({ success: false, message: 'Operasi berhasil dibatalkan oleh pengguna.' });
  }

  return { success: true, message: 'Operasi berhasil dibatalkan.' };
}

function runPowerShellScript(psContent, timeout = 600000) {
  const flagPath = getCancelFlagPath();
  try {
    if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
  } catch {}

  return new Promise((resolve) => {
    let tempPs1Path = null;
    try {
      const tempDir = app.getPath('temp');
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      tempPs1Path = path.join(tempDir, `corel_cts_${uniqueId}.ps1`);

      fs.writeFileSync(tempPs1Path, psContent, 'utf-8');
    } catch (writeErr) {
      logger.error('psRunner', 'Gagal menulis file temporary script:', writeErr);
      return resolve({
        success: false,
        message: `Gagal membuat file temporary script: ${writeErr?.message || writeErr}`
      });
    }

    activeResolve = resolve;
    activeTempPs1Path = tempPs1Path;

    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempPs1Path],
      { timeout: Math.max(600000, timeout) },
      (err, stdout, stderr) => {
        if (activeChildProcess === child) {
          activeChildProcess = null;
          activeTempPs1Path = null;
          activeResolve = null;
        }

        try {
          if (tempPs1Path && fs.existsSync(tempPs1Path)) {
            fs.unlinkSync(tempPs1Path);
          }
        } catch {}

        try {
          if (fs.existsSync(flagPath)) {
            fs.unlinkSync(flagPath);
            return resolve({
              success: false,
              message: 'Operasi berhasil dibatalkan oleh pengguna.'
            });
          }
        } catch {}

        if (err && !stdout) {
          if (err.code === 'ETIMEDOUT') {
            return resolve({
              success: false,
              message: 'Waktu proses di CorelDRAW melebihi batas (Timeout). Silakan kurangi beban dokumen atau coba beberapa saat lagi.'
            });
          }
          const rawErr = stderr || err?.message || 'Gagal menjalankan automasi di CorelDRAW';
          const cleanErr = rawErr
            .replace(/^Command failed:.*$/m, '')
            .replace(/powershell\.exe.*?-File\s+[^\r\n]+/gi, '')
            .trim();
          return resolve({
            success: false,
            message: cleanErr || 'Gagal menjalankan automasi di CorelDRAW'
          });
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
          resolve({
            success: false,
            message: (stdout || '').trim() || (stderr || '').trim() || 'Gagal memproses respon CorelDRAW'
          });
        }
      }
    );
  });
}

module.exports = {
  runPowerShellScript,
  cancelCurrentOperation,
};
