/**
 * CDR Version Downsaver & Inspector IPC Handlers
 */
const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { getCorelProcessHelpersPs, getPreferredCorelVersion } = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

let cdrVersionService = null;
try {
  cdrVersionService = require('../cdrVersionService.cjs');
} catch (e) {
  console.log('[cdrIpc] note:', e.message);
}

function registerCdrIpc() {
  ipcMain.handle('corel:inspect-cdr-file', async (_event, filePath) => {
    try {
      if (!cdrVersionService) cdrVersionService = require('../cdrVersionService.cjs');
      return cdrVersionService.inspectCdrFile(filePath);
    } catch (err) {
      return { success: false, message: err?.message };
    }
  });

  ipcMain.handle('corel:scan-cdr-directory', async (_event, { dirPath, recursive }) => {
    try {
      if (!cdrVersionService) cdrVersionService = require('../cdrVersionService.cjs');
      const files = cdrVersionService.scanDirectoryForCdr(dirPath, recursive !== false);
      return { success: true, files };
    } catch (err) {
      return { success: false, message: err?.message, files: [] };
    }
  });

  ipcMain.handle('corel:inspect-cdr-files', async (_event, filePaths) => {
    try {
      if (!cdrVersionService) cdrVersionService = require('../cdrVersionService.cjs');
      return cdrVersionService.inspectCdrBatch(filePaths);
    } catch (err) {
      return { success: false, message: err?.message };
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
    const pref = getPreferredCorelVersion();

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

$preferredVer = '${pref.preferredVersion}'
$preferredPid = ${pref.preferredPid}
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
        if ($c) { $corel = $c }
    } catch {}
}
if (-not $corel) {
    try {
        $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application")
        if ($c) { $corel = $c }
    } catch {}
}
if (-not $corel -and $runningVer -gt 0) {
    try {
        $c = New-Object -ComObject "CorelDRAW.Application.$runningVer" -ErrorAction SilentlyContinue
        if ($c) { $corel = $c }
    } catch {}
}
if (-not $corel) {
    try {
        $c = New-Object -ComObject "CorelDRAW.Application" -ErrorAction SilentlyContinue
        if ($c) { $corel = $c }
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

        if ($cleanupJunk) {
            try { $doc.ColorStyles.Clear() } catch {}
            try { $doc.Views.Clear() } catch {}
        }

        if ($curveTo) {
            try {
                if ($doc.Pages) {
                    foreach ($pg in $doc.Pages) {
                        $textShapes = $pg.Shapes.FindShapes($null, 6)
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
      return await runPowerShellScript(ps, Math.max(30000, files.length * 15000));
    } finally {
      try { if (fs.existsSync(tempJson)) fs.unlinkSync(tempJson); } catch {}
      try { if (fs.existsSync(cancelMarker)) fs.unlinkSync(cancelMarker); } catch {}
    }
  });
}

module.exports = {
  registerCdrIpc,
};
