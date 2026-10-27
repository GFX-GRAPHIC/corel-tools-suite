/**
 * Unit Test: Certificate & Mail Merge Service
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const xlsx = require('../electron/xlsx.full.min.js');
const { indexToLetter, parseExcelFile } = require('../electron/services/certMergerService.cjs');

test('CertMergerService - indexToLetter converts 0-based column indices to Excel column letters', () => {
  assert.equal(indexToLetter(0), 'A');
  assert.equal(indexToLetter(1), 'B');
  assert.equal(indexToLetter(25), 'Z');
  assert.equal(indexToLetter(26), 'AA');
  assert.equal(indexToLetter(27), 'AB');
  assert.equal(indexToLetter(51), 'AZ');
  assert.equal(indexToLetter(52), 'BA');
  assert.equal(indexToLetter(701), 'ZZ');
  assert.equal(indexToLetter(702), 'AAA');
});

test('CertMergerService - parseExcelFile returns safe error on empty or invalid payload', () => {
  const resNull = parseExcelFile(null);
  assert.equal(resNull.success, false);
  assert.ok(resNull.message.length > 0);

  const resNonExistent = parseExcelFile({ filePath: 'C:/non_existent_file_xyz_123.xlsx' });
  assert.equal(resNonExistent.success, false);
  assert.match(resNonExistent.message, /tidak ditemukan/i);
});

test('CertMergerService - parseExcelFile generates valid header objects without undefined', () => {
  const wb = xlsx.utils.book_new();
  const data = [
    ['No Sertifikat', 'Nama Peserta', 'Predikat Juara'],
    ['SERT-001', 'Budi Santoso', 'Juara 1 Desain Grafis'],
    ['SERT-002', 'Siti Rahma', 'Juara 2 Desain Grafis'],
  ];
  const ws = xlsx.utils.aoa_to_sheet(data);
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const res = parseExcelFile({ buffer });
  assert.equal(res.success, true);
  assert.equal(res.headers.length, 3);

  const h0 = res.headers[0];
  assert.equal(h0.letter, 'A');
  assert.equal(h0.name, 'No Sertifikat');
  assert.equal(h0.originalName, 'No Sertifikat');
  assert.equal(h0.displayName, 'A : No Sertifikat');
  assert.equal(h0.sample, 'SERT-001');
  assert.ok(h0.label.includes('A: No Sertifikat'));
  assert.ok(h0.label.includes('SERT-001'));
  assert.equal(h0.placeholder, '[No Sertifikat]');

  const h1 = res.headers[1];
  assert.equal(h1.letter, 'B');
  assert.equal(h1.name, 'Nama Peserta');
  assert.equal(h1.originalName, 'Nama Peserta');
  assert.equal(h1.sample, 'Budi Santoso');
  assert.ok(h1.label.includes('B: Nama Peserta'));

  // Ensure no property is undefined or string "undefined"
  res.headers.forEach((h, idx) => {
    assert.ok(h.name !== undefined && !h.name.includes('undefined'), `Header ${idx} name must not contain undefined`);
    assert.ok(h.label !== undefined && !h.label.includes('undefined'), `Header ${idx} label must not contain undefined`);
    assert.ok(h.displayName !== undefined && !h.displayName.includes('undefined'), `Header ${idx} displayName must not contain undefined`);
    assert.ok(h.originalName !== undefined && !h.originalName.includes('undefined'), `Header ${idx} originalName must not contain undefined`);
  });
});
