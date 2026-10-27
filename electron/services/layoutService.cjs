/**
 * Auto-Layout Jersey & Resize Layout Service
 * Automated sublimation jersey layout, sizing, player data mapping, and geometric positioning.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('../core/electronBridge.cjs');
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript, getCancelFlagPath } = require('../core/psRunner.cjs');

function dedupeKeysCI(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const seen = new Set();
  const res = {};
  for (const k of Object.keys(obj)) {
    const kLow = k.toLowerCase().trim();
    if (!seen.has(kLow)) {
      seen.add(kLow);
      res[k] = obj[k];
    }
  }
  return res;
}

async function executeLayout(payload) {
  const {
    targetSize = 'ALL',
    players = [],
    rows = [],
    mappings = [],
    sizeChart = {},
    enableAutoResize = false,
    masterSize = 'L',
    spacingCm = 1.0,
    limitCopy = 4,
    limitPerBatch,
    direction = 'vertical',
    groupBySize = false,
    autoCurves = false,
    maxWidthCm = 27.0,
  } = payload || {};

  const cleanSizeChart = dedupeKeysCI(sizeChart);
  const dataList = (players && players.length > 0) ? players : (rows && rows.length > 0) ? rows : [];
  if (dataList.length === 0) {
    return { success: false, message: 'Tidak ada data pemain/desain untuk ditata.' };
  }

  const cleanDataList = dataList.map(item => dedupeKeysCI(item));

  const tempDir = app.getPath('temp');
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tempJsonPath = path.join(tempDir, `corel_layout_data_${uniqueId}.json`);
  const effectiveLimit = parseInt(limitPerBatch || limitCopy, 10) || 4;

  const layoutPayload = {
    targetSize,
    players: cleanDataList,
    mappings,
    sizeChart: cleanSizeChart,
    enableAutoResize: !!enableAutoResize,
    masterSize: String(masterSize || 'L').trim().toUpperCase(),
    spacingCm: Number(spacingCm) >= 0 ? Number(spacingCm) : 1.0,
    limitPerBatch: effectiveLimit,
    direction: direction || 'vertical',
    groupBySize: !!groupBySize,
    autoCurves: !!autoCurves,
    maxWidthCm: Number(maxWidthCm) > 0 ? Number(maxWidthCm) : 27.0,
  };

  try {
    fs.writeFileSync(tempJsonPath, JSON.stringify(layoutPayload), 'utf-8');
  } catch (e) {
    return { success: false, message: `Gagal menyimpan data sementara: ${e.message}` };
  }

  const cancelFlagPath = getCancelFlagPath().replace(/\\/g, '\\\\');

  const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

trap {
    $errLine = $_.InvocationInfo.ScriptLineNumber
    $errMsg = $_.Exception.Message
    if (-not $errMsg) { $errMsg = "$_" }
    $res = @{
        success = $false
        message = "CorelDRAW Error (Line $errLine): $errMsg"
    }
    $res | ConvertTo-Json -Compress
    exit 0
}

try {
${getCorelConnectPs()}

    if (-not $doc) {
        throw "Tidak ada dokumen yang terbuka di CorelDRAW. Buka file pola master jersey Anda terlebih dahulu."
    }

    $doc.Unit = 3 # cdrCentimeter

    $selection = $null
    try { $selection = $corel.ActiveSelection } catch {}
    if (-not $selection -or (Get-RangeCount $selection) -eq 0) {
        try { $selection = $doc.Selection } catch {}
    }
    $selCount = Get-RangeCount $selection
    if ($selCount -eq 0) {
        throw "Silakan seleksi (blok) 1 grup master pola jersey di CorelDRAW terlebih dahulu."
    }

    $jsonPath = '${tempJsonPath.replace(/\\/g, '\\\\').replace(/'/g, "''")}'
    $jsonRaw = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
    $data = $jsonRaw | ConvertFrom-Json

    $targetSize = [string]$data.targetSize
    $rawPlayers = $data.players
    $mappings = $data.mappings
    $sizeChart = $data.sizeChart
    $enableAutoResize = [bool]$data.enableAutoResize
    $masterSize = if ($data.masterSize) { [string]$data.masterSize.ToString().Trim().ToUpper() } else { 'L' }
    $spacing = [double]$data.spacingCm
    $limit = [int]$data.limitPerBatch
    if ($limit -lt 1) { $limit = 4 }
    $dir = if ($data.direction) { [string]$data.direction } else { 'vertical' }
    $groupBySize = [bool]$data.groupBySize
    $autoCurves = [bool]$data.autoCurves
    $maxW = if ($data.maxWidthCm -and [double]$data.maxWidthCm -gt 0) { [double]$data.maxWidthCm } else { 27.0 }
    $cancelFlag = '${cancelFlagPath}'

    function Get-FieldValue($p, [string[]]$propNames) {
        if (-not $p) { return '' }
        foreach ($pn in $propNames) {
            try {
                if ($p.PSObject -and $p.PSObject.Properties) {
                    foreach ($pr in $p.PSObject.Properties) {
                        if ($pr.Name.ToLower() -eq $pn.ToLower() -and $pr.Value -ne $null) {
                            $v = [string]$pr.Value
                            if ($v.Trim() -ne '') { return $v.Trim() }
                        }
                    }
                }
            } catch {}
            try {
                if ($p.Keys) {
                    foreach ($k in $p.Keys) {
                        if ($k.ToString().ToLower() -eq $pn.ToLower() -and $p[$k] -ne $null) {
                            $v = [string]$p[$k]
                            if ($v.Trim() -ne '') { return $v.Trim() }
                        }
                    }
                }
            } catch {}
        }
        return ''
    }

    # Filter players by target size
    $playerList = @()
    if ($targetSize -and $targetSize -ne 'ALL') {
        foreach ($p in $rawPlayers) {
            $sz = Get-FieldValue $p @('Ukuran', 'Size', 'sz')
            if (-not $sz) { $sz = $masterSize }
            if ($sz.Trim().ToUpper() -eq $targetSize.Trim().ToUpper()) {
                $playerList += $p
            }
        }
    } else {
        $playerList = $rawPlayers
    }

    if (-not $playerList -or $playerList.Count -eq 0) {
        throw "Tidak ada data pemain yang cocok untuk ukuran '$targetSize'."
    }

    if ($groupBySize) {
        $playerList = $playerList | Sort-Object {
            $s = Get-FieldValue $_ @('Ukuran', 'Size', 'sz')
            if (-not $s) { $s = $masterSize }
            $s
        }
    }

    $masterShape = if ($selCount -gt 1) { $selection.Group() } else { Get-RangeItem $selection 1 }
    if (-not $masterShape) {
        throw "Gagal memproses master pola jersey di CorelDRAW."
    }

    $origMasterW = [double]$masterShape.SizeWidth
    $origMasterH = [double]$masterShape.SizeHeight
    $width = $origMasterW
    $height = $origMasterH

    # Native CorelDRAW text shapes discovery (v1.0.0 speed)
    $masterTexts = $null
    try { $masterTexts = $masterShape.Shapes.FindShapes($null, 6, $true) } catch {}
    $textCount = if ($masterTexts) { [int]$masterTexts.Count } else { 0 }
    if ($textCount -eq 0 -and $masterShape.Type -eq 6) {
        $masterTexts = @($masterShape)
        $textCount = 1
    }
    if ($textCount -eq 0) {
        throw "Tidak ditemukan objek teks (nama/nomor) di dalam pola master jersey yang dipilih."
    }

    function Get-ShapeByIndex($container, [int]$idx) {
        if (-not $container) { return $null }
        try { return $container.Item($idx) } catch {}
        try { return $container[$idx - 1] } catch {}
        return $null
    }

    # Lock text roles based on pristine master template BEFORE any modifications
    $origW = @{}
    $origH = @{}
    $textRoles = @{}
    $hasNameRole = $false

    for ($t = 1; $t -le $textCount; $t++) {
        $ts = Get-ShapeByIndex $masterTexts $t
        if (-not $ts) { continue }
        $origW[$t] = [double]$ts.SizeWidth
        $origH[$t] = [double]$ts.SizeHeight
        $rawText = ""
        try { $rawText = [string]$ts.Text.Story.Text.Trim() } catch {}

        $role = ''
        if ($mappings -and $mappings.Count -gt 0) {
            foreach ($m in $mappings) {
                $ph = if ($m.placeholder) { [string]$m.placeholder.Trim() } else { '' }
                $barePh = $ph.Trim('[', ']', '{', '}')
                $col = if ($m.column) { [string]$m.column.Trim().ToLower() } else { '' }
                $lbl = if ($m.label) { [string]$m.label.Trim().ToLower() } else { '' }
                $cStr = "$ph $col $lbl".ToLower()

                $matched = $false
                if ($ph -and ($rawText -ieq $ph -or ($barePh -and $rawText -ieq $barePh))) { $matched = $true }
                elseif ($rawText -imatch 'nama|name|pemain' -and $cStr -match 'nama|name|pemain') { $matched = $true }
                elseif ($rawText -match '^\\d+$' -and $cStr -match 'nomor|number|no|#') { $matched = $true }
                elseif ($rawText -match '^(?i)(size|ukuran|sz)$' -and $cStr -match 'size|ukuran|sz') { $matched = $true }

                if ($matched) {
                    if ($cStr -match 'nama|name|pemain') { $role = 'name' }
                    elseif ($cStr -match 'nomor|number|no|#') { $role = 'number' }
                    elseif ($cStr -match 'size|ukuran|sz') { $role = 'size' }
                    break
                }
            }
        }

        if (-not $role) {
            if ($rawText -match '^(?i)(\\[?(size|ukuran|sz)\\]?|size:?|ukuran:?|[SMLX]{1,4}|[2-5]?XL)$') {
                $role = 'size'
            } elseif ($rawText -match '^\\d+$' -or $rawText -match '^(?i)(\\[?(nomor|number|no|#)\\]?|00|99|10|0|no\\.?\\s*\\d*)$') {
                $role = 'number'
            } elseif ($rawText -match '^(?i)(\\[?(nama|name|pemain|player)\\]?)$') {
                $role = 'name'
            } else {
                $role = 'unassigned'
            }
        }

        if ($role -eq 'name') { $hasNameRole = $true }
        $textRoles[$t] = $role
    }

    # Fallback: if no text explicitly matched 'name', pick the widest non-number/non-size shape
    if (-not $hasNameRole) {
        $maxUnassignedW = -1.0
        $bestNameIdx = 0
        for ($t = 1; $t -le $textCount; $t++) {
            if ($textRoles[$t] -eq 'unassigned' -and $origW[$t] -gt $maxUnassignedW) {
                $maxUnassignedW = $origW[$t]
                $bestNameIdx = $t
            }
        }
        if ($bestNameIdx -gt 0) {
            $textRoles[$bestNameIdx] = 'name'
        }
    }

    # Mark remaining unassigned text as 'ignore' (protects logos, sponsors, club badges)
    for ($t = 1; $t -le $textCount; $t++) {
        if ($textRoles[$t] -eq 'unassigned') {
            $textRoles[$t] = 'ignore'
        }
    }

    function ApplyPlayerToShape($targetShape, $playerData, $tCount, $roles, $origTemplateW, $maxLimit, $mapList) {
        $pName = Get-FieldValue $playerData @('name', 'nama', 'pemain', 'player', 'playerName')
        if (-not $pName) { $pName = "PEMAIN" }
        $pName = $pName.Trim().ToUpper()

        $pNum = Get-FieldValue $playerData @('number', 'nomor', 'no', '#')
        if ($pNum -and $pNum -ne '-') { $pNum = $pNum.Trim() } else { $pNum = "" }

        $pSize = Get-FieldValue $playerData @('size', 'ukuran', 'sz')
        if (-not $pSize) { $pSize = "L" }
        $pSize = $pSize.Trim().ToUpper()

        if ($mapList -and $mapList.Count -gt 0) {
            foreach ($m in $mapList) {
                $col = if ($m.column) { [string]$m.column.Trim() } else { '' }
                if ($col) {
                    $val = Get-FieldValue $playerData @($col)
                    if ($val) {
                        $cStr = "$($m.placeholder) $($m.label) $col".ToLower()
                        if ($cStr -match 'nama|name|pemain') {
                            $pName = if ($m.textCase -eq 'lower') { $val.Trim().ToLower() } else { $val.Trim().ToUpper() }
                        } elseif ($cStr -match 'nomor|number|no|#') {
                            $pNum = if ($val -ne '-') { $val.Trim() } else { "" }
                        } elseif ($cStr -match 'size|ukuran|sz') {
                            $pSize = $val.Trim().ToUpper()
                        }
                    }
                }
            }
        }

        $shapes = $null
        try { $shapes = $targetShape.Shapes.FindShapes($null, 6, $true) } catch {}
        if (-not $shapes -or $shapes.Count -eq 0) {
            if ($targetShape.Type -eq 6) { $shapes = @($targetShape) } else { return }
        }

        for ($t = 1; $t -le $tCount; $t++) {
            $role = $roles[$t]
            if ($role -eq 'ignore') { continue }
            $ts = Get-ShapeByIndex $shapes $t
            if (-not $ts) { continue }

            $origCenterX = [double]$ts.CenterX
            $origCenterY = [double]$ts.CenterY
            $refW = if ($origTemplateW.ContainsKey($t)) { [double]$origTemplateW[$t] } else { [double]$ts.SizeWidth }

            try { $ts.Text.Story.Alignment = 3 } catch {}

            if ($role -eq 'name') {
                $ts.Text.Story.Text = [string]$pName
                # Proportional font width capping (never squishes or distorts font aspect ratio)
                $capW = if ($maxLimit -gt 0) { [math]::Max($refW, $maxLimit) } else { [math]::Max($refW, 27.0) }
                $curW = [double]$ts.SizeWidth
                if ($curW -gt $capW -and $curW -gt 0) {
                    $fontScale = $capW / $curW
                    $newH = [double]$ts.SizeHeight * $fontScale
                    try {
                        $ts.SetSize($capW, $newH)
                    } catch {
                        $ts.SizeWidth = $capW
                        $ts.SizeHeight = $newH
                    }
                }
                $ts.CenterX = $origCenterX
                $ts.CenterY = $origCenterY
            } elseif ($role -eq 'number') {
                $ts.Text.Story.Text = [string]$pNum
                $curW = [double]$ts.SizeWidth
                $maxNumW = if ($refW -gt 0) { $refW * 1.3 } else { 0.0 }
                if ($maxNumW -gt 0 -and $curW -gt $maxNumW) {
                    $numScale = $maxNumW / $curW
                    $newH = [double]$ts.SizeHeight * $numScale
                    try {
                        $ts.SetSize($maxNumW, $newH)
                    } catch {
                        $ts.SizeWidth = $maxNumW
                        $ts.SizeHeight = $newH
                    }
                }
                $ts.CenterX = $origCenterX
                $ts.CenterY = $origCenterY
            } elseif ($role -eq 'size') {
                $ts.Text.Story.Text = [string]$pSize
                $ts.CenterX = $origCenterX
                $ts.CenterY = $origCenterY
            }
        }
    }

    function Get-SizeScaleFactor($targetSz, $masterSz, $chart, $origW, $origH) {
        if (-not $targetSz -or -not $chart) {
            return @{ scaleW = 1.0; scaleH = 1.0; targetW = $origW; targetH = $origH; needsResize = $false }
        }
        $cleanTarget = $targetSz.ToString().Trim().ToUpper()
        $cleanMaster = if ($masterSz) { $masterSz.ToString().Trim().ToUpper() } else { 'L' }

        if ($cleanTarget -eq $cleanMaster) {
            return @{ scaleW = 1.0; scaleH = 1.0; targetW = $origW; targetH = $origH; needsResize = $false }
        }

        $masterEntry = $null
        $targetEntry = $null

        if ($chart.PSObject -and $chart.PSObject.Properties) {
            foreach ($prop in $chart.PSObject.Properties) {
                $pName = $prop.Name.Trim().ToUpper()
                if ($pName -eq $cleanMaster) { $masterEntry = $prop.Value }
                if ($pName -eq $cleanTarget) { $targetEntry = $prop.Value }
            }
        } elseif ($chart.Keys) {
            foreach ($k in $chart.Keys) {
                $kName = $k.ToString().Trim().ToUpper()
                if ($kName -eq $cleanMaster) { $masterEntry = $chart[$k] }
                if ($kName -eq $cleanTarget) { $targetEntry = $chart[$k] }
            }
        }

        if (-not $targetEntry) {
            return @{ scaleW = 1.0; scaleH = 1.0; targetW = $origW; targetH = $origH; needsResize = $false }
        }

        $tH = if ($targetEntry.height) { [double]$targetEntry.height } else { 0.0 }
        $tW = if ($targetEntry.width) { [double]$targetEntry.width } else { 0.0 }
        $mH = if ($masterEntry -and $masterEntry.height) { [double]$masterEntry.height } else { 0.0 }
        $mW = if ($masterEntry -and $masterEntry.width) { [double]$masterEntry.width } else { 0.0 }
        $isLock = if ($targetEntry.lockRatio -ne $null) { [bool]$targetEntry.lockRatio } else { $true }

        $scaleH = 1.0
        $scaleW = 1.0

        if ($mH -gt 0 -and $tH -gt 0) {
            $scaleH = $tH / $mH
        }
        if ($mW -gt 0 -and $tW -gt 0) {
            $scaleW = $tW / $mW
        }

        if ($isLock) {
            if ($scaleH -ne 1.0) {
                $scaleW = $scaleH
            } elseif ($scaleW -ne 1.0) {
                $scaleH = $scaleW
            }
        }

        $finalW = [math]::Round(($origW * $scaleW), 3)
        $finalH = [math]::Round(($origH * $scaleH), 3)
        $needs = ([math]::Abs($scaleW - 1.0) -gt 0.001 -or [math]::Abs($scaleH - 1.0) -gt 0.001)

        return @{ scaleW = $scaleW; scaleH = $scaleH; targetW = $finalW; targetH = $finalH; needsResize = $needs }
    }

    # Enable native Corel optimization flags (v1.0.0 speed)
    $corel.Optimization = $true
    $corel.EventsEnabled = $false
    $doc.BeginCommandGroup("CTS Auto-Layout Jersey")

    $created = 0
    $wasCancelled = $false

    # Fast batch duplication from pristine master shape
    $jerseyShapes = [System.Collections.Generic.List[System.Object]]::new()
    $jerseyShapes.Add($masterShape)

    for ($i = 1; $i -lt $playerList.Count; $i++) {
        if (Test-Path $cancelFlag) {
            $wasCancelled = $true
            break
        }

        if ($dir -eq 'horizontal') {
            $col = $i % $limit
            $row = [math]::Floor($i / $limit)
        } else {
            # vertical
            $row = $i % $limit
            $col = [math]::Floor($i / $limit)
        }

        $dx = $col * ($origMasterW + $spacing)
        $dy = -($row * ($origMasterH + $spacing))

        $dup = $masterShape.Duplicate($dx, $dy)
        $jerseyShapes.Add($dup)
    }

    # Process all jerseys with exact sizing and text mapping
    for ($i = 0; $i -lt $jerseyShapes.Count; $i++) {
        if (Test-Path $cancelFlag) {
            $wasCancelled = $true
            break
        }

        $p = $playerList[$i]
        $jShape = $jerseyShapes[$i]

        $pSz = Get-FieldValue $p @('size', 'ukuran', 'sz')
        if (-not $pSz) { $pSz = $masterSize }

        # Proportional Auto-Resize per size relative to master pattern
        if ($enableAutoResize) {
            $resizeInfo = Get-SizeScaleFactor $pSz $masterSize $sizeChart $origMasterW $origMasterH
            if ($resizeInfo.needsResize) {
                $curCenterX = [double]$jShape.CenterX
                $curCenterY = [double]$jShape.CenterY
                try {
                    $jShape.SetSize($resizeInfo.targetW, $resizeInfo.targetH)
                } catch {
                    $jShape.SizeWidth = $resizeInfo.targetW
                    $jShape.SizeHeight = $resizeInfo.targetH
                }
                $jShape.CenterX = $curCenterX
                $jShape.CenterY = $curCenterY
            }
        }

        ApplyPlayerToShape $jShape $p $textCount $textRoles $origW $maxW $mappings
        $created++
    }

    # Fast Native Curve Conversion on active page if requested
    if ($autoCurves -and -not $wasCancelled) {
        try {
            $allT = $doc.ActivePage.Shapes.FindShapes($null, 6, $true)
            if ($allT -and $allT.Count -gt 0) {
                try {
                    $allT.ConvertToCurves()
                } catch {
                    for ($k = $allT.Count; $k -ge 1; $k--) {
                        try { $allT.Item($k).ConvertToCurves() } catch {}
                    }
                }
            }
        } catch {}
    }

    $doc.EndCommandGroup()
    $corel.Optimization = $false
    $corel.EventsEnabled = $true
    $corel.Refresh()
    if ($corel.ActiveWindow) { try { $corel.ActiveWindow.Refresh() } catch {} }

    if ($wasCancelled) {
        $result.cancelled = $true
        $result.success = $false
        $result.count = $created
        $result.message = "Penataan jersey dibatalkan oleh pengguna ($created pola sempat diproses)."
    } else {
        $result.success = $true
        $result.count = $created
        $result.message = "Berhasil menata $created pola jersey di CorelDRAW!"
    }
} catch {
    try { if ($doc) { $doc.EndCommandGroup() } } catch {}
    try {
        if ($corel) {
            $corel.Optimization = $false
            $corel.EventsEnabled = $true
            $corel.Refresh()
        }
    } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
} finally {
    try {
        if (Test-Path '${tempJsonPath.replace(/\\/g, '\\\\').replace(/'/g, "''")}') {
            Remove-Item -Path '${tempJsonPath.replace(/\\/g, '\\\\').replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue
        }
    } catch {}
    if ($doc) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
    if ($corel) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($corel) | Out-Null } catch {} }
    [GC]::Collect()
}

$result | ConvertTo-Json -Compress
`;

  return runPowerShellScript(psScript, 600000);
}

async function executeResizeLayout(payload) {
  const { widthCm = 10, heightCm = 10, centerPage = true } = payload || {};
  const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }

    $doc.Unit = 3 # cdrCentimeter
    $doc.BeginCommandGroup("CTS Resize")

    $sel = $doc.ActiveSelection
    if (-not $sel -or $sel.Shapes.Count -eq 0) {
        $sel = $doc.Selection
    }
    if (-not $sel -or $sel.Shapes.Count -eq 0) {
        throw "Pilih objek yang ingin di-resize di CorelDRAW terlebih dahulu."
    }

    $targetShape = if ($sel.Shapes.Count -gt 1) { $sel.Group() } else { $sel.Shapes.Item(1) }
    $w = [double]${widthCm}
    $h = [double]${heightCm}

    if ($w -gt 0 -and $h -gt 0) {
        try { $targetShape.SetSize($w, $h) } catch {
            $targetShape.SizeWidth = $w
            $targetShape.SizeHeight = $h
        }
    }

    if ([bool]${centerPage ? '$true' : '$false'}) {
        try {
            $targetShape.AlignToPageCenter(3) # cdrAlignBoth
        } catch {
            try {
                $targetShape.CenterX = $doc.ActivePage.CenterX
                $targetShape.CenterY = $doc.ActivePage.CenterY
            } catch {}
        }
    }

    $doc.EndCommandGroup()
    $corel.Refresh()
    $result.success = $true
    $result.message = "Berhasil mengubah ukuran objek menjadi $($w) x $($h) cm!"
} catch {
    try { if ($doc) { $doc.EndCommandGroup() } } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
} finally {
    if ($doc) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
    if ($corel) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($corel) | Out-Null } catch {} }
    [GC]::Collect()
}

$result | ConvertTo-Json -Compress
`;

  return runPowerShellScript(psScript, 30000);
}

async function getSelectionInfo() {
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ success = $false; count = 0; widthCm = 0; heightCm = 0 }

try {
${getCorelConnectPs()}
    if ($corel -and $doc) {
        $doc.Unit = 3 # cdrCentimeter
        $sel = $null
        try { $sel = $corel.ActiveSelection } catch {}
        if (-not $sel -or $sel.Shapes.Count -eq 0) { try { $sel = $doc.Selection } catch {} }
        if ($sel -and $sel.Shapes.Count -gt 0) {
            $result.success = $true
            $result.count = $sel.Shapes.Count
            $result.widthCm = [math]::Round([double]$sel.SizeWidth, 3)
            $result.heightCm = [math]::Round([double]$sel.SizeHeight, 3)
        } else {
            $result.success = $true
        }
    }
} catch {}
$result | ConvertTo-Json -Compress
`;

  return runPowerShellScript(psScript, 5000);
}

module.exports = {
  dedupeKeysCI,
  executeLayout,
  executeResizeLayout,
  getSelectionInfo,
};
