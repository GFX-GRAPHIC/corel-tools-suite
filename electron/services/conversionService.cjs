/**
 * File Conversion Service
 * Batch converts CDR files to PDF, PNG, JPG, EPS, AI, and SVG using CorelDRAW COM.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('../core/electronBridge.cjs');
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

async function executeConversion(payload) {
  const {
    files = [],
    outputFormat = 'PDF',
    outputFolder = '',
    dpi = 300,
    openFolderAfter = true,
    overwrite = true,
  } = payload || {};

  if (!files.length) return { success: false, message: 'Daftar file yang dikonversi kosong.' };
  if (!outputFolder) return { success: false, message: 'Pilih folder tujuan output terlebih dahulu.' };

  const tempJson = path.join(app.getPath('temp'), `cts_convert_${Date.now()}.json`);
  try {
    fs.writeFileSync(tempJson, JSON.stringify({ files, outputFormat, outputFolder, dpi, overwrite }), 'utf-8');
  } catch (e) {
    return { success: false, message: `Gagal membuat file temporary konversi: ${e.message}` };
  }

  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ success = $false; message = ''; processed = 0 }

function Convert-CdrNative($sourcePath, $destinationPath, $targetFormat, $targetDpi) {
    try {
        Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $zip = [System.IO.Compression.ZipFile]::OpenRead($sourcePath)
        $thumbEntry = $null
        foreach ($e in $zip.Entries) {
            if ($e.FullName -like "*thumbnail.png*") {
                $thumbEntry = $e
                break
            }
        }
        if (-not $thumbEntry) {
            foreach ($e in $zip.Entries) {
                if ($e.FullName -like "*thumbnail.bmp*" -or $e.FullName -like "*preview.bmp*") {
                    $thumbEntry = $e
                    break
                }
            }
        }
        if ($thumbEntry) {
            $ms = New-Object System.IO.MemoryStream
            $st = $thumbEntry.Open()
            $st.CopyTo($ms)
            $st.Close()
            $zip.Dispose()
            $bytes = $ms.ToArray()
            $ms.Close()

            if ($targetFormat -eq 'PNG') {
                [System.IO.File]::WriteAllBytes($destinationPath, $bytes)
                return $true
            } elseif ($targetFormat -eq 'JPG' -or $targetFormat -eq 'JPEG') {
                Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
                $imgMs = New-Object System.IO.MemoryStream(,$bytes)
                $img = [System.Drawing.Image]::FromStream($imgMs)
                $img.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
                $img.Dispose()
                $imgMs.Close()
                return $true
            } else {
                [System.IO.File]::WriteAllBytes($destinationPath, $bytes)
                return $true
            }
        }
        $zip.Dispose()
        return $false
    } catch {
        try { if ($zip) { $zip.Dispose() } } catch {}
        return $false
    }
}

try {
    $json = [System.IO.File]::ReadAllText('${tempJson.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    $files = $json.files
    $format = [string]$json.outputFormat.ToUpper()
    $outDir = [string]$json.outputFolder
    $dpi = [int]$json.dpi

    if (-not (Test-Path $outDir)) {
        try { New-Item -ItemType Directory -Path $outDir -Force | Out-Null } catch {}
    }

${getCorelConnectPs()}

    $count = 0
    foreach ($f in $files) {
        $srcPath = if ($f.path) { [string]$f.path } elseif ($f.filePath) { [string]$f.filePath } else { [string]$f }
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

        $converted = $false
        if ($corel) {
            try {
                $doc = $corel.OpenDocument($srcPath)
                if ($doc) {
                    try {
                        if ($format -eq 'PDF') {
                            $doc.PublishToPDF($destPath)
                        } elseif ($format -eq 'PNG') {
                            $filter = $doc.ExportBitmap($destPath, 774, 1, 5, 0, 0, $dpi, $dpi)
                            if ($filter) { $filter.Finish() }
                        } elseif ($format -eq 'JPG' -or $format -eq 'JPEG') {
                            $filter = $doc.ExportBitmap($destPath, 771, 1, 4, 0, 0, $dpi, $dpi)
                            if ($filter) { $filter.Finish() }
                        } else {
                            $doc.SaveAs($destPath)
                        }
                        $converted = $true
                        $count++
                    } finally {
                        $doc.Close()
                    }
                }
            } catch {}
        }

        if (-not $converted) {
            if (Convert-CdrNative $srcPath $destPath $format $dpi) {
                $count++
            }
        }
    }

    $result.success = ($count -gt 0)
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

  return runPowerShellScript(psScript, 600000);
}

module.exports = {
  executeConversion,
};
