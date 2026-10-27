/**
 * Certificate & Variable Data Mail Merge Service
 * Merges Excel datasets into CorelDRAW templates (Inplace, Page-by-Page, and Grid N-Up).
 * Includes robust Excel worksheet parsing and header detection.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('../core/electronBridge.cjs');
const { getCorelConnectPs } = require('../core/corelConnection.cjs');
const { runPowerShellScript, getCancelFlagPath } = require('../core/psRunner.cjs');

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
        const originalName = (headerRow[colIdx] !== undefined && headerRow[colIdx] !== null) ? String(headerRow[colIdx]).trim() : '';
        const colName = originalName || `Kolom ${letter}`;

        let sample = '';
        for (const r of rows) {
          if (r[letter] && String(r[letter]).trim() !== '') {
            sample = String(r[letter]).trim();
            if (sample.length > 25) sample = sample.substring(0, 22) + '...';
            break;
          }
        }

        const label = sample
          ? `${letter}: ${colName} (Contoh: ${sample})`
          : `${letter}: ${colName}`;
        const displayName = originalName ? `${letter} : ${originalName}` : `${letter} : Kolom ${letter}`;
        const placeholder = `[${originalName || letter}]`;

        headers.push({
          letter,
          name: colName,
          label,
          sample,
          originalName,
          displayName,
          placeholder,
        });
      }

      sheetsData[sName] = {
        headers,
        rows,
        totalRows: rows.length,
        headerRowIdx,
        rawData: rawData.slice(0, 15),
      };
    }

    return {
      success: true,
      filePath: targetPath,
      sheetNames,
      activeSheet,
      sheets: sheetsData,
      headers: sheetsData[activeSheet]?.headers || [],
      rows: sheetsData[activeSheet]?.rows || [],
      totalRows: sheetsData[activeSheet]?.totalRows || 0,
      headerRowIdx: sheetsData[activeSheet]?.headerRowIdx || 0,
    };
  } catch (err) {
    return { success: false, message: `Gagal membaca Excel: ${err?.message || err}` };
  }
}

async function executeCertMerger(payload) {
  const tempDir = app.getPath('temp');
  const tempJsonPath = path.join(tempDir, `corel_cert_data_${Date.now()}.json`);
  const cancelFlagPath = getCancelFlagPath().replace(/\\/g, '\\\\');

  try {
    fs.writeFileSync(tempJsonPath, JSON.stringify(payload || {}), 'utf-8');
  } catch (e) {
    return { success: false, message: `Gagal menyimpan data sementara: ${e.message}` };
  }

  const psScript = `
$ErrorActionPreference = 'Stop'
$result = @{ success = $false; message = ''; count = 0; totalPages = 0 }
$cancelFlagPath = "${cancelFlagPath}"

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

function Convert-TextCase([string]$text, [string]$caseMode) {
    if (-not $text) { return "" }
    switch ($caseMode.ToLower()) {
        'upper'    { return $text.ToUpper() }
        'lower'    { return $text.ToLower() }
        'title'    {
            $ti = (Get-Culture).TextInfo
            return $ti.ToTitleCase($text.ToLower())
        }
        'sentence' {
            if ($text.Length -le 1) { return $text.ToUpper() }
            return $text.Substring(0, 1).ToUpper() + $text.Substring(1).ToLower()
        }
        'toggle'   {
            $chars = $text.ToCharArray()
            for ($i = 0; $i -lt $chars.Length; $i++) {
                if ([char]::IsUpper($chars[$i])) { $chars[$i] = [char]::ToLower($chars[$i]) }
                elseif ([char]::IsLower($chars[$i])) { $chars[$i] = [char]::ToUpper($chars[$i]) }
            }
            return -join $chars
        }
        default { return $text }
    }
}

function Replace-ShapeText($shp, [string]$findText, [string]$replaceVal, [double]$optWidth, [double]$optHeight, [bool]$lockRatio, [string]$fitMode, [string]$align, $docPage, [string]$textCase) {
    $replaced = $false
    if (-not $shp) { return $false }

    try {
        if ($shp.Type -eq 6) {
            $story = $shp.Text.Story
            $cur = [string]$story.Text
            $hasMatch = $false

            if ($cur -and $findText) {
                $cTrim = $cur.Trim()
                $fTrim = $findText.Trim()
                if ($cTrim -ieq $fTrim) {
                    $hasMatch = $true
                } elseif ($cur -match [regex]::Escape($findText)) {
                    $hasMatch = $true
                } elseif ($fTrim.StartsWith('[') -and $fTrim.EndsWith(']') -and ($cTrim -ieq $fTrim.Substring(1, $fTrim.Length - 2).Trim())) {
                    $hasMatch = $true
                } elseif (($cTrim -ieq "[$fTrim]") -or ($cTrim -ieq "{$fTrim}") -or ($cTrim -ieq "<$fTrim>")) {
                    $hasMatch = $true
                }
            }

            if ($hasMatch) {
                if ($textCase -and $textCase -ne 'none') {
                    $replaceVal = Convert-TextCase $replaceVal $textCase
                }

                $origCenterX = [double]$shp.CenterX
                $origCenterY = [double]$shp.CenterY
                $origLeft = [double]$shp.PositionX
                $origTop = [double]$shp.PositionY
                $origW = [double]$shp.SizeWidth
                $origH = [double]$shp.SizeHeight

                try {
                    $cTrim = $cur.Trim()
                    $fTrim = $findText.Trim()
                    if ($cTrim -ieq $fTrim -or $cTrim -ieq "[$fTrim]" -or $cTrim -ieq "{$fTrim}" -or $cTrim -ieq "<$fTrim>") {
                        $story.Text = [string]$replaceVal
                        $replaced = $true
                    } else {
                        $pattern = [regex]::Escape($findText)
                        $newStr = [regex]::Replace($cur, $pattern, [string]$replaceVal, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                        $story.Text = $newStr
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
                            try { $story.Case = $cdrCaseEnum } catch {}
                        }
                    }

                    try {
                        if ($align -eq 'center' -or $align -eq 'page_center') {
                            $story.Alignment = 3 # cdrCenterAlignment
                        } elseif ($align -eq 'left') {
                            $story.Alignment = 1 # cdrLeftAlignment
                        } elseif ($align -eq 'right') {
                            $story.Alignment = 2 # cdrRightAlignment
                        }
                    } catch {}

                    try {
                        $targetW = [double]$optWidth
                        $targetH = [double]$optHeight
                        $isLocked = [bool]$lockRatio
                        $modeFit = if ($fitMode) { [string]$fitMode } else { 'max' }

                        $curW = [double]$shp.SizeWidth
                        $curH = [double]$shp.SizeHeight

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
                                try { $shp.SetSize($newW, $newH) } catch {
                                    $shp.SizeWidth = $newW
                                    if ($isLocked) { $shp.SizeHeight = $newH }
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
                                        try { $shp.SetSize($newW, $newH) } catch {
                                            $shp.SizeWidth = $newW
                                            $shp.SizeHeight = $newH
                                        }
                                    }
                                } else {
                                    try { $shp.SetSize($targetW, $targetH) } catch {
                                        $shp.SizeWidth = $targetW
                                        $shp.SizeHeight = $targetH
                                    }
                                }
                            } elseif ($targetW -gt 0) {
                                if ($curW -gt 0) {
                                    $scale = $targetW / $curW
                                    if ($isLocked -and $curH -gt 0) {
                                        $newH = $curH * $scale
                                        try { $shp.SetSize($targetW, $newH) } catch {
                                            $shp.SizeWidth = $targetW
                                            $shp.SizeHeight = $newH
                                        }
                                    } else {
                                        $shp.SizeWidth = $targetW
                                    }
                                }
                            } elseif ($targetH -gt 0) {
                                if ($curH -gt 0) {
                                    $scale = $targetH / $curH
                                    if ($isLocked -and $curW -gt 0) {
                                        $newW = $curW * $scale
                                        try { $shp.SetSize($newW, $targetH) } catch {
                                            $shp.SizeWidth = $newW
                                            $shp.SizeHeight = $targetH
                                        }
                                    } else {
                                        $shp.SizeHeight = $targetH
                                    }
                                }
                            }
                        }
                    } catch {}

                    try {
                        if ($align -eq 'page_center') {
                            $pCenter = $null
                            if ($docPage) {
                                try { $pCenter = [double]$docPage.CenterX } catch {}
                            }
                            if (-not $pCenter) {
                                try { $pCenter = [double]$shp.Layer.Page.CenterX } catch {}
                            }
                            if ($pCenter -and $pCenter -gt 0) {
                                $shp.CenterX = $pCenter
                            } else {
                                $shp.CenterX = $origCenterX
                            }
                            $shp.CenterY = $origCenterY
                        } elseif ($align -eq 'center' -or -not $align) {
                            $shp.CenterX = $origCenterX
                            $shp.CenterY = $origCenterY
                        } elseif ($align -eq 'left') {
                            $shp.PositionX = $origLeft
                            $shp.CenterY = $origCenterY
                        } elseif ($align -eq 'right') {
                            $shp.PositionX = ($origLeft + $origW) - $shp.SizeWidth
                            $shp.CenterY = $origCenterY
                        }
                    } catch {}
                }
            }
        }
    } catch {}
    return $replaced
}

function Get-ValidTargetLayer($page, $doc) {
    if (-not $page) { return $doc.ActiveLayer }
    try {
        $lyr = $page.ActiveLayer
        if ($lyr -and -not $lyr.Master) { return $lyr }
    } catch {}
    try {
        for ($li = 1; $li -le $page.Layers.Count; $li++) {
            $l = $page.Layers.Item($li)
            if ($l -and -not $l.Master) { return $l }
        }
    } catch {}
    return $doc.ActiveLayer
}

# Blazingly fast native C++ text finder with PowerClip support
function Get-AllTextShapes($container) {
    $list = [System.Collections.ArrayList]::new()
    if (-not $container) { return $list }

    try {
        if ($container.Type -eq 6) {
            [void]$list.Add($container)
            return $list
        }
    } catch {}

    # 1. Native C++ Recursive FindShapes (cdrTextShape = 6, Recursive = $true)
    try {
        if ($container.Shapes) {
            $found = $container.Shapes.FindShapes($null, 6, $true)
            if ($found -and $found.Count -gt 0) {
                for ($k = 1; $k -le $found.Count; $k++) {
                    [void]$list.Add($found.Item($k))
                }
            }
        }
    } catch {}

    # 2. Check PowerClip on container itself
    try {
        $pc = $container.PowerClip
        if ($pc -and $pc.Shapes) {
            $pcTexts = $pc.Shapes.FindShapes($null, 6, $true)
            if ($pcTexts -and $pcTexts.Count -gt 0) {
                for ($k = 1; $k -le $pcTexts.Count; $k++) {
                    [void]$list.Add($pcTexts.Item($k))
                }
            }
        }
    } catch {}

    # 3. Check PowerClips inside container shapes (if container is a group or page)
    try {
        if ($container.Shapes) {
            for ($si = 1; $si -le $container.Shapes.Count; $si++) {
                $child = $container.Shapes.Item($si)
                try {
                    if ($child.PowerClip -and $child.PowerClip.Shapes) {
                        $childPcTexts = $child.PowerClip.Shapes.FindShapes($null, 6, $true)
                        if ($childPcTexts -and $childPcTexts.Count -gt 0) {
                            for ($k = 1; $k -le $childPcTexts.Count; $k++) {
                                [void]$list.Add($childPcTexts.Item($k))
                            }
                        }
                    }
                } catch {}
            }
        }
    } catch {}

    return $list
}

function Get-DeepTextShapes($container) {
    return Get-AllTextShapes $container
}

function Apply-RowReplacement($textList, $rowObj, $mapList, $docPage = $null) {
    if (-not $textList -or -not $rowObj -or -not $mapList) { return }
    foreach ($m in $mapList) {
        $ph = [string]$m.placeholder
        $col = [string]$m.column
        if (-not $col -and $m.col) { $col = [string]$m.col }
        if (-not $ph) { continue }
        $val = ""
        if ($rowObj -is [System.Collections.IDictionary]) {
            if ($col -and $rowObj.Contains($col)) { $val = [string]$rowObj[$col] }
            elseif ($ph -and $rowObj.Contains($ph)) { $val = [string]$rowObj[$ph] }
        } else {
            if ($col -and $rowObj.PSObject.Properties[$col]) {
                $val = [string]($rowObj.$col)
            } elseif ($ph -and $rowObj.PSObject.Properties[$ph]) {
                $val = [string]($rowObj.$ph)
            }
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
            if ($t -and $t.Type -eq 6) {
                try { [void]$t.ConvertToCurves() } catch {}
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

    $corel.Optimization = $true
    $corel.EventsEnabled = $false
    $doc.BeginCommandGroup("CTS Batch Certificate Mail Merge")
    $origDocUnit = $null
    try { $origDocUnit = $doc.Unit } catch {}
    $doc.Unit = 4 # cdrCentimeter

    $totalRows = $rows.Count

    if ($mode -eq 'inplace') {
        $selInfo = Get-CorelSelection $corel $doc
        $targetContainer = if ($selInfo.SelCount -gt 0) { $selInfo.Selection } else { $null }
        if (-not $targetContainer) {
            $targetContainer = $doc.ActivePage
            if (-not $targetContainer) {
                $targetContainer = $doc.Pages.Item(1)
            }
        }

        $texts = @(Get-DeepTextShapes $targetContainer)
        if ($texts.Count -eq 0) {
            throw "Tidak ditemukan objek teks pada seleksi/halaman aktif CorelDRAW."
        }

        $actPg = $doc.ActivePage
        Apply-RowReplacement $texts $rows[0] $sortedMappings $actPg
        if ($autoCurves) {
            Convert-TextsToCurves $texts
        }

        $result.count = 1
        $result.totalPages = 1
    }
    elseif ($mode -eq 'grid') {
        $doc.Unit = 4

        $selInfo = Get-CorelSelection $corel $doc
        $sel = $selInfo.Selection
        $selCount = [int]$selInfo.SelCount

        $masterPage = $doc.ActivePage
        if (-not $masterPage) { $masterPage = $doc.Pages.Item(1) }
        try { $masterPage.Activate() } catch {}

        $masterShape = $null
        if ($selCount -gt 1) {
            try { $masterShape = $sel.Group() } catch {}
            if (-not $masterShape) {
                try { $masterShape = $corel.ActiveSelection.Group() } catch {}
            }
        } elseif ($selCount -eq 1) {
            $single = Get-RangeItem $sel 1
            if (-not $single) { $single = $sel }

            # SMART AUTO-DETECTION: Check if selected shape has NO texts, but has texts sitting inside its bounds
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
        } else {
            $mpShapes = $doc.ActivePage.Shapes
            $mpCount = if ($mpShapes) { [int]$mpShapes.Count } else { 0 }
            if ($mpCount -gt 1) {
                $masterShape = $mpShapes.All().Group()
            } elseif ($mpCount -eq 1) {
                $masterShape = $mpShapes.Item(1)
            }
        }

        if (-not $masterShape) {
            throw "Gagal mendapatkan objek desain master di CorelDRAW."
        }

        $w = [double]$masterShape.SizeWidth
        $h = [double]$masterShape.SizeHeight
        $origX = [double]$masterShape.PositionX
        $origY = [double]$masterShape.PositionY

        $perPage = [int]($cols * $gridRows)
        if ($perPage -lt 1) { $perPage = 1 }
        $totalPages = [int][math]::Ceiling($totalRows / $perPage)

        # 1. Tata susunan kartu di Halaman 1 sesuai jumlah data yang dibutuhkan (maksimal $perPage)
        $countPage1 = [int][math]::Min($totalRows, $perPage)
        $page1Shapes = @()

        for ($idx = 0; $idx -lt $countPage1; $idx++) {
            $r = 0
            $c = 0
            if ($gridOrder -eq 'top_bottom') {
                $c = [int][math]::Floor($idx / $gridRows)
                $r = [int]($idx % $gridRows)
            } else {
                $r = [int][math]::Floor($idx / $cols)
                $c = [int]($idx % $cols)
            }

            $targetPosX = $origX + ($c * ($w + $spacingX))
            $targetPosY = $origY - ($r * ($h + $spacingY))

            if ($idx -eq 0) {
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

        # 2. Susun Halaman 2..N jika data melebihi 1 halaman
        if ($totalPages -gt 1) {
            for ($p = 2; $p -le $totalPages; $p++) {
                if (Test-Path $cancelFlagPath) {
                    throw "Operasi dibatalkan oleh pengguna."
                }
                $newPage = $doc.AddPages(1)
                $targetLyr = Get-ValidTargetLayer $newPage $doc
                $pIdx = $p - 1
                $startItem = $pIdx * $perPage
                $countThisPage = [int][math]::Min($totalRows - $startItem, $perPage)

                for ($s = 0; $s -lt $countThisPage; $s++) {
                    if (Test-Path $cancelFlagPath) {
                        throw "Operasi dibatalkan oleh pengguna."
                    }
                    $r = 0
                    $c = 0
                    if ($gridOrder -eq 'top_bottom') {
                        $c = [int][math]::Floor($s / $gridRows)
                        $r = [int]($s % $gridRows)
                    } else {
                        $r = [int][math]::Floor($s / $cols)
                        $c = [int]($s % $cols)
                    }

                    $targetPosX = $origX + ($c * ($w + $spacingX))
                    $targetPosY = $origY - ($r * ($h + $spacingY))

                    $dup = $masterShape.Duplicate()
                    try { $dup.MoveToLayer($targetLyr) } catch {}
                    $dup.PositionX = $targetPosX
                    $dup.PositionY = $targetPosY

                    $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) + $pIdx } else { $startItem + $s }
                    if ($itemIdx -lt $totalRows) {
                        try {
                            $shpTexts = Get-DeepTextShapes $dup
                            Apply-RowReplacement $shpTexts $rows[$itemIdx] $sortedMappings $newPage
                            if ($autoCurves) { Convert-TextsToCurves $shpTexts }
                        } catch {}
                    }
                }
            }
        }

        # 3. Ganti teks pada Halaman 1
        $masterPage.Activate()
        for ($s = 0; $s -lt $page1Shapes.Count; $s++) {
            if (Test-Path $cancelFlagPath) {
                throw "Operasi dibatalkan oleh pengguna."
            }
            $itemIdx = if ($gridOrder -eq 'cut_stack') { ($s * $totalPages) } else { $s }
            if ($itemIdx -lt $totalRows) {
                try {
                    $voucherShape = $page1Shapes[$s]
                    $shpTexts = Get-DeepTextShapes $voucherShape
                    Apply-RowReplacement $shpTexts $rows[$itemIdx] $sortedMappings $masterPage
                    if ($autoCurves) { Convert-TextsToCurves $shpTexts }
                } catch {}
            }
        }

        $result.count = $totalRows
        $result.totalPages = $totalPages
    }
    else {
        # MODE PAGE
        $masterPage = $doc.ActivePage
        if (-not $masterPage) { $masterPage = $doc.Pages.Item(1) }
        $masterPage.Activate()

        $mpShapes = $masterPage.Shapes
        $mpCount = if ($mpShapes) { [int]$mpShapes.Count } else { 0 }
        if ($mpCount -eq 0) {
            throw "Halaman template sertifikat masih kosong."
        }

        if ($totalRows -gt 1) {
            for ($i = 1; $i -lt $totalRows; $i++) {
                if (Test-Path $cancelFlagPath) {
                    throw "Operasi dibatalkan oleh pengguna."
                }
                try {
                    $newPage = $doc.AddPages(1)
                    $targetLyr = Get-ValidTargetLayer $newPage $doc

                    # Direct in-memory vector duplication per shape (no clipboard!)
                    for ($msIdx = $mpCount; $msIdx -ge 1; $msIdx--) {
                        $ms = $mpShapes.Item($msIdx)
                        $dupMs = $ms.Duplicate(0.0, 0.0)
                        $dupMs.MoveToLayer($targetLyr)
                    }

                    $newTexts = @(Get-AllTextShapes $newPage)
                    Apply-RowReplacement $newTexts $rows[$i] $sortedMappings $newPage
                    if ($autoCurves) { Convert-TextsToCurves $newTexts }
                } catch {}
            }
        }

        $masterPage.Activate()
        try {
            $masterTexts = @(Get-DeepTextShapes $masterPage)
            Apply-RowReplacement $masterTexts $rows[0] $sortedMappings $masterPage
            if ($autoCurves) { Convert-TextsToCurves $masterTexts }
        } catch {}

        $result.count = $totalRows
        $result.totalPages = $totalRows
    }

    try { $doc.ClearSelection() } catch {}
    try { $corel.ClearSelection() } catch {}
    if ($null -ne $origDocUnit) { try { $doc.Unit = $origDocUnit } catch {} }
    try { $doc.EndCommandGroup() } catch {}
    try { $corel.Optimization = $false } catch {}
    try { $corel.EventsEnabled = $true } catch {}
    try { $corel.Refresh() } catch {}
    if ($corel.ActiveWindow) { try { $corel.ActiveWindow.Refresh() } catch {} }

    $result.success = $true
    if ($mode -eq 'grid') {
        $result.message = "Berhasil menata $($result.count) desain dalam Grid $($cols) x $($gridRows) pada $($result.totalPages) lembar cetak di CorelDRAW!"
    } else {
        $result.message = "Berhasil membuat $($result.count) sertifikat pada $($result.totalPages) halaman di CorelDRAW!"
    }
}
catch {
    $errLine = $_.InvocationInfo.ScriptLineNumber
    try {
        if ($doc) {
            try { $doc.EndCommandGroup() } catch {}
            if ($null -ne $origDocUnit) { try { $doc.Unit = $origDocUnit } catch {} }
        }
        if ($corel) {
            $corel.Optimization = $false
            $corel.EventsEnabled = $true
            $corel.Refresh()
        }
    } catch {}
    $result.success = $false
    $result.message = "$($_.Exception.Message) (Baris $errLine)"
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

  const totalRowsCount = (payload?.rows || []).length;
  const dynamicTimeout = Math.max(600000, totalRowsCount * 800);
  return runPowerShellScript(psScript, dynamicTimeout);
}

module.exports = {
  indexToLetter,
  parseExcelFile,
  executeCertMerger,
  executeCertMergerWorkflow: executeCertMerger,
};
