/**
 * CorelDRAW Connection & COM Automation Core
 * Provides unified process discovery, version negotiation, and COM invocation bridge.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('./electronBridge.cjs');

function getCorelConfigPath() {
  try {
    return path.join(app.getPath('userData'), 'corel_config.json');
  } catch {
    return path.join(process.cwd(), 'corel_config.json');
  }
}

function getCorelConfig() {
  try {
    const p = getCorelConfigPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {}
  return { preferredVersion: 'auto', preferredPid: 0 };
}

function saveCorelConfig(cfg) {
  try {
    const p = getCorelConfigPath();
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {}
}

let activePreferredVersion = 'auto';
let activePreferredPid = 0;
try {
  const cfg = getCorelConfig();
  activePreferredVersion = cfg.preferredVersion || 'auto';
  activePreferredPid = parseInt(cfg.preferredPid, 10) || 0;
} catch {}

function setPreferredCorelVersion(ver, pid) {
  activePreferredVersion = String(ver || 'auto');
  activePreferredPid = parseInt(pid, 10) || 0;
  saveCorelConfig({ preferredVersion: activePreferredVersion, preferredPid: activePreferredPid });
  return { success: true, preferredVersion: activePreferredVersion, preferredPid: activePreferredPid };
}

function getPreferredCorelVersion() {
  return { preferredVersion: activePreferredVersion, preferredPid: activePreferredPid };
}

function getCorelProcessHelpersPs() {
  return `
    function Get-RealCorelProcesses {
        $procs = @(Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue)
        if (-not $procs -or $procs.Count -eq 0) { return @() }
        $noWin = @($procs | Where-Object { $_.MainWindowHandle -eq 0 })
        $ghostPids = @()
        if ($noWin -and $noWin.Count -gt 0) {
            $cimList = @(Get-CimInstance Win32_Process -Filter "Name = 'CorelDRW.exe' OR Name = 'CorelDRAW.exe'" -ErrorAction SilentlyContinue)
            if ($cimList -and $cimList.Count -gt 0) {
                foreach ($cp in $cimList) {
                    if ($cp.CommandLine -and $cp.CommandLine -match '(/Automation\\b|-Embedding\\b)') {
                        $gp = $noWin | Where-Object { $_.Id -eq $cp.ProcessId } | Select-Object -First 1
                        if ($gp) {
                            $ghostPids += $cp.ProcessId
                            try { Stop-Process -Id $cp.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
                        }
                    }
                }
            }
        }
        $filtered = @($procs | Where-Object { $ghostPids -notcontains $_.Id })
        $withWin = @($filtered | Where-Object { $_.MainWindowHandle -ne 0 })
        if ($withWin.Count -gt 0) { return $withWin }
        if ($filtered.Count -gt 0) { return $filtered }
        return @()
    }

    function Get-CorelVerFromProcess($p) {
        if (-not $p) { return 0 }
        $t = [string]$p.MainWindowTitle
        $pth = [string]$p.Path
        $fv = [string]$p.FileVersion
        if ($fv -match '^(\\d+)\\.') { return [int]$matches[1] }
        if ($t -match '2026|28\\.' -or $pth -like '*2026*') { return 28 }
        if ($t -match '2025|27\\.' -or $pth -like '*2025*') { return 27 }
        if ($t -match '2024|26\\.' -or $pth -like '*2024*') { return 26 }
        if ($t -match '2023|25\\.' -or $pth -like '*2023*') { return 25 }
        if ($t -match '2022|24\\.' -or $pth -like '*2022*') { return 24 }
        if ($t -match '2021|23\\.' -or $pth -like '*2021*') { return 23 }
        if ($t -match '2020|22\\.' -or $pth -like '*2020*') { return 22 }
        if ($t -match '2019|21\\.' -or $pth -like '*2019*') { return 21 }
        if ($t -match '2018|20\\.' -or $pth -like '*2018*') { return 20 }
        if ($t -match '2017|19\\.' -or $pth -like '*2017*') { return 19 }
        if ($t -match 'X8|18\\.' -or $pth -like '*X8*') { return 18 }
        if ($t -match 'X7|17\\.' -or $pth -like '*X7*') { return 17 }
        if ($t -match 'X6|16\\.' -or $pth -like '*X6*') { return 16 }
        if ($t -match 'X5|15\\.' -or $pth -like '*X5*') { return 15 }
        if ($t -match 'X4|14\\.' -or $pth -like '*X4*') { return 14 }
        return 0
    }
  `;
}

function getFastComBootstrapPs() {
  return `
    $fastComCode = @"
using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

[ComImport, Guid("00020400-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IDispatchRaw {
    [PreserveSig] int GetTypeInfoCount(out int pctinfo);
    [PreserveSig] int GetTypeInfo(int iTInfo, int lcid, out IntPtr ppTInfo);
    [PreserveSig] int GetIDsOfNames([In] ref Guid riid, [MarshalAs(UnmanagedType.LPArray, ArraySubType = UnmanagedType.LPWStr)] string[] rgszNames, int cNames, int lcid, [Out, MarshalAs(UnmanagedType.LPArray)] int[] rgDispId);
    [PreserveSig] int Invoke(int dispIdMember, [In] ref Guid riid, int lcid, short wFlags, ref System.Runtime.InteropServices.ComTypes.DISPPARAMS pDispParams, out object pVarResult, IntPtr pExcepInfo, IntPtr puArgErr);
}

public static class FastCom {
    [DllImport("oleaut32.dll")]
    private static extern int VariantClear(IntPtr pvarg);

    private static Guid IID_NULL = Guid.Empty;
    private const short DISPATCH_METHOD = 1;
    private const short DISPATCH_PROPERTYGET = 2;
    private const short DISPATCH_PROPERTYPUT = 4;
    private const short DISPATCH_PROPERTYPUTREF = 8;
    private const int DISPID_PROPERTYPUT = -3;
    private static readonly int VariantSize = IntPtr.Size == 8 ? 24 : 16;
    private static readonly ConditionalWeakTable<object, Dictionary<string, int>> DispIdCache = new ConditionalWeakTable<object, Dictionary<string, int>>();

    public static int GetDispId(object comObj, IDispatchRaw disp, string name) {
        Dictionary<string, int> map;
        if (!DispIdCache.TryGetValue(comObj, out map)) {
            map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            DispIdCache.Add(comObj, map);
        }
        int id;
        if (map.TryGetValue(name, out id)) {
            return id;
        }
        int[] ids = new int[1];
        int hr = disp.GetIDsOfNames(ref IID_NULL, new string[] { name }, 1, 0, ids);
        if (hr < 0) Marshal.ThrowExceptionForHR(hr);
        map[name] = ids[0];
        return ids[0];
    }

    private static void WriteVariant(object val, IntPtr slot) {
        if (val != null && val is Array) {
            Array a = (Array)val;
            if (a.Length > 0) val = a.GetValue(0);
            else val = null;
        }
        if (val != null && Marshal.IsComObject(val)) {
            IntPtr pDisp = Marshal.GetIDispatchForObject(val);
            Marshal.WriteInt16(slot, 0, 9);
            Marshal.WriteInt16(slot, 2, 0);
            Marshal.WriteInt16(slot, 4, 0);
            Marshal.WriteInt16(slot, 6, 0);
            Marshal.WriteIntPtr(slot, 8, pDisp);
        } else {
            Marshal.GetNativeVariantForObject(val, slot);
        }
    }

    private static object InvokeInternal(object comObj, string name, short flags, object[] args, bool isPut) {
        if (comObj == null) return null;
        if (comObj is Array) {
            Array arr = (Array)comObj;
            if (arr.Length > 0) comObj = arr.GetValue(0);
            else return null;
        }
        var disp = comObj as IDispatchRaw;
        if (disp == null) throw new InvalidOperationException("Object does not implement IDispatch");
        int dispId = GetDispId(comObj, disp, name);

        var dp = new System.Runtime.InteropServices.ComTypes.DISPPARAMS();
        IntPtr pArgs = IntPtr.Zero;
        IntPtr pNamed = IntPtr.Zero;
        int argCount = args != null ? args.Length : 0;

        try {
            if (argCount > 0) {
                pArgs = Marshal.AllocCoTaskMem(argCount * VariantSize);
                for (int i = 0; i < argCount; i++) {
                    IntPtr slot = IntPtr.Add(pArgs, (argCount - 1 - i) * VariantSize);
                    WriteVariant(args[i], slot);
                }
                dp.cArgs = argCount;
                dp.rgvarg = pArgs;
            }
            if (isPut) {
                pNamed = Marshal.AllocCoTaskMem(sizeof(int));
                Marshal.WriteInt32(pNamed, DISPID_PROPERTYPUT);
                dp.cNamedArgs = 1;
                dp.rgdispidNamedArgs = pNamed;
            }
            object result = null;
            int hr = disp.Invoke(dispId, ref IID_NULL, 0, flags, ref dp, out result, IntPtr.Zero, IntPtr.Zero);
            if (hr < 0) Marshal.ThrowExceptionForHR(hr);
            return result;
        } finally {
            if (pArgs != IntPtr.Zero) {
                for (int i = 0; i < argCount; i++) {
                    IntPtr slot = IntPtr.Add(pArgs, i * VariantSize);
                    VariantClear(slot);
                }
                Marshal.FreeCoTaskMem(pArgs);
            }
            if (pNamed != IntPtr.Zero) {
                Marshal.FreeCoTaskMem(pNamed);
            }
        }
    }

    public static object Get(object comObj, string name, object[] args = null) {
        return InvokeInternal(comObj, name, (short)(DISPATCH_PROPERTYGET | DISPATCH_METHOD), args, false);
    }

    public static object Call(object comObj, string name, object[] args = null) {
        return InvokeInternal(comObj, name, (short)(DISPATCH_METHOD | DISPATCH_PROPERTYGET), args, false);
    }

    public static void Set(object comObj, string name, object val) {
        short flags = DISPATCH_PROPERTYPUT;
        if (val != null && Marshal.IsComObject(val)) {
            flags |= DISPATCH_PROPERTYPUTREF;
        }
        InvokeInternal(comObj, name, flags, new object[] { val }, true);
    }
}
"@
    if (-not ("FastCom" -as [type])) {
        $fastComDll = Join-Path $env:TEMP "CorelFastCom_v4.dll"
        if (Test-Path $fastComDll) {
            try { Add-Type -Path $fastComDll -ErrorAction Stop } catch {}
        }
        if (-not ("FastCom" -as [type])) {
            try {
                Add-Type -TypeDefinition $fastComCode -OutputAssembly $fastComDll -ErrorAction Stop
                Add-Type -Path $fastComDll -ErrorAction Stop
            } catch {
                Add-Type -TypeDefinition $fastComCode -ErrorAction Stop
            }
        }
    }

    function Com-Get($obj, [string]$prop, [object[]]$argsList = $null) {
        if ($null -eq $obj) { return $null }
        if ($obj -is [System.Array]) {
            if ($obj.Length -gt 0) { $obj = $obj[0] } else { return $null }
        }
        try {
            $res = [FastCom]::Get($obj, $prop, $argsList)
            if ($null -eq $res) { return $null }
            return $res
        } catch {
            return $null
        }
    }

    function Com-Set($obj, [string]$prop, $val) {
        if ($null -eq $obj) { return }
        if ($obj -is [System.Array]) {
            if ($obj.Length -gt 0) { $obj = $obj[0] } else { return }
        }
        try {
            [FastCom]::Set($obj, $prop, $val)
        } catch {}
    }

    function Com-Call($obj, [string]$method, [object[]]$argsList = $null) {
        if ($null -eq $obj) { return $null }
        if ($obj -is [System.Array]) {
            if ($obj.Length -gt 0) { $obj = $obj[0] } else { return $null }
        }
        try {
            $res = [FastCom]::Call($obj, $method, $argsList)
            if ($null -eq $res) { return $null }
            return $res
        } catch {
            return $null
        }
    }

    function Get-CorelMajorFromCom($obj) {
        if (-not $obj) { return 0 }
        $vStr = Com-Get $obj "Version"
        if (-not $vStr) { $vStr = Com-Get $obj "VersionMajor" }
        if ($vStr -and [string]$vStr -match '^(\\d+)') {
            return [int]$matches[1]
        }
        return 0
    }
  `;
}

function getCorelFindAppPs() {
  return `
${getCorelProcessHelpersPs()}
${getFastComBootstrapPs()}

    $corel = $null
    $realProcs = @(Get-RealCorelProcesses)
    $preferredVer = '${activePreferredVersion}'
    $preferredPid = ${activePreferredPid}
    $targetProc = $null
    $targetVer = 0

    if ($realProcs -and $realProcs.Count -gt 0) {
        if ($preferredPid -and $preferredPid -gt 0) {
            $cand = $realProcs | Where-Object { $_.Id -eq $preferredPid } | Select-Object -First 1
            if ($cand) {
                if ($preferredVer -eq 'auto' -or -not ($preferredVer -match '^\\d+$') -or (Get-CorelVerFromProcess $cand) -eq [int]$preferredVer) {
                    $targetProc = $cand
                }
            }
        }
        if (-not $targetProc -and $preferredVer -ne 'auto' -and $preferredVer -match '^\\d+$') {
            $pVer = [int]$preferredVer
            $targetProc = $realProcs | Where-Object { (Get-CorelVerFromProcess $_) -eq $pVer } | Select-Object -First 1
        }
        if (-not $targetProc) {
            $targetProc = $realProcs | Select-Object -First 1
        }
        $targetVer = Get-CorelVerFromProcess $targetProc

        if ($targetVer -gt 0) {
            try {
                $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$targetVer")
                if ($c) { $corel = $c }
            } catch {}
        } else {
            try {
                $c = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application")
                if ($c) { $corel = $c }
            } catch {}
        }
    }
  `;
}

function getCorelConnectPs() {
  return `
${getCorelFindAppPs()}

    if (-not $corel -and $realProcs -and $realProcs.Count -gt 0) {
        if ($targetVer -gt 0) {
            try {
                $c = New-Object -ComObject "CorelDRAW.Application.$targetVer" -ErrorAction SilentlyContinue
                if ($c) { $corel = $c }
            } catch {}
        } else {
            try {
                $c = New-Object -ComObject "CorelDRAW.Application" -ErrorAction SilentlyContinue
                if ($c) { $corel = $c }
            } catch {}
        }
    }

    if (-not $corel) {
        $targetName = switch ($targetVer) {
            28 { "CorelDRAW 2026" }
            27 { "CorelDRAW 2025" }
            26 { "CorelDRAW 2024" }
            25 { "CorelDRAW 2023" }
            24 { "CorelDRAW 2022" }
            23 { "CorelDRAW 2021" }
            22 { "CorelDRAW 2020" }
            21 { "CorelDRAW 2019" }
            20 { "CorelDRAW 2018" }
            19 { "CorelDRAW 2017" }
            18 { "CorelDRAW X8" }
            17 { "CorelDRAW X7" }
            default { if ($targetVer -gt 0) { "CorelDRAW v$targetVer" } else { "CorelDRAW" } }
        }
        $activeWin = if ($targetProc -and $targetProc.MainWindowHandle -ne 0) {
            $targetProc
        } elseif ($realProcs -and $realProcs.Count -gt 0) {
            $realProcs | Where-Object { (Get-CorelVerFromProcess $_) -eq $targetVer } | Select-Object -First 1
        } else {
            $procs = Get-Process -Name 'CorelDRW','CorelDRAW' -ErrorAction SilentlyContinue
            if ($procs) { $procs | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 } else { $null }
        }
        if ($activeWin) {
            throw "$targetName sedang berjalan (PID $($activeWin.Id), Jendela: '$($activeWin.MainWindowTitle)'), namun antarmuka COM belum merespon. Pastikan CorelDRAW tidak sedang menampilkan dialog pop-up/modal atau sedang mengedit teks (tekan ESC di CorelDRAW jika kursor teks sedang aktif), lalu coba lagi."
        }
        throw "$targetName tidak sedang berjalan. Silakan buka aplikasi $targetName Anda terlebih dahulu."
    }

    $doc = Com-Get $corel "ActiveDocument"
    if (-not $doc) {
        $docs = Com-Get $corel "Documents"
        $docsCount = if ($docs) { [int](Com-Get $docs "Count") } else { 0 }
        if ($docs -and $docsCount -gt 0) {
            for ($dIdx = 1; $dIdx -le $docsCount; $dIdx++) {
                $testDoc = Com-Get $docs "Item" @($dIdx)
                if ($testDoc) {
                    $doc = $testDoc
                    try { [void](Com-Call $doc "Activate") } catch {}
                    break
                }
            }
        }
    }

    if ($corel -and -not $doc -and $realProcs -and $realProcs.Count -gt 1) {
        foreach ($altProc in $realProcs) {
            if ($targetProc -and $altProc.Id -eq $targetProc.Id) { continue }
            $altVer = Get-CorelVerFromProcess $altProc
            $altCorel = $null
            if ($altVer -gt 0) {
                try { $altCorel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application.$altVer") } catch {}
            }
            if (-not $altCorel) {
                try { $altCorel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("CorelDRAW.Application") } catch {}
            }
            if ($altCorel) {
                $altDoc = Com-Get $altCorel "ActiveDocument"
                if ($altDoc) {
                    $corel = $altCorel
                    $doc = $altDoc
                    break
                }
            }
        }
    }

    function Get-RangeCount($r) {
        if ($null -eq $r) { return 0 }
        try {
            $cnt = Com-Get $r "Count"
            if ($null -ne $cnt -and [int]$cnt -gt 0) { return [int]$cnt }
        } catch {}
        try {
            $shps = Com-Get $r "Shapes"
            if ($null -ne $shps) {
                $sc = Com-Get $shps "Count"
                if ($null -ne $sc -and [int]$sc -gt 0) { return [int]$sc }
            }
        } catch {}
        try {
            $sType = Com-Get $r "Type"
            if ($null -ne $sType -and [int]$sType -gt 0) { return 1 }
        } catch {}
        try {
            $sId = Com-Get $r "StaticID"
            if ($null -ne $sId -and [int]$sId -gt 0) { return 1 }
        } catch {}
        return 0
    }

    function Get-RangeItem($r, [int]$idx) {
        if ($null -eq $r) { return $null }
        if ($idx -eq 1) {
            try {
                $cnt = Com-Get $r "Count"
                if ($null -eq $cnt) {
                    $sType = Com-Get $r "Type"
                    if ($null -ne $sType -and [int]$sType -gt 0) { return ,$r }
                    $sId = Com-Get $r "StaticID"
                    if ($null -ne $sId -and [int]$sId -gt 0) { return ,$r }
                }
            } catch {}
        }
        try {
            $it = Com-Get $r "Item" @($idx)
            if ($null -ne $it) {
                if ($it -is [System.Array]) { if ($it.Length -gt 0) { $it = $it[0] } }
                return ,$it
            }
        } catch {}
        try {
            $shps = Com-Get $r "Shapes"
            if ($null -ne $shps) {
                $it2 = Com-Get $shps "Item" @($idx)
                if ($null -ne $it2) {
                    if ($it2 -is [System.Array]) { if ($it2.Length -gt 0) { $it2 = $it2[0] } }
                    return ,$it2
                }
            }
        } catch {}
        if ($idx -eq 1) {
            try {
                $sId = Com-Get $r "StaticID"
                if ($null -ne $sId -and [int]$sId -gt 0) { return ,$r }
            } catch {}
        }
        return $null
    }

    function Get-CorelSelection($cApp, $dDoc) {
        $sel = $null
        $cnt = 0

        # Tier 1: cApp.ActiveSelectionRange
        if ($cApp) {
            try {
                $cand = Com-Get $cApp "ActiveSelectionRange"
                $cnt = Get-RangeCount $cand
                if ($cnt -gt 0) { return [PSCustomObject]@{ Selection = $cand; Count = $cnt; SelCount = $cnt; SwitchedDoc = $null } }
            } catch {}
        }

        # Tier 2: dDoc.SelectionRange
        if ($dDoc) {
            try {
                $cand = Com-Get $dDoc "SelectionRange"
                $cnt = Get-RangeCount $cand
                if ($cnt -gt 0) { return [PSCustomObject]@{ Selection = $cand; Count = $cnt; SelCount = $cnt; SwitchedDoc = $null } }
            } catch {}
        }

        # Tier 3: cApp.ActiveSelection
        if ($cApp) {
            try {
                $cand = Com-Get $cApp "ActiveSelection"
                $cnt = Get-RangeCount $cand
                if ($cnt -gt 0) { return [PSCustomObject]@{ Selection = $cand; Count = $cnt; SelCount = $cnt; SwitchedDoc = $null } }
            } catch {}
        }

        # Tier 4: dDoc.ActiveSelection
        if ($dDoc) {
            try {
                $cand = Com-Get $dDoc "ActiveSelection"
                $cnt = Get-RangeCount $cand
                if ($cnt -gt 0) { return [PSCustomObject]@{ Selection = $cand; Count = $cnt; SelCount = $cnt; SwitchedDoc = $null } }
            } catch {}
        }

        # Tier 5: dDoc.Selection
        if ($dDoc) {
            try {
                $cand = Com-Get $dDoc "Selection"
                $cnt = Get-RangeCount $cand
                if ($cnt -gt 0) { return [PSCustomObject]@{ Selection = $cand; Count = $cnt; SelCount = $cnt; SwitchedDoc = $null } }
            } catch {}
        }

        # Tier 6: Multi-document search: when multiple documents/tabs are open in CorelDRAW
        if ($cApp) {
            try {
                $allDocs = Com-Get $cApp "Documents"
                $docTotal = if ($allDocs) { [int](Com-Get $allDocs "Count") } else { 0 }
                if ($docTotal -gt 1) {
                    $curDocName = if ($dDoc) { [string](Com-Get $dDoc "Name") } else { "" }
                    for ($di = 1; $di -le $docTotal; $di++) {
                        $oDoc = Com-Get $allDocs "Item" @($di)
                        if (-not $oDoc) { continue }
                        $oName = [string](Com-Get $oDoc "Name")
                        if ($curDocName -and $oName -eq $curDocName) { continue }

                        $cand = Com-Get $oDoc "SelectionRange"
                        $cnt = Get-RangeCount $cand
                        if ($cnt -gt 0) {
                            try { [void](Com-Call $oDoc "Activate") } catch {}
                            return [PSCustomObject]@{ Selection = $cand; Count = $cnt; SelCount = $cnt; SwitchedDoc = $oDoc }
                        }

                        $cand = Com-Get $oDoc "ActiveSelection"
                        $cnt = Get-RangeCount $cand
                        if ($cnt -gt 0) {
                            try { [void](Com-Call $oDoc "Activate") } catch {}
                            return [PSCustomObject]@{ Selection = $cand; Count = $cnt; SelCount = $cnt; SwitchedDoc = $oDoc }
                        }
                    }
                }
            } catch {}
        }

        return [PSCustomObject]@{ Selection = $null; Count = 0; SelCount = 0; SwitchedDoc = $null }
    }
  `;
}

module.exports = {
  getCorelConfigPath,
  getCorelConfig,
  saveCorelConfig,
  setPreferredCorelVersion,
  getPreferredCorelVersion,
  getCorelProcessHelpersPs,
  getFastComBootstrapPs,
  getCorelFindAppPs,
  getCorelConnectPs,
};
