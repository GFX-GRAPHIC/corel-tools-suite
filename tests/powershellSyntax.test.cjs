/**
 * Automated PowerShell Syntax & AST Parser Test
 * Ensures that no generated PowerShell script has syntax errors, token errors, or unclosed quotes.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function validatePsAst(scriptContent, testName) {
  const tempPs = path.join(__dirname, `temp_ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.ps1`);
  fs.writeFileSync(tempPs, scriptContent, 'utf-8');

  const validatorPs = `
$content = [System.IO.File]::ReadAllText('${tempPs.replace(/\\/g, '\\\\')}')
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($content, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) {
    foreach ($err in $errors) {
        Write-Output "Line $($err.Extent.StartLineNumber) Col $($err.Extent.StartColumnNumber): $($err.Message)"
    }
    exit 1
}
exit 0
`;
  const valFile = path.join(__dirname, `val_ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.ps1`);
  fs.writeFileSync(valFile, validatorPs, 'utf-8');

  try {
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', valFile], { encoding: 'utf-8' });
  } catch (err) {
    const msg = err.stdout?.toString() || err.stderr?.toString() || err.message;
    assert.fail(`[${testName}] PowerShell AST Parser Error:\n${msg}`);
  } finally {
    try { if (fs.existsSync(tempPs)) fs.unlinkSync(tempPs); } catch {}
    try { if (fs.existsSync(valFile)) fs.unlinkSync(valFile); } catch {}
  }
}

test('PowerShell AST - Corel Connection snippet parses with 0 errors', () => {
  const { getCorelConnectPs } = require('../electron/core/corelConnection.cjs');
  const ps = `
$ErrorActionPreference = 'Stop'
${getCorelConnectPs()}
`;
  validatePsAst(ps, 'getCorelConnectPs');
});

test('PowerShell AST - Numerator Service generated script parses with 0 errors', async () => {
  const psRunner = require('../electron/core/psRunner.cjs');
  let capturedScript = '';
  const originalRun = psRunner.runPowerShellScript;
  psRunner.runPowerShellScript = (script) => {
    capturedScript = script;
    return Promise.resolve({ success: true });
  };

  try {
    const { executeNumerator } = require('../electron/services/numeratorService.cjs');
    await executeNumerator({
      startNum: 1,
      endNum: 10,
      step: 1,
      digits: 4,
      prefix: 'TKT-',
      suffix: '',
      cols: 2,
      rows: 5,
      spacingX: 5,
      spacingY: 5,
      mode: 'grid',
      stackOrder: 'cut-stack',
      totalSheets: 1,
      replaceMode: 'auto-detect',
      manualPlaceholder: '{NO}',
      copiesPerNumber: 1
    });

    assert.ok(capturedScript.length > 0, 'Numerator must generate a PS script');
    validatePsAst(capturedScript, 'executeNumerator');
  } finally {
    psRunner.runPowerShellScript = originalRun;
  }
});

test('PowerShell AST - Cert Merger Service generated script parses with 0 errors', async () => {
  const psRunner = require('../electron/core/psRunner.cjs');
  let capturedScript = '';
  const originalRun = psRunner.runPowerShellScript;
  psRunner.runPowerShellScript = (script) => {
    capturedScript = script;
    return Promise.resolve({ success: true });
  };

  try {
    const { executeCertMerger } = require('../electron/services/certMergerService.cjs');
    await executeCertMerger({
      rows: [
        { 'Nama': 'Budi', 'Nomor': '001' },
        { 'Nama': 'Ani', 'Nomor': '002' }
      ],
      fieldMappings: [
        { field: 'Nama', placeholder: '{NAMA}' },
        { field: 'Nomor', placeholder: '{NO}' }
      ],
      outputMode: 'active-doc',
      pageSize: 'A4',
      orientation: 'landscape'
    });

    assert.ok(capturedScript.length > 0, 'Cert Merger must generate a PS script');
    validatePsAst(capturedScript, 'executeCertMerger');
  } finally {
    psRunner.runPowerShellScript = originalRun;
  }
});

test('PowerShell AST - Layout Pola Service generated script parses with 0 errors', async () => {
  const psRunner = require('../electron/core/psRunner.cjs');
  let capturedScript = '';
  const originalRun = psRunner.runPowerShellScript;
  psRunner.runPowerShellScript = (script) => {
    capturedScript = script;
    return Promise.resolve({ success: true });
  };

  try {
    const { executeLayoutPola } = require('../electron/services/layoutPolaService.cjs');
    await executeLayoutPola({
      gridCols: 2,
      gridRows: 2,
      gapX: 10,
      gapY: 10,
      includeBorder: false,
      rotation: 0
    });

    if (capturedScript) {
      validatePsAst(capturedScript, 'executeLayoutPola');
    }
  } finally {
    psRunner.runPowerShellScript = originalRun;
  }
});

test('PowerShell AST - Layout Service generated script parses with 0 errors', async () => {
  const psRunner = require('../electron/core/psRunner.cjs');
  let capturedScript = '';
  const originalRun = psRunner.runPowerShellScript;
  psRunner.runPowerShellScript = (script) => {
    capturedScript = script;
    return Promise.resolve({ success: true });
  };

  try {
    const { executeLayout } = require('../electron/services/layoutService.cjs');
    await executeLayout({
      targetSize: 'ALL',
      players: [
        { name: 'ALEXANDER', number: '10', size: 'L' },
        { name: 'CHRISTIAN', number: '07', size: 'XL' }
      ],
      spacingCm: 1.0,
      limitCopy: 4,
      direction: 'vertical'
    });

    assert.ok(capturedScript.length > 0, 'Layout Service must generate a PS script');
    validatePsAst(capturedScript, 'executeLayout');
  } finally {
    psRunner.runPowerShellScript = originalRun;
  }
});
