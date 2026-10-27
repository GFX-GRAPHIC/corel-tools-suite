/**
 * Unit Test: Layout Service
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { dedupeKeysCI } = require('../electron/services/layoutService.cjs');

test('LayoutService - dedupeKeysCI deduplicates case-insensitive keys correctly', () => {
  const input = {
    Nama: 'Ahmad',
    NAMA: 'Ahmad Upper',
    nama: 'Ahmad Lower',
    Nomor: '10',
    nomor: '20',
    Ukuran: 'XL'
  };

  const output = dedupeKeysCI(input);
  const keys = Object.keys(output);

  // Should preserve only one key per case-insensitive name
  const lowerKeys = keys.map(k => k.toLowerCase());
  const uniqueKeys = new Set(lowerKeys);
  assert.equal(lowerKeys.length, uniqueKeys.size, 'All keys must be unique case-insensitively');

  // Must retain first non-empty value
  assert.equal(output.Nama, 'Ahmad');
  assert.equal(output.Nomor, '10');
  assert.equal(output.Ukuran, 'XL');
});

test('LayoutService - dedupeKeysCI handles edge cases safely', () => {
  assert.equal(dedupeKeysCI(null), null);
  assert.equal(dedupeKeysCI(undefined), undefined);
  assert.deepEqual(dedupeKeysCI([]), []);
  assert.deepEqual(dedupeKeysCI({}), {});

  const singleKey = { KEY: 'val' };
  assert.deepEqual(dedupeKeysCI(singleKey), { KEY: 'val' });
});
