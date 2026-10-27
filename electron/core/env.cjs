/**
 * Environment Configuration Service
 * Separates Development, Production, and Test environments.
 */
const { app } = require('./electronBridge.cjs');

const NODE_ENV = process.env.NODE_ENV || (app && app.isPackaged ? 'production' : 'development');
const isDev = NODE_ENV === 'development';
const isProd = NODE_ENV === 'production' || (app && app.isPackaged);
const isTest = NODE_ENV === 'test' || process.env.NODE_ENV === 'test';
const isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE || !!process.env.PORTABLE_EXECUTABLE_DIR;

module.exports = {
  NODE_ENV,
  isDev,
  isProd,
  isTest,
  isPortable,
  getAppVersion: () => {
    try {
      if (app && typeof app.getVersion === 'function') {
        return app.getVersion();
      }
    } catch {}
    try {
      const pkg = require('../../package.json');
      return pkg.version;
    } catch {
      return '1.1.4';
    }
  }
};
