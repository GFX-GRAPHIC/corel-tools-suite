/**
 * Unit Test: Tutorial Service
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { openExternalUrl, openFileInExplorer } = require('../electron/services/tutorialService.cjs');

test('TutorialService - URL protocol validation rejects dangerous schemes', () => {
  const fileScheme = openExternalUrl('file:///C:/Windows/System32/cmd.exe');
  assert.equal(fileScheme.success, false);
  assert.match(fileScheme.message, /Hanya protokol HTTP\/HTTPS yang diizinkan/i);

  const jsScheme = openExternalUrl('javascript:alert(1)');
  assert.equal(jsScheme.success, false);
  assert.match(jsScheme.message, /Hanya protokol HTTP\/HTTPS yang diizinkan/i);

  const emptyUrl = openExternalUrl('');
  assert.equal(emptyUrl.success, false);
});

test('TutorialService - openFileInExplorer rejects non-existent paths gracefully', () => {
  const emptyRes = openFileInExplorer('');
  assert.equal(emptyRes.success, false);

  const fakeRes = openFileInExplorer('C:/non_existent_folder_xyz_123');
  assert.equal(fakeRes.success, false);
  assert.match(fakeRes.message, /tidak ditemukan/i);
});
