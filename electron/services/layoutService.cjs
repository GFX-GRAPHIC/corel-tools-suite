/**
 * Auto-Layout Jersey & Resize Layout Service
 * Automated sublimation jersey layout, sizing, player data mapping, and geometric positioning.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('../core/electronBridge.cjs');
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

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
    limitPerBatch = 4,
    direction = 'horizontal',
    groupBySize = false,
    autoCurves = false,
    maxWidthCm = 0.0,
  } = payload || {};

  const cleanSizeChart = dedupeKeysCI(sizeChart);
  const dataList = (players && players.length > 0) ? players : (rows && rows.length > 0) ? rows : [];
  if (dataList.length === 0) {
    return { success: false, message: 'Tidak ada data pemain/desain untuk ditata.' };
  }

  const cleanDataList = dataList.map(item => dedupeKeysCI(item));

  const tempDir = app.getPath('temp');
  const tempJsonPath = path.join(tempDir, `corel_layout_data_${Date.now()}.json`);
  const layoutPayload = {
    targetSize,
    players: cleanDataList,
    mappings,
    sizeChart: cleanSizeChart,
    enableAutoResize,
    masterSize,
    spacingCm: Number(spacingCm) || 1.0,
    limitPerBatch: parseInt(limitPerBatch, 10) || 4,
    direction,
    groupBySize,
    autoCurves,
    maxWidthCm: Number(maxWidthCm) > 0 ? Number(maxWidthCm) : 0.0,
  };

  try {
    fs.writeFileSync(tempJsonPath, JSON.stringify(layoutPayload), 'utf-8');
  } catch (e) {
    return { success: false, message: `Gagal menyimpan data sementara: ${e.message}` };
  }

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
        throw "Silakan seleksi (blok) 1 pola master jersey di CorelDRAW terlebih dahulu."
    }

    $jsonPath = '${tempJsonPath.replace(/'/g, "''")}'
    $jsonRaw = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
    $data = $jsonRaw | ConvertFrom-Json

    $targetSize = [string]$data.targetSize
    $rawPlayers = $data.players
    $mappings = $data.mappings
    $sizeChart = $data.sizeChart
    $enableAutoResize = [bool]$data.enableAutoResize
    $masterSize = [string]$data.masterSize
    $spacing = [double]$data.spacingCm
    $limit = [int]$data.limitPerBatch
    $dir = [string]$data.direction
    $groupBySize = [bool]$data.groupBySize
    $autoCurves = [bool]$data.autoCurves
    $maxW = [double]$data.maxWidthCm

    function Get-FieldValue($p, [string]$colName) {
        if (-not $p -or -not $colName) { return '' }
        try {
            if ($p.PSObject -and $p.PSObject.Properties) {
                foreach ($pr in $p.PSObject.Properties) {
                    if ($pr.Name.ToLower() -eq $colName.ToLower()) {
                        return [string]$pr.Value
                    }
                }
            }
        } catch {}

        try {
            if ($p.Keys) {
                foreach ($k in $p.Keys) {
                    if ($k.ToString().ToLower() -eq $colName.ToLower()) {
                        return [string]$p[$k]
                    }
                }
            }
        } catch {}

        $colLow = $colName.ToLower()
        if ($colLow -eq 'nama' -or $colLow -eq 'name') {
            if ($p.name -ne $null) { return [string]$p.name }
            if ($p.Nama -ne $null) { return [string]$p.Nama }
            if ($p.pemain -ne $null) { return [string]$p.pemain }
            if ($p.playerName -ne $null) { return [string]$p.playerName }
        }
        if ($colLow -eq 'nomor' -or $colLow -eq 'no' -or $colLow -eq 'number') {
            if ($p.number -ne $null) { return [string]$p.number }
            if ($p.nomor -ne $null) { return [string]$p.nomor }
            if ($p.no -ne $null) { return [string]$p.no }
        }
        if ($colLow -eq 'ukuran' -or $colLow -eq 'size') {
            if ($p.size -ne $null) { return [string]$p.size }
            if ($p.ukuran -ne $null) { return [string]$p.ukuran }
        }
        return ''
    }

    # Filter players by target size if specified
    $playerList = @()
    if ($targetSize -and $targetSize -ne 'ALL') {
        foreach ($p in $rawPlayers) {
            $sz = Get-FieldValue $p 'Ukuran'
            if (-not $sz) { $sz = Get-FieldValue $p 'Size' }
            if (-not $sz) { $sz = 'L' }
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

    # Sort players by size if requested
    if ($groupBySize) {
        $playerList = $playerList | Sort-Object {
            $s = Get-FieldValue $_ 'Ukuran'
            if (-not $s) { $s = Get-FieldValue $_ 'Size' }
            $s
        }
    }

    function Get-DeepTextShapes($container) {
        $list = [System.Collections.ArrayList]::new()
        if (-not $container) { return $list }
        try {
            if ($container.Type -eq 6) { [void]$list.Add($container); return $list }
        } catch {}
        try {
            if ($container.Shapes) {
                $found = $container.Shapes.FindShapes($null, 6, $true)
                if ($found -and $found.Count -gt 0) {
                    for ($k = 1; $k -le $found.Count; $k++) { [void]$list.Add($found.Item($k)) }
                }
            }
        } catch {}
        try {
            $pc = $container.PowerClip
            if ($pc -and $pc.Shapes) {
                $pcTexts = $pc.Shapes.FindShapes($null, 6, $true)
                if ($pcTexts -and $pcTexts.Count -gt 0) {
                    for ($k = 1; $k -le $pcTexts.Count; $k++) { [void]$list.Add($pcTexts.Item($k)) }
                }
            }
        } catch {}
        try {
            if ($container.Shapes) {
                for ($si = 1; $si -le $container.Shapes.Count; $si++) {
                    $child = $container.Shapes.Item($si)
                    try {
                        if ($child.PowerClip -and $child.PowerClip.Shapes) {
                            $childPcTexts = $child.PowerClip.Shapes.FindShapes($null, 6, $true)
                            if ($childPcTexts -and $childPcTexts.Count -gt 0) {
                                for ($k = 1; $k -le $childPcTexts.Count; $k++) { [void]$list.Add($childPcTexts.Item($k)) }
                            }
                        }
                    } catch {}
                }
            }
        } catch {}
        return $list
    }

    function Apply-TextToShape($ts, $val, $align, $textCase, $maxWLimit, $lockRatio) {
        if (-not $ts -or $val -eq $null) { return }
        try {
            $origCenterX = [double]$ts.CenterX
            $origCenterY = [double]$ts.CenterY
            $origLeft = [double]$ts.PositionX
            $origW = [double]$ts.SizeWidth

            $ts.Text.Story.Text = [string]$val

            if ($textCase -and $textCase -ne 'none') {
                $cdrCaseEnum = switch ($textCase.ToLower()) {
                    'sentence' { 1 }
                    'lower'    { 2 }
                    'upper'    { 3 }
                    'title'    { 4 }
                    'toggle'   { 5 }
                    default    { 0 }
                }
                if ($cdrCaseEnum -gt 0) {
                    try { $ts.Text.Story.Case = $cdrCaseEnum } catch {}
                }
            }

            $alignMode = if ($align) { $align.ToString().ToLower() } else { 'center' }
            try {
                if ($alignMode -eq 'left') {
                    $ts.Text.Story.Alignment = 1
                } elseif ($alignMode -eq 'right') {
                    $ts.Text.Story.Alignment = 2
                } else {
                    $ts.Text.Story.Alignment = 3
                }
            } catch {}

            $curW = [double]$ts.SizeWidth
            $curH = [double]$ts.SizeHeight
            $targetLimit = [double]$maxWLimit
            $isLocked = if ($lockRatio -ne $null) { [bool]$lockRatio } else { $true }

            # ONLY scale down if user explicitly specified a max width limit (> 0)
            if ($targetLimit -gt 0.0 -and $curW -gt $targetLimit) {
                $scale = $targetLimit / $curW
                $newW = $targetLimit
                $newH = if ($isLocked -and $curH -gt 0) { $curH * $scale } else { $curH }
                try {
                    $ts.SetSize($newW, $newH)
                } catch {
                    $ts.SizeWidth = $newW
                    if ($isLocked) { $ts.SizeHeight = $newH }
                }
            }

            if ($alignMode -eq 'left') {
                $ts.PositionX = $origLeft
                $ts.CenterY = $origCenterY
            } elseif ($alignMode -eq 'right') {
                $ts.PositionX = ($origLeft + $origW) - $ts.SizeWidth
                $ts.CenterY = $origCenterY
            } else {
                $ts.CenterX = $origCenterX
                $ts.CenterY = $origCenterY
            }
        } catch {}
    }

    function Get-PlaceholderCategory([string]$ph, [string]$lbl, [string]$col) {
        $c = "$ph $lbl $col".ToLower()
        if ($c -match 'nama|name|pemain|player') { return 'name' }
        if ($c -match 'nomor|number|no|#|00|99') { return 'number' }
        if ($c -match 'ukuran|size|sz') { return 'size' }
        if ($c -match 'sponsor|tim|team|club') { return 'sponsor' }
        return 'custom'
    }

    function Test-PlaceholderMatch([string]$text, $m) {
        if (-not $text -or -not $m) { return $false }
        $t = $text.Trim()
        $ph = if ($m.placeholder) { [string]$m.placeholder } else { '' }
        $lbl = if ($m.label) { [string]$m.label } else { '' }
        $col = if ($m.column) { [string]$m.column } else { '' }

        # 1. Exact or Bracket-free match against user mapping
        if ($ph) {
            $cleanPh = $ph.Trim()
            $barePh = $cleanPh.Trim('[', ']', '{', '}')
            if ($t -ieq $cleanPh -or ($barePh -and $t -ieq $barePh)) { return $true }
            if ($t -match [regex]::Escape($cleanPh)) { return $true }
        }

        # 2. Category synonyms
        $cat = Get-PlaceholderCategory $ph $lbl $col
        if ($cat -eq 'name') {
            if ($t -match '^(?i)(\[?nama\]?|\[?name\]?|\[?pemain\]?|\[?player\]?|\[?nama[\s_]*pemain\]?)$') { return $true }
        } elseif ($cat -eq 'number') {
            if ($t -match '^(?i)(\[?nomor\]?|\[?number\]?|\[?no\]?|\[?#\]?|00|99|10|\[00\]|\[99\])$') { return $true }
        } elseif ($cat -eq 'size') {
            if ($t -match '^(?i)(\[?ukuran\]?|\[?size\]?|\[?sz\]?|size:?|ukuran:?)$') { return $true }
        } elseif ($cat -eq 'sponsor') {
            if ($t -match '^(?i)(\[?sponsor\]?|\[?tim\]?|\[?team\]?|\[?club\]?)$') { return $true }
        }

        return $false
    }

    function UpdateJerseyShape($shapeItem, $player, $mappingsList, $fallbackMaxW) {
        try {
            $textShapes = @(Get-DeepTextShapes $shapeItem)
            if (-not $textShapes -or $textShapes.Count -eq 0) { return }

            $matchedIds = @{}

            # Identify mappings
            $numMapping = $null
            $nameMapping = $null
            $sizeMapping = $null
            if ($mappingsList) {
                foreach ($m in $mappingsList) {
                    $cat = Get-PlaceholderCategory $m.placeholder $m.label $m.column
                    if ($cat -eq 'number' -and -not $numMapping) { $numMapping = $m }
                    elseif ($cat -eq 'name' -and -not $nameMapping) { $nameMapping = $m }
                    elseif ($cat -eq 'size' -and -not $sizeMapping) { $sizeMapping = $m }
                }
            }

            # PASS 1: Placeholder Matching across all mappings
            if ($mappingsList -and $mappingsList.Count -gt 0) {
                foreach ($m in $mappingsList) {
                    for ($t = 0; $t -lt $textShapes.Count; $t++) {
                        $ts = $textShapes[$t]
                        $tsId = $ts.StaticID
                        if ($matchedIds.ContainsKey($tsId)) { continue }

                        $currText = ""
                        try { $currText = [string]$ts.Text.Story.Text.Trim() } catch {}
                        if (-not $currText) { continue }

                        if (Test-PlaceholderMatch $currText $m) {
                            $matchedIds[$tsId] = $true
                            $colKey = if ($m.column) { $m.column } else { '' }
                            $val = Get-FieldValue $player $colKey
                            $cat = Get-PlaceholderCategory $m.placeholder $m.label $m.column
                            if ([string]::IsNullOrWhiteSpace($val)) {
                                if ($cat -eq 'name') {
                                    $val = Get-FieldValue $player 'nama'
                                    if (-not $val) { $val = Get-FieldValue $player 'name' }
                                } elseif ($cat -eq 'number') {
                                    $val = Get-FieldValue $player 'nomor'
                                    if (-not $val) { $val = Get-FieldValue $player 'number' }
                                    if (-not $val) { $val = Get-FieldValue $player 'no' }
                                } elseif ($cat -eq 'size') {
                                    $val = Get-FieldValue $player 'ukuran'
                                    if (-not $val) { $val = Get-FieldValue $player 'size' }
                                }
                            }
                            $mW = if ($m.maxWidth -and [double]$m.maxWidth -gt 0) { [double]$m.maxWidth } elseif ($m.width -and [double]$m.width -gt 0) { [double]$m.width } else { 0.0 }
                            $lR = if ($m.lockRatio -ne $null) { [bool]$m.lockRatio } else { $true }
                            Apply-TextToShape $ts $val $m.align $m.textCase $mW $lR
                            # DO NOT break! Allows both back number and shorts number to be updated
                        }
                    }
                }
            }

            # PASS 2: Strict Fallback for standard placeholders that were unmatched
            for ($t = 0; $t -lt $textShapes.Count; $t++) {
                $ts = $textShapes[$t]
                if ($matchedIds.ContainsKey($ts.StaticID)) { continue }

                $txt = ""
                try { $txt = [string]$ts.Text.Story.Text.Trim() } catch {}
                if (-not $txt) { continue }

                # Number placeholder (00, 99, 10, #, NO. 00)
                if (($txt -eq '00' -or $txt -eq '99' -or $txt -eq '10' -or $txt -eq '#' -or $txt -match '^(no|no\.)\s*\d+$') -and $numMapping) {
                    $numVal = Get-FieldValue $player $numMapping.column
                    if (-not $numVal) { $numVal = Get-FieldValue $player 'nomor' }
                    if (-not $numVal) { $numVal = Get-FieldValue $player 'number' }
                    if (-not $numVal) { $numVal = Get-FieldValue $player 'no' }
                    if ($numVal) {
                        $mW = if ($numMapping.maxWidth -and [double]$numMapping.maxWidth -gt 0) { [double]$numMapping.maxWidth } else { 0.0 }
                        Apply-TextToShape $ts $numVal $numMapping.align $numMapping.textCase $mW $numMapping.lockRatio
                        $matchedIds[$ts.StaticID] = $true
                    }
                }
                # Size placeholder (SIZE, UKURAN, SZ, size:)
                elseif ($txt -match '^(?i)(\[?size\]?|\[?ukuran\]?|\[?sz\]?|size:?|ukuran:?)$') {
                    $szVal = Get-FieldValue $player 'ukuran'
                    if (-not $szVal) { $szVal = Get-FieldValue $player 'size' }
                    if ($sizeMapping -and -not $szVal) { $szVal = Get-FieldValue $player $sizeMapping.column }
                    if ($szVal) {
                        Apply-TextToShape $ts $szVal 'center' 'upper' 0.0 $true
                        $matchedIds[$ts.StaticID] = $true
                    }
                }
                # Name placeholder (NAMA, NAME, PEMAIN)
                elseif ($txt -match '^(?i)(\[?nama\]?|\[?name\]?|\[?pemain\]?|\[?player\]?)$' -and $nameMapping) {
                    $nameVal = Get-FieldValue $player $nameMapping.column
                    if (-not $nameVal) { $nameVal = Get-FieldValue $player 'nama' }
                    if (-not $nameVal) { $nameVal = Get-FieldValue $player 'name' }
                    if ($nameVal) {
                        $mW = if ($nameMapping.maxWidth -and [double]$nameMapping.maxWidth -gt 0) { [double]$nameMapping.maxWidth } else { 0.0 }
                        Apply-TextToShape $ts $nameVal $nameMapping.align $nameMapping.textCase $mW $nameMapping.lockRatio
                        $matchedIds[$ts.StaticID] = $true
                    }
                }
                # NOTE: Any other text (logos, team crest, sponsors, texture labels) is left UNTOUCHED!
            }
        } catch {}
    }

    $masterShape = if ($selCount -gt 1) { $selection.Group() } else { Get-RangeItem $selection 1 }
    if (-not $masterShape) { $masterShape = $selection }
    if (-not $masterShape) {
        throw "Gagal memproses objek master pola jersey di CorelDRAW."
    }

    $origMasterW = [double]$masterShape.SizeWidth
    $origMasterH = [double]$masterShape.SizeHeight
    $masterRatio = if ($origMasterH -gt 0) { $origMasterW / $origMasterH } else { 1.0 }

    function Get-SizeDimensions($szName, $chart, $mRatio, $origW, $origH) {
        if (-not $szName -or -not $chart) { return @{ targetW = $origW; targetH = $origH } }
        $cleanSz = $szName.ToString().Trim().ToUpper()

        $entry = $null
        if ($chart.PSObject -and $chart.PSObject.Properties) {
            foreach ($prop in $chart.PSObject.Properties) {
                if ($prop.Name.Trim().ToUpper() -eq $cleanSz) {
                    $entry = $prop.Value
                    break
                }
            }
        } elseif ($chart.Keys) {
            foreach ($k in $chart.Keys) {
                if ($k.ToString().Trim().ToUpper() -eq $cleanSz) {
                    $entry = $chart[$k]
                    break
                }
            }
        }

        if (-not $entry) {
            return @{ targetW = $origW; targetH = $origH }
        }

        $tw = if ($entry.width) { [double]$entry.width } else { 0.0 }
        $th = if ($entry.height) { [double]$entry.height } else { 0.0 }
        $isLock = if ($entry.lockRatio -ne $null) { [bool]$entry.lockRatio } else { $true }

        if ($th -gt 0 -and $tw -le 0 -and $isLock) {
            $tw = [math]::Round(($th * $mRatio), 3)
        } elseif ($tw -gt 0 -and $th -le 0 -and $isLock) {
            $th = [math]::Round(($tw / $mRatio), 3)
        } elseif ($tw -le 0 -and $th -le 0) {
            $tw = $origW
            $th = $origH
        }

        return @{ targetW = $tw; targetH = $th }
    }

    $corel.Optimization = $true
    $corel.EventsEnabled = $false
    $doc.BeginCommandGroup("CTS Auto-Layout Jersey")

    $created = 0
    $currentX = 0.0
    $currentY = 0.0
    $colMaxW = 0.0
    $rowMaxH = 0.0
    $colCount = 0
    $rowCount = 0

    for ($i = 0; $i -lt $playerList.Count; $i++) {
        $p = $playerList[$i]
        $sz = Get-FieldValue $p 'Ukuran'
        if (-not $sz) { $sz = Get-FieldValue $p 'Size' }
        $dim = Get-SizeDimensions $sz $sizeChart $masterRatio $origMasterW $origMasterH
        $targetW = [double]$dim.targetW
        $targetH = [double]$dim.targetH

        if ($i -eq 0) {
            if ($enableAutoResize -and $targetW -gt 0 -and $targetH -gt 0) {
                try { $masterShape.SetSize($targetW, $targetH) } catch {
                    $masterShape.SizeWidth = $targetW
                    $masterShape.SizeHeight = $targetH
                }
            }
            UpdateJerseyShape $masterShape $p $mappings $maxW
            $w = [double]$masterShape.SizeWidth
            $h = [double]$masterShape.SizeHeight

            $colMaxW = $w
            $rowMaxH = $h
            $colCount = 1
            $rowCount = 1

            if ($dir -eq 'horizontal') {
                $currentX += ($w + $spacing)
            } else {
                $currentY -= ($h + $spacing)
            }
            $created++
        } else {
            if ($dir -eq 'horizontal') {
                if ($rowCount -ge $limit) {
                    $currentY -= ($rowMaxH + $spacing)
                    $currentX = 0.0
                    $rowCount = 0
                    $rowMaxH = 0.0
                }
                $dx = $currentX
                $dy = $currentY
            } else {
                # vertical
                if ($colCount -ge $limit) {
                    $currentX += ($colMaxW + $spacing)
                    $currentY = 0.0
                    $colCount = 0
                    $colMaxW = 0.0
                }
                $dx = $currentX
                $dy = $currentY
            }

            $dup = $masterShape.Duplicate($dx, $dy)
            if ($enableAutoResize -and $targetW -gt 0 -and $targetH -gt 0) {
                try { $dup.SetSize($targetW, $targetH) } catch {
                    $dup.SizeWidth = $targetW
                    $dup.SizeHeight = $targetH
                }
            }
            UpdateJerseyShape $dup $p $mappings $maxW
            $w = [double]$dup.SizeWidth
            $h = [double]$dup.SizeHeight

            if ($dir -eq 'horizontal') {
                $rowMaxH = [math]::Max($rowMaxH, $h)
                $currentX += ($w + $spacing)
                $rowCount++
            } else {
                $colMaxW = [math]::Max($colMaxW, $w)
                $currentY -= ($h + $spacing)
                $colCount++
            }
            $created++
        }
    }

    if ($autoCurves) {
        try {
            $allDocTexts = @(Get-DeepTextShapes $doc.ActivePage)
            for ($ck = $allDocTexts.Count - 1; $ck -ge 0; $ck--) {
                try { [void]$allDocTexts[$ck].ConvertToCurves() } catch {}
            }
        } catch {}
    }

    $doc.EndCommandGroup()
    $corel.Optimization = $false
    $corel.EventsEnabled = $true
    $corel.Refresh()
    if ($corel.ActiveWindow) { try { $corel.ActiveWindow.Refresh() } catch {} }

    $result.success = $true
    $result.count = $created
    $result.message = "Berhasil menata $created pola jersey di CorelDRAW!"
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
        if (Test-Path '${tempJsonPath.replace(/'/g, "''")}') {
            Remove-Item -Path '${tempJsonPath.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue
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
