/**
 * Utility Service
 * Provides CorelDRAW connection inspection, document manipulation, curves conversion,
 * text case changing, color replace & extraction, splitting, dark mode toggle, and ghost process cleanup.
 */
const fs = require('fs');
const { shell } = require('../core/electronBridge.cjs');
const {
  getCorelProcessHelpersPs,
  getCorelFindAppPs,
  getCorelConnectPs,
  getPreferredCorelVersion,
  setPreferredCorelVersion: setPrefVer
} = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

async function checkStatus() {
  const pref = getPreferredCorelVersion();
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
    preferredVersion = '${pref.preferredVersion}'
    runningInstances = @()
}

${getCorelProcessHelpersPs()}

$allProcs = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue
$realProcs = if ($allProcs) { $allProcs | Where-Object { $_.MainWindowHandle -ne 0 -or $_.Responding } } else { $null }

if ($realProcs) {
    $res.connected = $true

    $preferredVer = '${pref.preferredVersion}'
    $preferredPid = ${pref.preferredPid}
    $targetProc = $null
    if ($preferredPid -and $preferredPid -gt 0) {
        $cand = $realProcs | Where-Object { $_.Id -eq $preferredPid } | Select-Object -First 1
        if ($cand) { $targetProc = $cand }
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
        $wTitle = $targetProc.MainWindowTitle
        if ($wTitle -match '[-–]\s*\[?([^\[\]]+?\.(?:cdr|cmx))\]?') {
            $res.activeDoc = $matches[1].Trim()
        } elseif ($wTitle -match '([^\\/\\:]+\\.(?:cdr|cmx))') {
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
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$cVerMajor") } catch {}
    }
    if (-not $corel) {
        try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
    }
    if ($corel) {
        try {
            if ($corel.ActiveDocument) {
                $res.activeDoc = $corel.ActiveDocument.Name
                try { $res.docPath = $corel.ActiveDocument.FullFileName } catch {}
                try { $res.selectionCount = $corel.ActiveDocument.Selection.Shapes.Count } catch {}
                try { $res.pageCount = $corel.ActiveDocument.Pages.Count } catch {}
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
}

function getPreferredVersion() {
  return { success: true, ...getPreferredCorelVersion() };
}

function setPreferredVersion(version, pid) {
  return setPrefVer(version, pid);
}

async function getDetectedVersions() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
${getCorelProcessHelpersPs()}

$allProcs = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue
$realProcs = if ($allProcs) { $allProcs | Where-Object { $_.MainWindowHandle -ne 0 -or $_.Responding } } else { $null }

$list = @()
if ($realProcs) {
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
            default { if ($v -gt 0) { "CorelDRAW v$v" } else { "CorelDRAW" } }
        }
        $docName = ''
        if ($p.MainWindowTitle) {
            $w = $p.MainWindowTitle
            if ($w -match '[-–]\\s*\\[?([^\\[\\]]+?\\.(?:cdr|cmx))\\]?') {
                $docName = $matches[1].Trim()
            } elseif ($w -match '([^\\\\/\\:]+\\.(?:cdr|cmx))') {
                $docName = $matches[1].Trim()
            }
        }
        $list += @{
            pid = $p.Id
            version = [string]$v
            versionNum = $v
            name = $vName
            activeDoc = $docName
            title = $p.MainWindowTitle
        }
    }
}
$list | ConvertTo-Json -Compress
`;
  const res = await runPowerShellScript(ps, 5000);
  return Array.isArray(res) ? res : (res && res.name ? [res] : []);
}

function cancelOperation() {
  return { success: true, message: 'Operasi dibatalkan' };
}

async function getRecentFiles() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$files = @()
${getCorelConnectPs()}
if ($corel) {
    try {
        $recent = $corel.RecentFiles
        if ($recent) {
            for ($i = 1; $i -le [math]::Min(15, $recent.Count); $i++) {
                try {
                    $rf = $recent.Item($i)
                    if ($rf -and (Test-Path $rf.FullName)) {
                        $files += @{
                            name = $rf.Name
                            fullPath = $rf.FullName
                        }
                    }
                } catch {}
            }
        }
    } catch {}
}
@{ success = $true; files = $files } | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
}

async function openDocument(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, message: 'File tidak ditemukan di disk.' };
  }
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }
try {
${getCorelConnectPs()}
    $path = '${filePath.replace(/'/g, "''")}'
    $doc = $corel.OpenDocument($path)
    if ($doc) {
        $result.success = $true
        $result.message = "Berhasil membuka dokumen: $($doc.Name)"
    } else {
        throw "Gagal membuka dokumen di CorelDRAW."
    }
} catch {
    $result.success = $false
    $result.message = $_.Exception.Message
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 20000);
}

async function cleanGhostProcesses() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$killed = 0
$ghostProcs = @(Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -eq 0 })
if ($ghostProcs.Count -gt 0) {
    foreach ($p in $ghostProcs) {
        try {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            $killed++
        } catch {}
    }
}
@{ success = $true; killedCount = $killed; message = "Berhasil membersihkan $killed proses latar belakang CorelDRAW." } | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
}

async function launchApp() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$regPaths = @(
    "Registry::HKEY_CLASSES_ROOT\\CorelDRAW.Application\\shell\\open\\command",
    "Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\CorelDRW.exe"
)
$exePath = ''
foreach ($rp in $regPaths) {
    $val = (Get-ItemProperty $rp -ErrorAction SilentlyContinue).'(default)'
    if ($val) {
        $m = [regex]::Match($val, '"([^"]+)"')
        if ($m.Success) { $exePath = $m.Groups[1].Value; break }
        elseif (Test-Path $val) { $exePath = $val; break }
    }
}
if ($exePath -and (Test-Path $exePath)) {
    Start-Process $exePath
    @{ success = $true; message = "CorelDRAW berhasil dibuka." } | ConvertTo-Json -Compress
} else {
    try {
        New-Object -ComObject CorelDRAW.Application -ErrorAction Stop | Out-Null
        @{ success = $true; message = "CorelDRAW berhasil diinisialisasi melalui COM." } | ConvertTo-Json -Compress
    } catch {
        @{ success = $false; message = "Tidak dapat menemukan file instalasi CorelDRAW pada sistem ini." } | ConvertTo-Json -Compress
    }
}
`;
  return runPowerShellScript(ps, 10000);
}

async function getSelectionInfo() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ success = $false; count = 0; widthCm = 0; heightCm = 0 }

try {
${getCorelConnectPs()}
    if ($corel -and $doc) {
        $origUnit = $null
        try { $origUnit = $doc.Unit } catch {}
        try { $doc.Unit = 4 } catch {} # cdrCentimeter (4 = cm)

        $selInfo = Get-CorelSelection $corel $doc
        $sel = $selInfo.Selection
        $cnt = [int]$selInfo.SelCount

        if ($sel -and $cnt -gt 0) {
            $result.success = $true
            $result.count = $cnt
            $result.widthCm = [math]::Round([double]$sel.SizeWidth, 3)
            $result.heightCm = [math]::Round([double]$sel.SizeHeight, 3)
        } else {
            $result.success = $true
        }

        if ($null -ne $origUnit) { try { $doc.Unit = $origUnit } catch {} }
    }
} catch {}

$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
}

async function convertAllCurves() {
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka dokumen di CorelDRAW terlebih dahulu." }

    $page = $doc.ActivePage
    if (-not $page) { $page = $doc.Pages.Item(1) }

    $corel.Optimization = $true
    $corel.EventsEnabled = $false
    $doc.BeginCommandGroup("Convert All Text to Curves")

    $textShapes = $page.Shapes.FindShapes($null, 6, $true)
    $convertedCount = if ($textShapes) { $textShapes.Count } else { 0 }
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
    if ($corel.ActiveWindow) { try { $corel.ActiveWindow.Refresh() } catch {} }

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
}

async function changeCase(caseType) {
  const targetCase = caseType || 'title';
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${getCorelConnectPs()}
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
                } catch { return $str }
            }
            'sentence' {
                if ($str.Length -le 1) { return $str.ToUpper() }
                return $str.Substring(0, 1).ToUpper() + $str.Substring(1).ToLower()
            }
            'toggle' {
                $chars = $str.ToCharArray()
                for ($i = 0; $i -lt $chars.Length; $i++) {
                    if ([char]::IsUpper($chars[$i])) { $chars[$i] = [char]::ToLower($chars[$i]) }
                    elseif ([char]::IsLower($chars[$i])) { $chars[$i] = [char]::ToUpper($chars[$i]) }
                }
                return -join $chars
            }
            default { return $str }
        }
    }

    $page = $doc.ActivePage
    if (-not $page) { $page = $doc.Pages.Item(1) }

    $corel.Optimization = $true
    $corel.EventsEnabled = $false
    $doc.BeginCommandGroup("Change Text Case ($caseType)")

    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    $selCount = [int]$selInfo.SelCount

    $textShapes = $null
    if ($sel -and $selCount -gt 0) {
        try { $textShapes = $sel.FindShapes($null, 6, $true) } catch {}
    }
    if (-not $textShapes -or $textShapes.Count -eq 0) {
        $textShapes = $page.Shapes.FindShapes($null, 6, $true)
    }

    $changedCount = 0
    if ($textShapes -and $textShapes.Count -gt 0) {
        for ($i = 1; $i -le $textShapes.Count; $i++) {
            $ts = $textShapes.Item($i)
            try {
                $applied = $false
                if ($cdrCaseEnum -gt 0) {
                    try {
                        $ts.Text.Story.Case = $cdrCaseEnum
                        $applied = $true
                    } catch {}
                }
                if (-not $applied) {
                    $orig = $ts.Text.Story.Text
                    if ($orig) {
                        $ts.Text.Story.Text = Convert-TextCase $orig $caseType
                        $applied = $true
                    }
                }
                if ($applied) { $changedCount++ }
            } catch {}
        }
    }

    $doc.EndCommandGroup()
    $corel.Optimization = $false
    $corel.EventsEnabled = $true
    $corel.Refresh()
    if ($corel.ActiveWindow) { try { $corel.ActiveWindow.Refresh() } catch {} }

    $result.success = $true
    $result.count = $changedCount
    $result.message = "Berhasil mengubah kapitalisasi pada $changedCount objek teks!"
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
}

async function executeColorReplace(payload) {
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
${getCorelConnectPs()}
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
}

async function executeExtractColors() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$colors = @()

${getCorelConnectPs()}

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
}

async function executeSplit(payload) {
  const { mode = 'pages', outputDir = '' } = payload || {};
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }
    $out = '${(outputDir || '').replace(/'/g, "''")}'
    if (-not $out -or -not (Test-Path $out)) {
        $out = [System.IO.Path]::GetDirectoryName($doc.FullFileName)
    }
    if (-not $out -or -not (Test-Path $out)) {
        $out = [Environment]::GetFolderPath('Desktop')
    }

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name)
    $pageCount = $doc.Pages.Count
    if ($pageCount -le 1) {
        throw "Dokumen hanya memiliki 1 halaman. Fitur split memerlukan minimal 2 halaman."
    }

    $count = 0
    for ($p = 1; $p -le $pageCount; $p++) {
        $page = $doc.Pages.Item($p)
        $destFile = Join-Path $out "$baseName`_Halaman_$p.cdr"
        
        $newDoc = $corel.CreateDocument()
        $newDoc.Unit = $doc.Unit
        $newDoc.ActivePage.SetSize($page.SizeWidth, $page.SizeHeight)

        $page.Shapes.All().Copy()
        $newDoc.ActiveLayer.Paste()
        $newDoc.SaveAs($destFile)
        $newDoc.Close()
        $count++
    }

    $result.success = $true
    $result.count = $count
    $result.message = "Berhasil memisahkan $count halaman menjadi file terpisah di folder tujuan!"
} catch {
    $result.success = $false
    $result.message = $_.Exception.Message
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 600000);
}

async function executeBatch(payload) {
  const { action = 'curves', files = [] } = payload || {};
  if (!files || files.length === 0) {
    return { success: false, message: 'Tidak ada file untuk diproses batch.' };
  }

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; processed = 0 }

try {
${getCorelConnectPs()}
    $action = '${action}'
    $count = 0

    $fileList = @(
${files.map(f => `        "${(typeof f === 'string' ? f : f?.path || '').replace(/"/g, '`"')}"`).join(',\n')}
    )

    foreach ($f in $fileList) {
        if (-not (Test-Path $f)) { continue }
        $doc = $corel.OpenDocument($f)
        if ($doc) {
            try {
                if ($action -eq 'curves') {
                    for ($p = 1; $p -le $doc.Pages.Count; $p++) {
                        $txts = $doc.Pages.Item($p).Shapes.FindShapes($null, 6, $true)
                        if ($txts) {
                            for ($k = $txts.Count; $k -ge 1; $k--) {
                                try { $txts.Item($k).ConvertToCurves() } catch {}
                            }
                        }
                    }
                }
                $doc.Save()
                $count++
            } finally {
                $doc.Close()
            }
        }
    }

    $result.success = $true
    $result.processed = $count
    $result.message = "Batch processing selesai. $count file berhasil diproses."
} catch {
    $result.success = $false
    $result.message = $_.Exception.Message
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 600000);
}

async function executeUtility(command) {
  if (command === 'curves') {
    return await convertAllCurves();
  }
  if (command === 'clean_ghost') {
    return await cleanGhostProcesses();
  }
  return { success: false, message: `Perintah utility '${command}' tidak dikenali.` };
}

async function toggleDarkMode(targetMode) {
  const mode = targetMode === 'dark' ? 'dark' : 'light';
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }

try {
${getCorelConnectPs()}
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
    if ($corel.ActiveWindow) { try { $corel.ActiveWindow.Refresh() } catch {} }
    $result.success = $true
} catch {
    $result.success = $false
    $result.message = $_.Exception.Message
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
}

module.exports = {
  checkStatus,
  getPreferredVersion,
  setPreferredVersion,
  getDetectedVersions,
  cancelOperation,
  getRecentFiles,
  openDocument,
  cleanGhostProcesses,
  launchApp,
  getSelectionInfo,
  convertAllCurves,
  changeCase,
  executeColorReplace,
  executeExtractColors,
  executeSplit,
  executeBatch,
  executeUtility,
  toggleDarkMode,
};
