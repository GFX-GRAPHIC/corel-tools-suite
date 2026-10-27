/**
 * Layout Service (Jersey Auto-Layout & Resize Layout)
 * Handles automated N-Up layout, automatic size scaling from size charts,
 * player name/number/size/sponsor replacement, and proportional distribution.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('../core/electronBridge.cjs');
const { execFile } = require('child_process');
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

// Deduplicate object keys case-insensitively for clean PowerShell ConvertFrom-Json compatibility
function dedupeKeysCI(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  const seen = new Map();
  for (const [k, v] of Object.entries(obj)) {
    const low = String(k).toLowerCase();
    if (seen.has(low)) {
      const prevKey = seen.get(low);
      const prevEmpty = out[prevKey] === '' || out[prevKey] === null || out[prevKey] === undefined;
      if (prevEmpty && v !== '' && v !== null && v !== undefined) out[prevKey] = v;
      continue;
    }
    seen.set(low, k);
    out[k] = v;
  }
  return out;
}

async function executeResizeLayout(payload) {
  const { widthCm = 10, heightCm = 10, centerPage = true } = payload || {};
  const ps = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = '' }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Buka file desain di CorelDRAW terlebih dahulu." }

    $doc.Unit = 3 # cdrCentimeter
    $doc.BeginCommandGroup("CTS Resize")

    $selInfo = Get-CorelSelection $corel $doc
    $sel = $selInfo.Selection
    $selCount = [int]$selInfo.SelCount
    if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

    if ($selCount -eq 0 -or -not $sel) {
        throw "Silakan seleksi objek di CorelDRAW terlebih dahulu."
    }

    $sel.SetSize([double]${Number(widthCm) || 10}, [double]${Number(heightCm) || 10})
    if ([bool]${centerPage ? '$true' : '$false'}) {
        $sel.AlignAndDistribute(3, 3) # Align center to page
    }

    $doc.EndCommandGroup()
    try { $corel.Refresh() } catch {}
    $result.success = $true
    $result.message = "Berhasil mengubah ukuran objek menjadi ${widthCm} cm x ${heightCm} cm."
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

async function executeLayout(payload) {
  return new Promise((resolve) => {
    const {
      targetSize = 'ALL',
      players = [],
      rows = [],
      mappings = [],
      sizeChart = {},
      enableAutoResize = false,
      autoCurves = false,
      masterSize = 'L',
      spacingCm = 1.0,
      limitCopy = 4,
      direction = 'vertical',
      maxNameWidthCm = 27.0,
      groupBySize = false
    } = payload || {};

    const rawList = (players && players.length > 0) ? players : rows;
    const dataList = Array.isArray(rawList) ? rawList.map(dedupeKeysCI) : [];
    if (!dataList || dataList.length === 0) {
      return resolve({ success: false, message: 'Daftar data pemain kosong.' });
    }

    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    const tempJsonPath = path.join(tempDir, `corel_jersey_${timestamp}.json`);
    const tempPs1Path = path.join(tempDir, `corel_jersey_${timestamp}.ps1`);

    const dataPayload = {
      targetSize: targetSize || 'ALL',
      players: dataList,
      mappings: Array.isArray(mappings) ? mappings.map(dedupeKeysCI) : [],
      sizeChart: dedupeKeysCI(sizeChart || {}),
      enableAutoResize: !!enableAutoResize,
      autoCurves: !!autoCurves,
      masterSize: masterSize || 'L',
      spacingCm: Number.isFinite(parseFloat(spacingCm)) ? parseFloat(spacingCm) : 1.0,
      limitCopy: parseInt(limitCopy, 10) || 4,
      direction: direction || 'vertical',
      maxNameWidthCm: parseFloat(maxNameWidthCm) || 27.0,
      groupBySize: !!groupBySize
    };

    fs.writeFileSync(tempJsonPath, JSON.stringify(dataPayload, null, 2), 'utf-8');

    const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0 }

try {
${getCorelConnectPs()}
    if (-not $doc) { throw "Tidak ada dokumen terbuka di CorelDRAW." }

    $origDocUnit = Com-Get $doc 'Unit'
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter (4 = cm)

    # Resolve Active Selection from CorelDRAW using robust cascading strategy
    $selInfo = Get-CorelSelection $corel $doc
    $selection = $selInfo.Selection
    $selCount = [int]$selInfo.SelCount
    if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }
    $selShapes = if ($selection) { Com-Get $selection 'Shapes' } else { $null }

    if ($selCount -eq 0 -or -not $selection) {
        throw "Silakan pilih (seleksi/blok) 1 grup master pola jersey di CorelDRAW terlebih dahulu."
    }

    $jsonFile = $args[0]
    $data = Get-Content -Path $jsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $rawPlayers = $data.players
    $targetSize = if ($data.targetSize) { [string]$data.targetSize } else { 'ALL' }
    $spacing = [double]$data.spacingCm
    $limit = [int]$data.limitCopy
    if ($limit -lt 1) { $limit = 4 }
    $dir = if ($data.direction) { [string]$data.direction } else { 'vertical' }
    $maxW = if ($data.maxNameWidthCm) { [double]$data.maxNameWidthCm } else { 27.0 }
    $mappings = $data.mappings
    $sizeChart = $data.sizeChart
    $enableAutoResize = [bool]$data.enableAutoResize
    $autoCurves = [bool]$data.autoCurves
    $masterSize = if ($data.masterSize) { [string]$data.masterSize } else { 'L' }
    $groupBySize = [bool]$data.groupBySize

    # Helper: Convert string case
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
                for ($k = 0; $k -lt $chars.Length; $k++) {
                    if ([char]::IsUpper($chars[$k])) {
                        $chars[$k] = [char]::ToLower($chars[$k])
                    } elseif ([char]::IsLower($chars[$k])) {
                        $chars[$k] = [char]::ToUpper($chars[$k])
                    }
                }
                return (-join $chars)
            }
            default { return $str }
        }
    }

    # Helper: Get value from player/row object by key, property, or alias
    function Get-FieldValue($p, $colName) {
        if (-not $p -or [string]::IsNullOrEmpty($colName)) { return '' }
        try {
            if ($p.PSObject -and $p.PSObject.Properties) {
                $prop = $p.PSObject.Properties[$colName]
                if ($prop -and $prop.Value -ne $null) { return [string]$prop.Value }
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
        try {
            $val = $p.$colName
            if ($val -ne $null) { return [string]$val }
        } catch {}
        return ''
    }

    # Helper: Resolve player value for a mapping object
    function Get-PlayerValueForMapping($p, $m, [int]$varIdx) {
        if (-not $p -or -not $m) { return '' }
        $col = if ($m.column) { [string]$m.column } else { '' }
        $ph = if ($m.placeholder) { [string]$m.placeholder } else { '' }
        $lbl = if ($m.label) { [string]$m.label } else { '' }

        if ($col) {
            $v = Get-FieldValue $p $col
            if ($v -ne '') { return $v }
        }
        if ($ph) {
            $v = Get-FieldValue $p $ph
            if ($v -ne '') { return $v }
            $bare = $ph.Trim('[', ']', '{', '}')
            if ($bare) {
                $v = Get-FieldValue $p $bare
                if ($v -ne '') { return $v }
            }
        }
        if ($lbl) {
            $v = Get-FieldValue $p $lbl
            if ($v -ne '') { return $v }
        }

        # Semantic fallback
        $combined = ($ph + " " + $lbl + " " + $col).ToLower()
        if ($combined -match 'nama|name|pemain|player') {
            foreach ($k in @('name','nama','pemain','player','playerName','nama punggung','nama dada','nama_punggung','nama_dada','Col_1','Col_2')) {
                $v = Get-FieldValue $p $k
                if ($v -ne '') { return $v }
            }
        }
        if ($combined -match 'nomor|number|no\\b|punggung|celana|00|#') {
            foreach ($k in @('number','nomor','no','punggung','no punggung','nomor punggung','no_punggung','nomor_punggung','no celana','nomor celana','no.','00','[00]','Col_2','Col_1','Col_3')) {
                $v = Get-FieldValue $p $k
                if ($v -ne '') { return $v }
            }
        }
        if ($combined -match 'ukuran|size|sz') {
            foreach ($k in @('size','ukuran','Ukuran','Size','sz','SIZE','UKURAN','[SIZE]','[UKURAN]','Col_3','Col_4')) {
                $v = Get-FieldValue $p $k
                if ($v -ne '') { return $v }
            }
        }
        if ($combined -match 'sponsor|tim|team') {
            foreach ($k in @('sponsor','Sponsor','tim','team','club','Col_4','Col_5')) {
                $v = Get-FieldValue $p $k
                if ($v -ne '') { return $v }
            }
        }

        if ($p.PSObject -and $p.PSObject.Properties) {
            $props = @($p.PSObject.Properties)
            if ($varIdx -ge 0 -and $varIdx -lt $props.Count) {
                $v = [string]$props[$varIdx].Value
                if ($v -ne '') { return $v }
            }
        }

        return ''
    }

    # Filter players by target size
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

    # Apparel size ranking
    function Get-SizeRank($sz) {
        if (-not $sz) { return 999 }
        $s = $sz.ToString().Trim().ToUpper()
        $ranks = @{
            'XS ANAK' = 1; 'S ANAK' = 2; 'M ANAK' = 3; 'L ANAK' = 4; 'XL ANAK' = 5; 'XXL ANAK' = 6
            '2XS' = 10; 'XXS' = 10; 'XS' = 11; 'S' = 12; 'M' = 13; 'L' = 14; 'XL' = 15; 'XXL' = 16; '2XL' = 16
            '3XL' = 17; 'XXXL' = 17; '4XL' = 18; '5XL' = 19; '6XL' = 20; '7XL' = 21
        }
        if ($ranks.ContainsKey($s)) { return $ranks[$s] }
        return 100
    }

    if ($groupBySize) {
        $playerList = @($playerList | Sort-Object {
            $s = Get-FieldValue $_ 'Ukuran'
            if (-not $s) { $s = Get-FieldValue $_ 'Size' }
            Get-SizeRank $s
        })
    }

    $dbgLog = Join-Path $env:TEMP "cts_jersey_debug.log"
    $logBuffer = [System.Collections.Generic.List[string]]::new()
    function Write-CtsLog($msg) {
        try {
            $ts = [DateTime]::Now.ToString("HH:mm:ss.fff")
            $logBuffer.Add("[$ts] $msg")
        } catch {}
    }
    Write-CtsLog "=== Starting CTS Jersey Auto-Layout ==="

    function Apply-TextToShape($ts, $val, $align, $textCase, $maxWLimit, $lockRatio) {
        if (-not $ts) { return }
        if ($ts -is [System.Array]) {
            if ($ts.Length -gt 0) { $ts = $ts[0] } else { return }
        }
        try {
            $origCenterX = [double](Com-Get $ts 'CenterX')
            $origCenterY = [double](Com-Get $ts 'CenterY')
            $origLeft    = [double](Com-Get $ts 'PositionX')
            $origW       = [double](Com-Get $ts 'SizeWidth')
            $origH       = [double](Com-Get $ts 'SizeHeight')

            if ($textCase -and $textCase -ne 'none') {
                $val = Convert-TextCase $val $textCase
            }

            $txtObj = Com-Get $ts 'Text'
            if (-not $txtObj) { try { $txtObj = $ts.Text } catch {} }
            if ($txtObj -is [System.Array]) { if ($txtObj.Length -gt 0) { $txtObj = $txtObj[0] } else { $txtObj = $null } }
            
            $story = if ($txtObj) { Com-Get $txtObj 'Story' } else { $null }
            if (-not $story -and $txtObj) { try { $story = $txtObj.Story } catch {} }
            if ($story -is [System.Array]) { if ($story.Length -gt 0) { $story = $story[0] } else { $story = $null } }

            $targetStr = [string]$val
            $tSet = $false

            if ($story) {
                try {
                    Com-Set $story 'Text' $targetStr
                    $tSet = $true
                } catch {}
            }
            if (-not $tSet -and $story) {
                try {
                    $story.Text = $targetStr
                    $nowTxt = [string]$story.Text
                    if ($nowTxt.Trim() -eq $targetStr.Trim()) { $tSet = $true }
                } catch {}
            }
            if (-not $tSet -and $txtObj) {
                try {
                    Com-Set $txtObj 'Contents' $targetStr
                    $nowTxt = [string](Com-Get $story 'Text')
                    if ($nowTxt.Trim() -eq $targetStr.Trim()) { $tSet = $true }
                } catch {}
            }
            if (-not $tSet -and $txtObj) {
                try {
                    $txtObj.Contents = $targetStr
                    $nowTxt = [string]$txtObj.Contents
                    if ($nowTxt.Trim() -eq $targetStr.Trim()) { $tSet = $true }
                } catch {}
            }
            if (-not $tSet) {
                try {
                    $ts.Text.Story.Text = $targetStr
                    $nowTxt = [string]$ts.Text.Story.Text
                    if ($nowTxt.Trim() -eq $targetStr.Trim()) { $tSet = $true }
                } catch {}
            }

            if ($story -and $textCase -and $textCase -ne 'none') {
                $cdrCaseEnum = switch ($textCase.ToLower()) {
                    'sentence' { 1 }
                    'lower'    { 2 }
                    'upper'    { 3 }
                    'title'    { 4 }
                    'toggle'   { 5 }
                    default    { 0 }
                }
                if ($cdrCaseEnum -gt 0) {
                    try { Com-Set $story 'Case' $cdrCaseEnum } catch {}
                }
            }

            $alignMode = if ($align) { $align.ToString().ToLower() } else { 'center' }
            if ($story) {
                try {
                    if ($alignMode -eq 'left') {
                        Com-Set $story 'Alignment' 1 # cdrLeftAlignment
                    } elseif ($alignMode -eq 'right') {
                        Com-Set $story 'Alignment' 2 # cdrRightAlignment
                    } else {
                        Com-Set $story 'Alignment' 3 # cdrCenterAlignment
                    }
                } catch {}
            }

            $curW = [double](Com-Get $ts 'SizeWidth')
            $curH = [double](Com-Get $ts 'SizeHeight')
            $targetLimit = [double]$maxWLimit
            $isLocked = if ($lockRatio -ne $null) { [bool]$lockRatio } else { $true }

            if ($targetLimit -gt 0 -and $curW -gt $targetLimit) {
                $scale = $targetLimit / $curW
                $newW = $targetLimit
                $newH = if ($isLocked -and $curH -gt 0) { $curH * $scale } else { $curH }
                try {
                    [void](Com-Call $ts 'SetSize' @([double]$newW, [double]$newH))
                } catch {
                    Com-Set $ts 'SizeWidth' ([double]$newW)
                    if ($isLocked) { Com-Set $ts 'SizeHeight' ([double]$newH) }
                }
            }

            if ($alignMode -eq 'left') {
                Com-Set $ts 'PositionX' ([double]$origLeft)
                Com-Set $ts 'CenterY' ([double]$origCenterY)
            } elseif ($alignMode -eq 'right') {
                $currW = [double](Com-Get $ts 'SizeWidth')
                Com-Set $ts 'PositionX' ([double](($origLeft + $origW) - $currW))
                Com-Set $ts 'CenterY' ([double]$origCenterY)
            } else {
                Com-Set $ts 'CenterX' ([double]$origCenterX)
                Com-Set $ts 'CenterY' ([double]$origCenterY)
            }
        } catch {}
    }

    function Find-AllShapeTexts($container) {
        $list = @()
        if ($null -eq $container) { return $list }
        $queue = [System.Collections.Queue]::new()
        if ($container -is [System.Array]) {
            foreach ($c in $container) { if ($c) { $queue.Enqueue($c) } }
        } else {
            $queue.Enqueue($container)
        }
        $visited = 0
        while ($queue.Count -gt 0 -and $visited -lt 4000) {
            $visited++
            $curr = $queue.Dequeue()
            if ($null -eq $curr) { continue }
            if ($curr -is [System.Array]) {
                if ($curr.Length -gt 0) { $curr = $curr[0] } else { continue }
            }
            $sType = 0
            try { $sType = [int](Com-Get $curr 'Type') } catch {}
            if ($sType -eq 6) {
                $list += $curr
                continue
            }
            $childShapes = $null
            try { $childShapes = Com-Get $curr 'Shapes' } catch {}
            if ($childShapes) {
                $cnt = 0
                try { $cnt = [int](Com-Get $childShapes 'Count') } catch {}
                if ($cnt -gt 0) {
                    for ($k = 1; $k -le $cnt; $k++) {
                        $ch = Com-Get $childShapes 'Item' @($k)
                        if ($ch) { $queue.Enqueue($ch) }
                    }
                }
            }
            try {
                $pc = Com-Get $curr 'PowerClip'
                if ($pc) {
                    $pcShps = Com-Get $pc 'Shapes'
                    if ($pcShps) {
                        $pCnt = [int](Com-Get $pcShps 'Count')
                        if ($pCnt -gt 0) {
                            for ($pk = 1; $pk -le $pCnt; $pk++) {
                                $pch = Com-Get $pcShps 'Item' @($pk)
                                if ($pch) { $queue.Enqueue($pch) }
                            }
                        }
                    }
                }
            } catch {}
        }
        return $list
    }

    function Get-MasterTextPaths($root) {
        $paths = [System.Collections.Generic.List[object]]::new()
        if ($null -eq $root) { return $paths }
        $q = [System.Collections.Queue]::new()
        $q.Enqueue(@{ Node = $root; Path = @() })
        $visited = 0
        while ($q.Count -gt 0 -and $visited -lt 4000) {
            $visited++
            $item = $q.Dequeue()
            $currNode = $item.Node
            $currPath = $item.Path
            if ($null -eq $currNode) { continue }
            if ($currNode -is [System.Array]) {
                if ($currNode.Length -gt 0) { $currNode = $currNode[0] } else { continue }
            }
            $sType = 0
            try { $sType = [int](Com-Get $currNode 'Type') } catch {}
            if ($sType -eq 6) {
                $paths.Add($currPath)
                continue
            }
            $childShapes = $null
            try { $childShapes = Com-Get $currNode 'Shapes' } catch {}
            if ($childShapes) {
                $cnt = 0
                try { $cnt = [int](Com-Get $childShapes 'Count') } catch {}
                if ($cnt -gt 0) {
                    for ($k = 1; $k -le $cnt; $k++) {
                        $ch = Com-Get $childShapes 'Item' @($k)
                        if ($ch) {
                            $newPath = @($currPath) + @($k)
                            $q.Enqueue(@{ Node = $ch; Path = $newPath })
                        }
                    }
                }
            }
            try {
                $pc = Com-Get $currNode 'PowerClip'
                if ($pc) {
                    $pcShps = Com-Get $pc 'Shapes'
                    if ($pcShps) {
                        $pCnt = [int](Com-Get $pcShps 'Count')
                        if ($pCnt -gt 0) {
                            for ($pk = 1; $pk -le $pCnt; $pk++) {
                                $pch = Com-Get $pcShps 'Item' @($pk)
                                if ($pch) {
                                    $newPath = @($currPath) + @("pc:$pk")
                                    $q.Enqueue(@{ Node = $pch; Path = $newPath })
                                }
                            }
                        }
                    }
                }
            } catch {}
        }
        return $paths
    }

    function Resolve-CardTextsByPaths($card, $paths) {
        $resultTexts = @()
        if (-not $card -or -not $paths -or $paths.Count -eq 0) { return $resultTexts }
        if ($card -is [System.Array]) {
            if ($card.Length -gt 0) { $card = $card[0] } else { return $resultTexts }
        }
        foreach ($p in $paths) {
            if ($null -eq $p -or $p.Length -eq 0) {
                $t = 0
                try { $t = [int](Com-Get $card 'Type') } catch {}
                if ($t -eq 6) { $resultTexts += $card }
                continue
            }
            $curr = $card
            $valid = $true
            for ($pi = 0; $pi -lt $p.Length; $pi++) {
                $step = [string]$p[$pi]
                if ($step.StartsWith("pc:")) {
                    $pk = [int]($step.Substring(3))
                    $pc = Com-Get $curr 'PowerClip'
                    if (-not $pc) { $valid = $false; break }
                    $pcShps = Com-Get $pc 'Shapes'
                    if (-not $pcShps) { $valid = $false; break }
                    $ch = Com-Get $pcShps 'Item' @($pk)
                    if (-not $ch) { $valid = $false; break }
                    $curr = $ch
                } else {
                    $idx = [int]$step
                    $shps = Com-Get $curr 'Shapes'
                    if (-not $shps) {
                        $ch = Com-Get $curr 'Item' @($idx)
                        if (-not $ch) { $valid = $false; break }
                        $curr = $ch
                        continue
                    }
                    $ch = Com-Get $shps 'Item' @($idx)
                    if (-not $ch) { $valid = $false; break }
                    $curr = $ch
                }
            }
            if ($valid -and $curr) {
                if ($curr -is [System.Array]) { if ($curr.Length -gt 0) { $curr = $curr[0] } }
                $t = [int](Com-Get $curr 'Type')
                if ($t -eq 6) { $resultTexts += $curr }
            }
        }
        return $resultTexts
    }

    function Get-MappingComb($mp) {
        if (-not $mp) { return '' }
        $a = if ($mp.placeholder) { [string]$mp.placeholder } else { '' }
        $b = if ($mp.label) { [string]$mp.label } else { '' }
        $c = if ($mp.column) { [string]$mp.column } else { '' }
        return ($a + ' ' + $b + ' ' + $c).ToLower()
    }

    function Get-ShapeMatchingMapping([string]$txt, $mappingsList) {
        if ([string]::IsNullOrWhiteSpace($txt) -or -not $mappingsList) { return $null }
        $tClean = $txt.Trim()
        $tNorm = $tClean.Trim('.', '[', ']', '{', '}', ':', ' ', '#', '"', "'", '-', '_')
        $tNormLow = $tNorm.ToLower()

        if ($tNormLow -match '^(kiri|_kiri|kanan|_kanan|depan|_depan|belakang|_belakang|tangan|_tangan|lengan|_lengan|kerah|_kerah|pola|_pola|badan|_badan)$') {
            return $null
        }

        foreach ($m in $mappingsList) {
            $ph = if ($m.placeholder) { [string]$m.placeholder.Trim() } else { '' }
            $bare = $ph.Trim('[', ']', '{', '}', '.', ':')
            $lbl = if ($m.label) { [string]$m.label.Trim() } else { '' }
            $col = if ($m.column) { [string]$m.column.Trim() } else { '' }

            if ($ph -and ($tClean -ieq $ph -or $tNormLow -ieq $ph.ToLower() -or $tClean -match ('^' + [regex]::Escape($ph) + '$'))) { return $m }
            if ($bare -and ($tClean -ieq $bare -or $tNormLow -ieq $bare.ToLower() -or $tClean -match ('^' + [regex]::Escape($bare) + '$'))) { return $m }
            if ($lbl -and ($tClean -ieq $lbl -or $tNormLow -ieq $lbl.ToLower())) { return $m }
            if ($col -and ($tClean -ieq $col -or $tNormLow -ieq $col.ToLower())) { return $m }
        }

        if ($tNormLow -match '^(nama|name|pemain|player|nama\\s*pemain|nama\\s*punggung|nama\\s*dada|nama\\s*lengkap)$' -or $tClean -match '^\[?(nama|name|pemain)\]?$') {
            foreach ($m in $mappingsList) {
                if ((Get-MappingComb $m) -match 'nama|name|pemain') { return $m }
            }
        }

        if ($tNorm -match '^\\d{1,4}$' -or
            $tNormLow -match '^(nomor|number|no|no\\.|no\\s*punggung|no\\s*dada|no\\s*celana|nomor\\s*punggung|nomor\\s*dada|nomor\\s*celana|#|00)$' -or
            $tNormLow -match '^(?:no|nomor|number)[\\s:\\.]*\\d{1,4}$' -or
            $tClean -match '^\[?(nomor|number|no|00|#)\]?$') {
            foreach ($m in $mappingsList) {
                if ((Get-MappingComb $m) -match 'nomor|number|no\\b|punggung|celana|dada|tangan|00|#') { return $m }
            }
        }

        if ($tNormLow -match '^(ukuran|size|size\\s*jersey|sz|label\\s*size|size\\s*label|label\\s*ukuran|ukuran\\s*label|size\\s*tag|tag\\s*size)$' -or
            $tNormLow -match '^(?:size|ukuran|sz)[\\s:\\-_]+(?:xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl|all|\\d{1,2}|\\[?(?:size|ukuran|sz)\\]?)?$' -or
            $tNormLow -match '^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl|all|all\\s*size)$' -or
            $tNormLow -match '^(xs|s|m|l|xl|xxl)\\s*anak$' -or
            $tClean -match '^\[?(ukuran|size|sz)\]?$') {
            foreach ($m in $mappingsList) {
                if ((Get-MappingComb $m) -match 'ukuran|size|sz') { return $m }
            }
        }

        return $null
    }

    function UpdateJerseyCard($cardShape, $player, $mappingsList, $fallbackMaxW, $cachedPaths = $null) {
        if (-not $cardShape -or -not $player) { return }
        $cardTexts = @()
        if ($cachedPaths -and $cachedPaths.Count -gt 0) {
            $cardTexts = @(Resolve-CardTextsByPaths $cardShape $cachedPaths)
        }
        if ($cardTexts.Count -eq 0) {
            $cardTexts = @(Find-AllShapeTexts $cardShape)
        }

        foreach ($ts in $cardTexts) {
            if (-not $ts) { continue }
            $txtObj = Com-Get $ts 'Text'
            if (-not $txtObj) { continue }
            $story = Com-Get $txtObj 'Story'
            $curText = if ($story) { [string](Com-Get $story 'Text') } else { '' }
            $curText = $curText.Trim()
            if ([string]::IsNullOrWhiteSpace($curText)) { continue }

            $m = Get-ShapeMatchingMapping $curText $mappingsList
            $val = $null
            $mW = $fallbackMaxW
            $lR = $true
            $align = 'center'
            $textCase = 'none'

            if ($m) {
                $val = Get-PlayerValueForMapping $player $m -1
                $mW = if ($m.maxWidth -and [double]$m.maxWidth -gt 0) { [double]$m.maxWidth } else { $fallbackMaxW }
                $lR = if ($m.lockRatio -ne $null) { [bool]$m.lockRatio } else { $true }
                $align = if ($m.align) { $m.align } else { 'center' }
                $textCase = if ($m.textCase) { $m.textCase } else { 'none' }
            }

            if ($null -eq $val -or $val -eq '') { continue }
            Apply-TextToShape $ts ([string]$val) $align $textCase $mW $lR
        }
    }

    $masterShape = $null
    try {
        $masterShape = Com-Call $selection 'Group'
        if (-not $masterShape) { try { $masterShape = $selection.Group() } catch {} }
    } catch {}
    if (-not $masterShape) { $masterShape = Get-RangeItem $selection 1 }
    if (-not $masterShape) { $masterShape = $selection }

    if (-not $masterShape) {
        throw "Gagal memproses objek master pola jersey di CorelDRAW."
    }
    $origMasterW = [double](Com-Get $masterShape 'SizeWidth')
    $origMasterH = [double](Com-Get $masterShape 'SizeHeight')
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
        }
        if (-not $entry) { return @{ targetW = $origW; targetH = $origH } }

        $tw = 0.0
        $th = 0.0
        $isLock = $true
        if ($entry.PSObject -and $entry.PSObject.Properties) {
            if ($entry.PSObject.Properties['height'] -and $entry.height -ne $null) { $th = [double]$entry.height }
            if ($entry.PSObject.Properties['width'] -and $entry.width -ne $null)   { $tw = [double]$entry.width }
            if ($entry.PSObject.Properties['lockRatio'] -and $entry.lockRatio -ne $null) { $isLock = [bool]$entry.lockRatio }
        }
        if ($th -gt 0 -and $tw -le 0 -and $isLock -and $mRatio -gt 0) {
            $tw = [math]::Round(($th * $mRatio), 3)
        } elseif ($tw -gt 0 -and $th -le 0 -and $isLock -and $mRatio -gt 0) {
            $th = [math]::Round(($tw / $mRatio), 3)
        } elseif ($tw -le 0 -and $th -le 0) {
            $tw = $origW
            $th = $origH
        }
        return @{ targetW = $tw; targetH = $th }
    }

    function Resize-JerseyShape($shp, [double]$targetW, [double]$targetH) {
        if (-not $shp -or $targetW -le 0 -or $targetH -le 0) { return }
        $curW = [double](Com-Get $shp 'SizeWidth')
        $curH = [double](Com-Get $shp 'SizeHeight')
        if ([math]::Abs($curW - $targetW) -lt 0.05 -and [math]::Abs($curH - $targetH) -lt 0.05) { return }
        try { $shp.SetSize([double]$targetW, [double]$targetH) } catch {}
        try { Com-Call $shp 'SetSize' @([double]$targetW, [double]$targetH) } catch {}
    }

    function Duplicate-JerseyShape($shp, $docRef) {
        if ($null -eq $shp) { return $null }
        try {
            $d = Com-Call $shp 'Duplicate' @([double]0.0, [double]0.0)
            if ($d) { return $d }
        } catch {}
        try {
            $d = $shp.Duplicate(0.0, 0.0)
            if ($d) { return $d }
        } catch {}
        return $null
    }

    function Move-JerseyCard($shp, [double]$px, [double]$py) {
        if (-not $shp) { return }
        try { [void](Com-Call $shp 'SetPosition' @([double]$px, [double]$py)) } catch {}
        try { $shp.SetPosition([double]$px, [double]$py) } catch {}
    }

    $commandGroupOpen = $false
    try {
        [void](Com-Call $doc 'BeginCommandGroup' @("CTS Auto-Layout Jersey"))
        $commandGroupOpen = $true
    } catch {}

    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}
    try { Com-Set $doc 'ReferencePoint' 1 } catch {}
    try { [void](Com-Call $doc 'ClearSelection') } catch {}

    $startX = [double](Com-Get $masterShape 'PositionX')
    $startY = [double](Com-Get $masterShape 'PositionY')
    $curPosX = $startX
    $curPosY = $startY
    $rowMaxH = 0.0
    $colMaxW = 0.0
    $rowCount = 0
    $colCount = 0

    $cardList = @()
    $cardList += $masterShape
    $cachedPaths = Get-MasterTextPaths $masterShape

    for ($i = 1; $i -lt $playerList.Count; $i++) {
        $dup = Duplicate-JerseyShape $masterShape $doc
        if ($dup) { $cardList += $dup }
    }

    $created = 0
    for ($i = 0; $i -lt $cardList.Count; $i++) {
        $card = $cardList[$i]
        $p = $playerList[$i]
        if (-not $card -or -not $p) { continue }

        $pSz = Get-FieldValue $p 'Ukuran'
        if (-not $pSz) { $pSz = Get-FieldValue $p 'Size' }

        $dim = Get-SizeDimensions $pSz $sizeChart $masterRatio $origMasterW $origMasterH
        $targetW = [double]$dim.targetW
        $targetH = [double]$dim.targetH

        if ($enableAutoResize -and $targetW -gt 0 -and $targetH -gt 0) {
            Resize-JerseyShape $card $targetW $targetH
        }

        $cardW = [double](Com-Get $card 'SizeWidth')
        $cardH = [double](Com-Get $card 'SizeHeight')
        if ($cardW -le 0) { $cardW = if ($targetW -gt 0) { $targetW } else { $origMasterW } }
        if ($cardH -le 0) { $cardH = if ($targetH -gt 0) { $targetH } else { $origMasterH } }

        if ($dir -eq 'horizontal') {
            if ($rowCount -ge $limit) {
                $curPosX = $startX
                $curPosY -= ($rowMaxH + $spacing)
                $rowCount = 0
                $rowMaxH = 0.0
            }
            Move-JerseyCard $card $curPosX $curPosY
            $rowMaxH = [math]::Max($rowMaxH, $cardH)
            $curPosX += ($cardW + $spacing)
            $rowCount++
        } else {
            if ($colCount -ge $limit) {
                $curPosY = $startY
                $curPosX += ($colMaxW + $spacing)
                $colCount = 0
                $colMaxW = 0.0
            }
            Move-JerseyCard $card $curPosX $curPosY
            $colMaxW = [math]::Max($colMaxW, $cardW)
            $curPosY -= ($cardH + $spacing)
            $colCount++
        }

        try {
            UpdateJerseyCard $card $p $mappings $maxW $cachedPaths
        } catch {}

        if ($autoCurves) {
            try {
                $cTexts = @(Resolve-CardTextsByPaths $card $cachedPaths)
                if ($cTexts.Count -eq 0) { $cTexts = @(Find-AllShapeTexts $card) }
                for ($ck = $cTexts.Count - 1; $ck -ge 0; $ck--) {
                    try { [void](Com-Call $cTexts[$ck] 'ConvertToCurves') } catch {}
                }
            } catch {}
        }

        $created++
    }

    try { [void](Com-Call $doc 'ClearSelection') } catch {}
    try { [void](Com-Call $corel 'ClearSelection') } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}

    $result.success = ($created -gt 0)
    $result.count = $created
    $result.message = "Berhasil menata $created pola jersey di CorelDRAW!"
} catch {
    $result.success = $false
    $result.message = $_.Exception.Message
} finally {
    if ($commandGroupOpen -and $doc) {
        try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
    }
    if ($null -ne $origDocUnit -and $doc) {
        try { Com-Set $doc 'Unit' $origDocUnit } catch {}
    }
    if ($corel) {
        try { Com-Set $corel 'EventsEnabled' $true } catch {}
        try { Com-Set $corel 'Optimization' $false } catch {}
        try { [void](Com-Call $corel 'Refresh') } catch {}
    }
    [GC]::Collect()
}
$result | ConvertTo-Json -Compress
`;

    fs.writeFileSync(tempPs1Path, psScript, 'utf-8');
    const dynamicTimeout = Math.max(600000, (dataList ? dataList.length : 20) * 15000);
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempPs1Path, tempJsonPath],
      { timeout: dynamicTimeout },
      (err, stdout, stderr) => {
        try {
          if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
          if (fs.existsSync(tempPs1Path)) fs.unlinkSync(tempPs1Path);
        } catch {}
        if (err && !stdout) {
          return resolve({ success: false, message: stderr || err?.message || 'Gagal menjalankan otomasi' });
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch {
          resolve({ success: false, message: stdout.trim() || stderr || 'Gagal memproses respon CorelDRAW' });
        }
      }
    );
  });
}

module.exports = {
  dedupeKeysCI,
  executeResizeLayout,
  executeLayout,
};
