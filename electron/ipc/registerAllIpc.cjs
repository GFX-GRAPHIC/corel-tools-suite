/**
 * Master IPC Router
 * Mounts domain-isolated IPC modules cleanly without side-effects.
 */
const { registerWindowIpc } = require('./windowIpc.cjs');
const { registerLicenseIpc } = require('./licenseIpc.cjs');
const { registerNumeratorIpc } = require('./numeratorIpc.cjs');
const { registerLayoutIpc } = require('./layoutIpc.cjs');
const { registerLayoutPolaIpc } = require('./layoutPolaIpc.cjs');
const { registerCertMergerIpc } = require('./certMergerIpc.cjs');
const { registerConversionIpc } = require('./conversionIpc.cjs');
const { registerUtilityIpc } = require('./utilityIpc.cjs');
const { registerAiTracerIpc } = require('./aiTracerIpc.cjs');
const { registerCdrIpc } = require('./cdrIpc.cjs');
const { registerTutorialIpc } = require('./tutorialIpc.cjs');

function registerAllIpc() {
  registerWindowIpc();
  registerLicenseIpc();
  registerNumeratorIpc();
  registerLayoutIpc();
  registerLayoutPolaIpc();
  registerCertMergerIpc();
  registerConversionIpc();
  registerUtilityIpc();
  registerAiTracerIpc();
  registerCdrIpc();
  registerTutorialIpc();
}

module.exports = {
  registerAllIpc,
};
