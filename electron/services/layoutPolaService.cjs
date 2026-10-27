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

    $origDocUnit = $null
    try { $origDocUnit = $doc.Unit } catch {}
    try { $doc.Unit = 4 } catch {} # cdrCentimeter (4 = cm)

    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    $cnt = [int]$selInfo.SelCount

    if ($cnt -eq 0 -or -not $sel) {
        throw "Silakan seleksi (blok) objek-objek pola di CorelDRAW terlebih dahulu."
    }

    function Get-ShapeLeft([object]$shp) {
        if (-not $shp) { return 0.0 }
        try { if ($shp.LeftX -ne $null) { return [double]$shp.LeftX } } catch {}
        try { if ($shp.PositionX -ne $null) { return [double]$shp.PositionX } } catch {}
        return 0.0
    }
    function Get-ShapeTop([object]$shp) {
        if (-not $shp) { return 0.0 }
        try { if ($shp.TopY -ne $null) { return [double]$shp.TopY } } catch {}
        try { if ($shp.PositionY -ne $null) { return [double]$shp.PositionY } } catch {}
        return 0.0
    }

    $rawItems = @()
    for ($i = 1; $i -le $cnt; $i++) {
        $s = Get-RangeItem $sel $i
        if (-not $s) { continue }
        $sId = [int]$s.StaticID
        $w = [math]::Round([double]$s.SizeWidth, 2)
        $h = [math]::Round([double]$s.SizeHeight, 2)
        $left = [math]::Round([double](Get-ShapeLeft $s), 2)
        $top = [math]::Round([double](Get-ShapeTop $s), 2)
        $name = [string]$s.Name
        $type = [int]$s.Type

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

    if ($null -ne $origDocUnit) { try { $doc.Unit = $origDocUnit } catch {} }
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

    $origDocUnit = $null
    try { $origDocUnit = $doc.Unit } catch {}
    try { $doc.Unit = 4 } catch {} # cdrCentimeter (4 = cm)

    try { $doc.BeginCommandGroup("CTS Layout Pola") } catch {}
    try { $doc.ClearSelection() } catch {}
    try { $corel.Optimization = $true } catch {}
    try { $corel.EventsEnabled = $false } catch {}

    function Get-ShapeLeft([object]$shp) {
        if (-not $shp) { return 0.0 }
        try { if ($shp.LeftX -ne $null) { return [double]$shp.LeftX } } catch {}
        try { if ($shp.PositionX -ne $null) { return [double]$shp.PositionX } } catch {}
        return 0.0
    }
    function Get-ShapeTop([object]$shp) {
        if (-not $shp) { return 0.0 }
        try { if ($shp.TopY -ne $null) { return [double]$shp.TopY } } catch {}
        try { if ($shp.PositionY -ne $null) { return [double]$shp.PositionY } } catch {}
        return 0.0
    }

    $shapeMap = @{}
    $actPg = $doc.ActivePage
    $allShapes = if ($actPg) { $actPg.Shapes } else { $null }
    $totalPageShapes = if ($allShapes) { [int]$allShapes.Count } else { 0 }
    for ($sIdx = 1; $sIdx -le $totalPageShapes; $sIdx++) {
        $curShp = $allShapes.Item($sIdx)
        if ($curShp) {
            $shapeMap[[int]$curShp.StaticID] = $curShp
        }
    }
    try {
        $dtLayer = $actPg.Layers.Item('Desktop')
        if ($dtLayer) {
            $dtShps = $dtLayer.Shapes
            $dtCnt = if ($dtShps) { [int]$dtShps.Count } else { 0 }
            for ($dIdx = 1; $dIdx -le $dtCnt; $dIdx++) {
                $dShp = $dtShps.Item($dIdx)
                if ($dShp) {
                    $dId = [int]$dShp.StaticID
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
            $sw = [double]$s.SizeWidth
            $sh = [double]$s.SizeHeight
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
        $actLayer = $doc.ActiveLayer
        $rect = if ($actLayer) { $actLayer.CreateRectangle($boxLeft, $boxTop, $right, $bottom) } else { $null }
        if ($rect) {
            try {
                if ($rect.Outline) { $rect.Outline.SetProperties(0.05) }
            } catch {}
        }
    }

    $moved = 0
    foreach ($it in $itemList) {
        $id = [int]$it.staticId
        if (-not $shapeMap.ContainsKey($id)) { continue }
        $shp = $shapeMap[$id]
        if (-not $shp) { continue }

        try {
            $targetRot = if ($it.rotate) { [double]$it.rotate } else { 0.0 }
            $curW = [double]$shp.SizeWidth
            $curH = [double]$shp.SizeHeight
            $origW = if ($it.origWidthCm) { [double]$it.origWidthCm } else { $curW }
            $origH = if ($it.origHeightCm) { [double]$it.origHeightCm } else { $curH }

            if ($targetRot -eq 90 -or $targetRot -eq 270) {
                if ($origW -gt $origH -and $curW -gt $curH) {
                    try { $shp.Rotate(90.0) } catch {}
                } elseif ($origW -lt $origH -and $curW -lt $curH) {
                    try { $shp.Rotate(90.0) } catch {}
                }
            } else {
                if ($origW -gt $origH -and $curW -lt $curH) {
                    try { $shp.Rotate(-90.0) } catch {}
                } elseif ($origW -lt $origH -and $curW -gt $curH) {
                    try { $shp.Rotate(-90.0) } catch {}
                }

                if ($targetRot -eq 180) {
                    $curRot = 0.0
                    try { if ($shp.RotationAngle -ne $null) { $curRot = [double]$shp.RotationAngle } } catch {}
                    $diffRot = 180.0 - $curRot
                    while ($diffRot -gt 180.0) { $diffRot -= 360.0 }
                    while ($diffRot -lt -180.0) { $diffRot += 360.0 }
                    if ([math]::Abs($diffRot) -gt 0.5) {
                        try { $shp.Rotate($diffRot) } catch {}
                    }
                }
            }

            $targetLeft = $boxLeft + [double]$it.xCm
            $targetTop = $boxTop - [double]$it.yCm

            $moveSuccess = $false
            try {
                $shp.SetPosition($targetLeft, $targetTop)
                $moveSuccess = $true
            } catch {
                try {
                    $shp.PositionX = $targetLeft
                    $shp.PositionY = $targetTop
                    $moveSuccess = $true
                } catch {
                    try {
                        $shp.LeftX = $targetLeft
                        $shp.TopY = $targetTop
                        $moveSuccess = $true
                    } catch {}
                }
            }

            if ($moveSuccess) { $moved++ }
        } catch {}
    }

    try { $doc.EndCommandGroup() } catch {}
    try { $corel.EventsEnabled = $true } catch {}
    try { $corel.Optimization = $false } catch {}
    try { $doc.ClearSelection() } catch {}
    try { $corel.Refresh() } catch {}
    if ($corel.ActiveWindow) { try { $corel.ActiveWindow.Refresh() } catch {} }

    $result.success = ($moved -gt 0)
    $result.movedCount = $moved
    $result.message = "Berhasil menata $moved pola ke dalam kotak ($boxW cm x $boxH cm)."

    if ($null -ne $origDocUnit) { try { $doc.Unit = $origDocUnit } catch {} }
}
catch {
    try { if ($doc) { $doc.EndCommandGroup() } } catch {}
    try { $corel.EventsEnabled = $true } catch {}
    try { $corel.Optimization = $false } catch {}
    try { $corel.Refresh() } catch {}
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
