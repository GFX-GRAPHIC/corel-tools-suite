/**
 * Certificate & Variable Data Mail Merge Service
 * Merges Excel datasets into CorelDRAW templates (Inplace, Page-by-Page, and Grid N-Up).
 * Includes robust Excel worksheet parsing and header detection.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('../core/electronBridge.cjs');
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript } = require('../core/psRunner.cjs');

function indexToLetter(idx) {
  let letter = '';
  let temp = idx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function parseExcelFile(payload) {
  try {
    let xlsx;
    try {
      xlsx = require('../xlsx.full.min.js');
    } catch {
      xlsx = require('xlsx');
    }
    let workbook = null;
    let targetPath = 'Data Excel';

    if (payload && payload.base64) {
      const buf = Buffer.from(payload.base64, 'base64');
      workbook = xlsx.read(buf, { type: 'buffer' });
      targetPath = payload.fileName || payload.filePath || 'Data Excel';
    } else if (payload && payload.buffer) {
      const buf = Buffer.isBuffer(payload.buffer) ? payload.buffer : Buffer.from(payload.buffer);
      workbook = xlsx.read(buf, { type: 'buffer' });
      targetPath = payload.fileName || payload.filePath || 'Data Excel';
    } else {
      let filePath = typeof payload === 'string' ? payload : payload?.filePath;
      if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
        return { success: false, message: 'File Excel tidak ditemukan.' };
      }
      const buf = fs.readFileSync(filePath);
      workbook = xlsx.read(buf, { type: 'buffer' });
      targetPath = filePath;
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, message: 'Lembar kerja Excel kosong.' };
    }

    const sheetsData = {};
    const sheetNames = workbook.SheetNames;
    const requestedSheet = (payload && typeof payload === 'object' && payload.sheetName) ? payload.sheetName : null;
    const activeSheet = (requestedSheet && sheetNames.includes(requestedSheet)) ? requestedSheet : sheetNames[0];

    for (const sName of sheetNames) {
      const ws = workbook.Sheets[sName];
      const rawData = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!rawData || rawData.length === 0) {
        sheetsData[sName] = { headers: [], rows: [], totalRows: 0, headerRowIdx: 0, rawData: [] };
        continue;
      }

      // Auto-detect header row
      let headerRowIdx = 0;
      let maxNonEmpty = 0;
      const scanLimit = Math.min(10, rawData.length);
      for (let r = 0; r < scanLimit; r++) {
        const row = rawData[r] || [];
        const count = row.filter(val => val !== undefined && val !== null && String(val).trim() !== '').length;
        if (count > maxNonEmpty) {
          maxNonEmpty = count;
          headerRowIdx = r;
        }
      }

      if (sName === activeSheet && payload && typeof payload === 'object' && typeof payload.headerRowIndex === 'number' && payload.headerRowIndex >= 0) {
        headerRowIdx = Math.min(payload.headerRowIndex, rawData.length - 1);
      }

      const headerRow = rawData[headerRowIdx] || [];
      const maxCols = Math.max(headerRow.length, ...rawData.map(r => (Array.isArray(r) ? r.length : 0)));

      const rows = [];
      for (let rIdx = headerRowIdx + 1; rIdx < rawData.length; rIdx++) {
        const rowValues = rawData[rIdx];
        if (!rowValues) continue;
        const hasData = rowValues.some(val => val !== undefined && val !== null && String(val).trim() !== '');
        if (!hasData) continue;

        const rowObj = {};
        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
          const letter = indexToLetter(colIdx);
          const cellVal = rowValues[colIdx];
          rowObj[letter] = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
        }
        rows.push(rowObj);
      }

      const headers = [];
      for (let colIdx = 0; colIdx < maxCols; colIdx++) {
        const letter = indexToLetter(colIdx);
        const rawName = (headerRow[colIdx] !== undefined && headerRow[colIdx] !== null) ? String(headerRow[colIdx]).trim() : '';
        const name = rawName || `Kolom ${letter}`;
        let sample = '';
        for (const r of rows) {
          if (r[letter] && r[letter].trim() !== '') {
            sample = r[letter].trim();
            if (sample.length > 25) sample = sample.substring(0, 22) + '...';
            break;
          }
        }
        const label = sample ? `${letter}: ${name} (Contoh: ${sample})` : `${letter}: ${name}`;
        headers.push({ letter, name, sample, label });
      }

      sheetsData[sName] = { headers, rows, totalRows: rows.length, headerRowIdx, rawData };
    }

    const primary = sheetsData[activeSheet] || { headers: [], rows: [], totalRows: 0, headerRowIdx: 0, rawData: [] };
    return {
      success: true,
      filePath: targetPath,
      sheetNames,
      activeSheet,
      sheetsData,
      headers: primary.headers,
      rows: primary.rows,
      totalRows: primary.totalRows,
      headerRowIdx: primary.headerRowIdx,
      rawData: primary.rawData
    };
  } catch (err) {
    return { success: false, message: `Gagal membaca Excel: ${err?.message || err}` };
  }
}

async function executeCertMergerWorkflow(payload) {
  const {
    rows = [],
    mappings = [],
    mode = 'page',
    autoCurves = true,
    cols = 2,
    gridRows = 5,
    spacingX = 0.5,
    spacingY = 0.5,
    gridOrder = 'left_right',
  } = payload || {};

  if (!rows || rows.length === 0) {
    return { success: false, message: 'Tidak ada data baris Excel yang diproses.' };
  }
  if (!mappings || mappings.length === 0) {
    return { success: false, message: 'Tidak ada pemetaan variabel teks yang ditentukan.' };
  }

  const tempDir = app.getPath('temp');
  const timestamp = Date.now();
  const tempJsonPath = path.join(tempDir, `corel_cert_data_${timestamp}.json`);

  try {
    fs.writeFileSync(
      tempJsonPath,
      JSON.stringify({
        rows,
        mappings,
        mode,
        autoCurves,
        cols: Number(cols) || 2,
        gridRows: Number(gridRows) || 5,
        spacingX: Number(spacingX) >= 0 ? Number(spacingX) : 0.5,
        spacingY: Number(spacingY) >= 0 ? Number(spacingY) : 0.5,
        gridOrder: gridOrder || 'left_right'
      }),
      'utf-8'
    );
  } catch (err) {
    return { success: false, message: `Gagal menyiapkan file data: ${err.message}` };
  }

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

function Replace-ShapeText($shp, $findText, $replaceVal, $optWidth, $optHeight, $lockRatio, $fitMode, $align, $docPage, $textCase = 'none') {
    if (-not $shp) { return $false }
    $replaced = $false
    $sType = 0
    try { $sType = [int](Com-Get $shp 'Type') } catch {}
    if ($sType -eq 6) {
        $hasMatch = $false
        $story = $null
        $cur = ""
        try {
            $txtObj = Com-Get $shp 'Text'
            if ($txtObj) {
                $story = Com-Get $txtObj 'Story'
                if ($story) {
                    $cur = [string](Com-Get $story 'Text')
                    if ($cur -and $cur -match [regex]::Escape($findText)) {
                        $hasMatch = $true
                    }
                }
            }
        } catch {}

        if ($hasMatch -and $story) {
            if ($textCase -and $textCase -ne 'none') {
                $replaceVal = Convert-TextCase $replaceVal $textCase
            }

            $origCenterX = [double](Com-Get $shp 'CenterX')
            $origCenterY = [double](Com-Get $shp 'CenterY')
            $origLeft = [double](Com-Get $shp 'PositionX')
            $origTop = [double](Com-Get $shp 'PositionY')
            $origW = [double](Com-Get $shp 'SizeWidth')
            $origH = [double](Com-Get $shp 'SizeHeight')

            try {
                if ($cur.Trim() -ieq $findText.Trim()) {
                    Com-Set $story 'Text' ([string]$replaceVal)
                    $replaced = $true
                } else {
                    $pattern = [regex]::Escape($findText)
                    $newStr = [regex]::Replace($cur, $pattern, [string]$replaceVal, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                    Com-Set $story 'Text' $newStr
                    $replaced = $true
                }
            } catch {}

            if ($replaced) {
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
                        try { Com-Set $story 'Case' $cdrCaseEnum } catch {}
                    }
                }

                try {
                    if ($align -eq 'center' -or $align -eq 'page_center') {
                        Com-Set $story 'Alignment' 3 # cdrCenterAlignment
                    } elseif ($align -eq 'left') {
                        Com-Set $story 'Alignment' 1 # cdrLeftAlignment
                    } elseif ($align -eq 'right') {
                        Com-Set $story 'Alignment' 2 # cdrRightAlignment
                    }
                } catch {}

                try {
                    $targetW = [double]$optWidth
                    $targetH = [double]$optHeight
                    $isLocked = [bool]$lockRatio
                    $modeFit = if ($fitMode) { [string]$fitMode } else { 'max' }

                    $curW = [double](Com-Get $shp 'SizeWidth')
                    $curH = [double](Com-Get $shp 'SizeHeight')

                    if ($modeFit -eq 'max') {
                        $scale = 1.0
                        if ($targetW -gt 0 -and $curW -gt $targetW) {
                            $scale = $targetW / $curW
                        }
                        if ($targetH -gt 0 -and $curH -gt $targetH) {
                            $scaleH = $targetH / $curH
                            if ($isLocked) {
                                $scale = [math]::Min($scale, $scaleH)
                            }
                        }
                        if ($scale -lt 0.999) {
                            $newW = $curW * $scale
                            $newH = if ($isLocked) { $curH * $scale } else { $curH }
                            try { [void](Com-Call $shp 'SetSize' @([double]$newW, [double]$newH)) } catch {
                                Com-Set $shp 'SizeWidth' ([double]$newW)
                                if ($isLocked) { Com-Set $shp 'SizeHeight' ([double]$newH) }
                            }
                        }
                    } else {
                        if ($targetW -gt 0 -and $targetH -gt 0) {
                            if ($isLocked) {
                                if ($curW -gt 0 -and $curH -gt 0) {
                                    $scaleW = $targetW / $curW
                                    $scaleH = $targetH / $curH
                                    $scale = [math]::Min($scaleW, $scaleH)
                                    $newW = $curW * $scale
                                    $newH = $curH * $scale
                                    try { [void](Com-Call $shp 'SetSize' @([double]$newW, [double]$newH)) } catch {
                                        Com-Set $shp 'SizeWidth' ([double]$newW)
                                        Com-Set $shp 'SizeHeight' ([double]$newH)
                                    }
                                }
                            } else {
                                try { [void](Com-Call $shp 'SetSize' @([double]$targetW, [double]$targetH)) } catch {
                                    Com-Set $shp 'SizeWidth' ([double]$targetW)
                                    Com-Set $shp 'SizeHeight' ([double]$targetH)
                                }
                            }
                        } elseif ($targetW -gt 0) {
                            if ($curW -gt 0) {
                                $scale = $targetW / $curW
                                if ($isLocked -and $curH -gt 0) {
                                    $newH = $curH * $scale
                                    try { [void](Com-Call $shp 'SetSize' @([double]$targetW, [double]$newH)) } catch {
                                        Com-Set $shp 'SizeWidth' ([double]$targetW)
                                        Com-Set $shp 'SizeHeight' ([double]$newH)
                                    }
                                } else {
                                    Com-Set $shp 'SizeWidth' ([double]$targetW)
                                }
                            }
                        } elseif ($targetH -gt 0) {
                            if ($curH -gt 0) {
                                $scale = $targetH / $curH
                                if ($isLocked -and $curW -gt 0) {
                                    $newW = $curW * $scale
                                    try { [void](Com-Call $shp 'SetSize' @([double]$newW, [double]$targetH)) } catch {
                                        Com-Set $shp 'SizeWidth' ([double]$newW)
                                        Com-Set $shp 'SizeHeight' ([double]$targetH)
                                    }
                                } else {
                                    Com-Set $shp 'SizeHeight' ([double]$targetH)
                                }
                            }
                        }
                    }
                } catch {}

                try {
                    if ($align -eq 'page_center') {
                        $pCenter = $null
                        if ($docPage) {
                            try { $pCenter = [double](Com-Get $docPage 'CenterX') } catch {}
                        }
                        if ($pCenter -and $pCenter -gt 0) {
                            Com-Set $shp 'CenterX' ([double]$pCenter)
                        } else {
                            Com-Set $shp 'CenterX' ([double]$origCenterX)
                        }
                        Com-Set $shp 'CenterY' ([double]$origCenterY)
                    } elseif ($align -eq 'center' -or -not $align) {
                        Com-Set $shp 'CenterX' ([double]$origCenterX)
                        Com-Set $shp 'CenterY' ([double]$origCenterY)
                    } elseif ($align -eq 'left') {
                        Com-Set $shp 'PositionX' ([double]$origLeft)
                        Com-Set $shp 'CenterY' ([double]$origCenterY)
                    } elseif ($align -eq 'right') {
                        $nowW = [double](Com-Get $shp 'SizeWidth')
                        Com-Set $shp 'PositionX' ([double](($origLeft + $origW) - $nowW))
                        Com-Set $shp 'CenterY' ([double]$origCenterY)
                    }
                } catch {}
            }
        }
    }
    return $replaced
}

function Get-AllTextShapes($container) {
    $list = @()
    if (-not $container) { return $list }
    try {
        $cType = [int](Com-Get $container 'Type')
        if ($cType -eq 6) {
            $list += ,$container
            return $list
        }
    } catch {}

    try {
        $shps = Com-Get $container 'Shapes'
        $cnt = if ($shps) { [int](Com-Get $shps 'Count') } else { 0 }
        for ($k = 1; $k -le $cnt; $k++) {
            $s = Com-Get $shps 'Item' @($k)
            if (-not $s) { continue }
            $sType = [int](Com-Get $s 'Type')
            if ($sType -eq 6) {
                $list += ,$s
            } elseif ($sType -eq 7) {
                $sub = @(Get-AllTextShapes $s)
                if ($sub.Count -gt 0) { $list += $sub }
            }
            try {
                $pc = Com-Get $s 'PowerClip'
                if ($pc) {
                    $pcSub = @(Get-AllTextShapes $pc)
                    if ($pcSub.Count -gt 0) { $list += $pcSub }
                }
            } catch {}
        }
    } catch {}
    return $list
}

function Apply-RowReplacement($textList, $rowObj, $mapList, $docPage = $null) {
    if (-not $textList -or -not $rowObj -or -not $mapList) { return }
    foreach ($m in $mapList) {
        $ph = [string]$m.placeholder
        $col = [string]$m.column
        if (-not $col -and $m.col) { $col = [string]$m.col }
        if (-not $ph) { continue }
        $val = ""
        if ($col -and $rowObj.PSObject.Properties[$col]) {
            $val = [string]($rowObj.$col)
        } elseif ($ph -and $rowObj.PSObject.Properties[$ph]) {
            $val = [string]($rowObj.$ph)
        }
        if ($null -eq $val) { $val = "" }

        $w = if ($m.width) { [double]$m.width } else { 0 }
        $h = if ($m.height) { [double]$m.height } else { 0 }
        $lock = if ($m.PSObject.Properties['lockRatio'] -and $m.lockRatio -ne $null) { [bool]$m.lockRatio } else { $true }
        $fit = if ($m.fitMode) { [string]$m.fitMode } else { 'max' }
        $al = if ($m.align) { [string]$m.align } else { 'center' }
        $tc = if ($m.textCase) { [string]$m.textCase } else { 'none' }

        foreach ($t in $textList) {
            [void](Replace-ShapeText $t $ph $val $w $h $lock $fit $al $docPage $tc)
        }
    }
}

function Convert-TextsToCurves($textList) {
    if (-not $textList) { return }
    for ($k = $textList.Count - 1; $k -ge 0; $k--) {
        try {
            $t = $textList[$k]
            if ($t -and [int](Com-Get $t 'Type') -eq 6) {
                try { [void](Com-Call $t 'ConvertToCurves') } catch {}
            }
        } catch {}
    }
}

try {
    $jsonPath = '${tempJsonPath.replace(/'/g, "''")}'
    $jsonRaw = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
    $data = $jsonRaw | ConvertFrom-Json
    $rows = $data.rows
    $mappings = $data.mappings
    $mode = [string]$data.mode
    $autoCurves = [bool]$data.autoCurves
    $cols = if ($data.cols) { [int]$data.cols } else { 2 }
    $gridRows = if ($data.gridRows) { [int]$data.gridRows } else { 5 }
    $spacingX = if ($null -ne $data.spacingX) { [double]$data.spacingX } else { 0.5 }
    $spacingY = if ($null -ne $data.spacingY) { [double]$data.spacingY } else { 0.5 }
    $gridOrder = if ($data.gridOrder) { [string]$data.gridOrder } else { 'left_right' }

    $sortedMappings = @($mappings | Sort-Object -Property @{ Expression = { $_.placeholder.Length }; Descending = $true })

${getCorelConnectPs()}

    if (-not $doc) {
        throw "Tidak ada dokumen template yang terbuka di CorelDRAW. Buka file sertifikat Anda terlebih dahulu."
    }

    try { Com-Set $corel 'Optimization' $true } catch {}
    try { Com-Set $corel 'EventsEnabled' $false } catch {}
    try { [void](Com-Call $doc 'BeginCommandGroup' @("CTS Batch Certificate Mail Merge")) } catch {}
    $origDocUnit = $null
    try { $origDocUnit = Com-Get $doc 'Unit' } catch {}
    try { Com-Set $doc 'Unit' 4 } catch {} # cdrCentimeter

    $totalRows = $rows.Count

    if ($mode -eq 'inplace') {
        $selInfo = Get-CorelSelection $corel $doc
        if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }
        $targetContainer = if ($selInfo.SelCount -gt 0) { $selInfo.Selection } else { $null }
        if (-not $targetContainer) {
            $targetContainer = Com-Get $doc 'ActivePage'
            if (-not $targetContainer) {
                $pgs = Com-Get $doc 'Pages'
                $targetContainer = Com-Get $pgs 'Item' @(1)
            }
        }

        $texts = @(Get-AllTextShapes $targetContainer)
        if ($texts.Count -eq 0) {
            throw "Tidak ditemukan objek teks pada seleksi/halaman aktif CorelDRAW."
        }

        $actPg = Com-Get $doc 'ActivePage'
        Apply-RowReplacement $texts $rows[0] $sortedMappings $actPg
        if ($autoCurves) {
            Convert-TextsToCurves $texts
        }

        $result.count = 1
        $result.totalPages = 1
    }
    elseif ($mode -eq 'grid') {
        try { Com-Set $doc 'Unit' 4 } catch {}

        $selInfo = Get-CorelSelection $corel $doc
        $sel = $selInfo.Selection
        $selCount = [int]$selInfo.SelCount
        if ($selInfo.SwitchedDoc) { $doc = $selInfo.SwitchedDoc }

        $masterPage = Com-Get $doc 'ActivePage'
        if (-not $masterPage) {
            $pgs = Com-Get $doc 'Pages'
            $masterPage = Com-Get $pgs 'Item' @(1)
        }
        try { [void](Com-Call $masterPage 'Activate') } catch {}

        $masterShape = $null
        if ($selCount -gt 1) {
            $masterShape = Com-Call $sel 'Group'
        } elseif ($selCount -eq 1) {
            $masterShape = Get-RangeItem $sel 1
            if (-not $masterShape -and $sel) { $masterShape = $sel }
        } else {
            $mpShapes = Com-Get $masterPage 'Shapes'
            $mpCount = if ($mpShapes) { [int](Com-Get $mpShapes 'Count') } else { 0 }
            if ($mpCount -gt 1) {
                $allRange = Com-Call $mpShapes 'All'
                $masterShape = Com-Call $allRange 'Group'
            } elseif ($mpCount -eq 1) {
                $masterShape = Com-Get $mpShapes 'Item' @(1)
            }
        }

        if (-not $masterShape) {
            throw "Gagal mendapatkan objek desain master di CorelDRAW."
        }

        $w = [double](Com-Get $masterShape 'SizeWidth')
        $h = [double](Com-Get $masterShape 'SizeHeight')
        $origX = [double](Com-Get $masterShape 'PositionX')
        $origY = [double](Com-Get $masterShape 'PositionY')

        $perPage = [int]($cols * $gridRows)
        if ($perPage -lt 1) { $perPage = 1 }
        $totalPages = [int][math]::Ceiling($totalRows / $perPage)

        $page1Shapes = @()
        for ($r = 0; $r -lt $gridRows; $r++) {
            for ($c = 0; $c -lt $cols; $c++) {
                $targetPosX = $origX + ($c * ($w + $spacingX))
                $targetPosY = $origY - ($r * ($h + $spacingY))

                if ($r -eq 0 -and $c -eq 0) {
                    Com-Set $masterShape 'PositionX' ([double]$targetPosX)
                    Com-Set $masterShape 'PositionY' ([double]$targetPosY)
                    $page1Shapes += ,$masterShape
                } else {
                    $dup = Com-Call $masterShape 'Duplicate'
                    Com-Set $dup 'PositionX' ([double]$targetPosX)
                    Com-Set $dup 'PositionY' ([double]$targetPosY)
                    $page1Shapes += ,$dup
                }
            }
        }

        if ($totalPages -gt 1) {
            try { [void](Com-Call $masterPage 'Activate') } catch {}
            $mpShapes = Com-Get $masterPage 'Shapes'
            $mpAll = Com-Call $mpShapes 'All'
            [void](Com-Call $mpAll 'Copy')

            for ($p = 2; $p -le $totalPages; $p++) {
                $newPage = Com-Call $doc 'AddPages' @(1)
                try { [void](Com-Call $newPage 'Activate') } catch {}
                $pIdx = $p - 1

                $actLyr = Com-Get $doc 'ActiveLayer'
                [void](Com-Call $actLyr 'Paste')

                $npShapes = Com-Get $newPage 'Shapes'
                $npCount = if ($npShapes) { [int](Com-Get $npShapes 'Count') } else { 0 }
                $newShapes = @()
                for ($k = 1; $k -le $npCount; $k++) {
                    $shp = Com-Get $npShapes 'Item' @($k)
                    $newShapes += [PSCustomObject]@{
                        Shape = $shp
                        PosX = [double](Com-Get $shp 'PositionX')
                        PosY = [double](Com-Get $shp 'PositionY')
                        Height = [double](Com-Get $shp 'SizeHeight')
                    }
                }

                $rowTol = [math]::Max(0.2, $h * 0.35)
                $sortedVouchers = @($newShapes | Sort-Object -Property @{ Expression = { [math]::Round($_.PosY / $rowTol) }; Descending = $true }, @{ Expression = { $_.PosX }; Descending = $false })

                for ($s = 0; $s -lt $sortedVouchers.Count; $s++) {
                    $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) + $pIdx } else { ($pIdx * $perPage) + $s }
                    if ($itemIdx -lt $totalRows) {
                        try {
                            $voucherShape = $sortedVouchers[$s].Shape
                            $shpTexts = @(Get-AllTextShapes $voucherShape)
                            Apply-RowReplacement $shpTexts $rows[$itemIdx] $sortedMappings $newPage
                            if ($autoCurves) { Convert-TextsToCurves $shpTexts }
                        } catch {}
                    } else {
                        try { [void](Com-Call $sortedVouchers[$s].Shape 'Delete') } catch {}
                    }
                }
            }
        }

        try { [void](Com-Call $masterPage 'Activate') } catch {}
        for ($s = 0; $s -lt $page1Shapes.Count; $s++) {
            $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) } else { $s }
            if ($itemIdx -lt $totalRows) {
                try {
                    $voucherShape = $page1Shapes[$s]
                    $shpTexts = @(Get-AllTextShapes $voucherShape)
                    Apply-RowReplacement $shpTexts $rows[$itemIdx] $sortedMappings $masterPage
                    if ($autoCurves) { Convert-TextsToCurves $shpTexts }
                } catch {}
            } else {
                try { [void](Com-Call $page1Shapes[$s] 'Delete') } catch {}
            }
        }

        $result.count = $totalRows
        $result.totalPages = $totalPages
    }
    else {
        # MODE PAGE
        $masterPage = Com-Get $doc 'ActivePage'
        if (-not $masterPage) {
            $pgs = Com-Get $doc 'Pages'
            $masterPage = Com-Get $pgs 'Item' @(1)
        }
        try { [void](Com-Call $masterPage 'Activate') } catch {}

        $mpShapes = Com-Get $masterPage 'Shapes'
        $mpCount = if ($mpShapes) { [int](Com-Get $mpShapes 'Count') } else { 0 }
        if ($mpCount -eq 0) {
            throw "Halaman template sertifikat masih kosong."
        }

        if ($totalRows -gt 1) {
            $mpAll = Com-Call $mpShapes 'All'
            [void](Com-Call $mpAll 'Copy')

            for ($i = 1; $i -lt $totalRows; $i++) {
                try {
                    $newPage = Com-Call $doc 'AddPages' @(1)
                    try { [void](Com-Call $newPage 'Activate') } catch {}
                    $actLyr = Com-Get $doc 'ActiveLayer'
                    [void](Com-Call $actLyr 'Paste')

                    $newTexts = @(Get-AllTextShapes $newPage)
                    Apply-RowReplacement $newTexts $rows[$i] $sortedMappings $newPage
                    if ($autoCurves) { Convert-TextsToCurves $newTexts }
                } catch {}
            }
        }

        try { [void](Com-Call $masterPage 'Activate') } catch {}
        try {
            $masterTexts = @(Get-AllTextShapes $masterPage)
            Apply-RowReplacement $masterTexts $rows[0] $sortedMappings $masterPage
            if ($autoCurves) { Convert-TextsToCurves $masterTexts }
        } catch {}

        $result.count = $totalRows
        $result.totalPages = $totalRows
    }

    try { [void](Com-Call $doc 'ClearSelection') } catch {}
    try { [void](Com-Call $corel 'ClearSelection') } catch {}
    if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
    try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
    try { Com-Set $corel 'Optimization' $false } catch {}
    try { Com-Set $corel 'EventsEnabled' $true } catch {}
    try { [void](Com-Call $corel 'Refresh') } catch {}

    $result.success = $true
    if ($mode -eq 'grid') {
        $result.message = "Berhasil menata $($result.count) desain dalam Grid $cols x $gridRows pada $($result.totalPages) lembar cetak di CorelDRAW!"
    } elseif ($mode -eq 'inplace') {
        $result.message = "Berhasil mengganti data teks pada objek aktif di CorelDRAW!"
    } else {
        $result.message = "Berhasil membuat $($result.count) sertifikat pada $($result.totalPages) halaman di CorelDRAW!"
    }
}
catch {
    try {
        if ($doc) {
            if ($null -ne $origDocUnit) { try { Com-Set $doc 'Unit' $origDocUnit } catch {} }
            try { [void](Com-Call $doc 'EndCommandGroup') } catch {}
        }
        try { Com-Set $corel 'Optimization' $false } catch {}
        try { Com-Set $corel 'EventsEnabled' $true } catch {}
        try { [void](Com-Call $corel 'Refresh') } catch {}
    } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message)"
} finally {
    if (Test-Path $jsonPath) { try { Remove-Item -Path $jsonPath -Force } catch {} }
    if ($doc) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
    if ($corel) { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($corel) | Out-Null } catch {} }
    [GC]::Collect()
}

$result | ConvertTo-Json -Compress
`;

  const dynamicTimeout = Math.max(600000, (rows ? rows.length : 10) * 5000);
  return runPowerShellScript(psScript, dynamicTimeout);
}

module.exports = {
  indexToLetter,
  parseExcelFile,
  executeCertMergerWorkflow,
};
