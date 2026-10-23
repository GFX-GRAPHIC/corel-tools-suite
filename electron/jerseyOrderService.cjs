const fs = require('fs');
const path = require('path');
const https = require('https');

let nativeImage = null;
try {
  const electron = require('electron');
  if (electron && electron.nativeImage) {
    nativeImage = electron.nativeImage;
  }
} catch {}

let LensCore = null;
let imageDimensionsFromData = null;

async function loadLensModule() {
  if (LensCore && imageDimensionsFromData) return;
  try {
    let lensCoreMod;
    try {
      lensCoreMod = await import('chrome-lens-ocr/src/core.js');
    } catch {
      try {
        lensCoreMod = await import('../node_modules/chrome-lens-ocr/src/core.js');
      } catch {
        const fullPth = path.join(__dirname, '../node_modules/chrome-lens-ocr/src/core.js');
        lensCoreMod = await import('file:///' + fullPth.replace(/\\/g, '/'));
      }
    }
    LensCore = lensCoreMod.default || lensCoreMod;
  } catch (err) {
    console.error('[Google Lens Service] Error loading LensCore:', err);
  }

  try {
    let dimMod;
    try {
      dimMod = await import('image-dimensions');
    } catch {
      try {
        dimMod = await import('../node_modules/image-dimensions/dist/index.js');
      } catch {
        const fullPth = path.join(__dirname, '../node_modules/image-dimensions/dist/index.js');
        dimMod = await import('file:///' + fullPth.replace(/\\/g, '/'));
      }
    }
    imageDimensionsFromData = dimMod.imageDimensionsFromData;
  } catch (err) {
    console.error('[Google Lens Service] Error loading image-dimensions:', err);
  }
}

/**
 * Perform HTTPS GET request returning parsed JSON
 */
function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
      timeout: 20000,
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: parsed });
          } else {
            const errMsg = parsed?.error?.message || `HTTP ${res.statusCode}: ${responseBody.substring(0, 200)}`;
            reject(new Error(errMsg));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, raw: responseBody });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseBody.substring(0, 200)}`));
          }
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Koneksi timeout.'));
    });
    req.end();
  });
}

let cachedJerseyModel = null;

async function getAvailableGeminiModels(cleanKey) {
  const preferred = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-flash-latest',
  ];

  if (cachedJerseyModel) {
    return [cachedJerseyModel, ...preferred.filter((m) => m !== cachedJerseyModel)];
  }

  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
    const res = await httpsGetJson(listUrl);
    if (res && res.data && Array.isArray(res.data.models)) {
      const active = res.data.models
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''));

      const filtered = preferred.filter((m) => active.includes(m));
      if (filtered.length > 0) {
        cachedJerseyModel = filtered[0];
        return [...filtered, ...active.filter((m) => m.includes('flash'))];
      }
    }
  } catch (err) {
    console.warn('[Gemini Model Discovery] Could not list models:', err.message);
  }

  return preferred;
}

/**
 * Perform HTTPS POST request with JSON
 */
function httpsPostJson(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyStr = JSON.stringify(data);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: parsed });
          } else {
            const errMsg = parsed?.error?.message || `HTTP ${res.statusCode}: ${responseBody.substring(0, 200)}`;
            reject(new Error(errMsg));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, raw: responseBody });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseBody.substring(0, 200)}`));
          }
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Koneksi ke Google AI Studio mengalami batas waktu (timeout).'));
    });

    req.write(bodyStr);
    req.end();
  });
}

/**
 * Size ordering index for sorting
 */
const SIZE_ORDER = [
  'XXS ANAK', 'XS ANAK', 'S ANAK', 'M ANAK', 'L ANAK', 'XL ANAK', 'XXL ANAK',
  '2', '4', '6', '8', '10', '12', '14', '16',
  'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL'
];
function getSizeRank(sz) {
  if (!sz) return 99;
  const s = String(sz).trim().toUpperCase();
  const idx = SIZE_ORDER.indexOf(s);
  return idx === -1 ? 50 : idx;
}

function cleanPlayerName(str) {
  if (!str) return '';
  let s = String(str).trim();
  // Strip leading numbering e.g. "1. ", "12) ", "[1] ", "1 " (when followed by letters or open paren)
  s = s.replace(/^\s*(?:\[\s*\d+\s*\]|\d+[\.\)\-:]\s*|\d+\s+(?=[A-Za-z\(\[\{])|\*\s*)/, '').trim();
  // Remove size enclosed in parentheses/brackets e.g. "(S)", "( M )", "(XL)", "[L]", "{XXL}"
  s = s.replace(/[\(\[\{]\s*(?:7XL|6XL|5XL|4XL|XXXXL|3XL|XXXL|XXL|2XL|XL|L|M|S|XS|XXS|S\s*ANAK|M\s*ANAK|L\s*ANAK|XL\s*ANAK|XXL\s*ANAK)\s*[\)\]\}]/gi, ' ').trim();
  // Remove any leftover empty parentheses, brackets, or braces: "()", "( )", "[]", "[ ]", "{}", "{ }"
  s = s.replace(/[\(\[\{]\s*[\)\]\}]/g, ' ').trim();
  // Remove leftover field labels like "Nama:", "Name:", "Punggung:", "Nama Punggung:"
  s = s.replace(/^(?:nama|name|punggung|nama\s*punggung)\s*[:=-]?\s*/i, '').trim();
  // Remove leftover leading/trailing punctuation like '-', '/', ',', '|', ':'
  s = s.replace(/^[\s\-\/\|:,]+|[\s\-\/\|:,]+$/g, '').trim();
  // Clean empty parentheses once more in case stripped punctuation revealed them
  s = s.replace(/[\(\[\{]\s*[\)\]\}]/g, ' ').trim();
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function cleanPlayerNumber(num) {
  if (num === null || num === undefined) return '-';
  let str = String(num).trim();
  if (!str || str === '-' || /^(?:tanpa\s*no(?:mor)?|ga\s*pake\s*no(?:mor)?|no\s*nomor|none|null|undefined)$/i.test(str)) {
    return '-';
  }
  str = str.replace(/[\(\)\[\]\{\}]/g, '').trim();
  str = str.replace(/^(?:no\.?|nomor|nomer|#)\s*[:=-]?\s*/i, '').trim();
  return str || '-';
}

function cleanPlayerSize(sz) {
  if (!sz) return 'L';
  let str = String(sz).trim().toUpperCase();
  str = str.replace(/[\(\)\[\]\{\}'"]/g, '').trim();
  str = str.replace(/^(?:size|ukuran|uk\.?|sz\.?)\s*[:=-]?\s*/i, '').trim();
  if (str === '2XL') return 'XXL';
  if (str === '3XL') return 'XXXL';
  if (str === '4XL') return 'XXXXL';
  return str || 'L';
}

/**
 * Scan an image buffer or base64 using direct Google Lens OCR
 */
async function scanWithGoogleLens(input) {
  await loadLensModule();
  if (!LensCore) {
    throw new Error('Modul Google Lens OCR internal tidak dapat dimuat.');
  }

  let buffer;
  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (typeof input === 'string') {
    if (input.startsWith('data:image')) {
      const cleanB64 = input.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(cleanB64, 'base64');
    } else if (fs.existsSync(input)) {
      buffer = fs.readFileSync(input);
    } else {
      buffer = Buffer.from(input, 'base64');
    }
  } else {
    throw new Error('Format gambar tidak dikenali.');
  }

  // Get dimensions & optimize
  let width = 0;
  let height = 0;
  let pngBuffer = buffer;

  if (nativeImage) {
    try {
      const img = nativeImage.createFromBuffer(buffer);
      if (!img.isEmpty()) {
        const size = img.getSize();
        width = size.width;
        height = size.height;
        if (width > 1600 || height > 1600) {
          const scale = 1600 / Math.max(width, height);
          const tw = Math.round(width * scale);
          const th = Math.round(height * scale);
          pngBuffer = img.resize({ width: tw, height: th, quality: 'better' }).toPNG();
          width = tw;
          height = th;
        } else {
          pngBuffer = img.toPNG();
        }
      }
    } catch {}
  }

  if (!width || !height) {
    if (imageDimensionsFromData) {
      try {
        const dim = imageDimensionsFromData(Uint8Array.from(buffer));
        if (dim && dim.width && dim.height) {
          width = dim.width;
          height = dim.height;
        }
      } catch {}
    }
  }

  if (!width || !height) {
    width = 1000;
    height = 1000;
  }

  const lens = new LensCore();
  const uint8 = Uint8Array.from(pngBuffer);
  const result = await lens.scanByData(uint8, 'image/png', [width, height]);

  const rawText = (result.segments || []).map(s => s.text).filter(Boolean).join('\n');
  return {
    success: true,
    text: rawText,
    language: result.language || '',
    segmentsCount: result.segments?.length || 0,
  };
}

/**
 * Clean & structure jersey order list with Gemini AI
 */
async function parseJerseyWithGemini({ rawText, imageBase64, apiKey, defaultSponsor = '', caseMode = 'asis' }) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    throw new Error('API Key Google Gemini belum diatur atau tidak valid.');
  }

  const cleanKey = apiKey.trim();
  const modelsToTry = await getAvailableGeminiModels(cleanKey);

  const systemInstruction = `Anda adalah asisten spesialis produksi jersey olahraga dan konveksi printing profesional.
Tugas Anda adalah merapihkan daftar pesanan jersey yang mungkin berantakan, acak, berasal dari chat WhatsApp, catatan tangan, format multi-baris (contoh 1:Nama\\nNo:12\\nUk:L), atau hasil pindai OCR foto.

ATURAN KETAT PRODUKSI JERSEY:
1. NAMA PUNGGUNG (ZERO-TYPO & 100% PERSIS):
   Ekstrak nama utama pemain untuk dicetak di punggung belakang jersey (field: "nama_punggung").
   Salin karakter per karakter persis seperti teks input aslinya! DILARANG KERAS memperbaiki ejaan, dilarang mengoreksi typo konsumen, dan dilarang mengubah susunan huruf.
   WAJIB BERSIH DARI TANDA KURUNG UKURAN:
   Jika ukuran ditulis di dalam tanda kurung setelah nama (contoh: "GAVRIEL (S) Nomer 28", "ALFA (M)", "DAMAR (L)"), field "nama_punggung" WAJIB BERSIH menjadi "GAVRIEL", "ALFA", "DAMAR".
   JANGAN PERNAH menyisakan tanda kurung kosong "()" atau "[]" pada nama_punggung (DILARANG KERAS menghasilkan "GAVRIEL ()" atau "ALFA ()")!
2. NAMA DADA DEPAN: Jika konsumen menulis spesifik ada nama dada depan (contoh: "Dada: KEVIN", "Nama Dada: RIZKY 99", "Depan: POLRESTABES"), masukkan ke field: "nama_dada". Jika tidak ada nama dada, isi dengan string kosong "".
3. NOMOR PUNGGUNG (PERTAHANKAN ANGKA NOL DI DEPAN):
   Ekstrak nomor punggung (field: "nomor").
   PERTAHANKAN ANGKA NOL DI DEPAN ("007", "022", "015", "01", "08"). JANGAN PERNAH menghapus angka nol di depan nomor karena itu adalah nomor resmi pemain (jangan ubah 007 jadi 7)!
   Jika pemain tidak punya nomor / tanpa nomor, isi dengan string "-".
4. UKURAN (SIZE):
   - Dewasa: XXS, XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL, 6XL, 7XL (jika "2XL" ubah jadi "XXL").
   - Anak-Anak: WAJIB PERTAHANKAN kata ANAK (misal: "S ANAK", "M ANAK", "L ANAK", "XL ANAK", "XXL ANAK") atau angka usia anak ("4", "6", "8", "10", "12"). JANGAN hilangkan kata ANAK!
   - Default jika ukuran tidak disebutkan sama sekali: "L".
5. KETERANGAN: Info pendukung seperti "HOODIE", "GK Kiper", "Kapten", atau catatan khusus masukkan ke field: "keterangan".
6. Celana dan panjang/pendek lengan TIDAK PERLU diekstrak ke kolom khusus karena Auto-Layout CorelDRAW hanya menata nama dan nomor jersey.

ATURAN KRUSIAL: VARIASI NAMA DENGAN ANGKA / SIMBOL (JANGAN PERNAH DIPISAH!):
a. Di dunia percetakan jersey, banyak konsumen memesan nama punggung yang memiliki variasi angka, tanda hubung (-), garis bawah (_), atau format gamertag/nickname.
   Contoh nyata:
   - "Padli-046" -> "nama_punggung": "Padli-046", "nomor": "-" (Angka 046 menyatu dengan strip, jadi 046 ADALAH BAGIAN DARI NAMA, BUKAN NOMOR PUNGGUNG!).
   - "SYARIF_007" -> "nama_punggung": "SYARIF_007", "nomor": "-" (Angka 007 menyatu dengan underscore, jadi 007 ADALAH BAGIAN DARI NAMA!).
   - "Rizal11_" -> "nama_punggung": "Rizal11_", "nomor": "-" (Angka 11 menempel di nama, jadi BAGIAN DARI NAMA!).
   - "1M15_NS" -> "nama_punggung": "1M15_NS", "nomor": "-"
   - "74" (ketika berada di kolom nama atau tanpa nama lain) -> "nama_punggung": "74", "nomor": "-"
   - "CR7" -> "nama_punggung": "CR7", "nomor": "-"
   - "AGENT-007" -> "nama_punggung": "AGENT-007", "nomor": "-"
   JANGAN PERNAH memisahkan angka yang terhubung dengan tanda hubung (-), garis bawah (_), atau menempel huruf dari nama pemain!

b. DAFTAR HANYA NAMA DAN UKURAN (TANPA KOLOM NOMOR):
   Jika daftar pesanan hanya memiliki kolom NAMA dan UKURAN (seperti contoh: "1. Padli-046 ( L )", "7. SYARIF_007 ( L )", "13. 74 ( M )"), maka SELURUH baris pesanan tersebut TIDAK MEMILIKI NOMOR ("nomor": "-"). Semua teks di kolom nama adalah NAMA PUNGGUNG.

c. KAPAN NOMOR PUNGGUNG BOLEH DIPISAH?
   Nomor punggung HANYA diekstrak jika:
   1. Ada label eksplisit, misalnya: "No: 10", "Nomor: 07", "#7", "No.Punggung: 12".
   2. ATAU terdapat kolom nomor tersendiri yang terpisah jelas (misalnya: "NAMA | NOMOR | UKURAN").
   3. ATAU angka berdiri sendiri yang dipisahkan oleh spasi jelas dari nama (misalnya: "BUDI 10 L", "EKO - 07 - M").
   Namun jika angka tersambung dengan tanda hubung atau underscore tanpa spasi (seperti "Padli-046" atau "SYARIF_007"), angka tersebut WAJIB dimasukkan ke dalam NAMA PUNGGUNG dan nomor punggung diberi "-".

7. URUTKAN hasil akhir berdasarkan hierarki ukuran pakaian dari terkecil ke terbesar:
   S ANAK -> M ANAK -> L ANAK -> XL ANAK -> XXL ANAK -> XXS -> XS -> S -> M -> L -> XL -> XXL -> 3XL -> 4XL -> 5XL.
8. Kembalikan HANYA format JSON murni berupa array of objects tanpa backtick markdown (\`\`\`json) dan tanpa penjelasan tambahan.

Format output:
[
  {
    "nama_punggung": "Padli-046",
    "nama_dada": "",
    "nomor": "-",
    "ukuran": "L",
    "keterangan": ""
  },
  {
    "nama_punggung": "SYARIF_007",
    "nama_dada": "",
    "nomor": "-",
    "ukuran": "L",
    "keterangan": ""
  },
  {
    "nama_punggung": "bauntung batuah baiman",
    "nama_dada": "",
    "nomor": "-",
    "ukuran": "XL",
    "keterangan": "HOODIE"
  }
]`;

  const contents = [];
  const parts = [];

  if (imageBase64) {
    const cleanB64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    parts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: cleanB64,
      },
    });
  }

  let userPrompt = `Rapihkan dan urutkan list pesanan jersey berikut berdasarkan ukuran pakaian:\n\n${rawText || ''}`;
  if (defaultSponsor) {
    userPrompt += `\n\nCatatan Tim / Sponsor Utama: ${defaultSponsor}`;
  }
  parts.push({ text: userPrompt });

  contents.push({ parts });

  const payload = {
    contents,
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.0,
      response_mime_type: 'application/json',
    },
  };

  let response = null;
  let lastError = null;
  let usedModel = '';

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      response = await httpsPostJson(url, payload);
      const candidates = response?.data?.candidates;
      if (candidates && candidates.length > 0) {
        cachedJerseyModel = model;
        usedModel = model;
        break;
      }
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      console.warn(`[Gemini API] Model ${model} failed:`, msg);
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('permission_denied')) {
        throw new Error('API Key Google Gemini tidak valid. Silakan periksa kembali API Key Anda.');
      }
    }
  }

  if (!response || !response.data?.candidates?.length) {
    throw new Error(lastError?.message || 'Google Gemini gagal memproses permintaan.');
  }

  const candidates = response.data.candidates;
  const rawJson = candidates[0]?.content?.parts?.[0]?.text?.trim() || '';
  let items = [];
  try {
    items = JSON.parse(rawJson);
  } catch (e) {
    // Attempt to extract array from string if wrapped in markdown or extra text
    let cleaned = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
    items = JSON.parse(cleaned);
  }

  if (!Array.isArray(items)) {
    throw new Error('Hasil AI bukan berupa array pesanan valid.');
  }

  // Sanitize, normalize casing, sort by size
  const sanitized = items.map((it, idx) => {
    let namaPunggung = cleanPlayerName(it.nama_punggung || it.nama || it.name || '');
    let namaDada = cleanPlayerName(it.nama_dada || it.dada || '');
    let nomor = cleanPlayerNumber(it.nomor);

    // Auto-heal: If nama and nomor were connected by '-' or '_' in rawText (e.g. Padli-046, SYARIF_007), reunite them into nama_punggung and set nomor to '-'
    if (rawText && nomor !== '-') {
      if (namaPunggung && namaPunggung !== '-') {
        const escapedName = namaPunggung.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedNum = nomor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const numPattern = '0*' + escapedNum.replace(/^0+/, '');
        const regexJoined = new RegExp('(\\b' + escapedName + ')([-_])(' + numPattern + '\\b)', 'i');
        const match = rawText.match(regexJoined);
        if (match) {
          namaPunggung = match[0];
          nomor = '-';
        }
      }

      // Check if number was actually the player name (e.g. "6. 74 ( M )")
      if (!namaPunggung || namaPunggung === '-' || namaPunggung === 'PEMAIN') {
        const escapedNum = nomor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexSoleNumber = new RegExp('^\\s*(?:\\[\\s*\\d+\\s*\\]|\\d+[\\.\\)\\-:]\\s*)?(' + escapedNum + ')\\s*(?:\\([\\s\\S]*?\\)|[A-Z0-9]+)?\\s*$', 'im');
        const matchSole = rawText.match(regexSoleNumber);
        if (matchSole) {
          namaPunggung = matchSole[1];
          nomor = '-';
        }
      }
    }

    if (caseMode === 'upper') namaPunggung = namaPunggung.toUpperCase();
    else if (caseMode === 'title') {
      namaPunggung = namaPunggung.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    if (caseMode === 'upper') namaDada = namaDada.toUpperCase();
    else if (caseMode === 'title') {
      namaDada = namaDada.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    let ukuran = cleanPlayerSize(it.ukuran || it.size || 'L');

    return {
      id: idx + 1,
      nama: namaPunggung,
      nama_punggung: namaPunggung,
      nama_dada: namaDada,
      dada: namaDada,
      nomor,
      ukuran: ukuran || 'L',
      keterangan: String(it.keterangan || it.posisi || it.note || '').trim(),
      sponsor: defaultSponsor || '',
    };
  });

  // Sort by size hierarchy
  sanitized.sort((a, b) => {
    const diff = getSizeRank(a.ukuran) - getSizeRank(b.ukuran);
    if (diff !== 0) return diff;
    return a.id - b.id;
  });

  // Re-index
  sanitized.forEach((it, idx) => { it.id = idx + 1; });

  return sanitized;
}

/**
 * Combined pipeline: Google Lens OCR + Gemini AI
 */
async function scanAndCleanJerseyWithLensAndAi({ imageBase64, imagePath, apiKey, defaultSponsor = '', caseMode = 'asis' }) {
  // Step 1: Google Lens OCR
  let lensResult = null;
  let lensText = '';
  try {
    const input = imageBase64 || imagePath;
    lensResult = await scanWithGoogleLens(input);
    lensText = lensResult.text || '';
  } catch (err) {
    console.warn('[Google Lens OCR warning]:', err.message);
  }

  // Step 2: Pass Google Lens OCR text + image to Gemini AI
  if (!apiKey) {
    throw new Error('API Key Google Gemini belum diatur. Masukkan API Key untuk melanjutkan.');
  }

  let promptText = lensText;
  if (!promptText) {
    promptText = 'Pindai seluruh daftar pesanan pemain dari foto jersey ini dan ekstrak nama, nomor, serta ukuran baju.';
  } else {
    promptText = `Berikut adalah hasil scan teks mentah dari foto menggunakan Google Lens:\n\n${lensText}\n\nPeriksa kembali dan sesuaikan dengan foto untuk mengekstrak seluruh nama, nomor punggung, dan ukuran baju dengan tepat.`;
  }

  const items = await parseJerseyWithGemini({
    rawText: promptText,
    imageBase64,
    apiKey,
    defaultSponsor,
    caseMode,
  });

  return {
    success: true,
    items,
    lensRawText: lensText,
    segmentsCount: lensResult?.segmentsCount || 0,
  };
}

module.exports = {
  scanWithGoogleLens,
  parseJerseyWithGemini,
  scanAndCleanJerseyWithLensAndAi,
  getSizeRank,
  cleanPlayerName,
  cleanPlayerNumber,
  cleanPlayerSize,
};
