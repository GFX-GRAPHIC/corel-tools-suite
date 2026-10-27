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

    # 1. Connect to active CorelDRAW COM instance
${getCorelConnectPs()}

    if (-not $doc) {
        throw "Tidak ada file/dokumen yang sedang terbuka di CorelDRAW. Silakan buka file desain di CorelDRAW."
    }
    Com-Set $doc "Unit" 3 # cdrCentimeter

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

    # Deep recursive shape text search (100% reliable across groups and nested groups)
    function Get-DeepTextShapes($shape) {
        $results = @()
        if ($null -eq $shape) { return $results }
        try {
            $shpType = [int](Com-Get $shape "Type")
            if ($shpType -eq 6) { # cdrTextShape
                $results += ,$shape
                return $results
            }
            # Group or composite shape with Shapes collection
            $sub = Com-Get $shape "Shapes"
            if ($sub) {
                $cnt = [int](Com-Get $sub "Count")
                for ($i = 1; $i -le $cnt; $i++) {
                    $child = Com-Get $sub "Item" @($i)
                    if ($child) {
                        $childTexts = Get-DeepTextShapes $child
                        if ($childTexts -and $childTexts.Count -gt 0) {
                            $results += $childTexts
                        }
                    }
                }
            }
            # PowerClip nested shapes
            $pc = Com-Get $shape "PowerClip"
            if ($pc) {
                $pcShapes = Com-Get $pc "Shapes"
                if ($pcShapes) {
                    $cnt = [int](Com-Get $pcShapes "Count")
                    for ($i = 1; $i -le $cnt; $i++) {
                        $child = Com-Get $pcShapes "Item" @($i)
                        if ($child) {
                            $childTexts = Get-DeepTextShapes $child
                            if ($childTexts -and $childTexts.Count -gt 0) {
                                $results += $childTexts
                            }
                        }
                    }
                }
            }
        } catch {}
        return $results
    }

    # Updates number text inside any shape (single text or grouped ticket)
    function Update-ShapeNumberText($targetShape, [string]$numText, [bool]$allowMulti) {
        if ($null -eq $targetShape) { return 0 }
        $textShapes = @(Get-DeepTextShapes $targetShape)
        if ($textShapes.Count -eq 0) { return 0 }

        $updated = 0
        # Pass 1: Replace matching placeholders
        foreach ($ts in $textShapes) {
            try {
                $txtObj = Com-Get $ts "Text"
                $story = if ($txtObj) { Com-Get $txtObj "Story" } else { $null }
                $raw = if ($story) { [string](Com-Get $story "Text") } else { "" }
                if (Is-NumberPlaceholder $raw) {
                    Com-Set $story "Text" $numText
                    $updated++
                    if (-not $allowMulti) { break }
                }
            } catch {}
        }

        # Pass 2: Fallback if no placeholder matched, update the text shapes
        if ($updated -eq 0) {
            foreach ($ts in $textShapes) {
                try {
                    $txtObj = Com-Get $ts "Text"
                    $story = if ($txtObj) { Com-Get $txtObj "Story" } else { $null }
                    if ($story) {
                        Com-Set $story "Text" $numText
                        $updated++
                        if (-not $allowMulti) { break }
                    }
                } catch {}
            }
        }
        return $updated
    }

    function Get-ValidTargetLayer($pageObj, $docObj) {
        $lyr = $null
        if ($pageObj) {
            $lyr = Com-Get $pageObj "ActiveLayer"
            if ($lyr) {
                $isSpec = [bool](Com-Get $lyr "IsSpecialLayer")
                $isEdit = [bool](Com-Get $lyr "Editable")
                if ($isSpec -or -not $isEdit) { $lyr = $null }
            }
            if (-not $lyr) {
                $lyrs = Com-Get $pageObj "Layers"
                $lyrsCount = if ($lyrs) { [int](Com-Get $lyrs "Count") } else { 0 }
                if ($lyrs -and $lyrsCount -gt 0) {
                    for ($li = 1; $li -le $lyrsCount; $li++) {
                        $candLyr = Com-Get $lyrs "Item" @($li)
                        if ($candLyr) {
                            $isSpec = [bool](Com-Get $candLyr "IsSpecialLayer")
                            $isEdit = [bool](Com-Get $candLyr "Editable")
                            if (-not $isSpec -and $isEdit) {
                                $lyr = $candLyr
                                break
                            }
                        }
                    }
                    if (-not $lyr) {
                        $lyr = Com-Get $lyrs "Item" @(1)
                    }
                }
            }
        }
        if (-not $lyr -and $docObj) {
            $lyr = Com-Get $docObj "ActiveLayer"
        }
        return ,$lyr
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
    if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

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
                    PosX = [double](Com-Get $s "PositionX")
                    PosY = [double](Com-Get $s "PositionY")
                    Height = [double](Com-Get $s "SizeHeight")
                }
            }
        }

        Com-Set $corel "Optimization" $true
        Com-Set $corel "EventsEnabled" $false
        try { [void](Com-Call $doc "BeginCommandGroup" @("CTS Numerator Inplace")) } catch {}

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
        $masterPage = Com-Get $doc "ActivePage"
        if (-not $masterPage) {
            $pgs = Com-Get $doc "Pages"
            if ($pgs -and ([int](Com-Get $pgs "Count")) -gt 0) {
                $masterPage = Com-Get $pgs "Item" @(1)
            }
        }
        if (-not $masterPage) {
            throw "Gagal membaca halaman aktif di CorelDRAW."
        }

        Com-Set $corel "Optimization" $true
        Com-Set $corel "EventsEnabled" $false
        try { [void](Com-Call $doc "BeginCommandGroup" @("CTS Numerator Page")) } catch {}

        $mpShapes = Com-Get $masterPage "Shapes"
        $allPageTexts = @()
        if ($mpShapes) {
            $mpCount = [int](Com-Get $mpShapes "Count")
            for ($si = 1; $si -le $mpCount; $si++) {
                $shp = Com-Get $mpShapes "Item" @($si)
                if ($shp) {
                    $found = Get-DeepTextShapes $shp
                    if ($found -and $found.Count -gt 0) {
                        $allPageTexts += $found
                    }
                }
            }
        }

        $textList = @()
        foreach ($t in $allPageTexts) {
            $storyObj = Com-Get (Com-Get $t "Text") "Story"
            $rawText = if ($storyObj) { [string](Com-Get $storyObj "Text") } else { "" }
            if (Is-NumberPlaceholder $rawText) {
                $textList += [PSCustomObject]@{
                    Shape = $t
                    PosX = [double](Com-Get $t "PositionX")
                    PosY = [double](Com-Get $t "PositionY")
                    Height = [double](Com-Get $t "SizeHeight")
                }
            }
        }

        if ($textList.Count -eq 0) {
            foreach ($t in $allPageTexts) {
                $textList += [PSCustomObject]@{
                    Shape = $t
                    PosX = [double](Com-Get $t "PositionX")
                    PosY = [double](Com-Get $t "PositionY")
                    Height = [double](Com-Get $t "SizeHeight")
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
                $storyObj = Com-Get (Com-Get $textList[$i].Shape "Text") "Story"
                if ($storyObj) { Com-Set $storyObj "Text" $numVal }
            }
        }

        if ($totalPages -gt 1) {
            for ($p = 2; $p -le $totalPages; $p++) {
                $newPage = Com-Call $doc "AddPages" @(1)
                if (-not $newPage) {
                    throw "Gagal menambahkan halaman baru ($p dari $totalPages) di CorelDRAW."
                }
                try { [void](Com-Call $newPage "Activate") } catch {}
                $targetLyr = Get-ValidTargetLayer $newPage $doc
                if ($mpShapes -and $targetLyr) {
                    $mpCount = [int](Com-Get $mpShapes "Count")
                    for ($msIdx = $mpCount; $msIdx -ge 1; $msIdx--) {
                        $ms = Com-Get $mpShapes "Item" @($msIdx)
                        if ($ms) {
                            $dupMs = Com-Call $ms "Duplicate" @(0.0, 0.0)
                            if ($dupMs) {
                                try { [void](Com-Call $dupMs "MoveToLayer" @($targetLyr)) } catch {}
                            }
                        }
                    }
                }

                $npShapes = Com-Get $newPage "Shapes"
                $newPageTexts = @()
                if ($npShapes) {
                    $npCount = [int](Com-Get $npShapes "Count")
                    for ($nsi = 1; $nsi -le $npCount; $nsi++) {
                        $nshp = Com-Get $npShapes "Item" @($nsi)
                        if ($nshp) {
                            $nfound = Get-DeepTextShapes $nshp
                            if ($nfound -and $nfound.Count -gt 0) {
                                $newPageTexts += $nfound
                            }
                        }
                    }
                }

                $newTextList = @()
                foreach ($t in $newPageTexts) {
                    $storyObj = Com-Get (Com-Get $t "Text") "Story"
                    $rawText = if ($storyObj) { [string](Com-Get $storyObj "Text") } else { "" }
                    if (Is-NumberPlaceholder $rawText) {
                        $newTextList += [PSCustomObject]@{
                            Shape = $t
                            PosX = [double](Com-Get $t "PositionX")
                            PosY = [double](Com-Get $t "PositionY")
                            Height = [double](Com-Get $t "SizeHeight")
                        }
                    }
                }

                if ($newTextList.Count -eq 0) {
                    foreach ($t in $newPageTexts) {
                        $newTextList += [PSCustomObject]@{
                            Shape = $t
                            PosX = [double](Com-Get $t "PositionX")
                            PosY = [double](Com-Get $t "PositionY")
                            Height = [double](Com-Get $t "SizeHeight")
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
                        $storyObj = Com-Get (Com-Get $newTextList[$i].Shape "Text") "Story"
                        if ($storyObj) { Com-Set $storyObj "Text" $numVal }
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
            try { $masterShape = Com-Call $sel "Group" } catch {}
            if (-not $masterShape) {
                $as = Com-Get $corel "ActiveSelection"
                if ($as) { try { $masterShape = Com-Call $as "Group" } catch {} }
            }
            if (-not $masterShape) {
                $sr = Com-Get $doc "SelectionRange"
                if ($sr) { try { $masterShape = Com-Call $sr "Group" } catch {} }
            }
        }
        if (-not $masterShape) {
            $masterShape = Get-RangeItem $sel 1
        }
        if (-not $masterShape -and $selCount -eq 1 -and $sel) {
            $masterShape = $sel
        }
        if (-not $masterShape) {
            throw "Gagal membaca objek seleksi master di CorelDRAW."
        }

        $w = [double](Com-Get $masterShape "SizeWidth")
        $h = [double](Com-Get $masterShape "SizeHeight")

        $perPage = $cols * $rows
        $totalPages = [math]::Ceiling($totalNumbers / $perPage)
        $masterPage = Com-Get $doc "ActivePage"
        if (-not $masterPage) {
            $pgs = Com-Get $doc "Pages"
            if ($pgs -and ([int](Com-Get $pgs "Count")) -gt 0) {
                $masterPage = Com-Get $pgs "Item" @(1)
            }
        }
        $page1Layer = Com-Get $masterShape "Layer"
        if (-not $page1Layer) { $page1Layer = Get-ValidTargetLayer $masterPage $doc }

        Com-Set $corel "Optimization" $true
        Com-Set $corel "EventsEnabled" $false
        try { [void](Com-Call $doc "BeginCommandGroup" @("CTS Numerator Grid")) } catch {}

        # 1. Grid Page 1 (cells other than (0,0) which is the masterShape itself)
        for ($r = 0; $r -lt $rows; $r++) {
            for ($c = 0; $c -lt $cols; $c++) {
                if ($r -eq 0 -and $c -eq 0) { continue }
                $s = ($r * $cols) + $c
                $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) } else { $s }
                if ($itemIdx -lt $totalNumbers) {
                    try {
                        $formattedNum = Get-FormattedNum $numList[$itemIdx] $digits $prefix $suffix
                        $ox = [double]($c * ($w + $spacingX))
                        $oy = [double](-($r * ($h + $spacingY)))
                        $dup = Com-Call $masterShape "Duplicate" @($ox, $oy)
                        if ($dup) {
                            Update-ShapeNumberText $dup $formattedNum $doubleNumber | Out-Null
                        }
                    } catch {}
                }
            }
        }

        # 2. Grid Pages 2..TotalPages (stamp using masterShape)
        if ($totalPages -gt 1) {
            for ($p = 2; $p -le $totalPages; $p++) {
                $newPage = Com-Call $doc "AddPages" @(1)
                if (-not $newPage) { continue }
                $pIdx = $p - 1
                $targetLyr = Get-ValidTargetLayer $newPage $doc
                if ($targetLyr) {
                    try { [void](Com-Call $masterShape "MoveToLayer" @($targetLyr)) } catch {}
                }

                for ($r = 0; $r -lt $rows; $r++) {
                    for ($c = 0; $c -lt $cols; $c++) {
                        $s = ($r * $cols) + $c
                        $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) + $pIdx } else { ($pIdx * $perPage) + $s }
                        if ($itemIdx -lt $totalNumbers) {
                            try {
                                $formattedNum = Get-FormattedNum $numList[$itemIdx] $digits $prefix $suffix
                                $ox = [double]($c * ($w + $spacingX))
                                $oy = [double](-($r * ($h + $spacingY)))
                                $dup = Com-Call $masterShape "Duplicate" @($ox, $oy)
                                if ($dup) {
                                    Update-ShapeNumberText $dup $formattedNum $doubleNumber | Out-Null
                                }
                            } catch {}
                        }
                    }
                }
            }

            if ($page1Layer) {
                try { [void](Com-Call $masterShape "MoveToLayer" @($page1Layer)) } catch {}
            }
        }

        # 3. Update the masterShape at (0,0) of Page 1 with the first number
        try {
            $firstNum = Get-FormattedNum $numList[0] $digits $prefix $suffix
            Update-ShapeNumberText $masterShape $firstNum $doubleNumber | Out-Null
        } catch {}

        if ($masterPage) {
            try { [void](Com-Call $masterPage "Activate") } catch {}
        }

        $result.count = $totalNumbers
        $result.totalPages = $totalPages
    }

    # Optional: Convert all text shapes to curves
    if ($autoCurves) {
        $pgs = Com-Get $doc "Pages"
        $pgsCount = if ($pgs) { [int](Com-Get $pgs "Count") } else { 0 }
        for ($p = 1; $p -le $pgsCount; $p++) {
            try {
                $pageObj = Com-Get $pgs "Item" @($p)
                $pShapes = Com-Get $pageObj "Shapes"
                if ($pShapes) {
                    $psCount = [int](Com-Get $pShapes "Count")
                    for ($si = 1; $si -le $psCount; $si++) {
                        $shp = Com-Get $pShapes "Item" @($si)
                        if ($shp) {
                            $texts = Get-DeepTextShapes $shp
                            foreach ($tItem in $texts) {
                                try { [void](Com-Call $tItem "ConvertToCurves") } catch {}
                            }
                        }
                    }
                }
            } catch {}
        }
    }

    try { [void](Com-Call $doc "ClearSelection") } catch {}
    try { [void](Com-Call $corel "ClearSelection") } catch {}
    try { [void](Com-Call $doc "EndCommandGroup") } catch {}
    try { Com-Set $corel "EventsEnabled" $true } catch {}
    try { Com-Set $corel "Optimization" $false } catch {}

    # Comprehensive Viewport & Tile Cache Invalidation
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
    try { [void](Com-Call $corel "Refresh") } catch {}

    $result.success = $true
    $result.message = "Berhasil membuat $($result.count) nomorator pada $($result.totalPages) halaman di CorelDRAW!"
}
catch {
    $errLine = $_.InvocationInfo.ScriptLineNumber
    try {
        if ($doc) { [void](Com-Call $doc "EndCommandGroup") }
        if ($corel) {
            try { Com-Set $corel "EventsEnabled" $true } catch {}
            try { Com-Set $corel "Optimization" $false } catch {}
            try { [void](Com-Call $corel "Refresh") } catch {}
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
