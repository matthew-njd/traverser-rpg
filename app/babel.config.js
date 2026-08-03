/**
 * ↯ Not optional once there is a test runner, even though the app builds fine without it.
 *
 * Metro synthesises `babel-preset-expo` when no Babel config exists, which is why M0 shipped an app
 * with no `babel.config.js`. Jest does not: `babel-jest` looks for a real config file, finds none,
 * and falls back to a bare parser that chokes on the Flow annotations in React Native's own
 * `jest-preset` setup file — a syntax error inside `node_modules` that looks nothing like a missing
 * Babel config.
 *
 * `api.cache(true)` is the standard opt-in; the config depends on no environment variable, so a
 * permanent cache entry is correct.
 */
module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
  };
};
