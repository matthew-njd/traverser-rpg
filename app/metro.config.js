const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Metro's default assetExts has `wav` but not `ogg` (tech-04 §9.3).
config.resolver.assetExts.push('ogg');

module.exports = config;
