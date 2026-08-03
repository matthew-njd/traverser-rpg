import type { ExpoConfig } from 'expo/config';

// tech-06 §4.2. This file replaces app.json outright rather than spreading it: when both exist,
// app.config.ts wins and app.json is merged only where explicitly spread, so keeping a half-read
// app.json around is a trap. One file, no precedence question.
//
// ↯ tech-04 §1.1: this file (plus config plugins) IS the native project. `android/` is generated
// by prebuild and deleted by the next one, so editing AndroidManifest.xml or build.gradle by hand
// is writing to a temp directory. Every native-facing change lands here.

// ↯ Build-time, not runtime (tech-06 §4.2). Expo CLI loads `app/.env` and inlines EXPO_PUBLIC_*
// into the bundle when it builds. Changing the API host is `prebuild` + rebuild + reinstall, not a
// restart and not a Fast Refresh — tech-04 §3.2, and tech-06 §11 step 5 depends on it.
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) {
  // Failing here rather than defaulting is deliberate: a default would produce an app that builds,
  // installs, and then fails every sync at runtime on a device, which is the most expensive place
  // to discover a missing environment variable.
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL is not set. Copy app/.env.example to app/.env and fill it in.'
  );
}

const config: ExpoConfig = {
  name: 'Traverser',
  slug: 'traverser',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'traverser',
  userInterfaceStyle: 'automatic',
  // Android-only (CLAUDE.md) — the template's ios/web blocks are deliberately absent.
  android: {
    // ↯ PERMANENT. This is the app's identity to Android, and it cannot be changed after the first
    // install: a different package is a different app, so changing it means uninstall + reinstall,
    // and tech-04 §6.5 makes uninstall total — SQLite mirror, watermarks, and Health Connect grants
    // all go with it. Reverse-DNS by convention; Google verifies uniqueness, never domain ownership.
    package: 'com.oldroads.traverser',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // tech-03 §2 — exactly two, both read. No WRITE_* (Traverser is a read-only consumer and
    // should never hold a write permission it could be blamed for), no READ_HEALTH_DATA_IN_
    // BACKGROUND (§1.5 — sync is foreground-only), no READ_EXERCISE (§1.2 — we derive tiers from
    // heart-rate samples and never read exercise sessions; asking for an unused permission is a
    // worse onboarding conversion for no benefit).
    permissions: [
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_HEART_RATE',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        android: {
          // ↯ Health Connect's floor, not a preference. `androidx.health.connect:connect-client`
          // declares minSdk 26 and Expo's default is 24, so without this the manifest merger fails
          // the build outright. Android 8.0 excludes nothing that matters: Health Connect itself
          // needs 8.0+ on the installable-APK path and is only part of the OS from 14.
          minSdkVersion: 26,
        },
      },
    ],
    // Adds the Android 13-and-below rationale intent filter to MainActivity (tech-03 §2).
    'react-native-health-connect',
    // ...and this adds the Android 14+ half, which the library's plugin does not. Both are
    // required by §2; see the plugin's own header for why the omission is silent.
    './plugins/withHealthConnectRationale',
    // Excludes the encrypted token store from Android Auto Backup. ↯ Not cosmetic: SecureStore
    // values are Keystore-encrypted with a device-bound key, so a backed-up blob restored onto
    // another device is undecryptable — the app would hold a bearer token it can never read.
    // tech-06 §13.1's export is the supported recovery path; Auto Backup is not.
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      '@sentry/react-native',
      {
        // Not secrets — an org slug and a project name, and naming them here silences the plugin's
        // "Missing config for organization, project" warning on every build.
        organization: 'emde',
        project: 'traverser-app',
        // ↯ Source-map upload is off. Turning it on needs a SENTRY_AUTH_TOKEN in the build
        // environment plus the sentry-cli binary whose postinstall npm blocks by default — a
        // second credential to manage for a benefit that only appears in a *release* build, since
        // dev bundles are not minified. Revisit at M5 when a release APK is the artefact.
        disableAutoUpload: true,
      },
    ],
    // Local plugin, tech-06 §7.3 — repoints the release build type at the out-of-tree keystore.
    // Must stay registered: without it the template signs release with the regenerated debug key.
    './plugins/withReleaseSigning',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    // Read through expo-constants by src/env.ts, never by feature code (tech-06 §4.2).
    // Trailing slash stripped here so callers can join with a leading-slash path unconditionally.
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),

    // tech-06 §9.1's `traverser-app` DSN. Deliberately NOT required the way apiBaseUrl is: blank
    // disables capture, which is the documented "no Sentry account" path (§4.1).
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
    sentryEnvironment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
  },
};

export default config;
