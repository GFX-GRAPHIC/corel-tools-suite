/**
 * Structured Logger for Corel Tools Suite
 * Non-crashing, safe diagnostic logging
 */
const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

function info(tag, ...args) {
  console.log(`[INFO][${tag}]`, ...args);
}

function warn(tag, ...args) {
  console.warn(`[WARN][${tag}]`, ...args);
}

function error(tag, ...args) {
  console.error(`[ERROR][${tag}]`, ...args);
}

function debug(tag, ...args) {
  if (isDev) {
    console.log(`[DEBUG][${tag}]`, ...args);
  }
}

module.exports = {
  info,
  warn,
  error,
  debug,
};
