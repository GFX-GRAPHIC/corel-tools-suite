/**
 * Numerator (Penomoran Otomatis) Service
 * Battle-tested automatic sequential numbering engine for CorelDRAW.
 * Supports In-place, Page-by-Page, and Grid N-Up (Cut & Stack / Sequential) modes.
 */
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

async function executeNumerator(payload) {
  const {
    start = 1,
    end = 100,
    step = 1,
    digits = 4,
    prefix = '',
    suffix = '',
    mode = 'page',
    cols = 2,
    rows = 5,
    spacingX = 0.5,
    spacingY = 0.5,
    gridOrder = 'cut_stack',
    autoCurves = true,
    doubleNumber = true,
  } = payload || {};

  const startVal = Number.isFinite(Number(start)) ? Number(start) : 1;
  const endVal = Number.isFinite(Number(end)) ? Number(end) : 1;
  const stepVal = Number.isFinite(Number(step)) && Number(step) > 0 ? Number(step) : 1;
  const digitsVal = Number.isFinite(Number(digits)) ? Number(digits) : 0;
  const safePrefix = (prefix || '').replace(/"/g, '`"');
  const safeSuffix = (suffix || '').replace(/"/g, '`"');
  const safeMode = mode || 'page';
  const colsVal = Math.max(1, parseInt(cols, 10) || 2);
  const rowsVal = Math.max(1, parseInt(rows, 10) || 5);
  const spacingXVal = Number.isFinite(Number(spacingX)) ? Number(spacingX) : 0.5;
  const spacingYVal = Number.isFinite(Number(spacingY)) ? Number(spacingY) : 0.5;
  const safeGridOrder = gridOrder || 'cut_stack';
  const autoCurvesVal = autoCurves ? '$true' : '$false';
  const doubleNumberVal = doubleNumber ? '$true' : '$false';

  const totalCount = Math.abs(endVal - startVal) + 1;
  const dynamicTimeout = Math.max(600000, totalCount * 600);

  const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0; totalPages = 0 }

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
    $start = [int]${startVal}
    $end = [int]${endVal}
    $step = [int]${stepVal}
    $digits = [int]${digitsVal}
    $prefix = "${safePrefix}"
    $suffix = "${safeSuffix}"
    $mode = "${safeMode}"
    $cols = [int]${colsVal}
    $rows = [int]${rowsVal}
    $spacingX = [double]${spacingXVal}
    $spacingY = [double]${spacingYVal}
    $gridOrder = "${safeGridOrder}"
    $autoCurves = [bool]${autoCurvesVal}
    $doubleNumber = [bool]${doubleNumberVal}

${getCorelConnectPs()}

    if (-not $doc) {
        throw "Tidak ada file/dokumen yang sedang terbuka di CorelDRAW. Silakan buka file desain di CorelDRAW."
    }
    $doc.Unit = 3 # cdrCentimeter

    function Get-FormattedNum([int]$val, [int]$dig, [string]$pfx, [string]$sfx) {
        $numPart = [string]$val
        if ($dig -gt 0) {
            $numPart = $numPart.PadLeft($dig, '0')
        }
        return "$pfx$numPart$sfx"
    }

    function Is-NumberPlaceholder([string]$txt) {
        if ([string]::IsNullOrWhiteSpace($txt)) { return $false }
        $t = $txt.Trim()
        if ($t -match '^\\d+$') { return $true }
        if ($t -match '^(no|no\\.|kpn|vcr|id|tiket|kupon|#|numb|num)?\\s*[:.-]?\\s*\\d+\\s*[a-z0-9/-]*$' -and $t.Length -le 18) { return $true }
        if ($t -match '\\d+' -and $t.Length -le 10) { return $true }
        return $false
    }

    # Universal Deep Recursive Text Finder (supports text shapes, PowerClips, groups, and nested groups)
    function Get-DeepTextShapes($container) {
        $found = @()
        if (-not $container) { return $found }

        # 1. Direct text shape (cdrTextShape = 6)
        try {
            if ($container.Type -eq 6) {
                $found += $container
                return $found
            }
        } catch {}

        # 2. Check if container itself has PowerClip (e.g. Rectangle, Curve, or Ellipse containing PowerClip)
        try {
            if ($container.PowerClip) {
                $pc = $container.PowerClip
                if ($pc.Shapes -and $pc.Shapes.Count -gt 0) {
                    for ($pi = 1; $pi -le $pc.Shapes.Count; $pi++) {
                        $pcChild = $pc.Shapes.Item($pi)
                        if ($pcChild) {
                            $pcTexts = Get-DeepTextShapes $pcChild
                            if ($pcTexts -and $pcTexts.Count -gt 0) { $found += $pcTexts }
                        }
                    }
                }
            }
        } catch {}

        # 3. Check if container has .Shapes (Group, Layer, Page)
        try {
            if ($container.Shapes -and $container.Shapes.Count -gt 0) {
                for ($si = 1; $si -le $container.Shapes.Count; $si++) {
                    $child = $container.Shapes.Item($si)
                    if ($child) {
                        $childTexts = Get-DeepTextShapes $child
                        if ($childTexts -and $childTexts.Count -gt 0) { $found += $childTexts }
                    }
                }
            }
        } catch {}

        # 4. Check if container is a ShapeRange or Selection
        try {
            if ($container.Count -and $container.Count -gt 0) {
                for ($ri = 1; $ri -le $container.Count; $ri++) {
                    $item = $container.Item($ri)
                    if ($item) {
                        $itemTexts = Get-DeepTextShapes $item
                        if ($itemTexts -and $itemTexts.Count -gt 0) { $found += $itemTexts }
                    }
                }
            }
        } catch {}

        return $found
    }

    # Updates number text inside any shape (single text, group, or PowerClip container)
    function Update-ShapeNumberText($targetShape, [string]$numText, [bool]$allowMulti) {
        if (-not $targetShape) { return 0 }
        $textShapes = @(Get-DeepTextShapes $targetShape)
        if ($textShapes.Count -eq 0) { return 0 }

        $updated = 0
        # Pass 1: Replace matching placeholders
        foreach ($ts in $textShapes) {
            try {
                $story = $ts.Text.Story
                $raw = if ($story) { [string]$story.Text } else { "" }
                if (Is-NumberPlaceholder $raw) {
                    $story.Text = $numText
                    $updated++
                    if (-not $allowMulti) { break }
                }
            } catch {}
        }

        # Pass 2: Fallback if no placeholder matched, update the text shapes
        if ($updated -eq 0) {
            foreach ($ts in $textShapes) {
                try {
                    $story = $ts.Text.Story
                    if ($story) {
                        $story.Text = $numText
                        $updated++
                        if (-not $allowMulti) { break }
                    }
                } catch {}
            }
        }
        return $updated
    }

    $numList = @()
    for ($n = $start; $n -le $end; $n += $step) {
        $numList += $n
    }
    $totalNumbers = $numList.Count
    if ($totalNumbers -eq 0) { throw "Jumlah nomor yang dihasilkan adalah 0." }

    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    $selCount = [int]$selInfo.SelCount

    # ==========================================
    # MODE A: INPLACE MODE (Multiple selected tickets on active page)
    # ==========================================
    if ($mode -eq 'inplace' -or ($selCount -gt 1 -and $mode -ne 'grid')) {
        $shapeList = @()
        for ($i = 1; $i -le $selCount; $i++) {
            $s = Get-RangeItem $sel $i
            if ($s) {
                $shapeList += [PSCustomObject]@{
                    Shape = $s
                    PosX = [double]$s.PositionX
                    PosY = [double]$s.PositionY
                    Height = [double]$s.SizeHeight
                }
            }
        }

        $corel.Optimization = $true
        $corel.EventsEnabled = $false
        $doc.BeginCommandGroup("CTS Numerator Inplace")

        $rowTol = 1.0
        if ($shapeList.Count -gt 0 -and $shapeList[0].Height -gt 0) {
            $rowTol = [math]::Max(0.2, $shapeList[0].Height * 0.35)
        }

        $sorted = @($shapeList | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false })

        $countToUpdate = [math]::Min($sorted.Count, $totalNumbers)
        for ($i = 0; $i -lt $countToUpdate; $i++) {
            $formattedNum = Get-FormattedNum $numList[$i] $digits $prefix $suffix
            $targetShp = $sorted[$i].Shape
            Update-ShapeNumberText $targetShp $formattedNum $doubleNumber | Out-Null
        }
        $result.count = $countToUpdate
        $result.totalPages = 1
    }
    # ==========================================
    # MODE B: PAGE MODE (1 or more tickets per page, duplicated across pages)
    # ==========================================
    elseif ($mode -eq 'page') {
        $masterPage = $doc.ActivePage
        if (-not $masterPage) { $masterPage = $doc.Pages.Item(1) }
        if (-not $masterPage) { throw "Gagal membaca halaman aktif di CorelDRAW." }

        $corel.Optimization = $true
        $corel.EventsEnabled = $false
        $doc.BeginCommandGroup("CTS Numerator Page")

        $allPageTexts = @(Get-DeepTextShapes $masterPage)

        $textList = @()
        foreach ($t in $allPageTexts) {
            $rawText = ""
            try { $rawText = [string]$t.Text.Story.Text } catch {}
            if (Is-NumberPlaceholder $rawText) {
                $textList += [PSCustomObject]@{
                    Shape = $t
                    PosX = [double]$t.PositionX
                    PosY = [double]$t.PositionY
                    Height = [double]$t.SizeHeight
                }
            }
        }

        if ($textList.Count -eq 0) {
            foreach ($t in $allPageTexts) {
                $textList += [PSCustomObject]@{
                    Shape = $t
                    PosX = [double]$t.PositionX
                    PosY = [double]$t.PositionY
                    Height = [double]$t.SizeHeight
                }
            }
        }

        $itemsPerPage = [math]::Max(1, $textList.Count)
        if ($textList.Count -gt 0) {
            $rowTol = [math]::Max(0.2, $textList[0].Height * 0.35)
            $sortedTexts = @($textList | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false })
            $textList = $sortedTexts
        }

        $totalPages = [math]::Ceiling($totalNumbers / $itemsPerPage)

        $countPage1 = [math]::Min($itemsPerPage, $totalNumbers)
        for ($i = 0; $i -lt $countPage1; $i++) {
            $numVal = Get-FormattedNum $numList[$i] $digits $prefix $suffix
            if ($i -lt $textList.Count -and $textList[$i].Shape) {
                try { $textList[$i].Shape.Text.Story.Text = $numVal } catch {}
            }
        }

        if ($totalPages -gt 1) {
            [void]$masterPage.Shapes.All().Copy()
            for ($p = 2; $p -le $totalPages; $p++) {
                $newPage = $doc.AddPages(1)
                $newPage.Activate()
                [void]$doc.ActiveLayer.Paste()

                $newPageTexts = @(Get-DeepTextShapes $newPage)
                $newTextList = @()
                foreach ($t in $newPageTexts) {
                    $rawText = ""
                    try { $rawText = [string]$t.Text.Story.Text } catch {}
                    if (Is-NumberPlaceholder $rawText) {
                        $newTextList += [PSCustomObject]@{
                            Shape = $t
                            PosX = [double]$t.PositionX
                            PosY = [double]$t.PositionY
                            Height = [double]$t.SizeHeight
                        }
                    }
                }

                if ($newTextList.Count -eq 0) {
                    foreach ($t in $newPageTexts) {
                        $newTextList += [PSCustomObject]@{
                            Shape = $t
                            PosX = [double]$t.PositionX
                            PosY = [double]$t.PositionY
                            Height = [double]$t.SizeHeight
                        }
                    }
                }

                if ($newTextList.Count -gt 0) {
                    $rowTol = [math]::Max(0.2, $newTextList[0].Height * 0.35)
                    $sortedNew = @($newTextList | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false })
                    $newTextList = $sortedNew
                }

                $startIndex = ($p - 1) * $itemsPerPage
                $countThisPage = [math]::Min($itemsPerPage, $totalNumbers - $startIndex)
                for ($i = 0; $i -lt $countThisPage; $i++) {
                    $numVal = Get-FormattedNum $numList[$startIndex + $i] $digits $prefix $suffix
                    if ($i -lt $newTextList.Count -and $newTextList[$i].Shape) {
                        try { $newTextList[$i].Shape.Text.Story.Text = $numVal } catch {}
                    }
                }
            }
        }

        $result.count = $totalNumbers
        $result.totalPages = $totalPages
    }
    # ==========================================
    # MODE C: GRID N-UP MODE (Duplicate master into cols x rows grid across pages)
    # ==========================================
    elseif ($mode -eq 'grid') {
        if ($selCount -eq 0) {
            throw "Silakan seleksi (blok) 1 desain master voucher/tiket di CorelDRAW terlebih dahulu."
        }

        $masterShape = $null
        if ($selCount -gt 1) {
            try { $masterShape = $sel.Group() } catch {}
            if (-not $masterShape) {
                try { $masterShape = $corel.ActiveSelection.Group() } catch {}
            }
        } elseif ($selCount -eq 1) {
            $single = Get-RangeItem $sel 1
            if (-not $single) { $single = $sel }

            # SMART AUTO-DETECTION: Check if the selected shape has NO texts, but has texts sitting inside its bounds
            $existingTexts = @(Get-DeepTextShapes $single)
            if ($existingTexts.Count -eq 0 -and $doc.ActivePage) {
                $bLeft = [double]$single.PositionX
                $bTop = [double]$single.PositionY
                $bRight = $bLeft + [double]$single.SizeWidth
                $bBottom = $bTop - [double]$single.SizeHeight

                $insideShapes = @($single)
                $pShapes = $doc.ActivePage.Shapes
                if ($pShapes) {
                    for ($pi = 1; $pi -le $pShapes.Count; $pi++) {
                        $cand = $pShapes.Item($pi)
                        if ($cand.StaticID -eq $single.StaticID) { continue }
                        $cx = [double]$cand.CenterX
                        $cy = [double]$cand.CenterY
                        if ($cx -ge ($bLeft - 0.2) -and $cx -le ($bRight + 0.2) -and $cy -le ($bTop + 0.2) -and $cy -ge ($bBottom - 0.2)) {
                            $insideShapes += $cand
                        }
                    }
                }
                if ($insideShapes.Count -gt 1) {
                    try {
                        $doc.ClearSelection()
                        for ($si = 0; $si -lt $insideShapes.Count; $si++) {
                            $insideShapes[$si].Selected = $true
                        }
                        $masterShape = $corel.ActiveSelection.Group()
                    } catch {
                        $masterShape = $single
                    }
                } else {
                    $masterShape = $single
                }
            } else {
                $masterShape = $single
            }
        }

        if (-not $masterShape) {
            throw "Gagal membaca objek seleksi master di CorelDRAW."
        }

        $w = [double]$masterShape.SizeWidth
        $h = [double]$masterShape.SizeHeight
        $origX = [double]$masterShape.PositionX
        $origY = [double]$masterShape.PositionY

        $perPage = $cols * $rows
        $totalPages = [math]::Ceiling($totalNumbers / $perPage)
        $masterPage = $doc.ActivePage
        if (-not $masterPage) { $masterPage = $doc.Pages.Item(1) }

        $corel.Optimization = $true
        $corel.EventsEnabled = $false
        $doc.BeginCommandGroup("CTS Numerator Grid")

        # 1. Tata susunan grid lengkap di Halaman 1 selagi master masih utuh
        $page1Shapes = @()
        for ($r = 0; $r -lt $rows; $r++) {
            for ($c = 0; $c -lt $cols; $c++) {
                $targetPosX = $origX + ($c * ($w + $spacingX))
                $targetPosY = $origY - ($r * ($h + $spacingY))

                if ($r -eq 0 -and $c -eq 0) {
                    $masterShape.PositionX = $targetPosX
                    $masterShape.PositionY = $targetPosY
                    $page1Shapes += $masterShape
                } else {
                    $dup = $masterShape.Duplicate()
                    $dup.PositionX = $targetPosX
                    $dup.PositionY = $targetPosY
                    $page1Shapes += $dup
                }
            }
        }

        # 2. Isi nomor urut pada Halaman 1 per grup voucher
        for ($s = 0; $s -lt $perPage; $s++) {
            $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) } else { $s }
            if ($itemIdx -lt $totalNumbers) {
                $formattedNum = Get-FormattedNum $numList[$itemIdx] $digits $prefix $suffix
                Update-ShapeNumberText $page1Shapes[$s] $formattedNum $doubleNumber | Out-Null
            } else {
                try { $page1Shapes[$s].Delete() } catch {}
            }
        }

        # 3. Duplicate Page 1 ke Pages 2..TotalPages dan isi semua nomor
        if ($totalPages -gt 1) {
            $masterPage.Activate()
            [void]$masterPage.Shapes.All().Copy()

            for ($p = 2; $p -le $totalPages; $p++) {
                $newPage = $doc.AddPages(1)
                $newPage.Activate()
                $pIdx = $p - 1

                [void]$doc.ActiveLayer.Paste()

                $newShapes = @()
                for ($k = 1; $k -le $newPage.Shapes.Count; $k++) {
                    $shp = $newPage.Shapes.Item($k)
                    $newShapes += [PSCustomObject]@{
                        Shape = $shp
                        PosX = [double]$shp.PositionX
                        PosY = [double]$shp.PositionY
                        Height = [double]$shp.SizeHeight
                    }
                }

                $rowTol = [math]::Max(0.2, $h * 0.35)
                $sortedVouchers = @($newShapes | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false })

                for ($s = 0; $s -lt $sortedVouchers.Count; $s++) {
                    $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) + $pIdx } else { ($pIdx * $perPage) + $s }
                    if ($itemIdx -lt $totalNumbers) {
                        $formattedNum = Get-FormattedNum $numList[$itemIdx] $digits $prefix $suffix
                        Update-ShapeNumberText $sortedVouchers[$s].Shape $formattedNum $doubleNumber | Out-Null
                    } else {
                        try { $sortedVouchers[$s].Shape.Delete() } catch {}
                    }
                }
            }
        }

        if ($masterPage) {
            try { $masterPage.Activate() } catch {}
        }

        $result.count = $totalNumbers
        $result.totalPages = $totalPages
    }

    # Optional: Convert all text shapes to curves
    if ($autoCurves) {
        for ($p = 1; $p -le $doc.Pages.Count; $p++) {
            try {
                $pObj = $doc.Pages.Item($p)
                $pTexts = @(Get-DeepTextShapes $pObj)
                for ($ti = $pTexts.Count - 1; $ti -ge 0; $ti--) {
                    try { [void]$pTexts[$ti].ConvertToCurves() } catch {}
                }
            } catch {}
        }
    }

    try { $doc.ClearSelection() } catch {}
    try { $corel.ClearSelection() } catch {}
    try { $doc.EndCommandGroup() } catch {}
    try { $corel.Optimization = $false } catch {}
    try { $corel.EventsEnabled = $true } catch {}
    try { $corel.Refresh() } catch {}
    if ($corel.ActiveWindow) { try { $corel.ActiveWindow.Refresh() } catch {} }

    $result.success = $true
    $result.message = "Berhasil membuat $($result.count) nomorator pada $($result.totalPages) halaman di CorelDRAW!"
}
catch {
    $errLine = $_.InvocationInfo.ScriptLineNumber
    try {
        if ($doc) { [void]$doc.EndCommandGroup() }
        if ($corel) {
            $corel.Optimization = $false
            $corel.EventsEnabled = $true
            $corel.Refresh()
        }
    } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message) (Baris $errLine)"
} finally {
    if ($doc) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
    if ($corel) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($corel) | Out-Null } catch {} }
    [GC]::Collect()
}

$result | ConvertTo-Json -Compress
`;

  return runPowerShellScript(psScript, dynamicTimeout);
}

module.exports = {
  executeNumerator,
};
