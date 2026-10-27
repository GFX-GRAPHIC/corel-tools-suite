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

  ipcMain.handle('corel:scan-directory-files', async (_event, { dirPath, extensions, recursive }) => {
    try {
      if (!cdrVersionService) cdrVersionService = require('../cdrVersionService.cjs');
      const files = cdrVersionService.scanDirectoryForFiles(dirPath, extensions, recursive !== false);
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

function Downsave-CdrContainerDirect($sourcePath, $destinationPath, $targetVer) {
    try {
        Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue

        $outParent = [System.IO.Path]::GetDirectoryName($destinationPath)
        if (-not [string]::IsNullOrEmpty($outParent) -and -not (Test-Path $outParent)) {
            New-Item -ItemType Directory -Path $outParent -Force | Out-Null
        }

        if ($sourcePath -ne $destinationPath) {
            Copy-Item -Path $sourcePath -Destination $destinationPath -Force
        }

        $verCode = "$($targetVer)00"
        $verName = switch ($targetVer) {
            14 { "CorelDRAW X4" }
            15 { "CorelDRAW X5" }
            16 { "CorelDRAW X6" }
            17 { "CorelDRAW X7" }
            18 { "CorelDRAW X8" }
            19 { "CorelDRAW 2017" }
            20 { "CorelDRAW 2018" }
            21 { "CorelDRAW 2019" }
            22 { "CorelDRAW 2020" }
            23 { "CorelDRAW 2021" }
            24 { "CorelDRAW 2022" }
            25 { "CorelDRAW 2024" }
            default { "CorelDRAW" }
        }

        $zip = [System.IO.Compression.ZipFile]::Open($destinationPath, [System.IO.Compression.ZipArchiveMode]::Update)
        
        $metaEntry = $null
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -like "*metadata.xml*") {
                $metaEntry = $entry
                break
            }
        }

        if ($metaEntry) {
            $sr = New-Object System.IO.StreamReader($metaEntry.Open(), [System.Text.Encoding]::UTF8)
            $xmlText = $sr.ReadToEnd()
            $sr.Close()
            $entryPath = $metaEntry.FullName
            $metaEntry.Delete()

            $xmlText = [System.Text.RegularExpressions.Regex]::Replace($xmlText, "(<cdr:AppVersion>)(.*?)(</cdr:AppVersion>)", ('$1' + $verCode + '$3'), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            $xmlText = [System.Text.RegularExpressions.Regex]::Replace($xmlText, "(<AppVersion>)(.*?)(</AppVersion>)", ('$1' + $verCode + '$3'), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            $xmlText = [System.Text.RegularExpressions.Regex]::Replace($xmlText, "(<cdr:ProductName>)(.*?)(</cdr:ProductName>)", ('$1' + $verName + '$3'), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            $xmlText = [System.Text.RegularExpressions.Regex]::Replace($xmlText, "(<ProductName>)(.*?)(</ProductName>)", ('$1' + $verName + '$3'), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

            $newMeta = $zip.CreateEntry($entryPath)
            $sw = New-Object System.IO.StreamWriter($newMeta.Open(), [System.Text.Encoding]::UTF8)
            $sw.Write($xmlText)
            $sw.Close()
        }

        $rootEntry = $null
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -like "*root.dat*" -or $entry.FullName -like "*riffData.cdr*") {
                $rootEntry = $entry
                break
            }
        }

        if ($rootEntry) {
            $ms = New-Object System.IO.MemoryStream
            $st = $rootEntry.Open()
            $st.CopyTo($ms)
            $st.Close()
            $bytes = $ms.ToArray()
            $ms.Close()

            $modified = $false
            for ($bi = 0; $bi -lt ($bytes.Length - 16); $bi++) {
                if ($bytes[$bi] -eq 0x66 -and $bytes[$bi+1] -eq 0x76 -and $bytes[$bi+2] -eq 0x65 -and $bytes[$bi+3] -eq 0x72) {
                    $payloadStart = $bi + 8
                    if ($payloadStart + 2 -lt $bytes.Length) {
                        $bytes[$payloadStart] = [byte]$targetVer
                        $bytes[$payloadStart + 1] = 0
                        $modified = $true
                        break
                    }
                }
            }

            if ($modified) {
                $rootPath = $rootEntry.FullName
                $rootEntry.Delete()
                $newRoot = $zip.CreateEntry($rootPath)
                $nw = $newRoot.Open()
                $nw.Write($bytes, 0, $bytes.Length)
                $nw.Close()
            }
        }

        $zip.Dispose()
        return $true
    } catch {
        try { if ($zip) { $zip.Dispose() } } catch {}
        return $false
    }
}

$hasCorel = $false
$corel = $null
$runningVer = 0

$allProcs = @(Get-RealCorelProcesses)
if ($allProcs -and $allProcs.Count -gt 0) {
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
    if ($targetProc) {
        $runningVer = Get-CorelVerFromProcess $targetProc
    }

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
    if ($corel) {
        $hasCorel = $true
        try { $corel.Optimization = $true } catch {}
        try { $corel.EventsEnabled = $false } catch {}
    }
}

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

    $convertedOk = $false
    $doc = $null
    $wasAlreadyOpen = $false

    # Strategy 1: If CorelDRAW is running, try native OpenDocument and SaveAs
    if ($hasCorel -and $corel) {
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
                try {
                    $doc = $corel.OpenDocument($srcPath)
                } catch {
                    # If failed to open (e.g. newer version v26), patch container to runningVer first
                    $tempPatched = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "cts_patch_" + [System.IO.Path]::GetFileName($srcPath))
                    $patchedOk = Downsave-CdrContainerDirect $srcPath $tempPatched $runningVer
                    if ($patchedOk -and (Test-Path $tempPatched)) {
                        $doc = $corel.OpenDocument($tempPatched)
                        try { Remove-Item $tempPatched -Force } catch {}
                    }
                }
            }

            if ($doc) {
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
                $convertedOk = $true
            }
        } catch {
            try { if ($doc -and -not $wasAlreadyOpen) { $doc.Close() } } catch {}
            $convertedOk = $false
        }
    }

    # Strategy 2: If CorelDRAW is absent or native save failed, use Direct Container Engine
    if (-not $convertedOk) {
        $containerOk = Downsave-CdrContainerDirect $srcPath $destPath $targetVersion
        if ($containerOk -and (Test-Path $destPath)) {
            $convertedOk = $true
        }
    }

    if ($convertedOk) {
        $result.converted += @{
            src = $srcPath
            dest = $destPath
            targetVersion = $targetVersion
        }
    } else {
        $result.failed += @{
            file = $srcPath
            error = "Gagal menurunkan versi file CDR"
        }
    }
}

if ($hasCorel -and $corel) {
    try { $corel.Optimization = $false } catch {}
    try { $corel.EventsEnabled = $true } catch {}
}

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
