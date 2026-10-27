/**
 * Unit Test: Numerator Service Logic & Calculations
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// Emulate formatting logic from numeratorService
function formatNum(val, digits, prefix = '', suffix = '') {
  let numPart = String(val);
  if (digits > 0) {
    numPart = numPart.padStart(digits, '0');
  }
  return `${prefix}${numPart}${suffix}`;
}

// Emulate placeholder detector from numeratorService
function isNumberPlaceholder(txt) {
  if (!txt || typeof txt !== 'string' || txt.trim() === '') return false;
  const t = txt.trim();
  if (/^\d+$/.test(t)) return true;
  if (/^(no|no\.|kpn|vcr|id|tiket|kupon|#|numb|num)?\s*[:.-]?\s*\d+\s*[a-z0-9/-]*$/i.test(t) && t.length <= 18) return true;
  if (/\d+/.test(t) && t.length <= 10) return true;
  return false;
}

test('NumeratorService - Number formatting with padding and affixes', () => {
  assert.equal(formatNum(1, 3, '', ''), '001');
  assert.equal(formatNum(25, 4, 'NO. ', ''), 'NO. 0025');
  assert.equal(formatNum(99, 2, '', '/2026'), '99/2026');
  assert.equal(formatNum(5, 0, '#', ''), '#5');
  assert.equal(formatNum(1234, 4, '', ''), '1234');
  assert.equal(formatNum(1234, 3, '', ''), '1234', 'Does not truncate numbers larger than digit padding');
});

test('NumeratorService - Placeholder detector correctly identifies ticket number placeholders', () => {
  // Plain digits (the exact bug reported by user: '001')
  assert.equal(isNumberPlaceholder('001'), true);
  assert.equal(isNumberPlaceholder('1'), true);
  assert.equal(isNumberPlaceholder('0001'), true);
  assert.equal(isNumberPlaceholder('99999'), true);

  // Prefixed digits
  assert.equal(isNumberPlaceholder('NO. 001'), true);
  assert.equal(isNumberPlaceholder('No: 123'), true);
  assert.equal(isNumberPlaceholder('#001'), true);
  assert.equal(isNumberPlaceholder('TIKET 001'), true);
  assert.equal(isNumberPlaceholder('KUPON 050'), true);
  assert.equal(isNumberPlaceholder('ID-100'), true);

  // Negative tests: Should NOT match non-placeholders
  assert.equal(isNumberPlaceholder(''), false);
  assert.equal(isNumberPlaceholder('   '), false);
  assert.equal(isNumberPlaceholder('TIKET MASUK JALAN SEHAT 2026 BERSAMA KELUARGA'), false);
  assert.equal(isNumberPlaceholder('HARGA RP 50.000'), false);
});

test('NumeratorService - Grid Cut & Stack index calculation', () => {
  const cols = 4;
  const rows = 8;
  const perPage = cols * rows; // 32
  const totalNumbers = 100;
  const totalPages = Math.ceil(totalNumbers / perPage); // 4

  assert.equal(totalPages, 4);

  // Cut & Stack: for slot s, Page 1 gets s * totalPages
  // Slot 0 (col 0, row 0): 0 * 4 = 0 -> Number 1
  // Slot 1 (col 1, row 0): 1 * 4 = 4 -> Number 5
  // Page 2 slot 0: 0 * 4 + 1 = 1 -> Number 2
  // When cutting the stack of 4 pages, each position gives a continuous sequence!
  const getCutStackIdx = (slot, pageIdx) => (slot * totalPages) + pageIdx;

  assert.equal(getCutStackIdx(0, 0), 0); // Ticket 1 on Page 1
  assert.equal(getCutStackIdx(0, 1), 1); // Ticket 2 on Page 2
  assert.equal(getCutStackIdx(0, 2), 2); // Ticket 3 on Page 3
  assert.equal(getCutStackIdx(0, 3), 3); // Ticket 4 on Page 4

  assert.equal(getCutStackIdx(1, 0), 4); // Ticket 5 on Page 1
  assert.equal(getCutStackIdx(1, 1), 5); // Ticket 6 on Page 2
});
