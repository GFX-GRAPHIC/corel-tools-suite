/**
 * Unit Test: Environment Service
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const env = require('../electron/core/env.cjs');

test('Environment Service - Environment detection', () => {
  assert.ok(typeof env.NODE_ENV === 'string', 'NODE_ENV should be a string');
  assert.ok(typeof env.isDev === 'boolean', 'isDev should be a boolean');
  assert.ok(typeof env.isProd === 'boolean', 'isProd should be a boolean');
  assert.ok(typeof env.isTest === 'boolean', 'isTest should be a boolean');
  assert.ok(typeof env.isPortable === 'boolean', 'isPortable should be a boolean');
});

test('Environment Service - App version retrieval', () => {
  const version = env.getAppVersion();
  assert.ok(typeof version === 'string', 'Version should be a string');
  assert.match(version, /^\d+\.\d+\.\d+/, 'Version should follow semantic versioning (e.g. 1.1.4)');
});
