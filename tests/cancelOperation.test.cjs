const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app } = require('../electron/core/electronBridge.cjs');
const { cancelCurrentOperation, runPowerShellScript } = require('../electron/core/psRunner.cjs');

test('psRunner - cancelCurrentOperation creates cancel flag and terminates execution', async () => {
  const cancelFlag = path.join(app.getPath('temp'), 'corel_cts_cancel.flag');

  // Launch a long-running script that would otherwise sleep for 10 seconds
  const longScript = `
    Start-Sleep -Seconds 10
    @{ success = $true } | ConvertTo-Json -Compress
  `;

  const promise = runPowerShellScript(longScript, 15000);

  // Give it 100ms to spawn
  await new Promise(r => setTimeout(r, 100));

  // Cancel it
  const cancelRes = cancelCurrentOperation();
  assert.strictEqual(cancelRes.success, true);
  assert.ok(fs.existsSync(cancelFlag), 'Cancel flag must be created');

  // The running promise should resolve with cancellation message
  const result = await promise;
  assert.strictEqual(result.success, false);
  assert.ok(result.message.includes('batal') || result.message.includes('Cancel') || result.message.includes('dibatalkan'));

  // Cleanup flag
  try { if (fs.existsSync(cancelFlag)) fs.unlinkSync(cancelFlag); } catch {}
});
