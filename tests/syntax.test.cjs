/**
 * Automated Syntax & Integrity Test
 * Validates that every CJS file in electron/ can be parsed without syntax errors.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function getCjsFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      getCjsFiles(full, fileList);
    } else if (item.endsWith('.cjs')) {
      fileList.push(full);
    }
  }
  return fileList;
}

test('Syntax Integrity - All electron CJS files pass node -c parsing', () => {
  const electronDir = path.resolve(__dirname, '../electron');
  const files = getCjsFiles(electronDir);
  assert.ok(files.length > 0, 'Must have cjs files in electron/');

  for (const f of files) {
    try {
      execFileSync(process.execPath, ['-c', f], { stdio: 'pipe' });
    } catch (err) {
      assert.fail(`Syntax error in file: ${f}\n${err.stderr?.toString() || err.message}`);
    }
  }
});
