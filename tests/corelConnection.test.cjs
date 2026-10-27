/**
 * Unit Test: Corel Connection & Configuration Core
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const corelConn = require('../electron/core/corelConnection.cjs');

test('CorelConnection - Configuration paths and defaults', () => {
  const cfgPath = corelConn.getCorelConfigPath();
  assert.ok(typeof cfgPath === 'string' && cfgPath.length > 0, 'Config path must be non-empty');
  assert.match(cfgPath, /corel_config\.json$/i, 'Config path should end with corel_config.json');

  const cfg = corelConn.getCorelConfig();
  assert.ok(typeof cfg === 'object' && cfg !== null, 'Config must be an object');
  assert.ok('preferredVersion' in cfg, 'Config must contain preferredVersion');
});

test('CorelConnection - Preferred version getters and setters', () => {
  const initial = corelConn.getPreferredCorelVersion();
  assert.ok(typeof initial.preferredVersion === 'string', 'preferredVersion must be string');
  assert.ok(typeof initial.preferredPid === 'number', 'preferredPid must be number');

  // Test setting a new version
  const updateRes = corelConn.setPreferredCorelVersion('23', 9024);
  assert.equal(updateRes.success, true);
  assert.equal(updateRes.preferredVersion, '23');
  assert.equal(updateRes.preferredPid, 9024);

  const updated = corelConn.getPreferredCorelVersion();
  assert.equal(updated.preferredVersion, '23');
  assert.equal(updated.preferredPid, 9024);

  // Restore
  corelConn.setPreferredCorelVersion(initial.preferredVersion, initial.preferredPid);
});

test('CorelConnection - PowerShell snippet generators contain required COM functions', () => {
  const helpersPs = corelConn.getCorelProcessHelpersPs();
  assert.ok(helpersPs.includes('function Get-CorelVerFromProcess'), 'Helpers must declare Get-CorelVerFromProcess');

  const connectPs = corelConn.getCorelConnectPs();
  assert.ok(connectPs.includes('function Get-CorelSelection'), 'Connect snippet must declare Get-CorelSelection');
  assert.ok(connectPs.includes('function Get-RangeItem'), 'Connect snippet must declare Get-RangeItem');
  assert.ok(connectPs.includes('function Get-RangeCount'), 'Connect snippet must declare Get-RangeCount');
});
