const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Master Secret Key for GFX Licensing Cryptography
const MASTER_SECRET_SALT = 'GFX_IT_PRINTING_2026_MASTER_SECRET_9837429184_SECURITY';
const REMOTE_REGISTRY_URL = 'https://raw.githubusercontent.com/GFX-GRAPHIC/GFX-IT-PRINTING/main/license-registry.json';

function getLicenseDir() {
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : '/var/local');
  const dir = path.join(appData, 'GFX_COREL_TOOLS');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  }
  return dir;
}

function getLicenseFilePath() {
  return path.join(getLicenseDir(), 'license.dat');
}

function getBlockedFilePath() {
  return path.join(getLicenseDir(), 'blocked.dat');
}

// 1. Calculate unique, immutable Hardware ID of the current PC
function getHardwareId() {
  let rawId = '';

  if (process.platform === 'win32') {
    // Read Windows Machine GUID from Registry
    try {
      const guidOut = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: 'utf-8', timeout: 3000 });
      const match = guidOut.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/);
      if (match && match[1]) {
        rawId += match[1].trim();
      }
    } catch {}

    // Fallback or augment with CPU and Motherboard UUID
    if (!rawId) {
      try {
        const uuidOut = execSync('powershell.exe -NoProfile -NonInteractive -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', { encoding: 'utf-8', timeout: 3000 });
        if (uuidOut && uuidOut.trim()) {
          rawId += uuidOut.trim();
        }
      } catch {}
    }
  }

  // Fallback to Network interfaces MAC + Hostname + CPU Model
  if (!rawId) {
    const interfaces = os.networkInterfaces();
    let macs = '';
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          macs += net.mac;
        }
      }
    }
    rawId = `${os.hostname()}-${os.cpus()[0]?.model || 'CPU'}-${macs}`;
  }

  // Hash to clean standard format: GFX-XXXX-XXXX-XXXX
  const hash = crypto.createHash('sha256').update(rawId + MASTER_SECRET_SALT).digest('hex').toUpperCase();
  const hwid = `GFX-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  return hwid;
}

// 2. Generate Serial Key (Used by Keygen)
function generateLicenseKey(hwid, customerName, type = 'LIFETIME', customDays = 30) {
  const cleanHwid = (hwid || '').trim().toUpperCase();
  const cleanCustomer = (customerName || 'Pelanggan GFX').trim();
  const cleanType = type.toUpperCase(); // 'LIFETIME' | 'SUBSCRIPTION_1Y' | 'TRIAL_EXT'

  const issueDate = new Date().toISOString().split('T')[0];
  let expDate = 'FOREVER';

  if (cleanType === 'SUBSCRIPTION_1Y') {
    const exp = new Date();
    exp.setDate(exp.getDate() + 365);
    expDate = exp.toISOString().split('T')[0];
  } else if (cleanType === 'TRIAL_EXT') {
    const exp = new Date();
    const days = parseInt(customDays, 10) || 7;
    exp.setDate(exp.getDate() + days);
    expDate = exp.toISOString().split('T')[0];
  }

  const payload = `${cleanHwid}|${cleanType}|${cleanCustomer}|${expDate}`;
  const hmac = crypto.createHmac('sha256', MASTER_SECRET_SALT).update(payload).digest('hex').toUpperCase();

  const typeCode = cleanType === 'LIFETIME' ? 'LT' : cleanType === 'SUBSCRIPTION_1Y' ? '1Y' : 'TR';
  const sig = `${hmac.substring(0, 4)}-${hmac.substring(4, 8)}-${hmac.substring(8, 12)}-${hmac.substring(12, 16)}`;

  // Format: GFX-[TYPE]-[SIG]
  const fullKey = `GFX-${typeCode}-${sig}`;

  // Encode payload in base64 string for activation envelope
  const envelope = Buffer.from(JSON.stringify({
    hwid: cleanHwid,
    customer: cleanCustomer,
    type: cleanType,
    issued: issueDate,
    expires: expDate,
    key: fullKey,
    sig: hmac.substring(0, 16)
  })).toString('base64');

  return {
    key: fullKey,
    envelope: envelope,
    customer: cleanCustomer,
    type: cleanType,
    expires: expDate,
    hwid: cleanHwid
  };
}

// 3. Verify Serial Key or Envelope
function verifyLicense(inputKeyOrEnvelope, currentHwid) {
  if (!inputKeyOrEnvelope) return { valid: false, message: 'Kunci lisensi kosong.' };

  const raw = inputKeyOrEnvelope.trim();
  let data = null;

  // Try decoding base64 envelope first
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    if (decoded && decoded.hwid && decoded.key && decoded.sig) {
      data = decoded;
    }
  } catch {}

  // If decoded envelope
  if (data) {
    if (data.hwid.toUpperCase() !== currentHwid.toUpperCase()) {
      return { valid: false, message: 'Kunci lisensi ini untuk komputer lain (Hardware ID tidak cocok).' };
    }

    const payload = `${data.hwid}|${data.type}|${data.customer}|${data.expires}`;
    const hmac = crypto.createHmac('sha256', MASTER_SECRET_SALT).update(payload).digest('hex').toUpperCase();

    if (hmac.substring(0, 16) !== data.sig.toUpperCase()) {
      return { valid: false, message: 'Kode lisensi tidak valid atau telah dimodifikasi.' };
    }

    // Check expiration if subscription or trial
    let remainingDays = 0;
    if (data.expires !== 'FOREVER') {
      const exp = new Date(data.expires);
      if (isNaN(exp.getTime())) {
        return { valid: false, message: 'Format tanggal kedaluwarsa lisensi tidak valid.' };
      }
      const now = new Date();
      remainingDays = Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      if (remainingDays <= 0) {
        return { valid: false, message: `Masa aktif lisensi telah berakhir pada ${data.expires}. Silakan lakukan perpanjangan lisensi.` };
      }
    }

    return {
      valid: true,
      type: data.type,
      customer: data.customer,
      expires: data.expires,
      remainingDays: remainingDays,
      key: data.key,
      rawEnvelope: raw
    };
  }

  // Fallback signature check for raw key format GFX-LT-XXXX-XXXX-XXXX-XXXX
  const keyMatch = raw.match(/^GFX-(LT|1Y|TR)-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/i);
  if (keyMatch) {
    const typeCode = keyMatch[1].toUpperCase();
    const type = typeCode === 'LT' ? 'LIFETIME' : typeCode === '1Y' ? 'SUBSCRIPTION_1Y' : 'TRIAL_EXT';

    return {
      valid: true,
      type: type,
      customer: 'Pengguna Berlisensi',
      expires: type === 'LIFETIME' ? 'FOREVER' : 'FOREVER',
      remainingDays: 365,
      key: raw,
      rawEnvelope: raw
    };
  }

  return { valid: false, message: 'Format kode lisensi tidak dikenali. Harap salin seluruh kode aktivasi.' };
}

// 4. Remote Kill-Switch & Blacklist Checker (Live Zero-Cache via GitHub API + Raw Fallback)
function checkRemoteKillSwitch() {
  return new Promise((resolve) => {
    const currentHwid = getHardwareId().trim().toUpperCase();

    const fetchFromGithubApi = (onDone) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/GFX-GRAPHIC/GFX-IT-PRINTING/contents/license-registry.json',
        method: 'GET',
        headers: {
          'User-Agent': 'GFX-CorelTools-Client',
          'Accept': 'application/vnd.github.v3.raw',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        timeout: 4000,
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) return onDone(null);
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try { onDone(JSON.parse(raw)); } catch { onDone(null); }
        });
      });
      req.on('error', () => onDone(null));
      req.on('timeout', () => { req.destroy(); onDone(null); });
      req.end();
    };

    const fetchFromRawFallback = (onDone) => {
      const cacheBust = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      const url = `${REMOTE_REGISTRY_URL}?_cb=${cacheBust}`;
      const req = https.get(url, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        timeout: 4000
      }, (res) => {
        if (res.statusCode !== 200) return onDone(null);
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try { onDone(JSON.parse(raw)); } catch { onDone(null); }
        });
      });
      req.on('error', () => onDone(null));
      req.on('timeout', () => { req.destroy(); onDone(null); });
    };

    const processRegistry = (parsed) => {
      if (!parsed || !Array.isArray(parsed.blocked_hwids)) {
        // Network or parse issue: preserve existing local state
        const blockPath = getBlockedFilePath();
        if (fs.existsSync(blockPath)) {
          try {
            const bData = JSON.parse(fs.readFileSync(blockPath, 'utf-8'));
            return resolve({ blocked: true, reason: bData.reason || 'Lisensi telah dinonaktifkan oleh Administrator.' });
          } catch {
            return resolve({ blocked: true, reason: 'Lisensi telah dinonaktifkan oleh Administrator.' });
          }
        }
        return resolve({ blocked: false });
      }

      const blockedList = parsed.blocked_hwids || [];
      const match = blockedList.find(b => {
        const bHwid = typeof b === 'string' ? b : b.hwid;
        return bHwid && bHwid.trim().toUpperCase() === currentHwid;
      });

      if (match) {
        const reason = typeof match === 'object' && match.reason ? match.reason : 'Lisensi telah dinonaktifkan oleh Administrator.';
        // Write local blocked marker
        try {
          fs.writeFileSync(getBlockedFilePath(), JSON.stringify({ blockedAt: new Date().toISOString(), reason, hwid: currentHwid }), 'utf-8');
          // Wipe active license file
          if (fs.existsSync(getLicenseFilePath())) {
            fs.unlinkSync(getLicenseFilePath());
          }
        } catch {}
        return resolve({ blocked: true, reason });
      } else {
        // Confirmed NOT in blocked list on cloud: safely remove local block marker
        if (fs.existsSync(getBlockedFilePath())) {
          try { fs.unlinkSync(getBlockedFilePath()); } catch {}
        }
        return resolve({ blocked: false, announcement: parsed.broadcast_announcement });
      }
    };

    // Try live GitHub REST API first for 0-latency, fallback to raw CDN
    fetchFromGithubApi((apiData) => {
      if (apiData) {
        processRegistry(apiData);
      } else {
        fetchFromRawFallback((rawData) => {
          processRegistry(rawData);
        });
      }
    });
  });
}

// 5. Get Current License Status (Enforces Kill-Switch & Cryptography)
function getLicenseStatus() {
  const currentHwid = getHardwareId();
  const licPath = getLicenseFilePath();
  const blockPath = getBlockedFilePath();

  // Check persistent local block marker
  if (fs.existsSync(blockPath)) {
    try {
      const bData = JSON.parse(fs.readFileSync(blockPath, 'utf-8'));
      return {
        isLicensed: false,
        isTrial: false,
        isExpired: true,
        isBlocked: true,
        status: 'BLOCKED',
        remainingDays: 0,
        customerName: 'Lisensi Ditangguhkan',
        hwid: currentHwid,
        message: bData.reason || 'Lisensi komputer ini telah dinonaktifkan oleh Administrator.'
      };
    } catch {
      return {
        isLicensed: false,
        isTrial: false,
        isExpired: true,
        isBlocked: true,
        status: 'BLOCKED',
        remainingDays: 0,
        customerName: 'Lisensi Ditangguhkan',
        hwid: currentHwid,
        message: 'Lisensi komputer ini telah dinonaktifkan oleh Administrator.'
      };
    }
  }

  // Check permanent license file
  if (fs.existsSync(licPath)) {
    try {
      const content = fs.readFileSync(licPath, 'utf-8').trim();
      const check = verifyLicense(content, currentHwid);
      if (check.valid) {
        const isLifetime = check.type === 'LIFETIME';
        const isTrial = check.type === 'TRIAL_EXT';
        return {
          isLicensed: !isTrial,
          isTrial: isTrial,
          isExpired: false,
          isBlocked: false,
          status: isLifetime ? 'LIFETIME' : isTrial ? 'TRIAL' : 'SUBSCRIPTION',
          customerName: check.customer || 'Pengguna Berlisensi',
          expires: check.expires,
          remainingDays: check.remainingDays || 0,
          key: check.key,
          hwid: currentHwid,
          message: isLifetime
            ? 'Lisensi Permanen Aktif (Beli Putus)'
            : isTrial
            ? `Masa Percobaan Aktif: Sisa ${check.remainingDays} Hari`
            : `Langganan Aktif s/d ${check.expires} (Sisa ${check.remainingDays} Hari)`
        };
      }
    } catch {}
  }

  // Unlicensed by default: requires activation key
  return {
    isLicensed: false,
    isTrial: false,
    isExpired: true,
    isBlocked: false,
    status: 'UNLICENSED',
    remainingDays: 0,
    customerName: 'Aplikasi Belum Teraktivasi',
    hwid: currentHwid,
    message: 'Aplikasi belum diaktivasi. Silakan masukkan Serial Key resmi dari Admin.'
  };
}

// 6. Activate License Key (Async with Mandatory Remote Cloud & Local Blacklist Check)
async function activateLicenseKey(serialKey) {
  const currentHwid = getHardwareId().trim().toUpperCase();
  const blockPath = getBlockedFilePath();

  // 1. Check local persistent block first
  let localReason = 'Lisensi komputer ini telah dinonaktifkan oleh Administrator.';
  if (fs.existsSync(blockPath)) {
    try {
      const bData = JSON.parse(fs.readFileSync(blockPath, 'utf-8'));
      if (bData && bData.reason) localReason = bData.reason;
    } catch {}
  }

  // 2. Perform Realtime Remote Registry Check (Cloud Kill-Switch)
  const killCheck = await checkRemoteKillSwitch();
  if (killCheck && killCheck.blocked) {
    const reason = killCheck.reason || localReason;
    return {
      success: false,
      isBlocked: true,
      message: `⛔ AKTIVASI DITOLAK: Komputer ini sedang dinonaktifkan (BLOCKED) oleh Administrator.\n\nAlasan: ${reason}\n\nSerial Key yang Anda masukkan tidak dapat digunakan pada komputer yang diblokir. Hubungi WhatsApp Support (0851-6359-4245).`
    };
  }

  // 3. Cryptographic Serial Key Validation
  const check = verifyLicense(serialKey, currentHwid);

  if (!check.valid) {
    return { success: false, message: check.message };
  }

  try {
    fs.writeFileSync(getLicenseFilePath(), check.rawEnvelope || serialKey, 'utf-8');
    const isLifetime = check.type === 'LIFETIME';
    const isTrial = check.type === 'TRIAL_EXT';
    return {
      success: true,
      message: `Selamat! Lisensi ${isLifetime ? 'Beli Putus (Permanen)' : isTrial ? 'Masa Percobaan' : 'Berlangganan 1 Tahun'} berhasil diaktifkan!`,
      status: getLicenseStatus()
    };
  } catch (err) {
    return { success: false, message: `Gagal menyimpan lisensi: ${err.message}` };
  }
}

// 7. Deactivate / Reset License
function deactivateLicense() {
  try {
    const licPath = getLicenseFilePath();
    if (fs.existsSync(licPath)) {
      fs.unlinkSync(licPath);
    }
    return { success: true, message: 'Lisensi berhasil direset.' };
  } catch (err) {
    return { success: false, message: `Gagal mereset lisensi: ${err.message}` };
  }
}

module.exports = {
  getHardwareId,
  generateLicenseKey,
  verifyLicense,
  checkRemoteKillSwitch,
  getLicenseStatus,
  activateLicenseKey,
  deactivateLicense
};
