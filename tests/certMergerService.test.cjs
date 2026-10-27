/**
 * Unit Test: Certificate & Mail Merge Service
 */
const test = require('node:test');
const assert = require('node:assert/strict');
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
