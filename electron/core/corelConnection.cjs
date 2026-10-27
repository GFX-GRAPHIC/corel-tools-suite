/**
 * CorelDRAW Connection & COM Automation Core
 * Provides unified process discovery, version negotiation, and native COM integration.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('./electronBridge.cjs');

function getCorelConfigPath() {
  try {
    return path.join(app.getPath('userData'), 'corel_config.json');
  } catch {
    return path.join(process.cwd(), 'corel_config.json');
  }
}

function getCorelConfig() {
  try {
    const p = getCorelConfigPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {}
  return { preferredVersion: 'auto', preferredPid: 0 };
}

function saveCorelConfig(cfg) {
  try {
    const p = getCorelConfigPath();
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {}
}

let activePreferredVersion = 'auto';
let activePreferredPid = 0;
try {
  const cfg = getCorelConfig();
  activePreferredVersion = cfg.preferredVersion || 'auto';
  activePreferredPid = parseInt(cfg.preferredPid, 10) || 0;
} catch {}

function setPreferredCorelVersion(ver, pid) {
  activePreferredVersion = String(ver || 'auto');
  activePreferredPid = parseInt(pid, 10) || 0;
  saveCorelConfig({ preferredVersion: activePreferredVersion, preferredPid: activePreferredPid });
  return { success: true, preferredVersion: activePreferredVersion, preferredPid: activePreferredPid };
}

function getPreferredCorelVersion() {
  return { preferredVersion: activePreferredVersion, preferredPid: activePreferredPid };
}

function getCorelProcessHelpersPs() {
  return `
    function Get-CorelVerFromProcess($p) {
        if (-not $p) { return 0 }
        $t = [string]$p.MainWindowTitle
        $pth = [string]$p.Path
        $fv = [string]$p.FileVersion
        if ($fv -match '^(\\d+)\\.') { return [int]$matches[1] }
        if ($t -match '2026|28\\.' -or $pth -like '*2026*') { return 28 }
        if ($t -match '2025|27\\.' -or $pth -like '*2025*') { return 27 }
        if ($t -match '2024|26\\.' -or $pth -like '*2024*') { return 26 }
        if ($t -match '2023|25\\.' -or $pth -like '*2023*') { return 25 }
        if ($t -match '2022|24\\.' -or $pth -like '*2022*') { return 24 }
        if ($t -match '2021|23\\.' -or $pth -like '*2021*') { return 23 }
        if ($t -match '2020|22\\.' -or $pth -like '*2020*') { return 22 }
        if ($t -match '2019|21\\.' -or $pth -like '*2019*') { return 21 }
        if ($t -match '2018|20\\.' -or $pth -like '*2018*') { return 20 }
        if ($t -match '2017|19\\.' -or $pth -like '*2017*') { return 19 }
        if ($t -match 'X8|18\\.' -or $pth -like '*X8*') { return 18 }
        if ($t -match 'X7|17\\.' -or $pth -like '*X7*') { return 17 }
        if ($t -match 'X6|16\\.' -or $pth -like '*X6*') { return 16 }
        if ($t -match 'X5|15\\.' -or $pth -like '*X5*') { return 15 }
        if ($t -match 'X4|14\\.' -or $pth -like '*X4*') { return 14 }
        return 0
    }
  `;
}

function getCorelFindAppPs() {
  return `
${getCorelProcessHelpersPs()}

    $corel = $null
    $allProcs = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue
    $realProcs = if ($allProcs) { $allProcs | Where-Object { $_.MainWindowHandle -ne 0 -or $_.Responding } } else { $null }

    if ($realProcs) {
        $preferredVer = '${activePreferredVersion}'
        $preferredPid = ${activePreferredPid}
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
        $targetVer = Get-CorelVerFromProcess $targetProc

        # Strategy A: Check window title for open .cdr file and bind moniker
        if ($targetProc -and $targetProc.MainWindowTitle) {
            $wTitle = $targetProc.MainWindowTitle
            if ($wTitle -match '([a-zA-Z]:\\\\[^\\[\\]\\*\\?"<>|\\r\\n\\t]+?\\.cdr)') {
                $cdrPath = $matches[1].Trim()
                if (Test-Path $cdrPath) {
                    try {
                        $boundDoc = [System.Runtime.InteropServices.Marshal]::BindToMoniker($cdrPath)
                        if ($boundDoc) {
                            try { $corel = $boundDoc.Application } catch { $corel = $boundDoc }
                        }
                    } catch {}
                }
            }
        }

        # Strategy B: Connect via COM for target version
        if (-not $corel -and $targetVer -gt 0) {
            try { $corel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$targetVer") } catch {}
            if (-not $corel) {
                try {
                    $c = New-Object -ComObject "CorelDRAW.Application.$targetVer" -ErrorAction SilentlyContinue
                    if ($c) { $corel = $c }
                } catch {}
            }
        }

        # Strategy C: CurVer / generic fallback
        if (-not $corel) {
            $curVer = (Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\\CorelDRAW.Application\\CurVer" -ErrorAction SilentlyContinue).'(default)'
            if ($curVer) {
                try { $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject($curVer); if ($c) { $corel = $c } } catch {}
            }
        }
        if (-not $corel) {
            try { $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application"); if ($c) { $corel = $c } } catch {}
        }
        if (-not $corel) {
            try {
                $c = New-Object -ComObject "CorelDRAW.Application" -ErrorAction SilentlyContinue
                if ($c) { $corel = $c }
            } catch {}
        }
    }
  `;
}

function getCorelConnectPs() {
  return `
${getCorelFindAppPs()}

    if (-not $corel) {
        $procs = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue
        $activeWin = if ($procs) { $procs | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 } else { $null }
        if ($activeWin) {
            throw "CorelDRAW sedang berjalan (Jendela: '$($activeWin.MainWindowTitle)'), namun antarmuka COM belum merespon. Pastikan CorelDRAW tidak sedang menampilkan dialog pop-up/modal, atau silakan buat/buka dokumen di CorelDRAW."
        }
        throw "CorelDRAW tidak sedang berjalan. Silakan buka aplikasi CorelDRAW Anda terlebih dahulu."
    }

    $doc = $null
    try { $doc = $corel.ActiveDocument } catch {}
    if (-not $doc -and $corel.Documents -and $corel.Documents.Count -gt 0) {
        try {
            $doc = $corel.Documents.Item(1)
            $doc.Activate()
        } catch {}
    }
    if (-not $doc -and $corel) {
        try {
            if ($corel.Documents -and $corel.Documents.Count -gt 0) {
                for ($dIdx = 1; $dIdx -le $corel.Documents.Count; $dIdx++) {
                    $testDoc = $corel.Documents.Item($dIdx)
                    if ($testDoc) { $doc = $testDoc; break }
                }
            }
        } catch {}
    }

    function Get-RangeCount($r) {
        if (-not $r) { return 0 }
        try { if ($r.Count -ne $null) { return [int]$r.Count } } catch {}
        try { if ($r.Shapes -and $r.Shapes.Count -ne $null) { return [int]$r.Shapes.Count } } catch {}
        return 0
    }

    function Get-RangeItem($r, [int]$idx) {
        if (-not $r) { return $null }
        try { $it = $r.Item($idx); if ($it) { return $it } } catch {}
        try { $it = $r.Shapes.Item($idx); if ($it) { return $it } } catch {}
        try { $it = $r[$idx]; if ($it) { return $it } } catch {}
        return $null
    }

    function Get-CorelSelection($cApp, $dDoc) {
        $cand = $null
        try { if ($cApp.ActiveSelectionRange -and $cApp.ActiveSelectionRange.Count -gt 0) { return @{ Selection = $cApp.ActiveSelectionRange; SelCount = [int]$cApp.ActiveSelectionRange.Count } } } catch {}
        try { if ($dDoc.SelectionRange -and $dDoc.SelectionRange.Count -gt 0) { return @{ Selection = $dDoc.SelectionRange; SelCount = [int]$dDoc.SelectionRange.Count } } } catch {}
        try { if ($cApp.ActiveSelection -and (Get-RangeCount $cApp.ActiveSelection) -gt 0) { return @{ Selection = $cApp.ActiveSelection; SelCount = (Get-RangeCount $cApp.ActiveSelection) } } } catch {}
        try { if ($dDoc.Selection -and (Get-RangeCount $dDoc.Selection) -gt 0) { return @{ Selection = $dDoc.Selection; SelCount = (Get-RangeCount $dDoc.Selection) } } } catch {}
        return @{ Selection = $null; SelCount = 0 }
    }
  `;
}

module.exports = {
  getCorelConfigPath,
  getCorelConfig,
  saveCorelConfig,
  setPreferredCorelVersion,
  getPreferredCorelVersion,
  getCorelProcessHelpersPs,
  getCorelFindAppPs,
  getCorelConnectPs,
};
