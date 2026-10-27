/**
 * Layout Pola Service (Auto-Nesting Lembar Cetak)
 * Detects patterns on active CorelDRAW page, builds geometry map,
 * and nests shapes with 0°, 90°, and 180° rotation into sheet boundaries.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('../core/electronBridge.cjs');
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

async function getLayoutPolaSelection() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ success = $false; message = ''; count = 0; items = @(); containerDetected = $null }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Tidak ada dokumen terbuka di CorelDRAW." }

    $origDocUnit = Com-Get $doc 'Unit'
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm)

    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    $cnt = [int]$selInfo.SelCount
    if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

    if ($cnt -eq 0 -or -not $sel) {
        throw "Silakan seleksi (blok) objek-objek pola di CorelDRAW terlebih dahulu."
    }

    function Get-ShapeLeft([object]$shp) {
        if ($null -eq $shp) { return 0.0 }
        $v = Com-Get $shp 'LeftX'
        if ($null -ne $v) { return [double]$v }
        $v = Com-Get $shp 'PositionX'
        if ($null -ne $v) { return [double]$v }
        return 0.0
    }
    function Get-ShapeTop([object]$shp) {
        if ($null -eq $shp) { return 0.0 }
        $v = Com-Get $shp 'TopY'
        if ($null -ne $v) { return [double]$v }
        $v = Com-Get $shp 'PositionY'
        if ($null -ne $v) { return [double]$v }
        return 0.0
    }

    $rawItems = @()
    for ($i = 1; $i -le $cnt; $i++) {
        $s = Get-RangeItem $sel $i
        if (-not $s) { continue }
        $sId = [int](Com-Get $s 'StaticID')
        $w = [math]::Round([double](Com-Get $s 'SizeWidth'), 2)
        $h = [math]::Round([double](Com-Get $s 'SizeHeight'), 2)
        $left = [math]::Round([double](Get-ShapeLeft $s), 2)
        $top = [math]::Round([double](Get-ShapeTop $s), 2)
        $name = [string](Com-Get $s 'Name')
        $type = [int](Com-Get $s 'Type')

        $rawItems += [PSCustomObject]@{
            index = $i
            staticId = $sId
            widthCm = $w
            heightCm = $h
            leftCm = $left
            topCm = $top
            name = if ($name) { $name } else { "Pola $i" }
            type = $type
        }
    }

    $filteredItems = @()
    if ($rawItems.Count -gt 1) {
        $sortedByArea = $rawItems | Sort-Object { $_.widthCm * $_.heightCm } -Descending
        $largest = $sortedByArea[0]
        $secondLargest = $sortedByArea[1]
        if (($largest.widthCm * $largest.heightCm) -gt (($secondLargest.widthCm * $secondLargest.heightCm) * 2.5) -and ($largest.widthCm -gt 60 -or $largest.heightCm -gt 100)) {
            $result.containerDetected = @{
                staticId = $largest.staticId
                widthCm = $largest.widthCm
                heightCm = $largest.heightCm
                leftCm = $largest.leftCm
                topCm = $largest.topCm
            }
            $filteredItems = $rawItems | Where-Object { $_.staticId -ne $largest.staticId }
        } else {
            $filteredItems = $rawItems
        }
    } else {
        $filteredItems = $rawItems
    }

    $result.success = $true
    $result.count = $filteredItems.Count
    $result.items = $filteredItems
    $result.message = "Berhasil mendeteksi $($filteredItems.Count) pola di CorelDRAW."

    if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
}
catch {
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}

$result | ConvertTo-Json -Depth 4 -Compress
`;
  return runPowerShellScript(ps);
}

async function executeLayoutPola(payload) {
  const {
    boxWidthCm = 100,
    boxHeightCm = 500,
    createBox = true,
    gapCm = 1.0,
    marginCm = 1.0,
    items = []
  } = payload || {};

  if (!items || items.length === 0) {
    return { success: false, message: 'Tidak ada data posisi pola yang dikirim.' };
  }

  const tempDir = app.getPath('temp');
  const tempJson = path.join(tempDir, `cts_layout_pola_${Date.now()}.json`);
  fs.writeFileSync(tempJson, JSON.stringify(payload, null, 2), 'utf8');

  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; movedCount = 0 }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Tidak ada dokumen terbuka di CorelDRAW." }

    $jsonFile = '${tempJson.replace(/\\/g, '\\\\')}'
    if (-not (Test-Path $jsonFile)) { throw "File data layout tidak ditemukan." }
    $data = Get-Content -Path $jsonFile -Raw -Encoding UTF8 | ConvertFrom-Json

    $boxW = [double]$data.boxWidthCm
    $boxH = [double]$data.boxHeightCm
    $createBox = [bool]$data.createBox
    $gap = [double]$data.gapCm
    $margin = [double]$data.marginCm
    $itemList = $data.items

    $origDocUnit = Com-Get $doc 'Unit'
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm)

    try { [void](Com-Call $doc 'BeginCommandGroup' @("CTS Layout Pola")) } catch {}
    try { [void](Com-Call $doc 'ClearSelection' @()) } catch {}
    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}

    function Get-ShapeLeft([object]$shp) {
        if ($null -eq $shp) { return 0.0 }
        $v = Com-Get $shp 'LeftX'
        if ($null -ne $v) { return [double]$v }
        $v = Com-Get $shp 'PositionX'
        if ($null -ne $v) { return [double]$v }
        return 0.0
    }
    function Get-ShapeTop([object]$shp) {
        if ($null -eq $shp) { return 0.0 }
        $v = Com-Get $shp 'TopY'
        if ($null -ne $v) { return [double]$v }
        $v = Com-Get $shp 'PositionY'
        if ($null -ne $v) { return [double]$v }
        return 0.0
    }

    $shapeMap = @{}
    $actPg = Com-Get $doc 'ActivePage'
    $allShapes = if ($actPg) { Com-Get $actPg 'Shapes' } else { $null }
    $totalPageShapes = if ($allShapes) { [int](Com-Get $allShapes 'Count') } else { 0 }
    for ($sIdx = 1; $sIdx -le $totalPageShapes; $sIdx++) {
        $curShp = Com-Get $allShapes 'Item' @($sIdx)
        if ($curShp) {
            $sId = [int](Com-Get $curShp 'StaticID')
            $shapeMap[$sId] = $curShp
        }
    }
    try {
        $dtLayer = Com-Get (Com-Get $actPg 'Layers') 'Item' @('Desktop')
        if ($dtLayer) {
            $dtShps = Com-Get $dtLayer 'Shapes'
            $dtCnt = if ($dtShps) { [int](Com-Get $dtShps 'Count') } else { 0 }
            for ($dIdx = 1; $dIdx -le $dtCnt; $dIdx++) {
                $dShp = Com-Get $dtShps 'Item' @($dIdx)
                if ($dShp) {
                    $dId = [int](Com-Get $dShp 'StaticID')
                    if (-not $shapeMap.ContainsKey($dId)) {
                        $shapeMap[$dId] = $dShp
                    }
                }
            }
        }
    } catch {}

    $minLeft = 999999.0
    $maxRight = -999999.0
    $maxTop = -999999.0
    $minBottom = 999999.0
    $foundAny = $false

    foreach ($it in $itemList) {
        $id = [int]$it.staticId
        if ($shapeMap.ContainsKey($id)) {
            $s = $shapeMap[$id]
            $sl = [double](Get-ShapeLeft $s)
            $st = [double](Get-ShapeTop $s)
            $sw = [double](Com-Get $s 'SizeWidth')
            $sh = [double](Com-Get $s 'SizeHeight')
            $sr = $sl + $sw
            $sb = $st - $sh
            $minLeft = [math]::Min($minLeft, $sl)
            $maxRight = [math]::Max($maxRight, $sr)
            $maxTop = [math]::Max($maxTop, $st)
            $minBottom = [math]::Min($minBottom, $sb)
            $foundAny = $true
        }
    }

    if (-not $foundAny) {
        $minLeft = 0.0
        $maxRight = 0.0
        $maxTop = 0.0
    }

    $boxLeft = 0.0
    $boxTop = 0.0
    $hasExistingBox = $false

    if ($data.containerBoxId -and $shapeMap.ContainsKey([int]$data.containerBoxId)) {
        $cBox = $shapeMap[[int]$data.containerBoxId]
        $boxLeft = [double](Get-ShapeLeft $cBox)
        $boxTop = [double](Get-ShapeTop $cBox)
        $hasExistingBox = $true
    } elseif ($foundAny) {
        $boxLeft = $maxRight + 15.0
        $boxTop = $maxTop
    }

    if ($createBox -and -not $hasExistingBox) {
        $right = $boxLeft + $boxW
        $bottom = $boxTop - $boxH
        $actLayer = Com-Get $doc 'ActiveLayer'
        $rect = if ($actLayer) { Com-Call $actLayer 'CreateRectangle' @([double]$boxLeft, [double]$boxTop, [double]$right, [double]$bottom) } else { $null }
        if ($rect) {
            try {
                $outline = Com-Get $rect 'Outline'
                if ($outline) {
                    Com-Call $outline 'SetProperties' @([double]0.05)
                }
            } catch {}
        }
    }

    $moved = 0
    foreach ($it in $itemList) {
        $id = [int]$it.staticId
        if (-not $shapeMap.ContainsKey($id)) { continue }
        $shp = $shapeMap[$id]
        if ($null -eq $shp) { continue }

        try {
            $targetRot = if ($it.rotate) { [double]$it.rotate } else { 0.0 }
            $curW = [double](Com-Get $shp 'SizeWidth')
            $curH = [double](Com-Get $shp 'SizeHeight')
            $origW = if ($it.origWidthCm) { [double]$it.origWidthCm } else { $curW }
            $origH = if ($it.origHeightCm) { [double]$it.origHeightCm } else { $curH }

            if ($targetRot -eq 90 -or $targetRot -eq 270) {
                if ($origW -gt $origH -and $curW -gt $curH) {
                    try { Com-Call $shp 'Rotate' @([double]90.0) } catch {}
                } elseif ($origW -lt $origH -and $curW -lt $curH) {
                    try { Com-Call $shp 'Rotate' @([double]90.0) } catch {}
                }
            } else {
                if ($origW -gt $origH -and $curW -lt $curH) {
                    try { Com-Call $shp 'Rotate' @([double]-90.0) } catch {}
                } elseif ($origW -lt $origH -and $curW -gt $curH) {
                    try { Com-Call $shp 'Rotate' @([double]-90.0) } catch {}
                }

                if ($targetRot -eq 180) {
                    $curRot = 0.0
                    try {
                        $rVal = Com-Get $shp 'RotationAngle'
                        if ($null -ne $rVal) { $curRot = [double]$rVal }
                    } catch {}
                    $diffRot = 180.0 - $curRot
                    while ($diffRot -gt 180.0) { $diffRot -= 360.0 }
                    while ($diffRot -lt -180.0) { $diffRot += 360.0 }
                    if ([math]::Abs($diffRot) -gt 0.5) {
                        try { Com-Call $shp 'Rotate' @([double]$diffRot) } catch {}
                    }
                }
            }

            $targetLeft = $boxLeft + [double]$it.xCm
            $targetTop = $boxTop - [double]$it.yCm

            $moveSuccess = $false
            try {
                Com-Call $shp 'SetPosition' @([double]$targetLeft, [double]$targetTop)
                $moveSuccess = $true
            } catch {
                try {
                    Com-Set $shp 'PositionX' $targetLeft
                    Com-Set $shp 'PositionY' $targetTop
                    $moveSuccess = $true
                } catch {
                    try {
                        Com-Set $shp 'LeftX' $targetLeft
                        Com-Set $shp 'TopY' $targetTop
                        $moveSuccess = $true
                    } catch {}
                }
            }

            if ($moveSuccess) { $moved++ }
        } catch {}
    }

    try { [void](Com-Call $doc 'EndCommandGroup' @()) } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { [void](Com-Call $doc 'ClearSelection' @()) } catch {}

    try {
        $win = Com-Get $corel 'ActiveWindow'
        if (-not $win) { $win = Com-Get $doc 'ActiveWindow' }
        if ($win) {
            $curMode = Com-Get $win 'ViewMode'
            if ($null -ne $curMode) {
                try { Com-Set $win 'ViewMode' 1 } catch {}
                try { [void](Com-Call $win 'Refresh' @()) } catch {}
                try { Com-Set $win 'ViewMode' $curMode } catch {}
                try { [void](Com-Call $win 'Refresh' @()) } catch {}
            } else {
                try { [void](Com-Call $win 'Refresh' @()) } catch {}
            }
        }
    } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}

    $result.success = ($moved -gt 0)
    $result.movedCount = $moved
    $result.message = "Berhasil menata $moved pola ke dalam kotak ($boxW cm x $boxH cm)."

    if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
}
catch {
    try { if ($doc) { [void](Com-Call $doc 'EndCommandGroup' @()) } } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
}
finally {
    if (Test-Path $jsonFile) { try { Remove-Item -Path $jsonFile -Force } catch {} }
}

$result | ConvertTo-Json -Compress
`;

  try {
    const timeoutMs = Math.max(300000, items.length * 2000);
    return await runPowerShellScript(ps, timeoutMs);
  } catch (err) {
    return { success: false, message: err.message };
  }
}

module.exports = {
  getLayoutPolaSelection,
  executeLayoutPola,
};
