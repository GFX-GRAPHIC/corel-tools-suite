/**
 * Corel Tools Suite - Instant GitHub Publisher & Release Manager
 * GFX GRAPHIC Technology Division
 *
 * Mode Otomatis Cerdas:
 * 1. Jika file installer sudah di-build, LANGSUNG UPLOAD dalam 10 detik (tanpa build ulang).
 * 2. Opsi build ulang hanya jika Anda memilihnya secara manual.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { execSync, spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLISH_DIR = path.resolve(__dirname);
const DIST_DIR = path.join(PROJECT_ROOT, 'dist-release');
const PKG_PATH = path.join(PROJECT_ROOT, 'package.json');
const BUILDER_BIN = 'C:\\Users\\Yahya\\.gemini\\antigravity\\scratch\\cetak-pro-pos\\node_modules\\.bin\\electron-builder.cmd';

const DEFAULT_OWNER = 'GFX-GRAPHIC';
const DEFAULT_REPO = 'corel-tools-suite';

console.log('================================================================');
console.log('       COREL TOOLS SUITE - INSTANT GITHUB RELEASE UPLOADER      ');
console.log('================================================================\n');

// Helper: Ask question in terminal
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

// 1. Get GitHub Token from Git Credential Manager or Environment
function getGitHubToken() {
  if (process.env.GH_TOKEN && process.env.GH_TOKEN.trim()) return process.env.GH_TOKEN.trim();
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) return process.env.GITHUB_TOKEN.trim();

  try {
    const credOut = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    let token = '';
    credOut.split('\n').forEach((line) => {
      if (line.startsWith('password=')) token = line.split('=')[1].trim();
    });
    if (token) return token;
  } catch {}

  return null;
}

// 2. Synchronize Files from dist-release to publish directory
function syncFilesToPublishDir() {
  if (!fs.existsSync(DIST_DIR)) return [];
  if (!fs.existsSync(PUBLISH_DIR)) fs.mkdirSync(PUBLISH_DIR, { recursive: true });

  const files = fs.readdirSync(DIST_DIR);
  const copiedFiles = [];

  files.forEach((f) => {
    if (f.endsWith('.exe') || f.endsWith('.yml') || f.endsWith('.blockmap')) {
      if (f.toLowerCase().includes('keygen') || f.toLowerCase().includes('builder-debug')) return;
      const src = path.join(DIST_DIR, f);
      const dst = path.join(PUBLISH_DIR, f);
      try {
        fs.copyFileSync(src, dst);
        copiedFiles.push(f);
      } catch {}
    }
  });

  return copiedFiles;
}

// 3. Automated Build Runner (Only executed if user requests or if files are missing)
function runBuildProcess() {
  return new Promise((resolve, reject) => {
    console.log('================================================================');
    console.log('   MEMULAI PROSES BUILD INSTALLER (SETUP & PORTABLE)            ');
    console.log('================================================================');

    try {
      execSync('powershell -Command "Stop-Process -Name \'Corel Tools Suite*\', \'electron*\' -Force -ErrorAction SilentlyContinue"');
    } catch {}

    const builderPath = fs.existsSync(BUILDER_BIN)
      ? BUILDER_BIN
      : path.join(PROJECT_ROOT, 'node_modules', '.bin', 'electron-builder.cmd');

    const args = ['--win', 'nsis', 'portable'];
    console.log(`Menjalankan: ${builderPath} ${args.join(' ')}\n`);

    const child = spawn(builderPath, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('\n[OK] Proses build Setup dan Portable BERHASIL selesai!\n');
        syncFilesToPublishDir();
        resolve();
      } else {
        reject(new Error(`Proses build gagal dengan exit code: ${code}`));
      }
    });
  });
}

// 4. Version Bump Helper
function parseSemVer(vStr) {
  const clean = (vStr || '1.0.0').replace(/^v/, '');
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return { major: parts[0], minor: parts[1], patch: parts[2], raw: clean };
}

async function promptVersionChange(currentVer) {
  const sem = parseSemVer(currentVer);
  const nextPatch = `${sem.major}.${sem.minor}.${sem.patch + 1}`;
  const nextMinor = `${sem.major}.${sem.minor + 1}.0`;

  console.log(`\nPilih nomor versi baru:`);
  console.log(`  [1] Patch  : ${nextPatch} (Perbaikan bug / update kecil) [Tekan ENTER / Default]`);
  console.log(`  [2] Minor  : ${nextMinor} (Penambahan fitur baru)`);
  console.log(`  [3] Kustom : Ketik nomor versi sendiri`);

  const choice = await askQuestion('\nPilihan Anda [1/2/3] (Default: 1): ');
  let chosenVersion = nextPatch;
  if (choice === '2') {
    chosenVersion = nextMinor;
  } else if (choice === '3') {
    const customInput = await askQuestion('Masukkan nomor versi baru (contoh: 1.0.2): ');
    if (customInput) chosenVersion = customInput.replace(/^v/, '');
  }

  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  pkg.version = chosenVersion;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2), 'utf-8');
  console.log(`[OK] Versi diperbarui menjadi: ${chosenVersion}\n`);
  return chosenVersion;
}

// 5. GitHub API Helper
function githubApi(token, pathStr, method, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: pathStr,
        method: method,
        headers: {
          'User-Agent': 'Corel-Tools-Publisher',
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// 6. Upload Asset Helper
function uploadAsset(token, uploadUrlTemplate, fileName, filePath) {
  return new Promise((resolve, reject) => {
    const uploadUrl = uploadUrlTemplate.replace(/\{(\?.*)?\}$/, '') + `?name=${encodeURIComponent(fileName)}`;
    const parsed = new URL(uploadUrl);
    const fileStat = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'User-Agent': 'Corel-Tools-Publisher',
          Authorization: `token ${token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileStat.size,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, status: res.statusCode });
          } else {
            resolve({ success: false, status: res.statusCode, body });
          }
        });
      }
    );

    req.on('error', reject);
    fileStream.pipe(req);
  });
}

// 7. Master Execution Flow
async function main() {
  try {
    const token = getGitHubToken();
    if (!token) {
      console.error('[ERROR] Token GitHub tidak ditemukan di Windows Credential Manager!');
      process.exit(1);
    }

    // Auto-sync files from dist-release if any
    syncFilesToPublishDir();

    let owner = DEFAULT_OWNER;
    let repo = DEFAULT_REPO;
    let appVersion = '1.0.0';

    if (fs.existsSync(PKG_PATH)) {
      try {
        const pkgObj = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
        if (pkgObj.version) appVersion = pkgObj.version;
        const pub = pkgObj.build?.publish;
        if (Array.isArray(pub) && pub[0]) {
          if (pub[0].owner) owner = pub[0].owner;
          if (pub[0].repo) repo = pub[0].repo;
        }
      } catch {}
    }

    // Check existing ready-made files
    let readyFiles = fs.readdirSync(PUBLISH_DIR).filter((f) => {
      if (f === 'uploader.js' || f === 'UPLOAD_UPDATE.bat' || f.endsWith('.tmp')) return false;
      if (f.toLowerCase().includes('keygen')) return false;
      return f.endsWith('.exe') || f.endsWith('.yml') || f.endsWith('.blockmap');
    });

    const hasSetup = readyFiles.some((f) => f.toLowerCase().includes('setup') && f.endsWith('.exe'));
    const hasYml = readyFiles.some((f) => f === 'latest.yml');

    console.log(`Repository Target  : ${owner}/${repo}`);
    console.log(`Versi Terdeteksi   : ${appVersion} (Tag: v${appVersion})\n`);

    if (hasSetup && hasYml) {
      console.log(`[INFO] File rilis yang SUDAH JADI ditemukan di folder publish:`);
      readyFiles.forEach((f) => {
        const sz = (fs.statSync(path.join(PUBLISH_DIR, f)).size / (1024 * 1024)).toFixed(2);
        console.log(`   - ${f} (${sz} MB)`);
      });
      console.log('\nPilihan Tindakan:');
      console.log('  [1] LANGSUNG UPLOAD file yang sudah jadi (Cepat 10 detik, tanpa build ulang)');
      console.log('      -> Tekan ENTER jika installer versi ini sudah di-build sebelumnya.');
      console.log('  [2] NAIKKAN VERSI BARU (Misal: 1.0.1) + BUILD OTOMATIS + UPLOAD KE GITHUB');
      console.log('      -> Pilih ini jika Anda baru saja menambahkan fitur baru ke kodingan.');
      console.log('  [3] Build ulang versi saat ini dari awal, lalu upload');

      const action = await askQuestion('\nPilihan Anda [1/2/3] (Default: 1): ');

      if (action === '2') {
        appVersion = await promptVersionChange(appVersion);
        await runBuildProcess();
      } else if (action === '3') {
        await runBuildProcess();
      } else {
        console.log('\n[OK] Memilih opsi 1: Mengunggah file yang sudah siap tanpa perlu build ulang.\n');
      }
    } else {
      console.log('[!] File installer jadi belum ditemukan di folder publish.');
      console.log('[*] Menjalankan build otomatis terlebih dahulu...\n');
      await runBuildProcess();
    }

    // Read latest.yml for expected URL
    const latestYmlPath = path.join(PUBLISH_DIR, 'latest.yml');
    let expectedSetupUrl = '';
    if (fs.existsSync(latestYmlPath)) {
      const ymlContent = fs.readFileSync(latestYmlPath, 'utf-8');
      const vMatch = ymlContent.match(/^version:\s*([^\r\n]+)/m);
      if (vMatch && vMatch[1]) appVersion = vMatch[1].trim();
      const urlMatch = ymlContent.match(/url:\s*([^\r\n]+)/m);
      if (urlMatch && urlMatch[1]) expectedSetupUrl = urlMatch[1].trim();
    }

    // Refresh ready files strictly for this appVersion
    readyFiles = fs.readdirSync(PUBLISH_DIR).filter((f) => {
      if (f === 'uploader.js' || f === 'UPLOAD_UPDATE.bat' || f.endsWith('.tmp')) return false;
      if (f.toLowerCase().includes('keygen')) return false;
      if (f === 'latest.yml') return true;
      if (f.includes(appVersion)) return true;
      return false;
    });

    const releaseTag = `v${appVersion}`;

    console.log('================================================================');
    console.log(`   MEMULAI UNGGAH KE GITHUB RELEASES (${owner}/${repo})         `);
    console.log('================================================================');
    console.log(`[*] Tag Rilis    : ${releaseTag}`);
    console.log(`[*] Total File   : ${readyFiles.length} file\n`);

    // Check or create release on GitHub
    const listRes = await githubApi(token, `/repos/${owner}/${repo}/releases`, 'GET');
    let targetRelease = null;
    if (listRes.status === 200 && Array.isArray(listRes.data)) {
      targetRelease = listRes.data.find((r) => r.tag_name === releaseTag);
    }

    if (!targetRelease) {
      console.log(`[*] Membuat rilis baru di GitHub (${releaseTag})...`);
      const createRes = await githubApi(
        token,
        `/repos/${owner}/${repo}/releases`,
        'POST',
        JSON.stringify({
          tag_name: releaseTag,
          name: `Corel Tools Suite ${releaseTag} Official Release`,
          body: `Rilis Pembaruan Corel Tools Suite (${releaseTag})\n\nFitur & Pembaruan v1.0.5:\n- Layout Pola: Dual-Mode Live Preview (Pop-out Window Mandiri Always on Top & Side-by-Side Split-View)\n- Layout Pola: Navigasi Varian Susunan (Next/Prev) langsung dari jendela monitor preview\n- Layout Pola: Fitur Pan & Zoom interaktif untuk inspeksi tata letak roll panjang hingga 28+ meter\n- Layout Pola: Tombol Satukan Kembali (Dock) dengan 1 klik tanpa kehilangan data kalkulasi\n- Integrasi Cerdas Layanan Online CDR Converter untuk file CorelDRAW versi 2024-2026\n- Penanganan 500+ pola massal super cepat dengan Optimization mode aktif\n\nInstaller Setup dan Portable siap digunakan.`,
          draft: true,
          prerelease: false,
        }),
        { 'Content-Type': 'application/json' }
      );

      if (createRes.status !== 201) {
        throw new Error(`Gagal membuat release di GitHub: HTTP ${createRes.status}`);
      }
      targetRelease = createRes.data;
      console.log(`[OK] Release draft dibuat (ID: ${targetRelease.id})`);
    } else {
      console.log(`[*] Memperbarui Release ${releaseTag} yang sudah ada (ID: ${targetRelease.id})...`);
    }

    const uploadUrl = targetRelease.upload_url;
    const existingAssets = targetRelease.assets || [];

    // Upload each asset
    for (const f of readyFiles) {
      const localFilePath = path.join(PUBLISH_DIR, f);

      let remoteName = f;
      if (f.endsWith('.exe')) {
        if (f.toLowerCase().includes('setup') && expectedSetupUrl) {
          remoteName = expectedSetupUrl;
        } else if (f.toLowerCase().includes('portable')) {
          remoteName = `Corel-Tools-Suite-${appVersion}-Portable.exe`;
        } else if (f.toLowerCase().includes('setup')) {
          remoteName = `Corel-Tools-Suite-Setup-${appVersion}.exe`;
        }
      } else if (f.endsWith('.blockmap')) {
        if (expectedSetupUrl) {
          remoteName = `${expectedSetupUrl}.blockmap`;
        } else {
          remoteName = `Corel-Tools-Suite-Setup-${appVersion}.exe.blockmap`;
        }
      }

      // Check and delete existing asset on GitHub
      const currentReleaseRes = await githubApi(token, `/repos/${owner}/${repo}/releases/${targetRelease.id}`, 'GET');
      const liveAssets = (currentReleaseRes.status === 200 && Array.isArray(currentReleaseRes.data.assets)) ? currentReleaseRes.data.assets : existingAssets;
      const oldAsset = liveAssets.find((a) => a.name.toLowerCase() === remoteName.toLowerCase());
      if (oldAsset) {
        process.stdout.write(`    [*] Menghapus aset lama ${remoteName}... `);
        await githubApi(token, `/repos/${owner}/${repo}/releases/assets/${oldAsset.id}`, 'DELETE');
        console.log('OK');
      }

      const fSizeMB = (fs.statSync(localFilePath).size / (1024 * 1024)).toFixed(2);
      process.stdout.write(`    [>] Mengunggah ${remoteName} (${fSizeMB} MB)... `);
      const upRes = await uploadAsset(token, uploadUrl, remoteName, localFilePath);

      if (upRes.success) {
        console.log('SELESAI!');
      } else {
        console.log(`GAGAL (HTTP ${upRes.status})`);
      }
    }

    // Publish release (draft: false)
    console.log(`\n[*] Mempublikasikan rilis ${releaseTag} ke publik...`);
    const pubRes = await githubApi(
      token,
      `/repos/${owner}/${repo}/releases/${targetRelease.id}`,
      'PATCH',
      JSON.stringify({ draft: false, prerelease: false }),
      { 'Content-Type': 'application/json' }
    );

    const publicUrl = pubRes.data?.html_url || `https://github.com/${owner}/${repo}/releases/tag/${releaseTag}`;

    console.log('\n================================================================');
    console.log('       SUKSES BESAR! PEMBARUAN BERHASIL DITERBITKAN             ');
    console.log('================================================================');
    console.log(`[V] Versi Baru : ${appVersion} (Tag: ${releaseTag})`);
    console.log(`[V] URL Rilis  : ${publicUrl}`);
    console.log(`\nSemua pengguna percetakan sekarang akan otomatis menerima notifikasi`);
    console.log(`dan tombol biru "Restart to Update" di layar komputer mereka!`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n[ERROR]', err.message);
  }
}

main();
