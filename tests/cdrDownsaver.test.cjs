const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { CDR_VERSION_MAP, scanDirectoryForFiles } = require('../electron/cdrVersionService.cjs');

test('CDR Version Map - Recognizes modern versions 2500, 2550, 2600, 2700', () => {
  assert.ok(CDR_VERSION_MAP['2500'], 'CorelDRAW 2024 should exist');
  assert.equal(CDR_VERSION_MAP['2500'].num, 25);

  assert.ok(CDR_VERSION_MAP['2550'], 'CorelDRAW 2024 (v25.5) should exist');
  assert.equal(CDR_VERSION_MAP['2550'].num, 25);

  assert.ok(CDR_VERSION_MAP['2600'], 'CorelDRAW 2025 / 2026 (v26) should exist');
  assert.equal(CDR_VERSION_MAP['2600'].num, 26);

  assert.ok(CDR_VERSION_MAP['2700'], 'CorelDRAW 2026 / 2027 (v27) should exist');
  assert.equal(CDR_VERSION_MAP['2700'].num, 27);
});

test('scanDirectoryForFiles - Discovers multiple graphics formats recursively', () => {
  const tempDir = path.join(__dirname, `temp_scan_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const subDir = path.join(tempDir, 'nested');
  fs.mkdirSync(subDir, { recursive: true });

  const file1 = path.join(tempDir, 'test1.cdr');
  const file2 = path.join(subDir, 'test2.pdf');
  const file3 = path.join(subDir, 'test3.ai');
  const file4 = path.join(tempDir, 'ignore.txt');

  fs.writeFileSync(file1, 'dummy cdr');
  fs.writeFileSync(file2, 'dummy pdf');
  fs.writeFileSync(file3, 'dummy ai');
  fs.writeFileSync(file4, 'dummy txt');

  try {
    const scanned = scanDirectoryForFiles(tempDir, ['.cdr', '.pdf', '.ai'], true);
    assert.equal(scanned.length, 3);
    assert.ok(scanned.includes(file1));
    assert.ok(scanned.includes(file2));
    assert.ok(scanned.includes(file3));
    assert.ok(!scanned.includes(file4));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
