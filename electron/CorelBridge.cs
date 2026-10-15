using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace GfxItPrinting.CorelBridge
{
    class SpatialItem
    {
        public dynamic Shape { get; set; }
        public double PosX { get; set; }
        public double PosY { get; set; }
        public double Height { get; set; }
    }

    class Program
    {

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                if (args.Length == 0 || args[0] == "status")
                {
                    CheckStatus();
                }
                else if (args[0] == "layout" && args.Length > 1)
                {
                    ExecuteLayout(args[1]);
                }
                else if (args[0] == "numerator" && args.Length > 1)
                {
                    ExecuteNumerator(args[1]);
                }
                else
                {
                    Console.WriteLine("{\"success\":false,\"message\":\"Invalid argument\"}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(string.Format("{{\"success\":false,\"message\":\"{0}\"}}", EscapeJson(ex.Message)));
            }
        }

        [DllImport("oleaut32.dll", PreserveSig = false)]
        private static extern void GetActiveObject(ref Guid rclsid, IntPtr pvReserved, [MarshalAs(UnmanagedType.IUnknown)] out object ppunk);

        [DllImport("ole32.dll")]
        private static extern int CLSIDFromProgID([MarshalAs(UnmanagedType.LPWStr)] string lpszProgID, out Guid lpclsid);

        static dynamic TryGetCom(string progId)
        {
            if (string.IsNullOrEmpty(progId)) return null;
            try
            {
                Guid clsid;
                if (CLSIDFromProgID(progId, out clsid) == 0)
                {
                    object obj;
                    GetActiveObject(ref clsid, IntPtr.Zero, out obj);
                    if (obj != null) return obj;
                }
            }
            catch { }
            try
            {
                object obj = Marshal.GetActiveObject(progId);
                if (obj != null) return obj;
            }
            catch { }
            try
            {
                Type t = Type.GetTypeFromProgID(progId);
                if (t != null)
                {
                    object obj = Activator.CreateInstance(t);
                    if (obj != null) return obj;
                }
            }
            catch { }
            return null;
        }

        static dynamic GetCorelApp(out string versionStr)
        {
            versionStr = "";

            // 1. Try CurVer
            string curVerProgId = null;
            try
            {
                using (RegistryKey key = Registry.ClassesRoot.OpenSubKey(@"CorelDRAW.Application\CurVer"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue("");
                        if (val != null) curVerProgId = val.ToString();
                    }
                }
            }
            catch { }

            if (!string.IsNullOrEmpty(curVerProgId))
            {
                dynamic app = TryGetCom(curVerProgId);
                if (app != null)
                {
                    try { versionStr = app.Version.ToString(); } catch { versionStr = curVerProgId; }
                    return app;
                }
            }

            // 2. Try Generic ProgID
            dynamic genericApp = TryGetCom("CorelDRAW.Application");
            if (genericApp != null)
            {
                try { versionStr = genericApp.Version.ToString(); } catch { versionStr = "Active"; }
                return genericApp;
            }

            // 3. Fallback versions 26 down to 14
            for (int v = 26; v >= 14; v--)
            {
                dynamic verApp = TryGetCom("CorelDRAW.Application." + v);
                if (verApp != null)
                {
                    try { versionStr = verApp.Version.ToString(); } catch { versionStr = v.ToString(); }
                    return verApp;
                }
            }

            return null;
        }

        static void CheckStatus()
        {
            try
            {
                string version = "";
                dynamic corel = GetCorelApp(out version);
                if (corel == null)
                {
                    Console.WriteLine("{\"connected\":false,\"error\":\"CorelDRAW tidak terdeteksi\"}");
                    return;
                }

                bool hasDoc = false;
                string docName = "";
                bool hasSelection = false;

                try
                {
                    if (corel.ActiveDocument != null)
                    {
                        hasDoc = true;
                        docName = corel.ActiveDocument.Name;
                        if (corel.ActiveSelection != null && corel.ActiveSelection.Shapes.Count > 0)
                        {
                            hasSelection = true;
                        }
                    }
                }
                catch { }

                Console.WriteLine(string.Format(
                    "{{\"connected\":true,\"version\":\"{0}\",\"hasDoc\":{1},\"docName\":\"{2}\",\"hasSelection\":{3}}}",
                    EscapeJson(version), hasDoc.ToString().ToLower(), EscapeJson(docName), hasSelection.ToString().ToLower()
                ));
            }
            catch (Exception ex)
            {
                Console.WriteLine(string.Format("{{\"connected\":false,\"error\":\"{0}\"}}", EscapeJson(ex.Message)));
            }
        }

        static void ExecuteLayout(string jsonFilePath)
        {
            try
            {
                if (!File.Exists(jsonFilePath))
                {
                    Console.WriteLine("{\"success\":false,\"message\":\"File data tidak ditemukan.\"}");
                    return;
                }

                string jsonContent = File.ReadAllText(jsonFilePath, Encoding.UTF8);

                string version = "";
                dynamic corel = GetCorelApp(out version);
                if (corel == null)
                {
                    Console.WriteLine("{\"success\":false,\"message\":\"CorelDRAW belum dibuka.\"}");
                    return;
                }

                if (corel.ActiveDocument == null)
                {
                    Console.WriteLine("{\"success\":false,\"message\":\"Tidak ada file yang sedang terbuka di CorelDRAW.\"}");
                    return;
                }

                dynamic doc = corel.ActiveDocument;
                doc.Unit = 3; // cdrCentimeter

                dynamic sel = corel.ActiveSelection;
                if (sel == null || sel.Shapes.Count == 0)
                {
                    Console.WriteLine("{\"success\":false,\"message\":\"Silakan pilih (seleksi/klik/blok) master pola jersey di CorelDRAW terlebih dahulu.\"}");
                    return;
                }

                dynamic masterShape = null;
                if (sel.Shapes.Count > 1)
                {
                    masterShape = sel.Group();
                }
                else
                {
                    masterShape = sel.Shapes.Item(1);
                }

                double startX = (double)masterShape.PositionX;
                double startY = (double)masterShape.PositionY;
                double width = (double)masterShape.SizeWidth;
                double height = (double)masterShape.SizeHeight;

                double spacingCm = 1.0;
                int limitCopy = 4;
                string direction = "vertical";

                Match mSpacing = Regex.Match(jsonContent, "\"spacingCm\"\\s*:\\s*([0-9.]+)");
                if (mSpacing.Success) double.TryParse(mSpacing.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out spacingCm);

                Match mLimit = Regex.Match(jsonContent, "\"limitCopy\"\\s*:\\s*([0-9]+)");
                if (mLimit.Success) int.TryParse(mLimit.Groups[1].Value, out limitCopy);
                if (limitCopy < 1) limitCopy = 4;

                Match mDir = Regex.Match(jsonContent, "\"direction\"\\s*:\\s*\"([a-zA-Z]+)\"");
                if (mDir.Success) direction = mDir.Groups[1].Value.ToLower();

                // Extract all players
                MatchCollection allPlayers = Regex.Matches(jsonContent, @"""name""\s*:\s*""([^""]*)""\s*,\s*""number""\s*:\s*""([^""]*)""");
                if (allPlayers.Count == 0)
                {
                    allPlayers = Regex.Matches(jsonContent, @"""name""\s*:\s*""([^""]*)""");
                }

                int createdCount = 0;
                int playerIndex = 0;

                foreach (Match match in allPlayers)
                {
                    string pName = match.Groups[1].Value.ToUpper();
                    string pNum = match.Groups.Count > 2 ? match.Groups[2].Value : "";
                    if (pNum == "-") pNum = "";

                    dynamic dup = masterShape.Duplicate();
                    UpdateShapeTextRecursive(dup, pName, pNum);

                    double posX, posY;
                    if (direction == "horizontal")
                    {
                        int col = playerIndex % limitCopy;
                        int row = playerIndex / limitCopy;
                        posX = startX + (col * (width + spacingCm));
                        posY = startY - (row * (height + spacingCm));
                    }
                    else
                    {
                        int row = playerIndex % limitCopy;
                        int col = playerIndex / limitCopy;
                        posX = startX + (col * (width + spacingCm));
                        posY = startY - (row * (height + spacingCm));
                    }

                    dup.SetPosition(posX, posY);
                    createdCount++;
                    playerIndex++;
                }

                doc.ClearSelection();

                Console.WriteLine(string.Format(
                    "{{\"success\":true,\"count\":{0},\"message\":\"Berhasil menata {0} pola jersey di CorelDRAW!\"}}",
                    createdCount
                ));
            }
            catch (Exception ex)
            {
                Console.WriteLine(string.Format("{{\"success\":false,\"message\":\"{0}\"}}", EscapeJson(ex.Message)));
            }
        }

        static void UpdateShapeTextRecursive(dynamic shape, string pName, string pNum)
        {
            try
            {
                if ((int)shape.Type == 6)
                {
                    string txt = shape.Text.Story.Text.Trim();
                    if (Regex.IsMatch(txt, @"^\d+$") || Regex.IsMatch(txt, @"^(#|00|99|0|NO|NO\.)$", RegexOptions.IgnoreCase))
                    {
                        shape.Text.Story.Text = pNum;
                    }
                    else
                    {
                        shape.Text.Story.Text = pName;
                    }
                }
                else if ((int)shape.Type == 7)
                {
                    int count = (int)shape.Shapes.Count;
                    for (int i = 1; i <= count; i++)
                    {
                        UpdateShapeTextRecursive(shape.Shapes.Item(i), pName, pNum);
                    }
                }
            }
            catch { }
        }

        static bool IsNumberPlaceholder(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return false;
            string t = text.Trim();
            if (Regex.IsMatch(t, @"^\d+$")) return true;
            if (Regex.IsMatch(t, @"^(no|no\.|kpn|vcr|id|tiket|kupon|#|numb|num)?\s*[:.-]?\s*\d+\s*[a-z0-9/-]*$", RegexOptions.IgnoreCase) && t.Length <= 18) return true;
            if (Regex.IsMatch(t, @"\d+") && t.Length <= 10) return true;
            return false;
        }

        static string GetFormattedNum(int val, int dig, string pfx, string sfx)
        {
            string numPart = dig > 0 ? val.ToString().PadLeft(dig, '0') : val.ToString();
            return (pfx ?? "") + numPart + (sfx ?? "");
        }

        static int SetShapeNumberText(dynamic targetShape, string textVal, bool allowMulti)
        {
            if (targetShape == null) return 0;
            int count = 0;
            try
            {
                if ((int)targetShape.Type == 6) // cdrTextShape
                {
                    targetShape.Text.Story.Text = textVal;
                    return 1;
                }
                dynamic textShapes = targetShape.Shapes.FindShapes(null, 6, true);
                if (textShapes != null && textShapes.Count > 0)
                {
                    for (int k = 1; k <= textShapes.Count; k++)
                    {
                        dynamic ts = textShapes.Item(k);
                        string raw = "";
                        try { raw = ts.Text.Story.Text; } catch { }
                        if (IsNumberPlaceholder(raw))
                        {
                            try
                            {
                                ts.Text.Story.Text = textVal;
                                count++;
                                if (!allowMulti) break;
                            }
                            catch { }
                        }
                    }

                    if (count == 0)
                    {
                        for (int k = 1; k <= textShapes.Count; k++)
                        {
                            dynamic ts = textShapes.Item(k);
                            try
                            {
                                ts.Text.Story.Text = textVal;
                                count++;
                                if (!allowMulti) break;
                            }
                            catch { }
                        }
                    }
                }
            }
            catch { }
            return count;
        }

        static void ExecuteNumerator(string jsonFilePath)
        {
            dynamic corel = null;
            dynamic doc = null;
            try
            {
                if (!File.Exists(jsonFilePath))
                {
                    Console.WriteLine("{\"success\":false,\"message\":\"File parameter tidak ditemukan.\"}");
                    return;
                }

                string jsonContent = File.ReadAllText(jsonFilePath, Encoding.UTF8);

                string version = "";
                corel = GetCorelApp(out version);
                if (corel == null)
                {
                    Console.WriteLine("{\"success\":false,\"message\":\"CorelDRAW belum dibuka atau tidak terhubung.\"}");
                    return;
                }

                if (corel.ActiveDocument == null)
                {
                    Console.WriteLine("{\"success\":false,\"message\":\"Tidak ada dokumen yang sedang terbuka di CorelDRAW.\"}");
                    return;
                }

                doc = corel.ActiveDocument;
                doc.Unit = 3; // cdrCentimeter

                // Parse parameters
                int start = 1, end = 100, step = 1, digits = 4, cols = 7, rows = 18;
                double spacingX = 0.5, spacingY = 0.5;
                string prefix = "", suffix = "", mode = "grid", gridOrder = "sequential";
                bool autoCurves = true, doubleNumber = true;

                Match mStart = Regex.Match(jsonContent, "\"start\"\\s*:\\s*([0-9]+)");
                if (mStart.Success) int.TryParse(mStart.Groups[1].Value, out start);

                Match mEnd = Regex.Match(jsonContent, "\"end\"\\s*:\\s*([0-9]+)");
                if (mEnd.Success) int.TryParse(mEnd.Groups[1].Value, out end);

                Match mStep = Regex.Match(jsonContent, "\"step\"\\s*:\\s*([0-9]+)");
                if (mStep.Success) int.TryParse(mStep.Groups[1].Value, out step);
                if (step < 1) step = 1;

                Match mDigits = Regex.Match(jsonContent, "\"digits\"\\s*:\\s*([0-9]+)");
                if (mDigits.Success) int.TryParse(mDigits.Groups[1].Value, out digits);

                Match mCols = Regex.Match(jsonContent, "\"cols\"\\s*:\\s*([0-9]+)");
                if (mCols.Success) int.TryParse(mCols.Groups[1].Value, out cols);
                if (cols < 1) cols = 1;

                Match mRows = Regex.Match(jsonContent, "\"rows\"\\s*:\\s*([0-9]+)");
                if (mRows.Success) int.TryParse(mRows.Groups[1].Value, out rows);
                if (rows < 1) rows = 1;

                Match mSpX = Regex.Match(jsonContent, "\"spacingX\"\\s*:\\s*([0-9.]+)");
                if (mSpX.Success) double.TryParse(mSpX.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out spacingX);

                Match mSpY = Regex.Match(jsonContent, "\"spacingY\"\\s*:\\s*([0-9.]+)");
                if (mSpY.Success) double.TryParse(mSpY.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out spacingY);

                Match mPfx = Regex.Match(jsonContent, "\"prefix\"\\s*:\\s*\"([^\"]*)\"");
                if (mPfx.Success) prefix = mPfx.Groups[1].Value;

                Match mSfx = Regex.Match(jsonContent, "\"suffix\"\\s*:\\s*\"([^\"]*)\"");
                if (mSfx.Success) suffix = mSfx.Groups[1].Value;

                Match mMode = Regex.Match(jsonContent, "\"mode\"\\s*:\\s*\"([^\"]*)\"");
                if (mMode.Success) mode = mMode.Groups[1].Value.ToLower();

                Match mOrder = Regex.Match(jsonContent, "\"gridOrder\"\\s*:\\s*\"([^\"]*)\"");
                if (mOrder.Success) gridOrder = mOrder.Groups[1].Value.ToLower();

                Match mCurves = Regex.Match(jsonContent, "\"autoCurves\"\\s*:\\s*(true|false)");
                if (mCurves.Success) autoCurves = mCurves.Groups[1].Value.ToLower() == "true";

                Match mDouble = Regex.Match(jsonContent, "\"doubleNumber\"\\s*:\\s*(true|false)");
                if (mDouble.Success) doubleNumber = mDouble.Groups[1].Value.ToLower() == "true";

                // Generate numbers list
                System.Collections.Generic.List<int> numList = new System.Collections.Generic.List<int>();
                for (int n = start; n <= end; n += step)
                {
                    numList.Add(n);
                }
                if (numList.Count == 0)
                {
                    Console.WriteLine("{\"success\":false,\"message\":\"Jumlah nomor yang dihasilkan adalah 0.\"}");
                    return;
                }

                corel.Optimization = true;
                corel.EventsEnabled = false;
                doc.BeginCommandGroup("GFX IT PRINTING Numerator Machine");

                dynamic sel = corel.ActiveSelection;
                int totalPages = 1;
                int updatedCount = 0;

                if (mode == "inplace" || (sel != null && sel.Shapes.Count > 1 && mode != "grid"))
                {
                    // INPLACE MODE
                    System.Collections.Generic.List<SpatialItem> items = new System.Collections.Generic.List<SpatialItem>();
                    for (int i = 1; i <= sel.Shapes.Count; i++)
                    {
                        dynamic s = sel.Shapes.Item(i);
                        items.Add(new SpatialItem
                        {
                            Shape = s,
                            PosX = (double)s.PositionX,
                            PosY = (double)s.PositionY,
                            Height = (double)s.SizeHeight
                        });
                    }

                    double h0 = items.Count > 0 ? items[0].Height : 1.0;
                    double rowTol = Math.Max(0.2, h0 * 0.35);
                    var sorted = items.OrderByDescending(x => Math.Round(x.PosY / rowTol)).ThenBy(x => x.PosX).ToList();

                    int countToUpdate = Math.Min(sorted.Count, numList.Count);
                    for (int i = 0; i < countToUpdate; i++)
                    {
                        string fNum = GetFormattedNum(numList[i], digits, prefix, suffix);
                        SetShapeNumberText(sorted[i].Shape, fNum, doubleNumber);
                    }
                    updatedCount = countToUpdate;
                    totalPages = 1;
                }
                else if (mode == "page")
                {
                    // PAGE MODE
                    dynamic masterPage = doc.ActivePage ?? doc.Pages.Item(1);
                    dynamic masterTexts = masterPage.Shapes.FindShapes(null, 6, true);
                    System.Collections.Generic.List<SpatialItem> textList = new System.Collections.Generic.List<SpatialItem>();

                    if (masterTexts != null && masterTexts.Count > 0)
                    {
                        for (int k = 1; k <= masterTexts.Count; k++)
                        {
                            dynamic t = masterTexts.Item(k);
                            string raw = "";
                            try { raw = t.Text.Story.Text; } catch { }
                            if (IsNumberPlaceholder(raw))
                            {
                                textList.Add(new SpatialItem
                                {
                                    Shape = t,
                                    PosX = (double)t.PositionX,
                                    PosY = (double)t.PositionY,
                                    Height = (double)t.SizeHeight
                                });
                            }
                        }
                        if (textList.Count == 0)
                        {
                            for (int k = 1; k <= masterTexts.Count; k++)
                            {
                                dynamic t = masterTexts.Item(k);
                                textList.Add(new SpatialItem
                                {
                                    Shape = t,
                                    PosX = (double)t.PositionX,
                                    PosY = (double)t.PositionY,
                                    Height = (double)t.SizeHeight
                                });
                            }
                        }
                    }

                    int itemsPerPage = Math.Max(1, textList.Count);
                    if (textList.Count > 0)
                    {
                        double h0 = textList[0].Height;
                        double rowTol = Math.Max(0.2, h0 * 0.35);
                        textList = textList.OrderByDescending(x => Math.Round(x.PosY / rowTol)).ThenBy(x => x.PosX).ToList();
                    }

                    totalPages = (int)Math.Ceiling((double)numList.Count / itemsPerPage);

                    // Page 1
                    int countPage1 = Math.Min(itemsPerPage, numList.Count);
                    for (int i = 0; i < countPage1; i++)
                    {
                        string numVal = GetFormattedNum(numList[i], digits, prefix, suffix);
                        try { textList[i].Shape.Text.Story.Text = numVal; } catch { }
                    }

                    // Pages 2..totalPages
                    if (totalPages > 1)
                    {
                        masterPage.Shapes.All().Copy();
                        for (int p = 2; p <= totalPages; p++)
                        {
                            dynamic newPage = doc.AddPages(1);
                            newPage.Activate();
                            doc.ActiveLayer.Paste();

                            dynamic newTexts = newPage.Shapes.FindShapes(null, 6, true);
                            System.Collections.Generic.List<SpatialItem> newTextList = new System.Collections.Generic.List<SpatialItem>();
                            if (newTexts != null && newTexts.Count > 0)
                            {
                                for (int k = 1; k <= newTexts.Count; k++)
                                {
                                    dynamic t = newTexts.Item(k);
                                    string raw = "";
                                    try { raw = t.Text.Story.Text; } catch { }
                                    if (IsNumberPlaceholder(raw))
                                    {
                                        newTextList.Add(new SpatialItem
                                        {
                                            Shape = t,
                                            PosX = (double)t.PositionX,
                                            PosY = (double)t.PositionY,
                                            Height = (double)t.SizeHeight
                                        });
                                    }
                                }
                                if (newTextList.Count == 0)
                                {
                                    for (int k = 1; k <= newTexts.Count; k++)
                                    {
                                        dynamic t = newTexts.Item(k);
                                        newTextList.Add(new SpatialItem
                                        {
                                            Shape = t,
                                            PosX = (double)t.PositionX,
                                            PosY = (double)t.PositionY,
                                            Height = (double)t.SizeHeight
                                        });
                                    }
                                }
                                double h0 = newTextList.Count > 0 ? newTextList[0].Height : 1.0;
                                double rowTol = Math.Max(0.2, h0 * 0.35);
                                newTextList = newTextList.OrderByDescending(x => Math.Round(x.PosY / rowTol)).ThenBy(x => x.PosX).ToList();
                            }

                            int startIndex = (p - 1) * itemsPerPage;
                            int countThisPage = Math.Min(itemsPerPage, numList.Count - startIndex);
                            for (int i = 0; i < countThisPage; i++)
                            {
                                string numVal = GetFormattedNum(numList[startIndex + i], digits, prefix, suffix);
                                if (i < newTextList.Count)
                                {
                                    try { newTextList[i].Shape.Text.Story.Text = numVal; } catch { }
                                }
                            }
                        }
                    }
                    updatedCount = numList.Count;
                }
                else
                {
                    // GRID MODE
                    if (sel == null || sel.Shapes.Count == 0)
                    {
                        Console.WriteLine("{\"success\":false,\"message\":\"Silakan seleksi (blok) 1 desain master voucher di CorelDRAW terlebih dahulu.\"}");
                        if (doc != null) doc.EndCommandGroup();
                        corel.Optimization = false;
                        corel.EventsEnabled = true;
                        return;
                    }

                    dynamic masterShape = sel.Shapes.Count > 1 ? sel.Group() : sel.Shapes.Item(1);
                    double w = (double)masterShape.SizeWidth;
                    double h = (double)masterShape.SizeHeight;
                    double origX = (double)masterShape.PositionX;
                    double origY = (double)masterShape.PositionY;

                    int perPage = cols * rows;
                    totalPages = (int)Math.Ceiling((double)numList.Count / perPage);
                    dynamic masterPage = doc.ActivePage ?? doc.Pages.Item(1);

                    // 1. Build grid on Page 1
                    System.Collections.Generic.List<dynamic> page1Shapes = new System.Collections.Generic.List<dynamic>();
                    for (int r = 0; r < rows; r++)
                    {
                        for (int c = 0; c < cols; c++)
                        {
                            double targetPosX = origX + (c * (w + spacingX));
                            double targetPosY = origY - (r * (h + spacingY));

                            if (r == 0 && c == 0)
                            {
                                masterShape.PositionX = targetPosX;
                                masterShape.PositionY = targetPosY;
                                page1Shapes.Add(masterShape);
                            }
                            else
                            {
                                dynamic dup = masterShape.Duplicate();
                                dup.PositionX = targetPosX;
                                dup.PositionY = targetPosY;
                                page1Shapes.Add(dup);
                            }
                        }
                    }

                    // 2. Number Page 1
                    for (int s = 0; s < perPage; s++)
                    {
                        int itemIdx = gridOrder == "cut_stack" ? (s * totalPages) : s;
                        if (itemIdx < numList.Count)
                        {
                            string formattedNum = GetFormattedNum(numList[itemIdx], digits, prefix, suffix);
                            SetShapeNumberText(page1Shapes[s], formattedNum, doubleNumber);
                        }
                        else
                        {
                            try { page1Shapes[s].Delete(); } catch { }
                        }
                    }

                    // 3. Duplicate Page 1 to Pages 2..totalPages and update numbers
                    if (totalPages > 1)
                    {
                        dynamic sheetGroup = masterPage.Shapes.All().Group();
                        sheetGroup.Copy();

                        for (int p = 2; p <= totalPages; p++)
                        {
                            dynamic newPage = doc.AddPages(1);
                            newPage.Activate();
                            int pIdx = p - 1;

                            dynamic pastedGroup = newPage.ActiveLayer.Paste();
                            try { pastedGroup.Ungroup(); } catch { }

                            System.Collections.Generic.List<SpatialItem> newShapes = new System.Collections.Generic.List<SpatialItem>();
                            for (int k = 1; k <= newPage.Shapes.Count; k++)
                            {
                                dynamic shp = newPage.Shapes.Item(k);
                                newShapes.Add(new SpatialItem
                                {
                                    Shape = shp,
                                    PosX = (double)shp.PositionX,
                                    PosY = (double)shp.PositionY,
                                    Height = (double)shp.SizeHeight
                                });
                            }

                            double rowTol = Math.Max(0.2, h * 0.35);
                            var sortedNew = newShapes.OrderByDescending(x => Math.Round(x.PosY / rowTol)).ThenBy(x => x.PosX).ToList();

                            for (int s = 0; s < sortedNew.Count; s++)
                            {
                                int itemIdx = gridOrder == "cut_stack" ? ((s * totalPages) + pIdx) : ((pIdx * perPage) + s);
                                if (itemIdx < numList.Count)
                                {
                                    string formattedNum = GetFormattedNum(numList[itemIdx], digits, prefix, suffix);
                                    SetShapeNumberText(sortedNew[s].Shape, formattedNum, doubleNumber);
                                }
                                else
                                {
                                    try { sortedNew[s].Shape.Delete(); } catch { }
                                }
                            }
                        }

                        try { sheetGroup.Ungroup(); } catch { }
                    }
                    updatedCount = numList.Count;
                }


                // 4. Auto Convert to Curves
                if (autoCurves)
                {
                    for (int p = 1; p <= doc.Pages.Count; p++)
                    {
                        try
                        {
                            dynamic pageObj = doc.Pages.Item(p);
                            dynamic allTexts = pageObj.Shapes.FindShapes(null, 6, true);
                            if (allTexts != null && allTexts.Count > 0)
                            {
                                for (int k = allTexts.Count; k >= 1; k--)
                                {
                                    try { allTexts.Item(k).ConvertToCurves(); } catch { }
                                }
                            }
                        }
                        catch { }
                    }
                }

                doc.EndCommandGroup();
                corel.Optimization = false;
                corel.EventsEnabled = true;
                try { corel.Refresh(); } catch { }
                try { if (corel.ActiveWindow != null) corel.ActiveWindow.Refresh(); } catch { }

                Console.WriteLine(string.Format(
                    "{{\"success\":true,\"count\":{0},\"totalPages\":{1},\"message\":\"Berhasil membuat {0} nomorator pada {1} halaman di CorelDRAW!\"}}",
                    updatedCount, totalPages
                ));
            }
            catch (Exception ex)
            {
                try
                {
                    if (doc != null) doc.EndCommandGroup();
                    if (corel != null)
                    {
                        corel.Optimization = false;
                        corel.EventsEnabled = true;
                        try { corel.Refresh(); } catch { }
                        try { if (corel.ActiveWindow != null) corel.ActiveWindow.Refresh(); } catch { }
                    }
                }
                catch { }

                Console.WriteLine(string.Format("{{\"success\":false,\"message\":\"{0}\"}}", EscapeJson(ex.Message)));
            }
        }

        static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
        }
    }
}

