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

$realProcs = @(Get-RealCorelProcesses)

if ($realProcs -and $realProcs.Count -gt 0) {
    $res.connected = $true

    $preferredVer = '${pref.preferredVersion}'
    $preferredPid = ${pref.preferredPid}
    $targetProc = $null
    if ($preferredPid -and $preferredPid -gt 0) {
        $cand = $realProcs | Where-Object { $_.Id -eq $preferredPid } | Select-Object -First 1
        if ($cand) {
            if ($preferredVer -eq 'auto' -or -not ($preferredVer -match '^\\d+$') -or (Get-CorelVerFromProcess $cand) -eq [int]$preferredVer) {
                $targetProc = $cand
            }
        }
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
        $wTitle = [string]$targetProc.MainWindowTitle
        if ($wTitle -match '([^\\\\/:*?"<>|\\[\\]]+\\.(?:cdr|cmx)\\*?)') {
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
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$cVerMajor")
            if ($c) { $corel = $c }
        } catch {}
    } else {
        try {
            $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application")
            if ($c) { $corel = $c }
        } catch {}
    }
    if ($corel) {
        try {
            $ad = Com-Get $corel "ActiveDocument"
            if ($ad) {
                $adName = [string](Com-Get $ad "Name")
                if ($adName) { $res.activeDoc = $adName }
                $adPath = [string](Com-Get $ad "FullFileName")
                if ($adPath) { $res.docPath = $adPath }
                $sCnt = 0
                $sr = Com-Get $ad "SelectionRange"
                if ($sr) {
                    $c = Com-Get $sr "Count"
                    if ($c) { $sCnt = [int]$c }
                }
                if ($sCnt -eq 0) {
                    $as = Com-Get $corel "ActiveSelection"
                    if ($as) {
                        $c = Com-Get $as "Count"
                        if ($c -and [int]$c -gt 0) {
                            $sCnt = [int]$c
                        } else {
                            $st = Com-Get $as "Type"
                            if ($st -and [int]$st -gt 0) { $sCnt = 1 }
                        }
                    }
                }
                $res.selectionCount = $sCnt
                $pgs = Com-Get $ad "Pages"
                if ($pgs) { $res.pageCount = [int](Com-Get $pgs "Count") }
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
  const pref = getPreferredCorelVersion();
  return { success: true, preferredVersion: pref.preferredVersion, preferredPid: pref.preferredPid };
}

function setPreferredVersion(version, pid) {
  return setPrefVer(version, pid);
}

async function getDetectedVersions() {
  const pref = getPreferredCorelVersion();
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'

${getCorelProcessHelpersPs()}

$realProcs = @(Get-RealCorelProcesses)

$preferredVer = '${pref.preferredVersion}'
$preferredPid = ${pref.preferredPid}
$targetProc = $null
if ($realProcs -and $realProcs.Count -gt 0) {
    if ($preferredPid -and $preferredPid -gt 0) {
        $cand = $realProcs | Where-Object { $_.Id -eq $preferredPid } | Select-Object -First 1
        if ($cand) {
            if ($preferredVer -eq 'auto' -or -not ($preferredVer -match '^\\d+$') -or (Get-CorelVerFromProcess $cand) -eq [int]$preferredVer) {
                $targetProc = $cand
            }
        }
    }
    if (-not $targetProc -and $preferredVer -ne 'auto' -and $preferredVer -match '^\\d+$') {
        $pVer = [int]$preferredVer
        $targetProc = $realProcs | Where-Object { (Get-CorelVerFromProcess $_) -eq $pVer } | Select-Object -First 1
    }
    if (-not $targetProc) {
        $targetProc = $realProcs | Select-Object -First 1
    }
}
$cVerMajor = if ($targetProc) { Get-CorelVerFromProcess $targetProc } else { 0 }

$runningInstances = @()
if ($realProcs -and $realProcs.Count -gt 0) {
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
        $isCur = if ($targetProc) { ($p.Id -eq $targetProc.Id) } else { $false }
        $runningInstances += @{
            id = [string]$v
            version = [string]$v
            versionNum = $v
            name = $vName
            title = $p.MainWindowTitle
            pid = $p.Id
            isVisible = $true
            isCurrent = $isCur
        }
    }
}

@{
    success = $true
    preferred = $preferredVer
    activeMajor = $cVerMajor
    running = $runningInstances
} | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
}

function cancelOperation() {
  return { success: true, message: 'Operasi dibatalkan.' };
}

async function getRecentFiles() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$files = @()

${getCorelFindAppPs()}

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

if ($files.Count -lt 5) {
    try {
        $recentPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Recent)
        if (Test-Path $recentPath) {
            $wsh = New-Object -ComObject WScript.Shell
            $lnks = Get-ChildItem -Path $recentPath -Filter "*.lnk" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
            foreach ($lnk in $lnks) {
                if ($files.Count -ge 8) { break }
                try {
                    $target = $wsh.CreateShortcut($lnk.FullName).TargetPath
                    if ($target -and ($target.ToLower().EndsWith('.cdr')) -and (Test-Path $target)) {
                        $already = $false
                        foreach ($f in $files) {
                            if ($f.path -eq $target) { $already = $true; break }
                        }
                        if (-not $already) {
                            $files += @{
                                name = [System.IO.Path]::GetFileName($target)
                                path = $target
                                isOpen = $false
                            }
                        }
                    }
                } catch {}
            }
        }
    } catch {}
}

@{ success = $true; files = $files } | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 4000);
}

function openDocument(filePath) {
  if (!filePath) return { success: false, message: 'Path file kosong.' };
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return { success: true };
  }
  return { success: false, message: 'File tidak ditemukan di komputer.' };
}

async function cleanGhostProcesses() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$procs = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue
$killed = 0
if ($procs) {
    foreach ($p in $procs) {
        if ($p.MainWindowHandle -eq 0) {
            try { Stop-Process -Id $p.Id -Force; $killed++ } catch {}
        }
    }
}
@{ success = $true; killed = $killed; message = "Berhasil membersihkan $killed proses CorelDRAW latar belakang." } | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
}

async function launchApp() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$shortcut = Get-ChildItem "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs" -Recurse -Filter "*CorelDRAW*.lnk" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch "Font|PHOTO|CAPTURE" } | Select-Object -First 1
if ($shortcut) {
    Start-Process -FilePath $shortcut.FullName
    @{ success = $true; message = "Aplikasi CorelDRAW sedang dibuka..." } | ConvertTo-Json -Compress
} else {
    $paths = @(
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2024\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2023\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2022\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2021\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2020\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite 2019\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite X8\\Programs64\\CorelDrw.exe",
        "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite X7\\Programs64\\CorelDrw.exe"
    )
    $found = $null
    foreach ($p in $paths) {
        if (Test-Path $p) { $found = $p; break }
    }
    if (-not $found) {
        try {
            $regPath = (Get-ItemProperty "Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\CorelDRW.exe" -ErrorAction SilentlyContinue).'(default)'
            if ($regPath -and (Test-Path $regPath)) { $found = $regPath }
        } catch {}
    }
    if ($found) {
        $workDir = [System.IO.Path]::GetDirectoryName($found)
        Start-Process -FilePath $found -WorkingDirectory $workDir
        @{ success = $true; message = "Aplikasi CorelDRAW sedang dibuka..." } | ConvertTo-Json -Compress
    } else {
        @{ success = $false; message = "File eksekusi CorelDRW.exe tidak ditemukan di lokasi standar." } | ConvertTo-Json -Compress
    }
}
`;
  return runPowerShellScript(ps, 5000);
}

async function getSelectionInfo() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ success = $false; count = 0; widthCm = 0; heightCm = 0 }
try {
${getCorelConnectPs()}
    if ($doc) {
        $origUnit = Com-Get $doc 'Unit'
        try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm)
        $selInfo = Get-CorelSelection $corel $doc
        $sel = $selInfo.Selection
        $cnt = [int]$selInfo.SelCount
        if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

        if ($sel -and $cnt -gt 0) {
            $result.success = $true
            $result.count = $cnt
            $result.widthCm = [math]::Round([double](Com-Get $sel 'SizeWidth'), 3)
            $result.heightCm = [math]::Round([double](Com-Get $sel 'SizeHeight'), 3)
        } else {
            $result.success = $true
        }
        if ($null -ne $origUnit) { try { Com-Set $doc 'Unit' $origUnit } catch {} }
    }
} catch {}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
}

async function convertAllCurves() {
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka dokumen di CorelDRAW terlebih dahulu." }

    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    $selCount = [int]$selInfo.SelCount
    if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

    $page = Com-Get $doc 'ActivePage'
    if (-not $page) { $page = Com-Get (Com-Get $doc 'Pages') 'Item' @(1) }

    $corel.Optimization = $true
    $corel.EventsEnabled = $false
    $doc.BeginCommandGroup("Convert All Text to Curves")

    $textShapes = $null
    if ($selCount -gt 0 -and $sel) {
        try { $textShapes = Com-Call $sel "FindShapes" @($null, 6, $true) } catch {}
    }
    if (-not $textShapes -or [int](Com-Get $textShapes "Count") -eq 0) {
        $pgShapes = if ($page) { Com-Get $page 'Shapes' } else { $null }
        if ($pgShapes) {
            $textShapes = Com-Call $pgShapes "FindShapes" @($null, 6, $true)
        }
    }

    $convertedCount = 0
    if ($textShapes) {
        $cnt = [int](Com-Get $textShapes "Count")
        if ($cnt -gt 0) {
            for ($i = $cnt; $i -ge 1; $i--) {
                try {
                    $ts = Com-Get $textShapes "Item" @($i)
                    if ($ts) { [void](Com-Call $ts "ConvertToCurves"); $convertedCount++ }
                } catch {}
            }
        }
    }
    if ($convertedCount -eq 0 -and $selCount -eq 1 -and $sel) {
        try {
            $sType = [int](Com-Get $sel "Type")
            if ($sType -eq 6 -or $sType -eq 4) {
                [void](Com-Call $sel "ConvertToCurves")
                $convertedCount = 1
            }
        } catch {}
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
            $cType = [int](Com-Get $container 'Type')
            if ($cType -eq 6 -or $cType -eq 4) {
                $list += ,$container
                return $list
            }
        } catch {}
        try {
            $cnt = Get-RangeCount $container
            for ($i = 1; $i -le $cnt; $i++) {
                $s = Get-RangeItem $container $i
                if (-not $s) { continue }
                $sType = [int](Com-Get $s 'Type')
                if ($sType -eq 6 -or $sType -eq 4) {
                    $list += ,$s
                } elseif ($sType -eq 7 -or $sType -eq 5) {
                    $sub = @(Get-AllTextShapes $s)
                    if ($sub.Count -gt 0) { $list += $sub }
                }
            }
        } catch {}
        return $list
    }

    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

    $texts = @()
    if ($sel) {
        $texts = @(Get-AllTextShapes $sel)
    }
    if (-not $texts -or $texts.Count -eq 0) {
        $actPg = Com-Get $doc 'ActivePage'
        if ($actPg) { $texts = @(Get-AllTextShapes $actPg) }
    }

    if (-not $texts -or $texts.Count -eq 0) {
        throw "Tidak ditemukan objek teks pada seleksi atau halaman aktif CorelDRAW."
    }

    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}
    try { [void](Com-Call $doc 'BeginCommandGroup' @("Change Case ($caseType)")) } catch {}

    $count = 0
    foreach ($t in $texts) {
        try {
            $txtObj = Com-Get $t 'Text'
            $story = if ($txtObj) { Com-Get $txtObj 'Story' } else { $null }
            if ($story) {
                if ($cdrCaseEnum -gt 0) {
                    try { Com-Set $story 'Case' $cdrCaseEnum } catch {}
                }
                $curTxt = [string](Com-Get $story 'Text')
                if ($curTxt) {
                    $newTxt = Convert-TextCase $curTxt $caseType
                    if ($newTxt -ne $curTxt) {
                        Com-Set $story 'Text' $newTxt
                    }
                    $count++
                }
            }
        } catch {}
    }

    try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}
    try {
        $aw = Com-Get $corel 'ActiveWindow'
        if ($aw) { [void](Com-Call $aw 'Refresh') }
    } catch {}

    $result.success = $true
    $result.count = $count
    $result.message = "Berhasil mengubah format huruf ($caseType) pada $count objek teks."
} catch {
    try {
        if ($corel) {
            try { Com-Set $corel 'Optimization' $false } catch {}
            try { Com-Set $corel 'EventsEnabled' $true } catch {}
            if ($doc) { try { [void](Com-Call $doc 'EndCommandGroup') } catch {} }
            try { [void](Com-Call $corel 'Refresh') } catch {}
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
  } = payload || {};

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }
    try { [void](Com-Call $doc 'BeginCommandGroup' @("CTS Replace Color")) } catch {}
    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}

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

    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    $selCount = [int]$selInfo.SelCount
    if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

    $allShapes = @()
    if ($selCount -gt 0 -and $sel) {
        if ($selCount -eq 1) {
            $singleShp = Get-RangeItem $sel 1
            if ($singleShp) {
                $allShapes += $singleShp
                try {
                    $subF = $singleShp.Shapes.FindShapes()
                    if ($subF) { for ($fi = 1; $fi -le $subF.Count; $fi++) { $allShapes += $subF.Item($fi) } }
                } catch {}
            }
        } else {
            try {
                $subF = $sel.Shapes.FindShapes()
                if ($subF) { for ($fi = 1; $fi -le $subF.Count; $fi++) { $allShapes += $subF.Item($fi) } }
            } catch {
                for ($si = 1; $si -le $selCount; $si++) {
                    $shp = Get-RangeItem $sel $si
                    if ($shp) { $allShapes += $shp }
                }
            }
        }
    }
    if ($allShapes.Count -eq 0) {
        $actPg = $doc.ActivePage
        if ($actPg -and $actPg.Shapes) {
            $subF = $actPg.Shapes.FindShapes()
            if ($subF) { for ($fi = 1; $fi -le $subF.Count; $fi++) { $allShapes += $subF.Item($fi) } }
        }
    }

    $changed = 0
    foreach ($s in $allShapes) {
        if (-not $s) { continue }
        if ([bool]${replaceFill ? '$true' : '$false'}) {
            try {
                if ($s.Fill.Type -eq 1) {
                    $c = $s.Fill.UniformColor
                    if ($c.Type -eq 5) {
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

    try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}
    $result.success = $true
    $result.count = $changed
    $result.message = "Berhasil mengganti warna pada $changed properti objek di CorelDRAW."
}
catch {
    try { if ($doc) { [void](Com-Call $doc 'EndCommandGroup') } } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 600000);
}

async function executeExtractColors() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$colors = @()

${getCorelConnectPs()}

if ($corel -and $doc) {
    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    $selCount = [int]$selInfo.SelCount
    if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

    $allShapes = @()
    if ($selCount -gt 0 -and $sel) {
        if ($selCount -eq 1) {
            $singleShp = Get-RangeItem $sel 1
            if ($singleShp) {
                $allShapes += $singleShp
                try {
                    $subF = $singleShp.Shapes.FindShapes()
                    if ($subF) { for ($fi = 1; $fi -le $subF.Count; $fi++) { $allShapes += $subF.Item($fi) } }
                } catch {}
            }
        } else {
            try {
                $subF = $sel.Shapes.FindShapes()
                if ($subF) { for ($fi = 1; $fi -le $subF.Count; $fi++) { $allShapes += $subF.Item($fi) } }
            } catch {
                for ($si = 1; $si -le $selCount; $si++) {
                    $shp = Get-RangeItem $sel $si
                    if ($shp) { $allShapes += $shp }
                }
            }
        }
    }
    if ($allShapes.Count -eq 0) {
        $actPg = $doc.ActivePage
        if ($actPg -and $actPg.Shapes) {
            $subF = $actPg.Shapes.FindShapes()
            if ($subF) { for ($fi = 1; $fi -le $subF.Count; $fi++) { $allShapes += $subF.Item($fi) } }
        }
    }

    $limit = [math]::Min(100, $allShapes.Count)
    for ($i = 0; $i -lt $limit; $i++) {
        $s = $allShapes[$i]
        if (-not $s) { continue }
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

if ($colors.Count -eq 0) {
    $colors = @('#E11D48', '#2563EB', '#10B981', '#F59E0B', '#000000', '#FFFFFF')
}

@{ success = $true; colors = $colors } | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps, 5000);
}

async function executeSplit(payload) {
  const { mode = 'pages', outputFolder = '' } = payload || {};
  if (!outputFolder) return { success: false, message: 'Pilih folder tujuan simpan.' };

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }
    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name)
    $outDir = '${outputFolder.replace(/'/g, "''")}'

    $count = 0
    if ('${mode}' -eq 'pages') {
        $totalPages = $doc.Pages.Count
        for ($p = 1; $p -le $totalPages; $p++) {
            try {
                $destPath = Join-Path $outDir "$baseName-Hal-$p.pdf"
                $doc.Pages.Item($p).Activate()
                $doc.PDFSettings.PublishRange = 1
                $doc.PublishToPDF($destPath)
                $count++
            } catch {}
        }
    } else {
        $selInfo = Get-CorelSelection $corel $doc
        $sel = $selInfo.Selection
        $selCount = [int]$selInfo.SelCount
        if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }
        if ($selCount -eq 0 -or -not $sel) { throw "Seleksi objek yang ingin dipisah." }
        for ($s = 1; $s -le $selCount; $s++) {
            try {
                $destPath = Join-Path $outDir "$baseName-Objek-$s.png"
                $shp = Get-RangeItem $sel $s
                if ($shp) {
                    $filter = Com-Call $shp 'ExportBitmap' @($destPath, 774, 1, 5, 0, 0, 300, 300)
                    if ($filter) { Com-Call $filter 'Finish' }
                    $count++
                }
            } catch {}
        }
    }

    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}

    $result.success = ($count -gt 0)
    $result.count = $count
    $result.message = "Berhasil memisahkan $count item ke folder tujuan."
}
catch {
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
$result | ConvertTo-Json -Compress
`;
  const res = await runPowerShellScript(ps, 600000);
  if (res && res.success && fs.existsSync(outputFolder)) {
    shell.openPath(outputFolder);
  }
  return res;
}

async function executeBatch(payload) {
  const { tasks = [] } = payload || {};
  if (!tasks.length) return { success: false, message: 'Tidak ada proses batch yang dipilih.' };

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }

    try { [void](Com-Call $doc 'BeginCommandGroup' @("CTS Batch Pipeline")) } catch {}
    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}

    for ($p = 1; $p -le $doc.Pages.Count; $p++) {
        $pg = $doc.Pages.Item($p)
        $texts = $pg.Shapes.FindShapes($null, 6, $true)
        if ($texts) {
            for ($k = $texts.Count; $k -ge 1; $k--) {
                try { $texts.Item($k).ConvertToCurves() } catch {}
            }
        }
    }

    try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}
    $result.success = $true
    $result.message = "Proses batch pipeline (${tasks.join(', ')}) selesai dijalankan di CorelDRAW."
}
catch {
    try { if ($doc) { [void](Com-Call $doc 'EndCommandGroup') } } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
}

async function executeUtility(command) {
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
        $selInfo = Get-CorelSelection $corel $doc
        $sel = $selInfo.Selection
        $selCount = [int]$selInfo.SelCount
        if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }
        if ($selCount -gt 0 -and $sel) {
            try { [void](Com-Call $sel 'UngroupAll') } catch { try { [void]$sel.UngroupAll() } catch {} }
            $result.message = "Objek terseleksi berhasil di-ungroup secara menyeluruh."
        } else {
            $actPg = Com-Get $doc 'ActivePage'
            $pgShps = if ($actPg) { Com-Get $actPg 'Shapes' } else { $null }
            if ($pgShps) {
                $allRange = Com-Call $pgShps 'All'
                if ($allRange) { try { [void](Com-Call $allRange 'UngroupAll') } catch {} }
            }
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
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }

    try { [void](Com-Call $doc 'BeginCommandGroup' @("CTS Utility: ${cmdName}")) } catch {}
    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}

    ${innerScript}

    try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}
    $result.success = $true
}
catch {
    try { if ($doc) { [void](Com-Call $doc 'EndCommandGroup') } } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
$result | ConvertTo-Json -Compress
`;
  return runPowerShellScript(ps);
}

async function toggleDarkMode(targetMode) {
  const mode = targetMode || 'dark';
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; mode = '${mode}' }

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
    if ($corel.ActiveWindow) { $corel.ActiveWindow.Refresh() }
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
