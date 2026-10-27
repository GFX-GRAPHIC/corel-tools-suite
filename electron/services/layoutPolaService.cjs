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

    $origRefPoint = $null
    try { $origRefPoint = $doc.ReferencePoint } catch {}
    try { $doc.ReferencePoint = 3 } catch {} # cdrTopLeft (3)

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

    if ($null -ne $origRefPoint -and $doc) { try { $doc.ReferencePoint = $origRefPoint } catch {} }
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

    $origRefPoint = $null
    try { $origRefPoint = $doc.ReferencePoint } catch {}
    try { $doc.ReferencePoint = 3 } catch {} # cdrTopLeft (3)

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

    function Get-SafeRangeItem($container, [int]$idx) {
        if (-not $container) { return $null }
        try { $it = $container.Item($idx); if ($it) { return $it } } catch {}
        try { $it = $container.Shapes.Item($idx); if ($it) { return $it } } catch {}
        try { $it = $container[$idx - 1]; if ($it) { return $it } } catch {}
        try { $it = $container[$idx]; if ($it) { return $it } } catch {}
        return $null
    }

    $shapeMap = @{}

    # Strategy 1: Active selection if available
    try {
        $selInfo = Get-CorelSelection $corel $doc
        $sel = $selInfo.Selection
        $sCnt = [int]$selInfo.SelCount
        if ($sel -and $sCnt -gt 0) {
            for ($si = 1; $si -le $sCnt; $si++) {
                try {
                    $s = Get-SafeRangeItem $sel $si
                    if ($s) {
                        $shapeMap[[int]$s.StaticID] = $s
                    }
                } catch {}
            }
        }
    } catch {}

    # Strategy 2: Page shapes via FindShapes
    $actPg = $doc.ActivePage
    if ($actPg) {
        try {
            $pShapes = $actPg.Shapes.FindShapes($null, 0, $true)
            if ($pShapes) {
                $pCount = [int]$pShapes.Count
                for ($pi = 1; $pi -le $pCount; $pi++) {
                    try {
                        $s = Get-SafeRangeItem $pShapes $pi
                        if ($s) {
                            $shapeMap[[int]$s.StaticID] = $s
                        }
                    } catch {}
                }
            }
        } catch {}

        # Strategy 3: Iterate Page Layers and Shapes
        try {
            if ($actPg.Layers) {
                $lCount = [int]$actPg.Layers.Count
                for ($li = 1; $li -le $lCount; $li++) {
                    try {
                        $lyr = Get-SafeRangeItem $actPg.Layers $li
                        if ($lyr -and $lyr.Shapes) {
                            $lsCount = [int]$lyr.Shapes.Count
                            for ($lsi = 1; $lsi -le $lsCount; $lsi++) {
                                try {
                                    $s = Get-SafeRangeItem $lyr.Shapes $lsi
                                    if ($s) {
                                        $shapeMap[[int]$s.StaticID] = $s
                                    }
                                } catch {}
                            }
                        }
                    } catch {}
                }
            }
        } catch {}

        # Strategy 4: FindShape by StaticID for any remaining items from itemList
        foreach ($it in $itemList) {
            try {
                $id = [int]$it.staticId
                if (-not $shapeMap.ContainsKey($id)) {
                    $found = $actPg.Shapes.FindShape($null, 0, $id, $true)
                    if ($found) { $shapeMap[$id] = $found }
                }
            } catch {}
        }
    }

    $minLeft = 999999.0
    $maxRight = -999999.0
    $maxTop = -999999.0
    $minBottom = 999999.0
    $foundAny = $false

    foreach ($it in $itemList) {
        try {
            $id = [int]$it.staticId
            if ($shapeMap.ContainsKey($id)) {
                $s = $shapeMap[$id]
                $sl = [double](Get-ShapeLeft $s)
                $st = [double](Get-ShapeTop $s)
                $sw = 0.0; try { $sw = [double]$s.SizeWidth } catch {}
                $sh = 0.0; try { $sh = [double]$s.SizeHeight } catch {}
                $sr = $sl + $sw
                $sb = $st - $sh
                $minLeft = [math]::Min($minLeft, $sl)
                $maxRight = [math]::Max($maxRight, $sr)
                $maxTop = [math]::Max($maxTop, $st)
                $minBottom = [math]::Min($minBottom, $sb)
                $foundAny = $true
            }
        } catch {}
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

            $targetLeft = [double]($boxLeft + [double]$it.xCm)
            $targetTop = [double]($boxTop - [double]$it.yCm)

            $moveSuccess = $false
            try {
                $shp.SetPosition($targetLeft, $targetTop)
                $moveSuccess = $true
            } catch {
                try {
                    $shp.LeftX = $targetLeft
                    $shp.TopY = $targetTop
                    $moveSuccess = $true
                } catch {}
            }

            # Verification delta check: guarantee LeftX and TopY are exact (no center-anchor shift)
            try {
                $curLeft = [double]$shp.LeftX
                $curTop = [double]$shp.TopY
                $dx = $targetLeft - $curLeft
                $dy = $targetTop - $curTop
                if ([math]::Abs($dx) -gt 0.05 -or [math]::Abs($dy) -gt 0.05) {
                    $shp.Move($dx, $dy)
                    $moveSuccess = $true
                }
            } catch {}

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
    if ($null -ne $origRefPoint -and $doc) { try { $doc.ReferencePoint = $origRefPoint } catch {} }
    if ($null -ne $origDocUnit -and $doc) { try { $doc.Unit = $origDocUnit } catch {} }
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
