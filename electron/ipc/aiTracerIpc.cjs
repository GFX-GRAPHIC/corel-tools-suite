/**
 * AI Jersey Tracer IPC Handlers
 */
const { ipcMain, nativeImage, clipboard, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { createCorelAiTracerWindow } = require('../services/windowManager.cjs');
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

let aiTracerService = null;
try {
  aiTracerService = require('../aiTracerService.cjs');
} catch (e) {
  console.log('[aiTracerIpc] note:', e.message);
}

function registerAiTracerIpc() {
  ipcMain.handle('corel:open-ai-tracer-tool', async () => {
    try {
      const win = createCorelAiTracerWindow();
      return { success: !!win };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal membuka jendela AI Tracer.' };
    }
  });

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
    const { patternPath, logoBase64, bleedCm = 1.5 } = payload || {};
    if (!patternPath || !fs.existsSync(patternPath)) {
      return { success: false, message: 'File motif tidak ditemukan.' };
    }
    let logoPath = '';
    if (logoBase64 && aiTracerService) {
      try { logoPath = aiTracerService.saveExtractedLogo(logoBase64); } catch {}
    }

    const tempDir = app.getPath('temp');
    const tempJsonPath = path.join(tempDir, `corel_apply_pattern_${Date.now()}.json`);
    fs.writeFileSync(tempJsonPath, JSON.stringify({ patternPath, logoPath, bleedCm }), 'utf-8');

    const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }
try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka file di CorelDRAW terlebih dahulu." }

    $origUnit = Com-Get $doc 'Unit'
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter

    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    $cnt = [int]$selInfo.SelCount
    if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

    if ($cnt -eq 0 -or -not $sel) { throw "Pilih bentuk pola target di CorelDRAW untuk di-PowerClip." }

    $targetShape = if ($cnt -gt 1) { Com-Call $sel 'Group' } else { Get-RangeItem $sel 1 }
    if (-not $targetShape -and $sel) { $targetShape = $sel }
    if (-not $targetShape) { throw "Gagal membaca bentuk pola target di CorelDRAW." }
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
    $result.success = $true
    $result.message = "Motif berhasil diterapkan ke dalam pola CorelDRAW!"
} catch {
    $result.success = $false
    $result.message = $_.Exception.Message
} finally {
    try { if (Test-Path '${tempJsonPath.replace(/'/g, "''")}') { Remove-Item -Path '${tempJsonPath.replace(/'/g, "''")}' -Force } } catch {}
}
$result | ConvertTo-Json -Compress
`;

    return await runPowerShellScript(psScript, 30000);
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
}

module.exports = {
  registerAiTracerIpc,
};
