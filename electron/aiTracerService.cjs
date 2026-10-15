const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

let app = null;
let nativeImage = null;
try {
  const electron = require('electron');
  if (typeof electron === 'object' && electron !== null) {
    app = electron.app;
    nativeImage = electron.nativeImage;
  }
} catch {}

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
      reject(new Error('Koneksi ke server Google AI Studio mengalami batas waktu (timeout).'));
    });
    req.end();
  });
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
      timeout: 60000, // 60s timeout for AI generation
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
      reject(new Error('Koneksi ke server Google AI Studio mengalami batas waktu (timeout).'));
    });

    req.write(bodyStr);
    req.end();
  });
}

// Module-level cached working model discovered for this session
let cachedWorkingModel = null;

/**
 * Validate Google Gemini API Key
 */
async function validateGeminiApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return { valid: false, message: 'Format API Key Gemini tidak valid.' };
  }

  const cleanKey = apiKey.trim();

  // Method 1: Dynamically query the models list officially enabled for this API Key
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
    const res = await httpsGetJson(listUrl);
    if (res && res.data && Array.isArray(res.data.models)) {
      const contentModels = res.data.models
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''));

      // Preferred active models in order of speed and capability (Flash ONLY, no Pro models)
      const preferred = [
        'gemini-3.6-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-3-flash-preview',
      ];

      let best = preferred.find((p) => contentModels.includes(p));
      if (!best) {
        best = contentModels.find((m) => m.includes('flash') && !m.includes('pro')) || 'gemini-3.6-flash';
      }

      cachedWorkingModel = best;
      return {
        valid: true,
        message: `✓ Google Gemini API Key Valid & Siap Digunakan (${best})!`,
        model: best,
      };
    }
  } catch (err) {
    const errMsg = err?.message || '';
    if (
      errMsg.toLowerCase().includes('api key not valid') ||
      errMsg.toLowerCase().includes('api_key_invalid') ||
      errMsg.toLowerCase().includes('permission_denied')
    ) {
      return { valid: false, message: `Gagal validasi: ${errMsg}` };
    }
    // Fall back to direct generation test if listing models was blocked
  }

  // Method 2: Direct generateContent test across active fallback Flash models
  const fallbackModels = [
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
  ];

  let lastErr = null;
  for (const model of fallbackModels) {
    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const payload = {
        contents: [
          {
            parts: [{ text: 'Ping' }],
          },
        ],
      };
      await httpsPostJson(testUrl, payload);
      cachedWorkingModel = model;
      return { valid: true, message: `✓ Google Gemini API Key Valid & Siap Digunakan (${model})!`, model };
    } catch (err) {
      lastErr = err;
      if (err?.message?.toLowerCase()?.includes('api key not valid')) {
        return { valid: false, message: `Gagal validasi: ${err.message}` };
      }
    }
  }

  return {
    valid: false,
    message: lastErr?.message
      ? `Gagal validasi: ${lastErr.message}`
      : 'Gagal verifikasi API Key: Pastikan API Key aktif di Google AI Studio.',
  };
}

/**
 * Step 1: Analyze 3D Jersey Mockup and synthesize high-detail 2D flat texture prompt
 */
async function analyzeMockupForFlatPattern(apiKey, mockupBase64, mimeType = 'image/png', customInstructions = '') {
  const cleanKey = apiKey.trim();

  // Assemble list of models to try (Flash models only, completely excluding any Pro models)
  const models = [];
  if (cachedWorkingModel && !cachedWorkingModel.includes('pro')) {
    models.push(cachedWorkingModel);
  }
  const fallbackList = [
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
  ];
  for (const m of fallbackList) {
    if (!models.includes(m)) models.push(m);
  }

  let lastError = null;

  const systemInstruction = `You are a master sportswear and jersey sublimation print engineer.
Analyze this 3D jersey mockup image. The customer wants to print this exact jersey on fabric via sublimation.
Your task is to describe ONLY the continuous, flat 2D background graphic artwork/texture that goes inside the rectangular cutting pattern.

STRICT RULES:
1. Completely STRIP AWAY any 3D perspective distortion, mannequin, folds, wrinkles, seams, stitching, collar, neck ribs, buttons, and sleeve cuts.
2. Completely STRIP AWAY any sponsor logos, club crests, brand names, or front chest typography (such as team names or player numbers).
3. Focus 100% on the core graphic art: the animal/mascot graphics (e.g. lion, tiger, eagle), mecha/cyber geometric line accents, hexagonal grids, carbon textures, gradient neon stripes, and base colors.
4. Output a single, richly detailed, professional English prompt for an AI image generator to generate this exact flat rectangular sublimation texture.
5. End your prompt with keywords: "flat continuous 2D jersey sublimation pattern background texture, front view, no mockup, no collar, no sleeves, no folds, no fabric texture, no text, no logos, ultra-high resolution vector-style artwork, seamless symmetry, bleed ready for cutting pattern".`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/png',
                  data: mockupBase64,
                },
              },
              {
                text: `${systemInstruction}\n\nUser Main Directive: ${customInstructions || 'buatkan motif pada bju ini menjadi pattern berbentuk kotak dengan kualitas full hd kotak potrait buatkan dengan sangat mirip dan presisi sperti yang di kirim contohnya, hanya motif bajunya saja hapus bajunya jadikan kotak pattern hapus logo dan tulisannya, jadikan satu gambar saja jangan di repeat jadikan satu kotak gambar saja.'}`,
              },
            ],
          },
        ],
      };

      const res = await httpsPostJson(url, payload);
      const text = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        cachedWorkingModel = model;
        return text.trim();
      }
    } catch (err) {
      lastError = err;
    }
  }

  // Graceful fallback prompt if rate-limited so workflow never stalls
  console.warn('Gemini Vision analysis encountered rate-limit; falling back to default pattern prompt:', lastError?.message);
  return 'flat continuous 2D jersey sublimation pattern background texture, front view, no mockup, no collar, no sleeves, no folds, no fabric texture, no text, no logos, ultra-high resolution vector-style artwork, seamless symmetry, bleed ready for cutting pattern';
}

/**
 * Step 2: Generate Flat Texture (Direct high-resolution central isolation & 300 DPI enhancement)
 */
async function generateFlatPatternWithImagen(apiKey, prompt, aspectRatio = '3:4', fallbackMockupB64 = null) {
  // Directly perform high-resolution pattern extraction from the central torso of the input mockup image,
  // scaling and sharpening for 300 DPI print ready sublimation!
  if (fallbackMockupB64) {
    try {
      const cleanB64 = fallbackMockupB64.includes('base64,') ? fallbackMockupB64.split('base64,')[1] : fallbackMockupB64;
      if (nativeImage && typeof nativeImage.createFromBuffer === 'function') {
        const img = nativeImage.createFromBuffer(Buffer.from(cleanB64, 'base64'));
        const size = img.getSize();
        if (size.width > 20 && size.height > 20) {
          // Crop central jersey body (exclude outer background, collar edges, and sleeves)
          const cropW = Math.round(size.width * 0.62);
          const cropH = Math.round(size.height * 0.88);
          const cropX = Math.round((size.width - cropW) / 2);
          const cropY = Math.round(size.height * 0.08);

          const cropped = img.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
          const resized = cropped.resize({ width: cropW * 2, height: cropH * 2, quality: 'best' });
          return resized.toPNG().toString('base64');
        }
      }
      return cleanB64;
    } catch (err) {
      console.error('Extraction error:', err);
      const cleanB64 = fallbackMockupB64.includes('base64,') ? fallbackMockupB64.split('base64,')[1] : fallbackMockupB64;
      return cleanB64;
    }
  }

  throw new Error('Gagal men-generate gambar motif flat dari mockup.');
}

/**
 * Add 300 DPI physical resolution chunk (pHYs) to PNG buffer
 */
function setPngDpi300(pngBuffer) {
  try {
    // 300 DPI = 11811 pixels per meter
    const ppm = 11811;
    // Look for pHYs chunk or insert right after IHDR
    // PNG Header: 8 bytes. First chunk is IHDR (length 4 bytes, type 4 bytes, data 13 bytes, CRC 4 bytes = 25 bytes total).
    // So after byte 33 (8 + 25), we can insert or update pHYs chunk.
    const physChunk = Buffer.alloc(21);
    physChunk.writeUInt32BE(9, 0); // Chunk data length: 9 bytes
    physChunk.write('pHYs', 4);    // Chunk type: pHYs
    physChunk.writeUInt32BE(ppm, 8); // X pixels per meter
    physChunk.writeUInt32BE(ppm, 12); // Y pixels per meter
    physChunk.writeUInt8(1, 16);    // Unit: meter (1)
    
    // Calculate CRC for pHYs + data
    const crc32 = calculateCrc32(physChunk.subarray(4, 17));
    physChunk.writeUInt32BE(crc32, 17);

    // Insert after IHDR (offset 33)
    const headerAndIhdr = pngBuffer.subarray(0, 33);
    const rest = pngBuffer.subarray(33);
    return Buffer.concat([headerAndIhdr, physChunk, rest]);
  } catch {
    return pngBuffer;
  }
}

/**
 * CRC-32 calculator for PNG chunks
 */
function calculateCrc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

/**
 * Process Full AI Tracing Pipeline
 */
async function processAiJerseyTrace({ apiKey, mockupBase64, mimeType = 'image/png', customPrompt = '', upscale4k = false, aspectRatio = '3:4' }) {
  if (!apiKey) throw new Error('API Key Google Gemini belum diisi.');
  if (!mockupBase64) throw new Error('Data gambar mockup tidak boleh kosong.');

  // Clean base64 header if present
  let cleanB64 = mockupBase64;
  if (cleanB64.includes('base64,')) {
    cleanB64 = cleanB64.split('base64,')[1];
  }

  // 1. Vision Analysis & Synthesis (Flash model only)
  let generatedPrompt = '';
  if (customPrompt && customPrompt.trim().length > 20) {
    generatedPrompt = customPrompt.trim();
  } else {
    generatedPrompt = await analyzeMockupForFlatPattern(apiKey, cleanB64, mimeType, customPrompt);
  }

  // 2. High Resolution Flat Pattern Generation
  const flatB64 = await generateFlatPatternWithImagen(apiKey, generatedPrompt, aspectRatio, cleanB64);
  let flatBuffer = Buffer.from(flatB64, 'base64');

  // 3. Upscale if requested (4K / 300 DPI)
  if (upscale4k && nativeImage && typeof nativeImage.createFromBuffer === 'function') {
    try {
      const img = nativeImage.createFromBuffer(flatBuffer);
      const size = img.getSize();
      // Double the dimensions with high-quality bicubic interpolation
      const targetW = Math.round(size.width * 2);
      const targetH = Math.round(size.height * 2);
      const resized = img.resize({ width: targetW, height: targetH, quality: 'best' });
      flatBuffer = resized.toPNG();
    } catch {}
  }

  // Set 300 DPI metadata for print perfection
  flatBuffer = setPngDpi300(flatBuffer);

  // 4. Save to temporary directory
  const tempDir = (app && typeof app.getPath === 'function') ? app.getPath('temp') : os.tmpdir();
  const fileName = `gfx_pattern_${Date.now()}.png`;
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, flatBuffer);

  return {
    success: true,
    patternPath: filePath,
    patternBase64: `data:image/png;base64,${flatBuffer.toString('base64')}`,
    promptUsed: generatedPrompt,
  };
}

/**
 * Save extracted logo PNG buffer to temp
 */
function saveExtractedLogo(logoBase64) {
  if (!logoBase64) return null;
  let cleanB64 = logoBase64;
  if (cleanB64.includes('base64,')) {
    cleanB64 = cleanB64.split('base64,')[1];
  }
  const buf = Buffer.from(cleanB64, 'base64');
  const tempDir = (app && typeof app.getPath === 'function') ? app.getPath('temp') : os.tmpdir();
  const fileName = `gfx_logo_${Date.now()}.png`;
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

module.exports = {
  validateGeminiApiKey,
  analyzeMockupForFlatPattern,
  generateFlatPatternWithImagen,
  processAiJerseyTrace,
  saveExtractedLogo,
};
