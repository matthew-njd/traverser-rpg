import { AndroidConfig, type ConfigPlugin, withAndroidManifest } from 'expo/config-plugins';

/**
 * tech-03 §2 — the Android 14+ half of Health Connect's permission-rationale plumbing.
 *
 * §2 requires *two* rationale targets, because Health Connect changed how it locates the screen:
 *
 *   - Android 13 and below: an activity handling `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`.
 *   - Android 14 and up: an `<activity-alias android:name="ViewPermissionUsageActivity">` guarded by
 *     `android.permission.START_VIEW_PERMISSION_USAGE`, with a VIEW_PERMISSION_USAGE intent filter
 *     in the HEALTH_PERMISSIONS category.
 *
 * `react-native-health-connect`'s own `app.plugin.js` adds only the first one. This plugin adds the
 * second. Registering the library plugin alone leaves the entry that actually matters on the target
 * device missing — the Pixel is Android 14+, so the 13-and-below filter is the one that never fires.
 *
 * ↯ The failure mode is silent, which is why this is worth a plugin rather than a TODO. A missing
 * rationale target does not throw and does not fail the build: it makes the privacy-policy link in
 * Health Connect's own permission dialog dead. Nothing in the app observes it. Traverser sideloads,
 * so today that is only a broken link — but it is a Play-review rejection the day distribution
 * changes, and it rots invisibly until then.
 *
 * The alias targets MainActivity rather than a dedicated rationale activity: prebuild owns
 * `android/` (tech-04 §1.1), so a hand-written Kotlin `PermissionsRationaleActivity` would have to
 * be injected as a source file by yet another plugin. Routing to MainActivity is the same trade the
 * library's own plugin makes for the 13-and-below filter, and keeps the native project generated.
 */

/** Matches the `android:name` Health Connect looks for. Not a free choice — it is the contract. */
const ALIAS_NAME = 'ViewPermissionUsageActivity';

const withHealthConnectRationale: ConfigPlugin = (config) =>
  withAndroidManifest(config, (manifestConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);

    const aliases = (application['activity-alias'] ??= []);

    // prebuild without `--clean` re-runs plugins over the existing manifest, so guard against a
    // duplicate alias — the manifest merger rejects two aliases with the same name.
    if (aliases.some((alias) => alias.$?.['android:name'] === ALIAS_NAME)) {
      return manifestConfig;
    }

    aliases.push({
      $: {
        'android:name': ALIAS_NAME,
        'android:exported': 'true',
        'android:targetActivity': '.MainActivity',
        'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
          category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
        },
      ],
    });

    return manifestConfig;
  });

export default withHealthConnectRationale;
