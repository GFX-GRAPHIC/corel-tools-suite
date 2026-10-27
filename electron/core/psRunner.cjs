/**
 * PowerShell Script Runner for CorelDRAW Automation
 * Executes PS scripts reliably, handles temp files, timeouts, and JSON results safely.
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { app } = require('./electronBridge.cjs');
const logger = require('./logger.cjs');

function runPowerShellScript(psContent, timeout = 600000) {
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

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempPs1Path],
      { timeout: Math.max(600000, timeout) },
      (err, stdout, stderr) => {
        try {
          if (tempPs1Path && fs.existsSync(tempPs1Path)) {
            fs.unlinkSync(tempPs1Path);
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
};
