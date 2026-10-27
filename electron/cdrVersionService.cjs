const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * CDR Version Map
 */
const CDR_VERSION_MAP = {
  '1100': { name: 'CorelDRAW 11', short: 'v11', num: 11 },
  '1200': { name: 'CorelDRAW 12', short: 'v12', num: 12 },
  '1300': { name: 'CorelDRAW X3', short: 'X3', num: 13 },
  '1400': { name: 'CorelDRAW X4', short: 'X4', num: 14 },
  '1500': { name: 'CorelDRAW X5', short: 'X5', num: 15 },
  '1600': { name: 'CorelDRAW X6', short: 'X6', num: 16 },
  '1700': { name: 'CorelDRAW X7', short: 'X7', num: 17 },
  '1800': { name: 'CorelDRAW X8', short: 'X8', num: 18 },
  '1900': { name: 'CorelDRAW 2017', short: '2017', num: 19 },
  '2000': { name: 'CorelDRAW 2018', short: '2018', num: 20 },
  '2100': { name: 'CorelDRAW 2019', short: '2019', num: 21 },
  '2200': { name: 'CorelDRAW 2020', short: '2020', num: 22 },
  '2300': { name: 'CorelDRAW 2021', short: '2021', num: 23 },
  '2310': { name: 'CorelDRAW 2021 (v23.1)', short: '2021', num: 23 },
  '2400': { name: 'CorelDRAW 2022', short: '2022', num: 24 },
  '2450': { name: 'CorelDRAW 2023', short: '2023', num: 24 },
  '2500': { name: 'CorelDRAW 2024', short: '2024', num: 25 },
  '2550': { name: 'CorelDRAW 2024 (v25.5)', short: '2024', num: 25 },
  '2600': { name: 'CorelDRAW 2025 / 2026', short: '2026', num: 26 },
  '2700': { name: 'CorelDRAW 2026 / 2027', short: '2027', num: 27 },
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function inspectCdrFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, filePath, fileName: path.basename(filePath), message: 'File tidak ditemukan' };
    }

    const stat = fs.statSync(filePath);
    const fd = fs.openSync(filePath, 'r');
    const headBuf = Buffer.alloc(16);
    fs.readSync(fd, headBuf, 0, 16, 0);

    const magic = headBuf.subarray(0, 4).toString('utf8');

    // 1. Legacy RIFF (CorelDRAW 1 - X3 / v13)
    if (magic === 'RIFF') {
      const riffType = headBuf.subarray(8, 12).toString('utf8');
      fs.closeSync(fd);
      let verNum = 0;
      let verName = 'Legacy CDR';
      if (riffType.startsWith('CDR')) {
        const vChar = riffType.charAt(3);
        const vHex = parseInt(vChar, 16);
        if (!isNaN(vHex)) {
          verNum = vHex;
          verName = `CorelDRAW ${vHex}`;
          if (vHex === 13) verName = 'CorelDRAW X3 (v13)';
        }
      }
      return {
        success: true,
        filePath,
        fileName: path.basename(filePath),
        fileSize: formatBytes(stat.size),
        sizeBytes: stat.size,
        isZip: false,
        productName: verName,
        appVersion: verNum ? `${verNum}00` : 'RIFF',
        humanVersion: verName,
        versionNum: verNum,
        thumbnailBase64: null,
        fontsUsed: [],
        pages: 1
      };
    }

    // 2. Modern ZIP package format (X4 / v14 up to 2024 / v25)
    if (magic !== 'PK\x03\x04') {
      fs.closeSync(fd);
      return { success: false, filePath, fileName: path.basename(filePath), message: 'Bukan file CorelDRAW (.cdr) yang valid' };
    }

    const fileSize = stat.size;
    const readLen = Math.min(65536, fileSize);
    const endBuf = Buffer.alloc(readLen);
    fs.readSync(fd, endBuf, 0, readLen, fileSize - readLen);

    let eocdOffset = -1;
    for (let i = readLen - 22; i >= 0; i--) {
      if (endBuf[i] === 0x50 && endBuf[i+1] === 0x4b && endBuf[i+2] === 0x05 && endBuf[i+3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      fs.closeSync(fd);
      return { success: false, filePath, fileName: path.basename(filePath), message: 'Struktur ZIP file CDR rusak' };
    }

    const cdTotalEntries = endBuf.readUInt16LE(eocdOffset + 10);
    const cdSize = endBuf.readUInt32LE(eocdOffset + 12);
    const cdOffset = endBuf.readUInt32LE(eocdOffset + 16);

    const cdBuf = Buffer.alloc(cdSize);
    fs.readSync(fd, cdBuf, 0, cdSize, cdOffset);

    let p = 0;
    const entries = [];
    for (let e = 0; e < cdTotalEntries && p < cdSize; e++) {
      if (cdBuf.readUInt32LE(p) !== 0x02014b50) break;
      const compression = cdBuf.readUInt16LE(p + 10);
      const compSize = cdBuf.readUInt32LE(p + 20);
      const uncompSize = cdBuf.readUInt32LE(p + 24);
      const fnameLen = cdBuf.readUInt16LE(p + 28);
      const extraLen = cdBuf.readUInt16LE(p + 30);
      const commentLen = cdBuf.readUInt16LE(p + 32);
      const localHeaderOffset = cdBuf.readUInt32LE(p + 42);

      const fname = cdBuf.subarray(p + 46, p + 46 + fnameLen).toString('utf8');
      entries.push({
        name: fname,
        compression,
        compSize,
        uncompSize,
        localHeaderOffset
      });
      p += 46 + fnameLen + extraLen + commentLen;
    }

    function readEntryBuffer(entry) {
      if (!entry) return null;
      const lhead = Buffer.alloc(30);
      fs.readSync(fd, lhead, 0, 30, entry.localHeaderOffset);
      const fnLen = lhead.readUInt16LE(26);
      const exLen = lhead.readUInt16LE(28);
      const dataOffset = entry.localHeaderOffset + 30 + fnLen + exLen;

      const rawData = Buffer.alloc(entry.compSize);
      fs.readSync(fd, rawData, 0, entry.compSize, dataOffset);

      if (entry.compression === 0) {
        return rawData;
      } else if (entry.compression === 8) {
        return zlib.inflateRawSync(rawData);
      }
      return null;
    }

    // Find metadata.xml
    const metaEntry = entries.find(e => e.name.endsWith('metadata.xml'));
    let productName = 'CorelDRAW';
    let appVersion = '';
    let fontsUsed = [];
    let pages = 1;

    if (metaEntry) {
      try {
        const metaBuf = readEntryBuffer(metaEntry);
        if (metaBuf) {
          const xml = metaBuf.toString('utf8');
          const mProd = xml.match(/<cdr:ProductName>([^<]+)<\/cdr:ProductName>/i) || xml.match(/<ProductName>([^<]+)<\/ProductName>/i);
          if (mProd) productName = mProd[1];

          const mVer = xml.match(/<cdr:AppVersion>([^<]+)<\/cdr:AppVersion>/i) || xml.match(/<AppVersion>([^<]+)<\/AppVersion>/i);
          if (mVer) appVersion = mVer[1];

          const mPages = xml.match(/<cdrinfo:NumPages>([^<]+)<\/cdrinfo:NumPages>/i);
          if (mPages) pages = parseInt(mPages[1], 10) || 1;

          const fontMatches = xml.match(/<rdf:li>([^<]+)<\/rdf:li>/gi);
          if (fontMatches) {
            fontsUsed = fontMatches.map(f => f.replace(/<\/?rdf:li>/gi, '').trim()).filter(Boolean);
            fontsUsed = Array.from(new Set(fontsUsed)).slice(0, 10);
          }
        }
      } catch (err) {}
    }

    let humanVersion = 'CorelDRAW';
    let versionNum = 0;
    if (appVersion && CDR_VERSION_MAP[appVersion]) {
      humanVersion = CDR_VERSION_MAP[appVersion].name;
      versionNum = CDR_VERSION_MAP[appVersion].num;
    } else if (appVersion) {
      const vMaj = parseInt(appVersion.substring(0, 2), 10);
      versionNum = vMaj;
      humanVersion = `CorelDRAW v${vMaj}`;
    } else if (productName) {
      humanVersion = productName;
    }

    // Find thumbnail
    let thumbnailBase64 = null;
    const thumbEntry = entries.find(e => e.name.toLowerCase().includes('thumbnail.png'));
    if (thumbEntry) {
      try {
        const thumbBuf = readEntryBuffer(thumbEntry);
        if (thumbBuf && thumbBuf.length > 0) {
          thumbnailBase64 = 'data:image/png;base64,' + thumbBuf.toString('base64');
        }
      } catch {}
    }

    fs.closeSync(fd);

    return {
      success: true,
      filePath,
      fileName: path.basename(filePath),
      fileSize: formatBytes(stat.size),
      sizeBytes: stat.size,
      isZip: true,
      productName,
      appVersion: appVersion || 'v' + versionNum,
      humanVersion,
      versionNum,
      thumbnailBase64,
      fontsUsed,
      pages
    };
  } catch (err) {
    return {
      success: false,
      filePath,
      fileName: path.basename(filePath),
      message: err.message || 'Gagal membaca metadata file'
    };
  }
}

function inspectCdrBatch(filePaths) {
  if (!Array.isArray(filePaths)) return [];
  return filePaths.map((fp) => {
    const targetPath = typeof fp === 'string' ? fp : (fp?.path || fp?.filePath || '');
    return inspectCdrFile(targetPath);
  });
}

function scanDirectoryForCdr(dirPath, recursive = true) {
  return scanDirectoryForFiles(dirPath, ['.cdr'], recursive);
}

function scanDirectoryForFiles(dirPath, extensions = ['.cdr'], recursive = true) {
  const results = [];
  const normalizedExts = (extensions || ['.cdr']).map((e) => (e.toLowerCase().startsWith('.') ? e.toLowerCase() : '.' + e.toLowerCase()));
  function walk(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (recursive) walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (normalizedExts.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch {}
  }
  if (dirPath && fs.existsSync(dirPath)) {
    walk(dirPath);
  }
  return results;
}

module.exports = {
  inspectCdrFile,
  inspectCdrBatch,
  scanDirectoryForCdr,
  scanDirectoryForFiles,
  CDR_VERSION_MAP,
  formatBytes,
};
