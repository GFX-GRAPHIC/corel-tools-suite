/**
 * Conversion Service
 * Exports and converts CorelDRAW files to PDF, PNG, JPG, EPS, AI, and SVG.
 */
const fs = require('fs');
const path = require('path');
const { app, shell } = require('../core/electronBridge.cjs');
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

async function executeConversion(payload) {
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

${getCorelConnectPs()}

    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}

    $count = 0
    foreach ($f in $files) {
        try {
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

            $doc = $null
            try { $doc = $corel.OpenDocument($srcPath) } catch {}
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
                    try { $doc.Close() } catch {}
                }
            }
        } catch {}
    }

    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}

    $result.success = ($count -gt 0)
    $result.processed = $count
    $result.message = "Berhasil mengonversi $count file ke format $format di folder tujuan."
}
catch {
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
finally {
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { Remove-Item '${tempJson.replace(/'/g, "''")}' -Force } catch {}
}
$result | ConvertTo-Json -Compress
`;

  const res = await runPowerShellScript(ps, Math.max(600000, files.length * 20000));
  if (res && res.success && openFolderAfter && fs.existsSync(outputFolder)) {
    shell.openPath(outputFolder);
  }
  return res;
}

module.exports = {
  executeConversion,
};
